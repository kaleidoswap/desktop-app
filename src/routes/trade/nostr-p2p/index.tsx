import { KeyRound, RadioTower, RefreshCw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { TRADE_MARKET_MAKER_PATH } from '../../../app/router/paths'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks'
import { uiSliceActions } from '../../../slices/ui/ui.slice'
import { IssueAssetModal } from '../../../components/IssueAssetModal'
import { UTXOManagementModal } from '../../../components/UTXOManagementModal'
import { useSettings } from '../../../hooks/useSettings'
import { marketApi } from './api'
import { TradeNav } from '../../../components/Trade'
import { Alert, Button } from '../../../components/ui'
import { nodeApi } from '../../../slices/nodeApi/nodeApi.slice'

import { Component as AssetsHistory } from '../../wallet-history/assets'
import { Component as DepositsHistory } from '../../wallet-history/deposits'
import { Component as WithdrawalsHistory } from '../../wallet-history/withdrawals'
import { nodeWalletNetworkKey } from '../../p2p-home/networks'

import { DepositModal } from './DepositModal'
import { FundsModal, type Direction } from './FundsModal'
import { SwapView } from './market/SwapView'
import { Market } from './market/Market'
import { Picker } from './market/Picker'
import { p2pGenerateSeed } from './p2p'
import { RecoveryPhraseModal } from './RecoveryPhraseModal'
import { RelaysModal } from './RelaysModal'
import {
  isTauri,
  type P2pWalletSession,
  useOptionalP2pSession,
  useP2pWalletSession,
} from './session'
import { WalletSetup } from './WalletSetup'
import { WalletSwitch } from './WalletSwitch'
import { WithdrawModal } from './WithdrawModal'

type View = 'swap' | 'book'

const VIEW_KEY = 'p2p-trade.view'

const savedView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'swap' ? 'swap' : 'book'
  } catch {
    return 'book'
  }
}

type Tab = 'market' | 'assets' | 'deposits' | 'withdrawals'

/**
 * What stands between the user and a running trading wallet: no desktop, no network, the daemon
 * cannot run here, the wallet is not set up yet, it is starting, or it failed. Once it runs, the
 * children show.
 */
export function P2pGate({
  session,
  children,
}: {
  session: P2pWalletSession
  children: ReactNode
}) {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const {
    config,
    createWallet,
    error,
    hint,
    leaveUnfinishedWallet,
    options,
    phase,
    retry,
    walletId,
    walletLabel,
  } = session
  let body
  if (!isTauri()) {
    body = <Alert variant="info">{t('p2pMarket.desktopOnly')}</Alert>
  } else if (options === null) {
    body = null
  } else if (!config) {
    body = <Alert variant="info">{t('p2pMarket.noNetwork')}</Alert>
  } else if (phase === 'unavailable') {
    const why: Record<string, string> = {
      docker_missing:
        'The P2P market runs in Docker on this system. Install Docker Desktop, start it, and try again.',
      docker_stopped:
        'Docker is installed but not running. Start Docker Desktop and try again.',
      image_unpublished:
        'The P2P market cannot start on this system yet: its Docker image is not published.',
    }
    body = (
      <div className="mx-auto flex max-w-xl flex-col gap-4 py-16 text-center">
        <h2 className="text-xl font-bold text-content-primary">
          {t('p2pMarket.unavailableTitle', {
            defaultValue: 'The market cannot start here yet',
          })}
        </h2>
        <p className="text-content-secondary">
          {t(`p2pMarket.unavailable.${hint ?? 'other'}`, {
            defaultValue:
              (hint && why[hint]) ||
              'The P2P market is not part of this build.',
          })}
        </p>
        <div>
          <Button onClick={() => retry()}>
            {t('p2pMarket.retry', { defaultValue: 'Try again' })}
          </Button>
        </div>
      </div>
    )
  } else if (phase === 'setup') {
    body = (
      <WalletSetup
        generate={() => p2pGenerateSeed(config.network)}
        networkLabel={config.label ?? config.network}
        onCancel={walletId ? leaveUnfinishedWallet : undefined}
        onComplete={createWallet}
        startWithRestore={params.get('setup') === 'restore'}
        walletLabel={walletId ? walletLabel : undefined}
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
          <Button onClick={() => retry()}>
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
    body = children
  }
  return <>{body}</>
}

/**
 * The P2P market with its wallet. In the node's Trading section (`showNav`) it has the Trade menu;
 * on its own it also has the wallet's tabs and settings. Inside the P2P app (`inShell`) those live
 * in the app's own menu, so only the market shows.
 */
function MarketView({
  session,
  showNav,
  inShell,
}: {
  session: P2pWalletSession
  showNav: boolean
  inShell: boolean
}) {
  const { t } = useTranslation()
  const {
    addWallet,
    chooseWallet,
    config,
    networkKey,
    networks,
    rescan,
    restart,
    setNetworkKey,
    walletId,
    walletLabel,
    wallets,
  } = session
  const standalone = !showNav
  const dispatch = useAppDispatch()
  const [tab, setTab] = useState<Tab>('market')

  const [view, setView] = useState<View>(savedView)
  const choose = (v: View) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      // The view preference is optional.
    }
  }

  // a node is optional: when one is connected, funds can also move to and from it
  const nodeBtc = nodeApi.endpoints.btcBalance.useQuery(undefined, {
    pollingInterval: 15_000,
    skip: standalone,
  })
  const nodeNetwork = useAppSelector((state) => state.nodeSettings.data.network)
  const nodeConnected =
    !standalone &&
    nodeBtc.data !== undefined &&
    config?.key === nodeWalletNetworkKey(nodeNetwork)

  const [deposit, setDeposit] = useState(false)
  const [withdraw, setWithdraw] = useState(false)
  const [coins, setCoins] = useState(false)
  const [issue, setIssue] = useState(false)
  const { bitcoinUnit } = useSettings()
  const [nodeTransfer, setNodeTransfer] = useState<Direction | null>(null)
  const [recovery, setRecovery] = useState(false)
  const [relays, setRelays] = useState(false)

  if (!config) return null

  const running = (
    <div className="flex flex-col gap-3">
      {!inShell && (
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
          <WalletSwitch
            onCreate={addWallet}
            onSelect={chooseWallet}
            selectedId={walletId}
            wallets={wallets}
          />
          {networks.length > 1 && (
            <Picker
              label={t('p2pMarket.network', { defaultValue: 'Network' })}
              onChange={setNetworkKey}
              options={networks.map((o) => ({ title: o.label, value: o.key }))}
              value={networkKey || config.key}
              variant="pill"
            />
          )}
          {standalone && tab !== 'market' && (
            <Button
              icon={<RadioTower size={14} />}
              onClick={() => setRelays(true)}
              size="sm"
              variant="outline"
            >
              {t('p2pMarket.relays', { defaultValue: 'Relays' })}
            </Button>
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
            onClick={() => void restart()}
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
      )}
      {standalone && tab === 'assets' && <AssetsHistory />}
      {standalone && tab === 'deposits' && <DepositsHistory />}
      {standalone && tab === 'withdrawals' && <WithdrawalsHistory />}
      {(!standalone || tab === 'market') &&
        (view === 'swap' ? (
          <SwapView onShowOffers={() => choose('book')} />
        ) : (
          <Market
            node={
              nodeConnected
                ? { btc: nodeBtc.data?.vanilla.spendable ?? 0, connected: true }
                : undefined
            }
            onIssueAsset={standalone ? () => setIssue(true) : undefined}
            onManageCoins={standalone ? () => setCoins(true) : undefined}
            onManageRelays={() => setRelays(true)}
            onOpenFunds={(d) =>
              d === 'toNode'
                ? setWithdraw(true)
                : standalone
                  ? // the app's own deposit screen, which reads the trading wallet while this page is open
                    dispatch(
                      uiSliceActions.setModal({
                        assetId: undefined,
                        type: 'deposit',
                      })
                    )
                  : setDeposit(true)
            }
            onRescan={rescan}
            onSimpleSwap={() => choose('swap')}
            showNetwork={!inShell}
            walletLabel={walletLabel}
          />
        ))}
      {coins && (
        <UTXOManagementModal
          bitcoinUnit={bitcoinUnit}
          onClose={() => setCoins(false)}
        />
      )}
      {issue && (
        <IssueAssetModal
          onClose={() => setIssue(false)}
          onSuccess={() => void marketApi.refresh()}
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
      <RelaysModal
        isOpen={relays}
        networkKey={config.key}
        onClose={() => setRelays(false)}
        onSaved={() => void restart()}
      />
      <RecoveryPhraseModal
        isOpen={recovery}
        onClose={() => setRecovery(false)}
      />
    </div>
  )

  if (inShell) return <P2pGate session={session}>{running}</P2pGate>

  return (
    <div className="w-full min-h-full">
      {showNav && (
        <div className="mx-auto w-full max-w-screen-xl px-4 pt-2">
          <TradeNav />
        </div>
      )}
      <div className="mx-auto w-full max-w-screen-xl px-4 py-4">
        <P2pGate session={session}>{running}</P2pGate>
      </div>
    </div>
  )
}

function OwnSession({ showNav }: { showNav: boolean }) {
  const session = useP2pWalletSession(!showNav)
  return <MarketView inShell={false} session={session} showNav={showNav} />
}

function NodeTransfers() {
  const node = useAppSelector((state) => state.nodeSettings.data)
  const session = useP2pWalletSession(
    false,
    node.name ? nodeWalletNetworkKey(node.network) : ''
  )
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 pt-2">
      <TradeNav />
      <P2pGate session={session}>
        <FundsModal
          isOpen
          onClose={() => {
            if (location.key === 'default')
              navigate(TRADE_MARKET_MAKER_PATH, { replace: true })
            else navigate(-1)
          }}
        />
      </P2pGate>
    </div>
  )
}

/**
 * The P2P market. It has a wallet of its own, made here and kept with a recovery phrase, so it
 * needs no node: a node only adds a way to move funds in and out. Inside the P2P app it uses the
 * app's session; elsewhere it holds its own.
 */
export const P2pMarketPage = ({ showNav = true }: { showNav?: boolean }) => {
  const shared = useOptionalP2pSession()
  return shared ? (
    <MarketView inShell session={shared} showNav={false} />
  ) : (
    <OwnSession showNav={showNav} />
  )
}

export function Component() {
  const [params] = useSearchParams()
  return params.get('funds') === '1' ? <NodeTransfers /> : <P2pMarketPage />
}
