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
    await screen.findByRole('button', { name: /Alice/ })
    expect(screen.queryByRole('button', { name: /my-maker|Bob/ })).toBeNull()
    expect(screen.getByText('14,000 sat')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sell' }))
    expect(screen.getByRole('button', { name: /Bob/ })).toBeInTheDocument()
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
    await screen.findByRole('button', { name: 'Nostr profile and reputation' })
    expect(profiles).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Nostr relays (1)' }))
    expect(screen.getByText('wss://relay.example')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Manage relays' }))
    expect(manageRelays).toHaveBeenCalledOnce()
    fireEvent.click(
      screen.getByRole('button', { name: 'Nostr profile and reputation' })
    )
    expect(await screen.findByText(npub)).toBeInTheDocument()
    expect(profiles).toHaveBeenCalledWith([npub])
    fireEvent.click(screen.getByRole('button', { name: 'Sell' }))
    expect(screen.queryByText(npub)).not.toBeInTheDocument()
    expect(profiles).toHaveBeenCalledTimes(1)
  })

  it('opens a real limit ticket from My offers without publishing on entry', async () => {
    const { place } = openMarket()
    fireEvent.click(await screen.findByRole('button', { name: /My offers/ }))
    expect(
      screen.getByRole('button', { name: 'Cancel order' })
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Publish offer' })[0]!
    )
    const form = screen.getByRole('region', { name: 'Trade' })
    expect(
      within(form).getByRole('tab', { name: 'Buy DEMO' })
    ).toBeInTheDocument()
    expect(within(form).queryByRole('tab', { name: 'Market' })).toBeNull()
    expect(place).not.toHaveBeenCalled()
  })
})
