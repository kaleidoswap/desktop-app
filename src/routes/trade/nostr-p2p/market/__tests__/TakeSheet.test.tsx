import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Info, Order } from '../../api'
import { TakeSheet } from '../TakeSheet'

const take = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) =>
      opts?.defaultValue ?? _key,
  }),
}))
vi.mock('../../api', async () => {
  const actual = await vi.importActual<typeof import('../../api')>('../../api')
  return {
    ...actual,
    marketApi: {
      asset: vi.fn(async () => null),
      take,
    },
  }
})

const order = (): Order => ({
  amount: 1000,
  asset_id: 'rgb:demo',
  away: false,
  expiry: 0,
  impersonates: null,
  last_seen: Math.floor(Date.now() / 1000),
  maker: 'alice',
  mine: false,
  name: 'Demo',
  network_fee_sat: 1000,
  order_id: 'order-1',
  platform_fee_sat: 500,
  precision: 0,
  price_sat: 50_000,
  registry: null,
  rgb_output_sat: 1000,
  side: 'sell',
  state: 'open',
  ticker: 'DEMO',
  unit_price: 50,
  verified: true,
})

const info = (): Info => ({
  address: 'bcrt1q',
  dev: true,
  fee_bps: 10,
  min_confirmations: 1,
  min_fee_sat: 1,
  name: 'wallet-signetcustom',
  network: 'signetcustom',
  network_fee_sat: 1000,
  npub: 'npub1example',
  registry: null,
  registry_assets: 0,
  relays: [],
  taker_wait_secs: 600,
})

const renderSheet = () =>
  render(
    <TakeSheet
      info={info()}
      onChanged={vi.fn()}
      onClose={vi.fn()}
      orders={[order()]}
      trades={[]}
    />
  )

const deferred = () => {
  let settle: (value: unknown) => void = () => undefined
  let fail: (reason: unknown) => void = () => undefined
  const promise = new Promise((resolve, reject) => {
    settle = resolve
    fail = reject
  })
  return { fail, promise, settle }
}

describe('take progress', () => {
  it('shows Requested while take() is still in flight', async () => {
    const pending = deferred()
    take.mockImplementation(() => pending.promise)
    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm purchase' }))
    expect(
      await screen.findByText('Waiting for the other side to answer')
    ).toBeInTheDocument()
    expect(take).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByRole('button', { name: 'Confirm purchase' })
    ).not.toBeInTheDocument()
    pending.settle({})
  })

  it('returns to the receipt when the take is refused before a trade exists', async () => {
    const pending = deferred()
    take.mockImplementation(() => pending.promise)
    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm purchase' }))
    expect(
      await screen.findByText('Waiting for the other side to answer')
    ).toBeInTheDocument()
    pending.fail(new Error('order gone'))
    expect(
      await screen.findByRole('button', { name: 'Confirm purchase' })
    ).toBeInTheDocument()
  })
})
