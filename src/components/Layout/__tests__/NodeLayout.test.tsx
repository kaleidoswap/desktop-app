import { fireEvent, render, screen, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeAll, beforeEach, expect, it, vi } from 'vitest'

import { store } from '../../../app/store'
import { getWalletOverride } from '../../../api/wallet-override'
import { i18n } from '../../../i18n'
import { Component as NodeHistory } from '../../../routes/wallet-history'
import {
  Component as NodeP2pRoute,
  P2pMarketPage,
} from '../../../routes/trade/nostr-p2p'
import * as desktopNetworks from '../../../routes/p2p-home/networks'
import { useP2pWalletSession } from '../../../routes/trade/nostr-p2p/session'
import { setNodeReachability } from '../../../slices/node/node.slice'
import { nodeSettingsActions } from '../../../slices/nodeSettings/nodeSettings.slice'
import { setAppMode } from '../../../slices/settings/settings.slice'
import { Layout } from '..'
import { TradeNav } from '../../Trade/TradeNav'

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))
vi.mock('../../AppVersion', () => ({ AppVersion: () => null }))
vi.mock('../../../hooks/useDcaScheduler', () => ({ useDcaScheduler: vi.fn() }))
vi.mock('../../../hooks/useLimitOrderScheduler', () => ({
  useLimitOrderScheduler: vi.fn(),
}))
vi.mock('../../../hooks/useNwcAutostart', () => ({ useNwcAutostart: vi.fn() }))
vi.mock('../../../hooks/useNodeLifecycleEvents', () => ({
  useNodeLifecycleEvents: vi.fn(),
}))
vi.mock('../../../hooks/useNodeReachabilityMonitor', () => ({
  useNodeReachabilityMonitor: vi.fn(),
}))
vi.mock('../../../routes/trade/nostr-p2p/session', async (original) => {
  const session =
    await original<typeof import('../../../routes/trade/nostr-p2p/session')>()
  return { ...session, useP2pWalletSession: vi.fn(session.useP2pWalletSession) }
})

beforeAll(async () => {
  await i18n.changeLanguage('en')
})
beforeEach(() => {
  store.dispatch(
    nodeSettingsActions.setNodeSettings({
      name: 'Test node',
      network: 'SignetCustom',
    })
  )
  store.dispatch(setNodeReachability({ status: 'unreachable' }))
  store.dispatch(setAppMode('both'))
})

function renderRoute(path: string, child = <article>Test page</article>) {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <Layout>{child}</Layout>
      </MemoryRouter>
    </Provider>
  )
}

it.each([
  ['/order-new-channel', 'Channels', '/channels'],
  ['/nwc', 'App Connections', '/nwc'],
])('keeps the global and contextual selections on %s', (path, label, href) => {
  renderRoute(path)
  const primary = screen.getByLabelText(i18n.t('p2pShell.menu'), {
    selector: 'nav',
  })
  expect(primary.querySelector('a[aria-current="page"]')).toHaveTextContent(
    'Lightning node'
  )
  const sidebar = within(primary)
  expect(sidebar.getByRole('link', { name: 'Wallet' })).toHaveAttribute(
    'href',
    '/wallet-dashboard'
  )
  expect(sidebar.getByRole('link', { name: 'Lightning node' })).toHaveAttribute(
    'href',
    '/channels'
  )
  expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull()
  const secondary = screen.getByLabelText('Lightning node', { selector: 'nav' })
  const activeLinks = secondary.querySelectorAll('a[aria-current="page"]')
  expect(activeLinks).toHaveLength(1)
  expect(activeLinks[0]).toHaveTextContent(label)
  expect(activeLinks[0]).toHaveAttribute('href', href)
})

it('shows node history deep links in Activity with the original transaction tabs', () => {
  renderRoute('/wallet-history/channel-orders', <NodeHistory />)
  const primary = within(
    screen.getByRole('navigation', { name: i18n.t('p2pShell.menu') })
  )
  expect(primary.getByRole('link', { name: 'Activity' })).toHaveAttribute(
    'aria-current',
    'page'
  )
  expect(primary.getByRole('link', { name: 'Activity' })).toHaveAttribute(
    'href',
    '/wallet-history/deposits'
  )
  const filters = within(screen.getByRole('navigation', { name: 'Activity' }))
  expect(filters.getByRole('link', { name: 'Channel Orders' })).toHaveAttribute(
    'aria-current',
    'page'
  )
  expect(filters.getAllByRole('link')).toHaveLength(5)
  expect(screen.queryByRole('link', { name: 'History' })).toBeNull()
})

it('opens a legacy Nostr market link in Markets while preserving its wallet backend', () => {
  renderRoute('/nostr-p2p', <P2pMarketPage />)
  const primary = within(
    screen.getByRole('navigation', { name: i18n.t('p2pShell.menu') })
  )
  expect(primary.getByRole('link', { name: /Markets/ })).toHaveAttribute(
    'aria-current',
    'page'
  )
  const venues = within(screen.getByRole('navigation', { name: 'Markets' }))
  expect(venues.getByText(i18n.t('unified.nostrVenue'))).toHaveAttribute(
    'aria-current',
    'page'
  )
  expect(venues.getByRole('link', { name: /Market Maker/ })).toHaveAttribute(
    'href',
    '/market-maker'
  )
  expect(useP2pWalletSession).toHaveBeenCalledWith(false)
  expect(getWalletOverride()).toBeNull()
})

it('groups Lightning orders with the market maker', () => {
  renderRoute('/limit-orders', <TradeNav />)
  const primary = within(
    screen.getByRole('navigation', { name: i18n.t('p2pShell.menu') })
  )
  expect(primary.getByRole('link', { name: /Markets/ })).toHaveAttribute(
    'aria-current',
    'page'
  )
  expect(
    screen.queryByRole('navigation', { name: 'Lightning node' })
  ).toBeNull()
  expect(
    screen.getByRole('link', { name: i18n.t('navigation.limitOrders') })
  ).toHaveAttribute('aria-current', 'page')
})

it('opens transfers from Trading on the node network and exposes the marketplace once', () => {
  const networks = vi
    .spyOn(desktopNetworks, 'useDesktopTestNetworks')
    .mockReturnValue([
      { key: 'SignetCustom', label: 'Mutinynet', network: 'signetcustom' },
    ])
  try {
    renderRoute(
      '/market-maker',
      <Routes>
        <Route element={<TradeNav />} path="/market-maker" />
        <Route element={<NodeP2pRoute />} path="/nostr-p2p" />
      </Routes>
    )
    const tradeTabs = within(
      screen.getByRole('navigation', { name: 'Trading' })
    )
    expect(tradeTabs.queryByRole('link', { name: /Nostr P2P/i })).toBeNull()
    const transfers = tradeTabs.getByRole('link', {
      name: i18n.t('navigation.p2pTransfers'),
    })
    expect(transfers).toHaveAttribute('href', '/nostr-p2p?funds=1')
    fireEvent.click(transfers)
    expect(useP2pWalletSession).toHaveBeenLastCalledWith(false, 'SignetCustom')
    expect(screen.getAllByRole('link', { name: /Nostr P2P/i })).toHaveLength(1)
  } finally {
    networks.mockRestore()
  }
})

it('keeps Mind available without a node and switches between Brain and Chat', () => {
  store.dispatch(nodeSettingsActions.resetNodeSettings())
  store.dispatch(setAppMode('mind'))
  renderRoute('/kaleido-mind/skills')
  const primary = within(
    screen.getByRole('navigation', { name: i18n.t('p2pShell.menu') })
  )
  expect(
    primary.getByRole('link', { name: /KaleidoMind.*Beta/i })
  ).toHaveAttribute('aria-current', 'page')
  expect(primary.getByRole('link', { name: 'Settings' })).not.toHaveAttribute(
    'href',
    '/settings'
  )
  expect(
    screen.queryByRole('button', { name: 'Deposit' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Withdraw' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByText(i18n.t('nodeReachability.unresponsiveTitle'))
  ).not.toBeInTheDocument()
  const mind = within(screen.getByRole('navigation', { name: 'KaleidoMind' }))
  expect(mind.getByRole('link', { name: 'Brain' })).toHaveAttribute(
    'aria-current',
    'page'
  )
  fireEvent.click(mind.getByRole('link', { name: 'Chat' }))
  expect(mind.getByRole('link', { name: 'Chat' })).toHaveAttribute(
    'aria-current',
    'page'
  )
})

it('opens support inside the node content and keeps the workspace menu available', () => {
  renderRoute('/wallet-dashboard')
  const primary = within(
    screen.getByRole('navigation', { name: i18n.t('p2pShell.menu') })
  )
  const content = document.getElementById('content-area')!
  expect(content).toContainElement(
    screen.getByText(i18n.t('nodeReachability.unresponsiveTitle'))
  )
  expect(content).toContainElement(document.getElementById('modal-portal'))
  expect(content).not.toContainElement(
    primary.getByRole('link', { name: 'Wallet' })
  )
  fireEvent.click(
    primary.getByRole('button', { name: i18n.t('navigation.helpSupport') })
  )
  const portal = within(document.getElementById('modal-portal')!)
  expect(
    portal.getByRole('heading', { name: i18n.t('supportModal.title') })
  ).toBeInTheDocument()
  expect(portal.queryByRole('navigation')).not.toBeInTheDocument()
  expect(primary.getByRole('link', { name: 'Wallet' })).toHaveAttribute(
    'href',
    '/wallet-dashboard'
  )
  expect(primary.getByRole('link', { name: 'Wallet' })).toHaveAttribute(
    'aria-current',
    'page'
  )
  expect(
    screen.queryByRole('navigation', { name: 'Lightning node' })
  ).toBeNull()
})
