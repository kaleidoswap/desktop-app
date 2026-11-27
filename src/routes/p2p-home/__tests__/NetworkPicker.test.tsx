import { configureStore } from '@reduxjs/toolkit'
import { invoke } from '@tauri-apps/api/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { BitcoinNetwork } from '../../../constants'
import { memoryWalletStore } from '../../trade/nostr-p2p/__tests__/memoryWalletStore'
import { saveNetwork, savedNetwork } from '../../trade/nostr-p2p/wallets'
import { WalletNodeSources } from '../WalletNodeSources'
import { NetworkPicker } from '../NetworkPicker'
import { lastWalletContext } from '../navigation'
import {
  defaultNodeNetwork,
  nodeWalletNetworkKey,
  rememberNodeWalletNetwork,
} from '../networks'
import { Component as NodeChooser } from '../node'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('../../../slices/nodeAccounts', () => ({
  useSavedNodeAccountsQuery: () => ({ data: [] }),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (translationKey: string, options: Record<string, string> = {}) =>
      (options.defaultValue ?? translationKey).replace(
        /{{(\w+)}}/g,
        (_, key: string) => options[key]
      ),
  }),
}))

const networks = [
  { key: 'SignetCustom', label: 'Mutinynet', network: 'signetcustom' },
  { key: 'Signet', label: 'Signet', network: 'signet' },
]

function WalletContextPage() {
  const { pathname, search, hash, state } = useLocation()
  return (
    <>
      <h1>
        {pathname === '/wallet-setup' ? 'Accounts' : pathname + search + hash}
      </h1>
      <NetworkPicker context={state?.walletContext ?? 'mainnet'} />
    </>
  )
}

function renderNode(
  network: BitcoinNetwork,
  initialPath = '/channels',
  setupNetwork?: BitcoinNetwork
) {
  const store = configureStore({
    reducer: () => ({
      node: { reachability: 'reachable' },
      nodeSettings: { data: { name: 'Alice', network } },
    }),
  })
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<WalletContextPage />} path="/wallet-setup" />
          <Route element={<WalletContextPage />} path="/kaleido-mind/*" />
          <Route
            element={
              <>
                <h1>Channels</h1>
                <NetworkPicker context="node" />
              </>
            }
            path="/channels"
          />
          <Route
            element={
              <>
                <NetworkPicker context="node" />
                <WalletNodeSources section="activity" source="node" />
              </>
            }
            path="/wallet-history/*"
          />
          <Route
            element={<h1>Trading wallet activity</h1>}
            path="/p2p/activity"
          />
          <Route
            element={<WalletNodeSources section="activity" source="mainnet" />}
            path="/mainnet/activity"
          />
          <Route element={<NetworkPicker context="node" />} path="/settings" />
          <Route element={<h1>Test wallet settings</h1>} path="/p2p/settings" />
          <Route
            element={<NetworkPicker context="test" />}
            path="/wallet-unlock"
          />
          <Route
            element={
              <NetworkPicker context="test" setupNetwork={setupNetwork} />
            }
            path="/wallet-config"
          />
          <Route
            element={
              <>
                <NetworkPicker context="node" />
                <WalletNodeSources section="wallet" source="node" />
              </>
            }
            path="/wallet-dashboard"
          />
          <Route element={<h1>Test on-chain wallet</h1>} path="/p2p/wallet" />
          <Route
            element={<WalletNodeSources section="wallet" source="mainnet" />}
            path="/mainnet/wallet"
          />
          <Route element={<h1>Mainnet node entry</h1>} path="/mainnet/node" />
          <Route
            element={
              <>
                <NetworkPicker context="test" />
                <NodeChooser />
              </>
            }
            path="/p2p/node"
          />
        </Routes>
      </MemoryRouter>
    </Provider>
  )
  return store
}

async function chooseNetwork(name: string) {
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Network' }), {
    key: 'ArrowDown',
  })
  const option = await within(await screen.findByRole('listbox')).findByRole(
    'option',
    { name }
  )
  fireEvent.keyDown(option, { key: 'Enter' })
}

describe('network selection on a Lightning node', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryWalletStore())
    vi.stubGlobal('__TAURI_INTERNALS__', {})
    vi.mocked(invoke)
      .mockReset()
      .mockImplementation(async (command) => {
        if (command === 'p2p_networks') return networks
        throw new Error(command)
      })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('opens the selected test network and offers the connected account only on its own chain', async () => {
    saveNetwork('SignetCustom')
    const store = renderNode('Signet')
    expect(screen.getByRole('combobox', { name: 'Network' })).toHaveTextContent(
      'Signet · test'
    )
    await chooseNetwork('Mutinynet · test')
    expect(
      screen.getByRole('heading', { name: 'Lightning node' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Open Alice/ })).toBeNull()
    await chooseNetwork('Signet · test')
    expect(savedNetwork()).toBe('Signet')
    fireEvent.click(screen.getByRole('link', { name: 'Open Alice · Signet' }))
    expect(
      screen.getByRole('heading', { name: 'Channels' })
    ).toBeInTheDocument()
    expect(store.getState().nodeSettings.data.network).toBe('Signet')
    expect(
      vi.mocked(invoke).mock.calls.every(([cmd]) => cmd === 'p2p_networks')
    ).toBe(true)
  })

  it('shows a node-only chain and can leave it for the mainnet node entry', async () => {
    renderNode('Testnet')
    expect(screen.getByRole('combobox', { name: 'Network' })).toHaveTextContent(
      'Testnet · test'
    )
    await chooseNetwork('Bitcoin Mainnet')
    expect(
      screen.getByRole('heading', { name: 'Mainnet node entry' })
    ).toBeInTheDocument()
    expect(savedNetwork()).toBeNull()
  })

  it('opens the on-chain wallet on the node network from its legacy dashboard URL', async () => {
    saveNetwork('SignetCustom')
    renderNode('Signet', '/wallet-dashboard')
    const sources = within(
      await screen.findByRole('navigation', { name: 'unified.walletSource' })
    )
    expect(sources.getByText('unified.node')).toHaveAttribute(
      'aria-current',
      'page'
    )
    fireEvent.click(
      sources.getByRole('link', { name: 'unified.onchainWallet' })
    )
    expect(savedNetwork()).toBe('Signet')
    expect(
      screen.getByRole('heading', { name: 'Test on-chain wallet' })
    ).toBeVisible()
  })

  it('keeps Wallet when the user switches from a node wallet to another network', async () => {
    renderNode('Signet', '/wallet-dashboard')
    await chooseNetwork('Mutinynet · test')
    expect(savedNetwork()).toBe('SignetCustom')
    expect(
      screen.getByRole('heading', { name: 'Test on-chain wallet' })
    ).toBeVisible()
  })

  it('never offers a node on another network as the mainnet wallet source', async () => {
    renderNode('Signet', '/wallet-dashboard')
    await chooseNetwork('Bitcoin Mainnet')
    expect(
      screen.queryByRole('navigation', { name: 'unified.walletSource' })
    ).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('keeps a node-only wallet accessible without offering an unsupported on-chain wallet', async () => {
    renderNode('Testnet', '/wallet-dashboard')
    expect(
      await screen.findByRole('combobox', { name: 'Network' })
    ).toHaveTextContent('Testnet · test')
    expect(
      screen.queryByRole('navigation', { name: 'unified.walletSource' })
    ).toBeNull()
  })

  it('opens the trading wallet’s activity on the node’s chain when a different wallet network was saved', async () => {
    saveNetwork('SignetCustom')
    renderNode('Signet', '/wallet-history/withdrawals')
    fireEvent.click(
      await screen.findByRole('link', { name: 'unified.onchainWallet' })
    )
    expect(savedNetwork()).toBe('Signet')
    expect(
      screen.getByRole('heading', { name: 'Trading wallet activity' })
    ).toBeVisible()
  })

  it('keeps the Activity section when changing networks and excludes a node on another chain', async () => {
    renderNode('Signet', '/wallet-history/deposits')
    await chooseNetwork('Bitcoin Mainnet')
    expect(screen.queryByRole('link', { name: 'unified.node' })).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('keeps the Settings section when changing networks from node settings', async () => {
    renderNode('Signet', '/settings')
    await chooseNetwork('Mutinynet · test')
    expect(
      screen.getByRole('heading', { name: 'Test wallet settings' })
    ).toBeVisible()
    expect(savedNetwork()).toBe('SignetCustom')
  })

  it('switches wallet context inside Accounts while keeping the chooser open', async () => {
    renderNode('Signet', '/wallet-setup')
    await chooseNetwork('Signet · test')
    expect(
      screen.getByRole('heading', { name: 'Accounts' })
    ).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Network' })).toHaveTextContent(
      'Signet · test'
    )
    expect(lastWalletContext()).toBe('test')
    expect(
      vi.mocked(invoke).mock.calls.every(([cmd]) => cmd === 'p2p_networks')
    ).toBe(true)
  })

  it('keeps the current KaleidoMind page and its query when switching wallet networks', async () => {
    const path = '/kaleido-mind/models?tab=local#list'
    renderNode('SignetCustom', path)
    await chooseNetwork('Signet · test')
    expect(screen.getByRole('heading', { name: path })).toBeVisible()
    expect(lastWalletContext()).toBe('test')
    expect(savedNetwork()).toBe('Signet')
    expect(screen.getByRole('combobox')).toHaveTextContent('Signet · test')
  })

  it('labels unlock with the selected account even when its wallet preference differs', async () => {
    saveNetwork('SignetCustom')
    renderNode('Signet', '/wallet-unlock')
    expect(screen.getByRole('combobox', { name: 'Network' })).toHaveTextContent(
      'Signet · test'
    )
    await chooseNetwork('Bitcoin Mainnet')
    expect(
      screen.getByRole('heading', { name: 'Mainnet node entry' })
    ).toBeInTheDocument()
  })

  it('uses the network chosen in the setup form and returns to node setup when changing chains', async () => {
    saveNetwork('SignetCustom')
    renderNode('SignetCustom', '/wallet-config', 'Testnet')
    expect(screen.getByRole('combobox', { name: 'Network' })).toHaveTextContent(
      'Testnet · test'
    )
    await chooseNetwork('Signet · test')
    expect(
      screen.getByRole('heading', { name: 'Lightning node' })
    ).toBeInTheDocument()
    expect(savedNetwork()).toBe('Signet')
  })

  it('prefills the next node setup on the selected network and retains a supported wallet network', () => {
    saveNetwork('Signet')
    expect(defaultNodeNetwork()).toBe('Signet')
    rememberNodeWalletNetwork('Testnet')
    expect(savedNetwork()).toBe('Signet')
    rememberNodeWalletNetwork('SignetCustom')
    expect(defaultNodeNetwork()).toBe('SignetCustom')
    expect(nodeWalletNetworkKey('LocalDockerRegtest')).toBe('LocalRegtest')
    saveNetwork('LocalRegtest')
    expect(defaultNodeNetwork()).toBe('Regtest')
  })
})
