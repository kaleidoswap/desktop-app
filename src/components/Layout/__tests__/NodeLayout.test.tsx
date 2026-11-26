import { fireEvent, render, screen, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, expect, it, vi } from 'vitest'

import { store } from '../../../app/store'
import { getWalletOverride } from '../../../api/wallet-override'
import { i18n } from '../../../i18n'
import { P2pMarketPage } from '../../../routes/trade/nostr-p2p'
import { useP2pWalletSession } from '../../../routes/trade/nostr-p2p/session'
import { setNodeReachability } from '../../../slices/node/node.slice'
import { nodeSettingsActions } from '../../../slices/nodeSettings/nodeSettings.slice'
import { setAppMode } from '../../../slices/settings/settings.slice'
import { Layout } from '..'

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
  ['/wallet-history/channel-orders', 'History', '/wallet-history/deposits'],
  ['/order-new-channel', 'Channels', '/channels'],
  ['/limit-orders', 'Trading', '/market-maker'],
  ['/nwc', 'App Connections', '/nwc'],
])('keeps the global and contextual selections on %s', (path, label, href) => {
  renderRoute(path)
  const primary = screen.getByLabelText(i18n.t('p2pShell.menu'), {
    selector: 'nav',
  })
  expect(primary.querySelector('a[aria-current="page"]')).toHaveTextContent(
    'Lightning node'
  )
  const secondary = screen.getByLabelText('Lightning node', { selector: 'nav' })
  const activeLinks = secondary.querySelectorAll('a[aria-current="page"]')
  expect(activeLinks).toHaveLength(1)
  expect(activeLinks[0]).toHaveTextContent(label)
  expect(activeLinks[0]).toHaveAttribute('href', href)
})

it('keeps the node-linked Nostr market under Trading with the node wallet backend', () => {
  renderRoute('/nostr-p2p', <P2pMarketPage />)
  const node = within(
    screen.getByRole('navigation', { name: 'Lightning node' })
  )
  expect(node.getByRole('link', { name: 'Trading' })).toHaveAttribute(
    'aria-current',
    'page'
  )
  expect(useP2pWalletSession).toHaveBeenCalledWith(false)
  expect(getWalletOverride()).toBeNull()
})

it('keeps Mind available without a node and switches between Brain and Chat', () => {
  store.dispatch(nodeSettingsActions.resetNodeSettings())
  store.dispatch(setAppMode('mind'))
  renderRoute('/kaleido-mind/skills')
  const primary = within(
    screen.getByRole('navigation', { name: i18n.t('p2pShell.menu') })
  )
  expect(
    primary.getByRole('link', { name: i18n.t('unified.accounts') })
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
    '/p2p/wallet'
  )
})
