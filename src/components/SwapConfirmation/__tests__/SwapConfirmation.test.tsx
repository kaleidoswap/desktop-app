import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SwapConfirmation } from '../index'
vi.mock('../../Trade', () => ({
  AssetOption: ({ ticker }: { ticker: string }) => <span>{ticker}</span>,
}))
vi.mock('../../../helpers/modalPortal', () => ({
  getModalPortalTarget: () => document.body,
  getModalPositionClass: () => 'fixed',
}))
vi.mock('../../../helpers/number', () => ({
  calculateAndFormatRate: () => '0.001',
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
const props = {
  bitcoinUnit: 'SAT',
  canConfirm: true,
  exchangeRate: 0.001,
  fromAmount: '100',
  fromAsset: 'BTC',
  getAssetPrecision: () => 8,
  isOpen: true,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  selectedPair: null,
  toAmount: '0.1',
  toAsset: 'USDT',
}
describe('swap confirmation', () => {
  it('blocks an expired quote even after the confirmation was opened', () => {
    const confirm = vi.fn()
    const { rerender } = render(
      <SwapConfirmation {...props} onConfirm={confirm} />
    )
    rerender(
      <SwapConfirmation {...props} canConfirm={false} onConfirm={confirm} />
    )
    expect(screen.getByRole('button', { name: 'Confirm Swap' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Swap' }))
    expect(confirm).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('ux.quoteUnavailable')
  })
  it('blocks repeated confirmation and dismissal while submission is running', () => {
    const confirm = vi.fn(),
      close = vi.fn()
    render(
      <SwapConfirmation
        {...props}
        isLoading
        onClose={close}
        onConfirm={confirm}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Confirming...' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(confirm).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
  })
})
