import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { useAppDispatch } from '../../../app/store/hooks'
import { setWalletOverride } from '../../../api/wallet-override'
import {
  allocateWalletId,
  type P2pNetworkOption,
  walletAccountFor,
} from '../../../constants/p2p'
import { uiSliceActions } from '../../../slices/ui/ui.slice'
import { nodeApi } from '../../../slices/nodeApi/nodeApi.slice'

import {
  p2pAvailability,
  type P2pAvailability,
  p2pNetworks,
  p2pProfileGet,
  p2pProfileSet,
  p2pStart,
  p2pStatus,
  p2pStop,
  startConfigFor,
} from './p2p'
import { createP2pWalletWrapper } from './walletClient'
import {
  originalWallet,
  readSelectedWalletId,
  readWalletList,
  removeWallet,
  saveWallet,
  saveNetwork,
  savedNetwork,
  writeSelectedWalletId,
  type TradingWallet,
} from './wallets'

export const isTauri = () =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** Which wallet the running daemon belongs to, so coming back to a page does not restart it. */
let runningAccount: string | null = null

// All wallets share one native daemon. Finish any already-issued lifecycle mutation before another
// account can stop, start or configure it, including across unmounts of the trading wallet shell.
let lifecycle: Promise<void> = Promise.resolve()
function withDaemon(operation: () => Promise<void>) {
  const result = lifecycle.then(operation)
  lifecycle = result.catch(() => undefined)
  return result
}

async function stopDaemon() {
  await p2pStop()
  runningAccount = null
}

export type Phase =
  'loading' | 'unavailable' | 'setup' | 'starting' | 'running' | 'error'

/**
 * The trading wallet as the app holds it: which network and wallet are open, and the daemon that
 * serves them, from setup to running. `standalone` is the P2P app, which has no node: while its
 * wallet runs, the app's wallet screens read the trading wallet instead of a node.
 */
export function useP2pWalletSession(
  standalone: boolean,
  nodeNetworkKey?: string
) {
  const [options, setOptions] = useState<P2pNetworkOption[] | null>(null)
  useEffect(() => {
    if (!isTauri()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOptions([])
      return
    }
    p2pNetworks()
      .then(setOptions)
      .catch(() => setOptions([]))
  }, [])
  const [preferredNetwork, setNetworkKeyState] = useState(
    () => savedNetwork() ?? ''
  )
  const networkKey = nodeNetworkKey ?? preferredNetwork
  const networks = options ?? []
  const config: P2pNetworkOption | undefined =
    networks.find((o) => o.key === networkKey) ??
    (nodeNetworkKey === undefined ? networks[0] : undefined)
  const network = config?.network ?? ''
  const [walletLists, setWalletLists] = useState<
    Record<string, TradingWallet[]>
  >({})
  const [selection, setSelection] = useState<{
    network: string
    id: string
  } | null>(null)
  const [draft, setDraft] = useState<{
    network: string
    id: string
    label: string
  } | null>(null)
  const wallets = network
    ? (walletLists[network] ?? readWalletList(network))
    : [originalWallet()]
  const savedWalletId = network ? readSelectedWalletId(network) : ''
  const walletId =
    draft && draft.network === network
      ? draft.id
      : selection && selection.network === network
        ? selection.id
        : savedWalletId
  const account = config ? walletAccountFor(config, walletId) : ''
  const walletLabel =
    wallets.find((w) => w.id === walletId)?.label ??
    (draft?.network === network ? draft.label : undefined)

  const [state, setState] = useState<{
    account: string
    phase: Phase
    error?: string
    hint?: P2pAvailability['hint']
  }>({ account: '', phase: 'loading' })
  const phase: Phase = state.account === account ? state.phase : 'loading'
  const error = state.account === account ? (state.error ?? null) : null
  const hint = state.account === account ? (state.hint ?? null) : null
  const [attempt, setAttempt] = useState(0)
  const active = useRef<symbol | null>(null)
  const dispatch = useAppDispatch()

  useLayoutEffect(() => {
    if (!standalone || phase !== 'running') return
    setWalletOverride(createP2pWalletWrapper())
    dispatch(nodeApi.util.resetApiState())
    return () => {
      setWalletOverride(null)
      dispatch(uiSliceActions.setModal({ type: 'none' }))
      dispatch(nodeApi.util.resetApiState())
    }
  }, [standalone, account, phase, dispatch])

  useLayoutEffect(() => {
    if (!isTauri() || !config) return
    const token = Symbol()
    active.current = token
    const current = () => active.current === token
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ account, phase: 'loading' })
    void withDaemon(async () => {
      if (!current()) return
      const where = await p2pAvailability().catch(() => null)
      if (!current()) return
      if (!where?.backend) {
        setState({ account, hint: where?.hint, phase: 'unavailable' })
        return
      }
      const status = await p2pStatus().catch(() => null)
      if (!current()) return
      if (status?.running && runningAccount === account) {
        // Native reuse checks account and network. Forget this hint if native identity validation
        // fails, so a user retry can reopen the selected wallet through the normal startup path.
        runningAccount = null
        await p2pStart(startConfigFor(account, config))
        runningAccount = account
        if (!current()) return
        setState({ account, phase: 'running' })
        return
      }
      await stopDaemon()
      if (!current()) return
      const profile = await p2pProfileGet(account)
      if (!current()) return
      if (!profile) {
        setState({ account, phase: 'setup' })
        return
      }
      setState({ account, phase: 'starting' })
      await p2pStart(startConfigFor(account, config))
      runningAccount = account
      if (current()) setState({ account, phase: 'running' })
    }).catch((e) => {
      if (current())
        setState({
          account,
          error: e instanceof Error ? e.message : String(e),
          phase: 'error',
        })
    })
    return () => {
      active.current = null
    }
  }, [account, config, attempt])

  const createWallet = async (phrase: string) => {
    const token = active.current
    if (!config || !token || phase !== 'setup') return
    await withDaemon(async () => {
      if (active.current !== token || runningAccount === account) return
      setState({ account, phase: 'starting' })
      try {
        await stopDaemon()
        if (active.current !== token) return
        await p2pStart({
          ...startConfigFor(account, config),
          seed_mnemonic: phrase,
        })
        // Even if navigation changed during startup, finish recording the wallet just created.
        await p2pProfileSet(account, {
          backed_up: true,
          created_at: Date.now(),
          version: 1,
        })
        runningAccount = account
        if (active.current === token) {
          setDraft(null)
          setState({ account, phase: 'running' })
        }
      } catch (err) {
        if (active.current === token) setState({ account, phase: 'setup' })
        throw err
      }
    })
  }

  const chooseWallet = (id: string) => {
    if (!config) return
    writeSelectedWalletId(config.network, id)
    setDraft(null)
    setSelection({ id, network: config.network })
  }

  const addWallet = (name: string) => {
    if (!config) return
    const id = allocateWalletId(
      name,
      wallets.map((w) => w.id)
    )
    const label =
      name.trim() || `Wallet ${wallets.filter((w) => w.id).length + 2}`
    const next = saveWallet(config.network, { id, label })
    writeSelectedWalletId(config.network, id)
    setWalletLists((m) => ({ ...m, [config.network]: next }))
    setDraft({ id, label, network: config.network })
    setSelection({ id, network: config.network })
  }

  const leaveUnfinishedWallet = () => {
    if (!config || !walletId) return
    const next = removeWallet(config.network, walletId)
    setWalletLists((m) => ({ ...m, [config.network]: next }))
    writeSelectedWalletId(config.network, '')
    setDraft(null)
    setSelection({ id: '', network: config.network })
  }

  const setNetworkKey = (key: string) => {
    saveNetwork(key)
    setNetworkKeyState(key)
  }

  const resetDaemon = async (rescan: boolean) => {
    const token = active.current
    if (!config || !token) return
    await withDaemon(async () => {
      if (active.current !== token) return
      setState({ account, phase: 'starting' })
      try {
        await stopDaemon()
        if (active.current !== token) return
        await p2pStart({ ...startConfigFor(account, config), rescan })
        runningAccount = account
        if (active.current === token) setState({ account, phase: 'running' })
      } catch (e) {
        if (active.current === token)
          setState({
            account,
            error: e instanceof Error ? e.message : String(e),
            phase: 'error',
          })
      }
    })
  }
  const rescan = () => resetDaemon(true)
  const restart = () => resetDaemon(false)
  const retry = () => setAttempt((n) => n + 1)

  return {
    account,
    addWallet,
    chooseWallet,
    config,
    createWallet,
    error,
    hint,
    leaveUnfinishedWallet,
    network,
    networkKey,
    networks,
    options,
    phase,
    rescan,
    restart,
    retry,
    setNetworkKey,
    standalone,
    walletId,
    walletLabel,
    wallets,
  }
}

export type P2pWalletSession = ReturnType<typeof useP2pWalletSession>

const SessionContext = createContext<P2pWalletSession | null>(null)

/** One trading wallet session for every page of the P2P app. */
export function P2pSessionProvider({ children }: { children: ReactNode }) {
  const session = useP2pWalletSession(true)
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  )
}

/** The shared session, inside the P2P app; `null` elsewhere (the market inside the node's pages). */
export const useOptionalP2pSession = () => useContext(SessionContext)

export function useP2pSession(): P2pWalletSession {
  const s = useContext(SessionContext)
  if (!s) throw new Error('useP2pSession needs a P2pSessionProvider')
  return s
}
