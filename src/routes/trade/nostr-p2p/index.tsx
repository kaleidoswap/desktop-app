import { KeyRound, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppDispatch } from '../../../app/store/hooks'
import { setWalletOverride } from '../../../api/wallet-override'
import { TradeNav } from '../../../components/Trade'
import { Alert, Button } from '../../../components/ui'
import { p2pNetworkOptions, walletAccountFor } from '../../../constants/p2p'
import { nodeApi } from '../../../slices/nodeApi/nodeApi.slice'

import { Component as AssetsHistory } from '../../wallet-history/assets'
import { Component as DepositsHistory } from '../../wallet-history/deposits'
import { Component as WithdrawalsHistory } from '../../wallet-history/withdrawals'

import { DepositModal } from './DepositModal'
import { FundsModal, type Direction } from './FundsModal'
import { Market } from './market/Market'
import { RecoveryPhraseModal } from './RecoveryPhraseModal'
import {
  p2pAvailable,
  p2pGenerateSeed,
  p2pProfileGet,
  p2pProfileSet,
  p2pStart,
  p2pStatus,
  p2pStop,
  startConfigFor,
} from './p2p'
import { createP2pWalletWrapper } from './walletClient'
import { WalletSetup } from './WalletSetup'
import { WithdrawModal } from './WithdrawModal'

const isTauri = () =>
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

/** Which wallet the running daemon belongs to, so coming back to the page does not restart it. */
let runningAccount: string | null = null

type Tab = 'market' | 'assets' | 'deposits' | 'withdrawals'

type Phase =
  'loading' | 'unavailable' | 'setup' | 'starting' | 'running' | 'error'

/**
 * The P2P market. It has a wallet of its own, made here and kept with a recovery phrase, so it
 * needs no node: a node only adds a way to move funds in and out.
 */
/**
 * The market page. `showNav` adds the Trade menu, which belongs to the node's sections; the
 * stand-alone P2P app has no such menu.
 */
export const P2pMarketPage = ({ showNav = true }: { showNav?: boolean }) => {
  const { t } = useTranslation()
  const options = useMemo(p2pNetworkOptions, [])
  const [networkKey, setNetworkKey] = useState(
    () =>
      options.find((o) => o.key === savedNetwork())?.key ??
      options[0]?.key ??
      ''
  )
  const option = options.find((o) => o.key === networkKey) ?? options[0]
  const config = option?.config
  const account = config ? walletAccountFor(config) : ''

  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  // The stand-alone app has no node: while its pages are open the wallet screens read the trading
  // wallet instead. Inside the node's Trading section the connected node stays what they read.
  const standalone = !showNav
  const dispatch = useAppDispatch()
  const [tab, setTab] = useState<Tab>('market')
  useEffect(() => {
    if (!standalone || phase !== 'running') return
    setWalletOverride(createP2pWalletWrapper())
    dispatch(nodeApi.util.resetApiState())
    return () => {
      setWalletOverride(null)
      dispatch(nodeApi.util.resetApiState())
    }
  }, [standalone, phase, dispatch])

  // a node is optional: when one is connected, funds can also move to and from it
  const nodeBtc = nodeApi.endpoints.btcBalance.useQuery(undefined, {
    pollingInterval: 15_000,
    skip: standalone,
  })
  const nodeConnected = !standalone && nodeBtc.data !== undefined

  const [deposit, setDeposit] = useState(false)
  const [withdraw, setWithdraw] = useState(false)
  const [nodeTransfer, setNodeTransfer] = useState<Direction | null>(null)
  const [recovery, setRecovery] = useState(false)

  const begin = useCallback(async () => {
    if (!config) return
    if (!(await p2pAvailable().catch(() => false))) {
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
    runningAccount = account
    setPhase('running')
  }

  const rescan = async () => {
    if (!config) return
    await p2pStop()
    runningAccount = null
    await p2pStart({ ...startConfigFor(account, config), rescan: true })
    runningAccount = account
  }

  const stop = async () => {
    await p2pStop()
    runningAccount = null
    setAttempt((n) => n + 1)
  }

  let body
  if (!isTauri()) {
    body = <Alert variant="info">{t('p2pMarket.desktopOnly')}</Alert>
  } else if (!config) {
    body = <Alert variant="info">{t('p2pMarket.noNetwork')}</Alert>
  } else if (phase === 'unavailable') {
    body = (
      <Alert variant="info">
        {t('p2pMarket.unavailable', {
          defaultValue:
            'The P2P market is not part of this build yet. It is not included on Windows; it is available on macOS and Linux.',
        })}
      </Alert>
    )
  } else if (phase === 'setup') {
    body = (
      <WalletSetup
        generate={() => p2pGenerateSeed(config.network)}
        networkLabel={option?.label ?? config.network}
        onComplete={createWallet}
      />
    )
  } else if (phase === 'error') {
    body = (
      <div className="mx-auto flex max-w-xl flex-col gap-4 py-16 text-center">
        <h2 className="text-xl font-bold text-content-primary">
          {t('p2pMarket.startFailed', {
            defaultValue: 'The market could not start',
          })}
        </h2>
        <p className="text-content-secondary">{error}</p>
        <div>
          <Button onClick={() => setAttempt((n) => n + 1)}>
            {t('p2pMarket.retry', { defaultValue: 'Try again' })}
          </Button>
        </div>
      </div>
    )
  } else if (phase !== 'running') {
    body = (
      <p className="py-16 text-center text-content-secondary">
        {phase === 'starting'
          ? t('p2pMarket.starting', {
              defaultValue: 'Starting your trading wallet…',
            })
          : t('p2pMarket.loading', { defaultValue: 'Loading…' })}
      </p>
    )
  } else {
    body = (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {standalone && (
            <div
              className="mr-auto flex gap-1 rounded-xl bg-surface-inset p-1"
              role="tablist"
            >
              {(
                [
                  [
                    'market',
                    t('p2pMarket.tabMarket', { defaultValue: 'Market' }),
                  ],
                  [
                    'assets',
                    t('p2pMarket.tabAssets', { defaultValue: 'Assets' }),
                  ],
                  [
                    'deposits',
                    t('p2pMarket.tabDeposits', { defaultValue: 'Deposits' }),
                  ],
                  [
                    'withdrawals',
                    t('p2pMarket.tabWithdrawals', {
                      defaultValue: 'Withdrawals',
                    }),
                  ],
                ] as [Tab, string][]
              ).map(([id, label]) => (
                <button
                  aria-selected={tab === id}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    tab === id
                      ? 'bg-surface-raised text-content-primary'
                      : 'text-content-tertiary hover:text-content-secondary'
                  }`}
                  key={id}
                  onClick={() => setTab(id)}
                  role="tab"
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {options.length > 1 && (
            <select
              aria-label={t('p2pMarket.network', { defaultValue: 'Network' })}
              className="rounded-lg bg-surface-inset px-3 py-1.5 text-caption text-content-primary outline-none"
              onChange={(e) => {
                saveNetwork(e.target.value)
                setNetworkKey(e.target.value)
              }}
              value={networkKey}
            >
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          <Button
            icon={<KeyRound size={14} />}
            onClick={() => setRecovery(true)}
            size="sm"
            variant="outline"
          >
            {t('p2pMarket.recovery', { defaultValue: 'Recovery phrase' })}
          </Button>
          <Button
            icon={<RefreshCw size={14} />}
            onClick={() => void stop()}
            size="sm"
            title={t('p2pMarket.restartHelp', {
              defaultValue:
                'Restarts the trading wallet. Your open offers are taken off the market and put back.',
            })}
            variant="outline"
          >
            {t('p2pMarket.restart', { defaultValue: 'Restart' })}
          </Button>
        </div>
        {standalone && tab === 'assets' && <AssetsHistory />}
        {standalone && tab === 'deposits' && <DepositsHistory />}
        {standalone && tab === 'withdrawals' && <WithdrawalsHistory />}
        {(!standalone || tab === 'market') && (
          <Market
            node={
              nodeConnected
                ? { btc: nodeBtc.data?.vanilla.spendable ?? 0, connected: true }
                : undefined
            }
            onOpenFunds={(d) =>
              d === 'toNode' ? setWithdraw(true) : setDeposit(true)
            }
            onRescan={rescan}
          />
        )}
        <DepositModal
          isOpen={deposit}
          onClose={() => setDeposit(false)}
          onFromNode={
            nodeConnected
              ? () => {
                  setDeposit(false)
                  setNodeTransfer('toTrading')
                }
              : undefined
          }
        />
        <WithdrawModal
          isOpen={withdraw}
          onClose={() => setWithdraw(false)}
          onToNode={
            nodeConnected
              ? () => {
                  setWithdraw(false)
                  setNodeTransfer('toNode')
                }
              : undefined
          }
        />
        <FundsModal
          initialDirection={nodeTransfer ?? 'toTrading'}
          isOpen={nodeTransfer !== null}
          onClose={() => setNodeTransfer(null)}
        />
        <RecoveryPhraseModal
          isOpen={recovery}
          onClose={() => setRecovery(false)}
        />
      </div>
    )
  }

  return (
    <div className="w-full min-h-full">
      {showNav && (
        <div className="mx-auto w-full max-w-screen-xl px-4 pt-2">
          <TradeNav />
        </div>
      )}
      <div className="mx-auto w-full max-w-screen-xl px-4 py-4">{body}</div>
    </div>
  )
}

export const Component = () => <P2pMarketPage />
