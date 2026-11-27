import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { marketApi } from '../../api'
import { demoBalance, demoInfo, demoOrder } from '../../preview/fixtures'
import { Market } from '../Market'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts: Record<string, string> = {}) =>
      (opts.defaultValue ?? key).replace(
        /{{(\w+)}}/g,
        (_, field) => opts[field] ?? ''
      ),
  }),
}))

afterEach(() => vi.restoreAllMocks())

function openMarket(npub?: string) {
  const expires = Math.floor(Date.now() / 1000) + 3600
  const sell = demoOrder('sell', {
    expiry: expires,
    maker: 'Alice',
    maker_npub: npub,
  })
  const buy = demoOrder('buy', { expiry: expires, maker: 'Bob' })
  const own = demoOrder('sell', {
    expiry: expires,
    maker: 'my-maker',
    mine: true,
    order_id: 'mine',
  })
  vi.spyOn(marketApi, 'info').mockResolvedValue({
    ...demoInfo(),
    relays: ['wss://relay.example'],
  })
  vi.spyOn(marketApi, 'balance').mockResolvedValue(demoBalance())
  vi.spyOn(marketApi, 'book').mockResolvedValue([sell, buy, own])
  vi.spyOn(marketApi, 'orders').mockResolvedValue([own])
  vi.spyOn(marketApi, 'trades').mockResolvedValue([])
  vi.spyOn(marketApi, 'asset').mockResolvedValue(null)
  const take = vi.spyOn(marketApi, 'take').mockResolvedValue({})
  const place = vi.spyOn(marketApi, 'placeOrder').mockResolvedValue(own)
  const manageRelays = vi.fn()
  render(<Market onManageRelays={manageRelays} />)
  return { buy, manageRelays, place, take }
}

describe('P2P market', () => {
  it('shows the opposite side of the book and reviews the original terms before taking an offer', async () => {
    const { buy, take } = openMarket()
    const ask = await screen.findByRole('button', { name: /Alice/ })
    const book = within(screen.getByRole('region', { name: 'Order book' }))
    expect(book.getByRole('heading', { name: /Sell orders/ })).toBeVisible()
    expect(book.getByRole('heading', { name: /Buy orders/ })).toBeVisible()
    expect(book.getByRole('button', { name: /Bob/ })).toBeVisible()
    expect(book.getByTitle('Your order')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Review swap' })).toBeNull()
    fireEvent.click(ask)
    expect(screen.getByText('14,000 sat')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('button', { name: 'Review swap' })).toBeNull()
    fireEvent.click(ask)
    fireEvent.click(screen.getByRole('button', { name: /Bob/ }))
    expect(screen.getByText('3,000 sat')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Review swap' }))
    expect(take).not.toHaveBeenCalled()
    const confirm = await screen.findByRole('button', { name: 'Confirm sale' })
    await act(async () => {
      fireEvent.click(confirm)
    })
    expect(take).toHaveBeenCalledWith(buy, expect.any(Object))
  })

  it('shows configured Nostr relays and fetches a maker profile only on request', async () => {
    const npub = 'npub1makeridentity'
    const profiles = vi.spyOn(marketApi, 'makers').mockResolvedValue([])
    const { manageRelays } = openMarket(npub)
    const ask = await screen.findByRole('button', { name: /npub/ })
    expect(profiles).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Relays (1)' }))
    expect(manageRelays).toHaveBeenCalledOnce()
    fireEvent.click(ask)
    fireEvent.click(
      screen.getByRole('button', { name: 'Nostr profile and reputation' })
    )
    expect(await screen.findByText(npub)).toBeInTheDocument()
    expect(profiles).toHaveBeenCalledWith([npub])
    fireEvent.click(screen.getByRole('button', { name: /Bob/ }))
    expect(screen.queryByText(npub)).not.toBeInTheDocument()
    expect(profiles).toHaveBeenCalledTimes(1)
  })

  it('keeps wallet orders under the book and opens the limit ticket without publishing', async () => {
    const { place } = openMarket()
    expect(
      await screen.findByRole('tab', { name: /Open orders/ })
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Cancel order' })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Publish offer' }))
    const form = screen.getByRole('region', { name: 'Trade' })
    expect(
      within(form).getByRole('tab', { name: 'Buy DEMO' })
    ).toBeInTheDocument()
    expect(within(form).queryByRole('tab', { name: 'Market' })).toBeNull()
    expect(place).not.toHaveBeenCalled()
  })
})
