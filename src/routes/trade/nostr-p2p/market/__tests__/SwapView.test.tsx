import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { marketApi } from '../../api'
import { nostrProfiles } from '../../nostrProfiles'
import { demoBalance, demoInfo, demoOrder } from '../../preview/fixtures'
import { SwapView } from '../SwapView'

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

function openSwap(npub = demoInfo().npub) {
  const ask = demoOrder('sell', { precision: 2, unit_price: 10000 })
  const bid = demoOrder('buy', { precision: 2, unit_price: 10000 })
  const balance = demoBalance()
  balance.assets[0].precision = 2
  vi.spyOn(marketApi, 'info').mockResolvedValue({ ...demoInfo(), npub })
  vi.spyOn(marketApi, 'book').mockResolvedValue([ask, bid])
  vi.spyOn(marketApi, 'balance').mockResolvedValue(balance)
  vi.spyOn(marketApi, 'trades').mockResolvedValue([])
  vi.spyOn(marketApi, 'asset').mockResolvedValue(null)
  const take = vi.spyOn(marketApi, 'take').mockResolvedValue({})
  render(<SwapView onShowOffers={() => {}} />)
  return { ask, take }
}
describe('simple P2P swap', () => {
  it('edits both fields, switches direction through either selector and applies percentages only to funds paid', async () => {
    const { take } = openSwap()
    const pay = await screen.findByRole('textbox', { name: 'You pay' })
    const get = screen.getByRole('textbox', { name: 'You get' })
    fireEvent.change(pay, { target: { value: '15000' } })
    expect(get).toHaveValue('1')
    expect(
      screen.getByText('Whole offers fill 14,000 sats → 1 DEMO.')
    ).toBeVisible()
    fireEvent.change(get, { target: { value: '1,00' } })
    expect(pay).toHaveValue('14000')
    expect(screen.getAllByRole('button', { name: '25%' })).toHaveLength(1)
    fireEvent.click(
      screen.getByRole('button', { name: /Choose the asset to pay with/ })
    )
    const picker = screen.getByRole('dialog')
    fireEvent.click(
      within(picker).getByRole('button', { name: /DEMO.*Demo asset/ })
    )
    const sell = screen.getByRole('textbox', { name: 'You pay' })
    const proceeds = screen.getByRole('textbox', { name: 'You get' })
    fireEvent.change(proceeds, { target: { value: '10000' } })
    expect(sell).toHaveValue('1')
    fireEvent.change(sell, { target: { value: '1' } })
    expect(proceeds).toHaveValue('10000')
    fireEvent.click(screen.getByRole('button', { name: '25%' }))
    expect(sell).toHaveValue('2.5')
    fireEvent.click(
      screen.getByRole('button', { name: /Choose the asset to receive/ })
    )
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: /DEMO.*Demo asset/,
      })
    )
    expect(
      screen.getByRole('button', { name: /Choose the asset to pay with · BTC/ })
    ).toBeVisible()
    expect(take).not.toHaveBeenCalled()
  })

  it('clears the quote and reads the new signer when switching Nostr profiles from the swap header', async () => {
    const original =
      'npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d'
    const next =
      'npub1ccz8l9zpa47k6vz9gphftsrumpw80rjt3nhnefat4symjhrsnmjs38mnyd'
    const profiles = [
      { label: null, npub: original },
      { label: 'Orange', npub: next },
    ]
    vi.spyOn(nostrProfiles, 'list').mockResolvedValue({
      active: original,
      profiles,
      supported: true,
    })
    vi.spyOn(nostrProfiles, 'select').mockImplementation(async () => {
      vi.mocked(marketApi.info).mockResolvedValue({ ...demoInfo(), npub: next })
      return { active: next, profiles, supported: true }
    })
    const { take } = openSwap(original)
    const input = await screen.findByRole('textbox', { name: 'You get' })
    fireEvent.change(input, { target: { value: '1' } })
    expect(screen.getByRole('button', { name: 'Review swap' })).toBeEnabled()
    fireEvent.click(
      screen.getByRole('button', { name: 'p2pMarket.profiles.title' })
    )
    const profile = await within(screen.getByRole('dialog')).findByRole(
      'button',
      { name: 'p2pMarket.profiles.switch' }
    )
    fireEvent.click(profile)
    await vi.waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'You get' })).toHaveValue('')
    )
    expect(nostrProfiles.select).toHaveBeenCalledWith(original, next)
    expect(marketApi.info).toHaveBeenCalledTimes(2)
    expect(take).not.toHaveBeenCalled()
  })

  it('confirms only the frozen terms after a book update', async () => {
    const { ask, take } = openSwap()
    const receive = await screen.findByRole('textbox', { name: 'You get' })
    fireEvent.change(receive, { target: { value: '2' } })
    expect(screen.getByRole('button', { name: 'Review swap' })).toBeDisabled()
    fireEvent.change(receive, { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Review swap' }))
    const original = { ...ask }
    ask.price_sat = 12000
    expect(take).not.toHaveBeenCalled()
    await act(async () =>
      fireEvent.click(
        await screen.findByRole('button', { name: 'Confirm purchase' })
      )
    )
    expect(take).toHaveBeenCalledWith(original, expect.any(Object))
  })
})
