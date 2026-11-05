import { KeyRound, Power } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TradeNav } from '../../../components/Trade'
import { Alert, Button } from '../../../components/ui'
import { p2pNetworkOptions, walletAccountFor } from '../../../constants/p2p'
import { nodeApi } from '../../../slices/nodeApi/nodeApi.slice'

import { DepositModal } from './DepositModal'
import { FundsModal, type Direction } from './FundsModal'
import { Market } from './market/Market'
import { RecoveryPhraseModal } from './RecoveryPhraseModal'
import {
  p2pGenerateSeed,
  p2pProfileGet,
  p2pProfileSet,
  p2pStart,
  p2pStatus,
  p2pStop,
  startConfigFor,
} from './p2p'
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

type Phase = 'loading' | 'setup' | 'starting' | 'running' | 'error'

/**
 * The P2P market. It has a wallet of its own, made here and kept with a recovery phrase, so it
 * needs no node: a node only adds a way to move funds in and out.
 */
export const Component = () => {
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

  // a node is optional: when one is connected, funds can also move to and from it
  const nodeBtc = nodeApi.endpoints.btcBalance.useQuery(undefined, {
    pollingInterval: 15_000,
  })
  const nodeConnected = nodeBtc.data !== undefined

  const [deposit, setDeposit] = useState(false)
  const [withdraw, setWithdraw] = useState(false)
  const [nodeTransfer, setNodeTransfer] = useState<Direction | null>(null)
  const [recovery, setRecovery] = useState(false)

  const begin = useCallback(async () => {
    if (!config) return
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
            icon={<Power size={14} />}
            onClick={() => void stop()}
            size="sm"
            variant="outline"
          >
            {t('p2pMarket.stop')}
          </Button>
        </div>
        <Market
          node={
            nodeConnected
              ? { btc: nodeBtc.data?.vanilla.spendable ?? 0, connected: true }
              : undefined
          }
          onOpenFunds={(d) =>
            d === 'toNode' ? setWithdraw(true) : setDeposit(true)
          }
        />
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
      <div className="mx-auto w-full max-w-screen-xl px-4 pt-2">
        <TradeNav />
      </div>
      <div className="mx-auto w-full max-w-screen-xl px-4 py-4">{body}</div>
    </div>
  )
}
