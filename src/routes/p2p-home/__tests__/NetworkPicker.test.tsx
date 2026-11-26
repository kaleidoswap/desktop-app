import { configureStore } from '@reduxjs/toolkit'
import { invoke } from '@tauri-apps/api/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { BitcoinNetwork } from '../../../constants'
import { memoryWalletStore } from '../../trade/nostr-p2p/__tests__/memoryWalletStore'
import { saveNetwork, savedNetwork } from '../../trade/nostr-p2p/wallets'
import { NetworkPicker } from '../NetworkPicker'
import { lastWalletContext } from '../navigation'
import {
  defaultNodeNetwork,
  nodeWalletNetworkKey,
  rememberNodeWalletNetwork,
} from '../networks'
import { Component as NodeChooser } from '../node'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_: string, options: Record<string, string>) =>
      options.defaultValue.replace(
        /{{(\w+)}}/g,
        (_, key: string) => options[key]
      ),
  }),
}))

const networks = [
  { key: 'SignetCustom', label: 'Mutinynet', network: 'signetcustom' },
  { key: 'Signet', label: 'Signet', network: 'signet' },
]

function Accounts() {
  const { state } = useLocation()
  return (
    <>
      <h1>Accounts</h1>
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
          <Route element={<Accounts />} path="/wallet-setup" />
          <Route element={<NetworkPicker context="node" />} path="/channels" />
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
          <Route element={<h1>Dashboard</h1>} path="/wallet-dashboard" />
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
  fireEvent.click(screen.getByRole('button', { name: 'Network' }))
  fireEvent.click(
    await within(screen.getByRole('listbox')).findByRole('option', { name })
  )
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
    expect(screen.getByRole('button', { name: 'Network' })).toHaveTextContent(
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
      screen.getByRole('heading', { name: 'Dashboard' })
    ).toBeInTheDocument()
    expect(store.getState().nodeSettings.data.network).toBe('Signet')
    expect(
      vi.mocked(invoke).mock.calls.every(([cmd]) => cmd === 'p2p_networks')
    ).toBe(true)
  })

  it('shows a node-only chain and can leave it for the mainnet node entry', async () => {
    renderNode('Testnet')
    expect(screen.getByRole('button', { name: 'Network' })).toHaveTextContent(
      'Testnet · test'
    )
    await chooseNetwork('Bitcoin Mainnet')
    expect(
      screen.getByRole('heading', { name: 'Mainnet node entry' })
    ).toBeInTheDocument()
    expect(savedNetwork()).toBeNull()
  })

  it('switches wallet context inside Accounts while keeping the chooser open', async () => {
    renderNode('Signet', '/wallet-setup')
    await chooseNetwork('Signet · test')
    expect(
      screen.getByRole('heading', { name: 'Accounts' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Network' })).toHaveTextContent(
      'Signet · test'
    )
    expect(lastWalletContext()).toBe('test')
    expect(
      vi.mocked(invoke).mock.calls.every(([cmd]) => cmd === 'p2p_networks')
    ).toBe(true)
  })

  it('labels unlock with the selected account even when its wallet preference differs', async () => {
    saveNetwork('SignetCustom')
    renderNode('Signet', '/wallet-unlock')
    expect(screen.getByRole('button', { name: 'Network' })).toHaveTextContent(
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
    expect(screen.getByRole('button', { name: 'Network' })).toHaveTextContent(
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
