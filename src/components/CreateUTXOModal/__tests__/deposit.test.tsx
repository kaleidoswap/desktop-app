import { useState } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LayoutModal } from '../../Layout/Modal'
import { CreateUTXOModal } from '..'

const mocks = vi.hoisted(() => ({
  balance: 10000,
  create: vi.fn(),
  dispatch: vi.fn(),
  estimate: vi.fn(),
  getBalance: vi.fn(),
  retry: vi.fn(),
}))
vi.mock('../../../app/store/hooks', () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: () => ({ type: 'deposit' }),
}))
vi.mock('../../../slices/ui/ui.slice', () => ({
  uiSliceActions: { setModal: (payload: unknown) => payload },
  uiSliceSeletors: { modal: vi.fn() },
}))
vi.mock('../../../slices/nodeApi/nodeApi.slice', () => ({
  nodeApi: {
    endpoints: {
      btcBalance: {
        useLazyQuery: () => [
          mocks.getBalance,
          { data: { vanilla: { spendable: mocks.balance } } },
        ],
      },
    },
    useCreateUtxosMutation: () => [mocks.create],
    useLazyEstimateFeeQuery: () => [mocks.estimate],
  },
}))
vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))
vi.mock('../../ui', async () => ({
  ...(await import('../../ui/Button')),
}))
vi.mock('../../Layout/Modal/Content', () => ({
  Content: () => {
    const [isOpen, setIsOpen] = useState(true)
    return (
      <CreateUTXOModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={vi.fn()}
        operationType="issuance"
        retryFunction={mocks.retry}
      />
    )
  },
}))

afterEach(() => {
  cleanup()
  document.getElementById('modal-portal')?.remove()
})
beforeEach(() => {
  vi.clearAllMocks()
  mocks.balance = 10000
  mocks.create.mockReturnValue({ unwrap: () => Promise.resolve() })
  mocks.estimate.mockReturnValue({
    unwrap: () => Promise.resolve({ fee_rate: 0.4 }),
  })
  mocks.retry.mockResolvedValue(undefined)
})

describe('colored UTXOs inside the deposit modal', () => {
  it('keeps deposit open while editing settings, creates UTXOs and retries the invoice', async () => {
    const user = userEvent.setup()
    const portal = document.createElement('div')
    portal.id = 'modal-portal'
    document.body.appendChild(portal)
    render(<LayoutModal />)
    await user.click(screen.getByRole('button', { name: 'Advanced Settings' }))
    expect(screen.getByText('Number of UTXOs')).toBeVisible()
    expect(mocks.dispatch).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Create UTXOs' }))
    expect(mocks.dispatch).not.toHaveBeenCalled()
    expect(mocks.create).toHaveBeenCalledWith({
      fee_rate: 1,
      num: 1,
      size: 3000,
      up_to: false,
    })
    await waitFor(() => expect(mocks.retry).toHaveBeenCalledOnce())
  })

  it('shows zero spendable BTC and explains why creation is disabled', async () => {
    mocks.balance = 0
    render(<LayoutModal />)
    expect(screen.getByText('Available BTC: 0 sats')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Insufficient spendable BTC'
    )
    expect(screen.getByRole('button', { name: 'Create UTXOs' })).toBeDisabled()
    await userEvent.click(
      screen.getByRole('button', { name: 'Advanced Settings' })
    )
    expect(screen.getByText('Number of UTXOs')).toBeVisible()
    expect(mocks.dispatch).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('allows reducing the output count to fit the spendable balance', async () => {
    mocks.balance = 6000
    const user = userEvent.setup()
    render(<LayoutModal />)
    await user.click(screen.getByRole('button', { name: 'Advanced Settings' }))
    const count = screen.getAllByRole('spinbutton')[0]
    await user.clear(count)
    await user.type(count, '3')
    expect(screen.getByRole('button', { name: 'Create UTXOs' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Insufficient spendable BTC'
    )
    await user.clear(count)
    expect(screen.getByRole('button', { name: 'Create UTXOs' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Create UTXOs' }))
    expect(mocks.create).toHaveBeenCalledWith({
      fee_rate: 1,
      num: 1,
      size: 3000,
      up_to: false,
    })
  })

  it('shows node failures inline and allows retrying', async () => {
    mocks.create.mockReturnValueOnce({
      unwrap: () =>
        Promise.reject({
          data: { error: 'Insufficient bitcoins for transaction fees' },
        }),
    })
    render(<LayoutModal />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create UTXOs' })).toBeEnabled()
    )
    await userEvent.click(screen.getByRole('button', { name: 'Create UTXOs' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Insufficient bitcoins for transaction fees'
    )
    expect(mocks.retry).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Create UTXOs' }))
    await waitFor(() => expect(mocks.retry).toHaveBeenCalledOnce())
  })

  it('closes deposit only when its own backdrop is clicked', async () => {
    render(<LayoutModal />)
    await userEvent.click(screen.getByText('Create Colored UTXOs'))
    expect(mocks.dispatch).not.toHaveBeenCalled()
    const title = screen.getByText('Create Colored UTXOs')
    const utxoBackdrop = title.parentElement!.parentElement!.parentElement!
    await userEvent.click(utxoBackdrop)
    expect(mocks.dispatch).not.toHaveBeenCalled()
    const depositBackdrop = document.querySelector('.pointer-events-auto')!
    await userEvent.click(depositBackdrop)
    expect(mocks.dispatch).toHaveBeenCalledWith({ type: 'none' })
  })
})
