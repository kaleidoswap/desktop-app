import { memoryWalletStore } from '../../trade/nostr-p2p/__tests__/memoryWalletStore'
import { invoke } from '@tauri-apps/api/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  MAINNET_MARKET_PATH,
  MAINNET_NODE_PATH,
  MAINNET_SETTINGS_PATH,
  MAINNET_WALLET_PATH,
  P2P_BALANCE_PATH,
  P2P_NODE_PATH,
  P2P_SETTINGS_PATH,
  P2P_TRADE_PATH,
  WALLET_SETUP_PATH,
} from '../../../app/router/paths'
import {
  lastWalletContext,
  rememberProfile,
  startupPath,
  switchNetworkPath,
} from '../navigation'
import { TestNetworkGate } from '../node'
import { saveWallet } from '../../trade/nostr-p2p/wallets'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_: string, o: { defaultValue: string }) => o.defaultValue,
  }),
}))

const defaultNetwork = {
  key: 'SignetCustom',
  label: 'Mutinynet',
  network: 'signetcustom',
}
const localNetwork = {
  key: 'LocalRegtest',
  label: 'Regtest',
  network: 'regtest',
}

describe('unified wallet entry', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryWalletStore())
    vi.stubGlobal('__TAURI_INTERNALS__', {})
    vi.mocked(invoke).mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts a fresh installation on mainnet without starting a daemon', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd) => {
      if (cmd === 'get_accounts') return []
      if (cmd === 'p2p_networks') return [defaultNetwork]
      if (cmd === 'p2p_profile_get') return null
      throw new Error(cmd)
    })
    expect(await startupPath(false)).toBe(MAINNET_WALLET_PATH)
    expect(vi.mocked(invoke).mock.calls.map(([cmd]) => cmd)).toEqual([
      'get_accounts',
      'p2p_networks',
      'p2p_profile_get',
    ])
  })
  it('can enter mainnet when the test wallet service is unavailable', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd) => {
      if (cmd === 'get_accounts') return []
      throw new Error('test wallet unavailable')
    })
    expect(await startupPath(false)).toBe(MAINNET_WALLET_PATH)
  })
  it('keeps the existing node chooser for an upgraded installation', async () => {
    vi.mocked(invoke).mockResolvedValue([{ name: 'remote test node' }])
    expect(await startupPath(false)).toBe(WALLET_SETUP_PATH)
    expect(vi.mocked(invoke).mock.calls).toEqual([['get_accounts']])
  })
  it('finds an older extra wallet even when it is on the second test network', async () => {
    saveWallet('regtest', { id: 'desk', label: 'Desk' })
    vi.mocked(invoke).mockImplementation(async (cmd, args) => {
      if (cmd === 'get_accounts') return []
      if (cmd === 'p2p_networks') return [defaultNetwork, localNetwork]
      return (args as { account: string }).account === 'wallet-regtest-desk'
        ? { version: 1 }
        : null
    })
    expect(await startupPath(false)).toBe(WALLET_SETUP_PATH)
  })
  it('resumes the last explicit profile before running native discovery', async () => {
    for (const [profile, to] of [
      ['test', P2P_BALANCE_PATH],
      ['node', WALLET_SETUP_PATH],
      ['mainnet', MAINNET_WALLET_PATH],
    ] as const) {
      rememberProfile(profile)
      expect(await startupPath(false)).toBe(to)
    }
    expect(invoke).not.toHaveBeenCalled()
  })
  it('keeps the previous wallet network while resuming a node', async () => {
    expect(lastWalletContext()).toBe('mainnet')
    localStorage.setItem('kaleidoswap.desktop.last-profile', 'test')
    rememberProfile('node')
    expect(lastWalletContext()).toBe('test')
    expect(await startupPath(false)).toBe(WALLET_SETUP_PATH)
    rememberProfile('mainnet')
    expect(lastWalletContext()).toBe('mainnet')
  })
  it('keeps Mind and account discovery failures on the legacy chooser', async () => {
    expect(await startupPath(true)).toBe(WALLET_SETUP_PATH)
    vi.mocked(invoke).mockRejectedValue(new Error('unavailable'))
    expect(await startupPath(false)).toBe(WALLET_SETUP_PATH)
  })
})

describe('explicit market and Lightning test network navigation', () => {
  it('keeps the settings section when switching wallet networks', () => {
    expect(switchNetworkPath(MAINNET_SETTINGS_PATH, false)).toBe(
      P2P_SETTINGS_PATH
    )
    expect(switchNetworkPath(P2P_SETTINGS_PATH, true)).toBe(
      MAINNET_SETTINGS_PATH
    )
  })
  it.each([
    [MAINNET_MARKET_PATH, P2P_TRADE_PATH],
    [MAINNET_NODE_PATH, P2P_NODE_PATH],
  ])('switches from %s only on request', (main, test) => {
    render(
      <MemoryRouter initialEntries={[main]}>
        <Routes>
          <Route element={<TestNetworkGate />} path={main} />
          <Route element={<h1>Test profile</h1>} path={test} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.queryByText('Test profile')).toBeNull()
    fireEvent.click(
      screen.getByRole('link', { name: 'Switch to test networks' })
    )
    expect(
      screen.getByRole('heading', { name: 'Test profile' })
    ).toBeInTheDocument()
    expect(switchNetworkPath(test, true)).toBe(main)
  })
})
