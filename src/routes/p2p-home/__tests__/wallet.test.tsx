import { fireEvent, render, screen, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'

import { store } from '../../../app/store'
import { i18n } from '../../../i18n'
import { P2P_TRADE_PATH } from '../../../app/router/paths'
import { marketApi } from '../../trade/nostr-p2p/api'
import { demoBalance, demoInfo } from '../../trade/nostr-p2p/preview/fixtures'
import { Component } from '../wallet'

vi.mock('../../trade/nostr-p2p/session', () => ({
  useP2pSession: () => ({
    account: 'fixture',
    config: { faucet_url: 'https://example.test', network: 'signet' },
    walletId: '',
    wallets: [{ id: '', label: 'Alice' }],
  }),
}))

it('shows a test faucet only for verified empty funds and preserves the on-chain actions', async () => {
  await i18n.changeLanguage('en')
  const empty = { assets: [], btc_spendable_sat: 0 }
  const loaded = demoBalance()
  const [asset] = loaded.assets
  const balance = vi
    .spyOn(marketApi, 'balance')
    .mockRejectedValueOnce(new Error('Balance unavailable'))
    .mockResolvedValueOnce(empty)
    .mockResolvedValueOnce({ ...empty, btc_pending_sat: 25 })
    .mockResolvedValue({
      ...loaded,
      assets: [
        { ...asset, precision: 2, schema: 'BFA', spendable: 800, total: 1250 },
      ],
    })
  vi.spyOn(marketApi, 'info').mockResolvedValue(demoInfo())
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/p2p/wallet']}>
        <Routes>
          <Route element={<Component />} path="/p2p/wallet" />
          <Route element={<p>Market opened</p>} path={P2P_TRADE_PATH} />
        </Routes>
      </MemoryRouter>
    </Provider>
  )
  expect(screen.getByRole('status')).toHaveTextContent(i18n.t('common.loading'))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Balance unavailable'
  )
  const faucet = () =>
    screen.queryByRole('button', { name: i18n.t('p2pHome.faucetButton') })
  expect(faucet()).toBeNull()
  expect(screen.queryByText('0 sats')).toBeNull()
  fireEvent.click(
    screen.getByRole('button', { name: i18n.t('p2pMarket.retry') })
  )
  expect(await screen.findByText('0 sats')).toBeVisible()
  expect(faucet()).toBeVisible()
  expect(screen.getByRole('status')).toHaveTextContent(
    i18n.t('p2pHome.noAssets')
  )

  const refresh = screen.getByRole('button', {
    name: i18n.t('dashboard.refresh'),
  })
  fireEvent.click(refresh)
  expect(
    await screen.findByText(i18n.t('p2pWallet.pending', { sats: '25' }))
  ).toBeVisible()
  expect(faucet()).toBeNull()
  fireEvent.click(refresh)
  const row = within(await screen.findByRole('row', { name: /DEMO/ }))
  expect(row.getByText(/BFA/)).toBeVisible()
  expect(row.getByRole('cell', { name: '12.5' })).toBeVisible()
  expect(row.getByRole('cell', { name: '8' })).toBeVisible()
  expect(row.queryByRole('button', { name: /send/i })).toBeNull()
  fireEvent.click(row.getByRole('button', { name: 'Receive · DEMO' }))
  expect(store.getState().ui.modal).toEqual({
    assetId: asset.asset_id,
    type: 'deposit',
  })
  fireEvent.click(screen.getByRole('button', { name: i18n.t('p2pHome.send') }))
  expect(store.getState().ui.modal).toEqual({
    assetId: undefined,
    type: 'withdraw',
  })
  expect(screen.getByText(i18n.t('p2pWallet.identity'))).toBeVisible()
  expect(faucet()).toBeNull()
  expect(balance).toHaveBeenCalledTimes(4)
  fireEvent.click(
    screen.getByRole('button', { name: i18n.t('unified.market') })
  )
  expect(screen.getByText('Market opened')).toBeVisible()
})
