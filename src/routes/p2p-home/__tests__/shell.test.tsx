import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Provider } from 'react-redux'
import { expect, it, vi } from 'vitest'

import { i18n } from '../../../i18n'
import { store } from '../../../app/store'
import { nodeSettingsActions } from '../../../slices/nodeSettings/nodeSettings.slice'
import { Component, MainnetShell } from '..'
import {
  P2pSessionProvider,
  useOptionalP2pSession,
} from '../../trade/nostr-p2p/session'

vi.mock('../../../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('../../../components/Layout/DesktopFrame', () => ({
  DesktopFrame: ({
    title,
    children,
    secondaryNav,
  }: {
    title?: string
    children: ReactNode
    secondaryNav?: ReactNode
  }) => (
    <>
      {title && <h1>{title}</h1>}
      {secondaryNav}
      {children}
    </>
  ),
}))
vi.mock('../../trade/nostr-p2p/session', () => ({
  P2pSessionProvider: vi.fn(
    ({ children }: { children: ReactNode }) => children
  ),
  isTauri: () => true,
  useOptionalP2pSession: vi.fn(() => null),
}))

it('opens direct links to the node chooser without starting a trading wallet session', async () => {
  await i18n.changeLanguage('en')
  render(
    <MemoryRouter initialEntries={['/P2P/NODE/']}>
      <Component />
    </MemoryRouter>
  )
  expect(screen.getByRole('heading', { name: 'Lightning node' })).toBeVisible()
  expect(P2pSessionProvider).not.toHaveBeenCalled()
})

it.each([true, false])(
  'opens the Lightning venue with matching node %s without starting the trading wallet',
  async (matches) => {
    await i18n.changeLanguage('en')
    store.dispatch(
      nodeSettingsActions.setNodeSettings({
        name: 'Example',
        network: matches ? 'Mainnet' : 'Signet',
      })
    )
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/mainnet/market?venue=lightning']}>
          <Routes>
            <Route element={<MainnetShell />} path="/mainnet/market" />
            <Route element={<p>Lightning RFQ</p>} path="/market-maker" />
          </Routes>
        </MemoryRouter>
      </Provider>
    )
    if (matches) expect(await screen.findByText('Lightning RFQ')).toBeVisible()
    else {
      expect(
        screen.getByRole('link', { name: i18n.t('launcher.cards.remote') })
      ).toHaveAttribute('href', '/mainnet/node')
      expect(
        screen.getByRole('link', { name: i18n.t('unified.nostrVenue') })
      ).toHaveAttribute('href', '/mainnet/market')
    }
    expect(P2pSessionProvider).not.toHaveBeenCalled()
  }
)

it.each([true, false])(
  'offers only the same-chain node while the trading wallet needs setup (match %s)',
  async (matches) => {
    await i18n.changeLanguage('en')
    const config = { key: 'Signet', label: 'Signet', network: 'signet' }
    const session = vi.mocked(useOptionalP2pSession, { partial: true })
    session.mockReturnValue({
      config,
      networks: [config],
      options: [config],
      phase: 'setup',
    })
    try {
      store.dispatch(
        nodeSettingsActions.setNodeSettings({
          name: 'Example',
          network: matches ? 'Signet' : 'SignetCustom',
        })
      )
      render(
        <Provider store={store}>
          <MemoryRouter initialEntries={['/p2p/wallet']}>
            <Routes>
              <Route element={<Component />} path="/p2p/wallet">
                <Route element={<p>Unlocked wallet balance</p>} index />
              </Route>
              <Route element={<p>Node balances</p>} path="/wallet-dashboard" />
            </Routes>
          </MemoryRouter>
        </Provider>
      )
      expect(screen.queryByText('Unlocked wallet balance')).toBeNull()
      expect(screen.getByRole('heading', { name: 'Wallet' })).toBeVisible()
      const sources = screen.queryByRole('navigation', {
        name: 'Wallet source',
      })
      if (matches) {
        expect(sources).toBeVisible()
        const nav = within(sources!)
        expect(nav.getByText('On-chain wallet')).toHaveAttribute(
          'aria-current',
          'page'
        )
        fireEvent.click(nav.getByRole('link', { name: 'Lightning node' }))
        expect(screen.getByText('Node balances')).toBeVisible()
      } else expect(sources).toBeNull()
    } finally {
      session.mockReturnValue(null)
    }
  }
)
