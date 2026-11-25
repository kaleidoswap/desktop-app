import { invoke } from '@tauri-apps/api/core'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useP2pWalletSession } from '../session'
import { setWalletOverride } from '../../../../api/wallet-override'
import type { P2pStartRequest } from '../p2p'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('../../../../app/store/hooks', () => {
  const dispatch = vi.fn()
  return { useAppDispatch: () => dispatch }
})
vi.mock('../../../../api/wallet-override', () => ({
  setWalletOverride: vi.fn(),
}))
vi.mock('../walletClient', () => ({ createP2pWalletWrapper: () => ({}) }))

const networks = [
  { key: 'SignetCustom', label: 'Mutinynet', network: 'signetcustom' },
  { key: 'LocalRegtest', label: 'Regtest', network: 'regtest' },
]
function deferred() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('__TAURI_INTERNALS__', {})
  vi.clearAllMocks()
})
afterEach(() => vi.unstubAllGlobals())

it('serializes in-flight starts and exposes only the newly selected account', async () => {
  const starts: string[] = []
  const startingA = deferred()
  const startingB = deferred()
  vi.mocked(invoke).mockImplementation(async (cmd, args) => {
    if (cmd === 'p2p_networks') return networks
    if (cmd === 'p2p_available') return { backend: 'native' }
    if (cmd === 'p2p_status') return { running: false }
    if (cmd === 'p2p_profile_get') return { version: 1 }
    if (cmd === 'p2p_stop') return
    if (cmd === 'p2p_start') {
      const { config } = args as { config: P2pStartRequest }
      starts.push(config.account)
      return config.network_key === 'SignetCustom'
        ? startingA.promise
        : startingB.promise
    }
    throw new Error(cmd)
  })
  const { result } = renderHook(() => useP2pWalletSession(true))
  await waitFor(() => expect(starts).toEqual(['wallet-signetcustom']))
  act(() => result.current.setNetworkKey('LocalRegtest'))
  expect(result.current.network).toBe('regtest')
  expect(result.current.phase).toBe('loading')
  expect(starts).toEqual(['wallet-signetcustom'])
  await act(async () => startingA.release())
  await waitFor(() =>
    expect(starts).toEqual(['wallet-signetcustom', 'wallet-regtest'])
  )
  expect(result.current.phase).toBe('starting')
  expect(setWalletOverride).not.toHaveBeenCalled()
  await act(async () => startingB.release())
  expect(result.current.phase).toBe('running')
  expect(result.current.account).toBe('wallet-regtest')
  expect(setWalletOverride).toHaveBeenCalledTimes(1)
})

it('does not start a daemon after leaving its profile during discovery', async () => {
  const checking = deferred()
  let available = false
  vi.mocked(invoke).mockImplementation(async (cmd) => {
    if (cmd === 'p2p_networks') return networks
    if (cmd === 'p2p_available') {
      available = true
      await checking.promise
      return { backend: 'native' }
    }
    throw new Error(cmd)
  })
  const { unmount } = renderHook(() => useP2pWalletSession(true))
  await waitFor(() => expect(available).toBe(true))
  unmount()
  await act(async () => checking.release())
  expect(vi.mocked(invoke).mock.calls.map(([cmd]) => cmd)).toEqual([
    'p2p_networks',
    'p2p_available',
  ])
  expect(setWalletOverride).not.toHaveBeenCalled()
})

it('revalidates the native identity when returning to a remembered running wallet', async () => {
  let nativeChanged = false
  const requested: string[] = []
  vi.mocked(invoke).mockImplementation(async (cmd, args) => {
    if (cmd === 'p2p_networks') return networks
    if (cmd === 'p2p_available') return { backend: 'native' }
    if (cmd === 'p2p_status') return { running: nativeChanged }
    if (cmd === 'p2p_profile_get') return { version: 1 }
    if (cmd === 'p2p_stop') return
    if (cmd === 'p2p_start') {
      const { config } = args as { config: P2pStartRequest }
      requested.push(config.account)
      if (nativeChanged) throw new Error('A different wallet is open')
      return
    }
    throw new Error(cmd)
  })
  const first = renderHook(() => useP2pWalletSession(true))
  await waitFor(() => expect(first.result.current.phase).toBe('running'))
  first.unmount()
  nativeChanged = true
  vi.mocked(setWalletOverride).mockClear()
  const second = renderHook(() => useP2pWalletSession(true))
  await waitFor(() => expect(second.result.current.phase).toBe('error'))
  expect(second.result.current.error).toMatch(/different wallet/)
  expect(setWalletOverride).not.toHaveBeenCalled()
  expect(requested).toEqual(['wallet-signetcustom', 'wallet-signetcustom'])
})
