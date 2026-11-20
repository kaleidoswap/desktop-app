import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  writeSelectedWalletId,
  type TradingWallet,
} from './wallets'

export const isTauri = () =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const NETWORK_KEY = 'p2p-market.network'

const savedNetwork = (): string | null => {
  try {
    return localStorage.getItem(NETWORK_KEY)
  } catch {
    return null
  }
}

const saveNetwork = (key: string) => {
  try {
    localStorage.setItem(NETWORK_KEY, key)
  } catch {
    // the choice is just not remembered
  }
}

/** Which wallet the running daemon belongs to, so coming back to a page does not restart it. */
let runningAccount: string | null = null

export type Phase =
  'loading' | 'unavailable' | 'setup' | 'starting' | 'running' | 'error'

/**
 * The trading wallet as the app holds it: which network and wallet are open, and the daemon that
 * serves them, from setup to running. `standalone` is the P2P app, which has no node: while its
 * wallet runs, the app's wallet screens read the trading wallet instead of a node.
 */
export function useP2pWalletSession(standalone: boolean) {
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
  const [networkKey, setNetworkKeyState] = useState(() => savedNetwork() ?? '')
  const networks = options ?? []
  const config: P2pNetworkOption | undefined =
    networks.find((o) => o.key === networkKey) ?? networks[0]
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

  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [hint, setHint] = useState<P2pAvailability['hint']>(null)

  const dispatch = useAppDispatch()
  useEffect(() => {
    if (!standalone || phase !== 'running') return
    setWalletOverride(createP2pWalletWrapper())
    dispatch(nodeApi.util.resetApiState())
    return () => {
      setWalletOverride(null)
      dispatch(nodeApi.util.resetApiState())
    }
  }, [standalone, phase, dispatch])

  const begin = useCallback(async () => {
    if (!config) return
    const where = await p2pAvailability().catch(() => null)
    if (!where?.backend) {
      setHint(where?.hint ?? null)
      setPhase('unavailable')
      return
    }
    const status = await p2pStatus().catch(() => null)
    if (status?.running && runningAccount === account) {
      setPhase('running')
      return
    }
    await p2pStop()
    runningAccount = null
    const profile = await p2pProfileGet(account)
    if (!profile) {
      setPhase('setup')
      return
    }
    setPhase('starting')
    await p2pStart(startConfigFor(account, config))
    runningAccount = account
    setPhase('running')
  }, [account, config])

  useEffect(() => {
    if (!isTauri() || !config) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase('loading')
    setError(null)
    void begin().catch((e) => {
      if (cancelled) return
      setError(e instanceof Error ? e.message : String(e))
      setPhase('error')
    })
    return () => {
      cancelled = true
    }
  }, [begin, config, attempt])

  const createWallet = async (phrase: string) => {
    if (!config) return
    await p2pStop()
    runningAccount = null
    setPhase('starting')
    try {
      await p2pStart({
        ...startConfigFor(account, config),
        seed_mnemonic: phrase,
      })
    } catch (e) {
      setPhase('setup')
      throw e
    }
    await p2pProfileSet(account, {
      backed_up: true,
      created_at: Date.now(),
      version: 1,
    })
    setDraft(null)
    runningAccount = account
    setPhase('running')
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

  const rescan = async () => {
    if (!config) return
    await p2pStop()
    runningAccount = null
    await p2pStart({ ...startConfigFor(account, config), rescan: true })
    runningAccount = account
  }

  /** Stop the daemon and start it again (with new settings, or after an error). */
  const restart = async () => {
    await p2pStop()
    runningAccount = null
    setAttempt((n) => n + 1)
  }

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
