import { Button, PageHeader } from 'kaleido-ui'
import {
  ArrowLeftRight,
  Wallet,
  Cloud,
  Server,
  Container,
  ArrowLeft,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'

import {
  WALLET_INIT_PATH,
  WALLET_REMOTE_PATH,
  WALLET_RESTORE_PATH,
  WALLET_SETUP_PATH,
  P2P_NODE_PATH,
} from '../../app/router/paths'
import { useAppDispatch, useAppSelector } from '../../app/store/hooks'
import { Layout } from '../../components/Layout'
import { Toolbar } from '../../components/Toolbar'
import { WalletAction, IconWrapper } from '../../components/wallet-setup'
import { setAppMode } from '../../slices/settings/settings.slice'
import { useLocalNodeCapabilities } from './useLocalNodeCapabilities'

function NodeAccounts() {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const appMode = useAppSelector((state) => state.settings.appMode)
  const activateNode = () => {
    if (appMode === 'mind') dispatch(setAppMode('both'))
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6">
      <PageHeader
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="surface">
              <Link onClick={activateNode} to={WALLET_REMOTE_PATH}>
                <Cloud aria-hidden size={16} />
                {t('launcher.cards.remote')}
              </Link>
            </Button>
            <Button asChild size="sm" variant="surface">
              <Link
                onClick={activateNode}
                to={WALLET_SETUP_PATH + '?node=local'}
              >
                <Server aria-hidden size={16} />
                {t('launcher.cards.local')}
              </Link>
            </Button>
          </div>
        }
        title={t('launcher.yourAccounts')}
        variant="page"
      />
      <Toolbar />
    </section>
  )
}

function LocalNodeSetup() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { state } = useLocation()
  const {
    isNativeSupported,
    isDockerAvailable,
    localNodeMode,
    setLocalNodeMode,
    checkingCapabilities,
    checkCapabilities,
  } = useLocalNodeCapabilities()

  const navigateToWalletInit = (path: string) => {
    if (localNodeMode === 'docker') {
      // Docker env will be auto-created in wallet-init based on account name
      navigate(`${path}?mode=docker`, { state: { fromLocalSetup: true } })
    } else {
      navigate(path, { state: { fromLocalSetup: true } })
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
      <div className="mb-8 slide-in">
        <button
          className="px-3 py-2 text-content-secondary hover:text-white transition-colors flex items-center gap-1.5 hover:bg-surface-overlay/50 rounded-lg text-sm"
          onClick={() =>
            state?.from === P2P_NODE_PATH
              ? navigate(P2P_NODE_PATH)
              : navigate(WALLET_SETUP_PATH)
          }
          type="button"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t('common.back')}
        </button>
      </div>

      <div className="text-center mb-10 slide-in">
        <div className="relative inline-flex mb-6">
          <div
            className={`${IconWrapper} bg-gradient-to-br from-cyan/25 via-cyan/15 to-blue-500/15 border-2 border-primary/30
                          rounded-2xl shadow-2xl shadow-primary/15
                          relative z-10`}
          >
            <Server className="w-7 h-7 text-primary drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]" />
          </div>
          <div className="absolute inset-0 bg-primary/15 rounded-2xl blur-xl scale-150 opacity-50" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-4 text-white leading-tight tracking-tight">
          {t('walletSetup.setupLocalTitle')}
        </h1>
        <p className="text-content-secondary text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          {t('walletSetup.setupLocalSubtitle')}
        </p>
      </div>

      {/* Backend selection — always visible so user knows which backend will run */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <button
          className={`p-4 rounded-xl border-2 transition-all duration-300 text-left ${
            !isNativeSupported
              ? 'border-border-default/20 bg-surface-elevated/10 opacity-50 cursor-not-allowed'
              : localNodeMode === 'native'
                ? 'border-cyan bg-cyan/10 shadow-lg shadow-cyan/10'
                : 'border-border-default/40 bg-surface-elevated/20 hover:border-border-default/60'
          }`}
          disabled={!isNativeSupported}
          onClick={() => setLocalNodeMode('native')}
          type="button"
        >
          <div className="flex items-center gap-3 mb-2">
            <Server
              className={`w-5 h-5 ${localNodeMode === 'native' ? 'text-status-success' : 'text-content-secondary'}`}
            />
            <span
              className={`font-semibold ${localNodeMode === 'native' ? 'text-white' : 'text-content-secondary'}`}
            >
              {t('walletSetup.backendNative')}
            </span>
            {!isNativeSupported && (
              <span className="text-xs text-content-tertiary ml-auto">
                {t('walletSetup.backendUnavailable')}
              </span>
            )}
          </div>
          <p className="text-xs text-content-secondary">
            {t('walletSetup.backendNativeDescription')}
          </p>
        </button>
        <button
          className={`relative p-4 rounded-xl border-2 transition-all duration-300 text-left ${
            !isDockerAvailable
              ? 'border-border-default/20 bg-surface-elevated/10 opacity-50 cursor-not-allowed'
              : localNodeMode === 'docker'
                ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/10'
                : 'border-border-default/40 bg-surface-elevated/20 hover:border-border-default/60'
          }`}
          disabled={!isDockerAvailable}
          onClick={() => setLocalNodeMode('docker')}
          type="button"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Container
                className={`w-5 h-5 ${localNodeMode === 'docker' ? 'text-purple-400' : 'text-content-secondary'}`}
              />
              <span
                className={`font-semibold ${localNodeMode === 'docker' ? 'text-purple-400' : 'text-content-secondary'}`}
              >
                {t('walletSetup.backendDocker')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!isDockerAvailable && (
                <span className="text-xs text-content-tertiary">
                  {t('walletSetup.backendUnavailable')}
                </span>
              )}
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {t('walletSetup.recommended')}
              </span>
            </div>
          </div>
          <p className="text-xs text-content-secondary">
            {t('walletSetup.backendDockerDescription')}
          </p>
        </button>
      </div>

      <div
        aria-live="polite"
        className="mb-6 flex flex-wrap items-center gap-3"
      >
        <button
          className="rounded-lg border border-white/20 px-4 py-2 text-sm text-content-primary disabled:opacity-50"
          disabled={checkingCapabilities}
          onClick={() => void checkCapabilities()}
          type="button"
        >
          {t(
            checkingCapabilities
              ? 'walletSetup.checkingBackends'
              : 'walletSetup.recheckDocker'
          )}
        </button>
        <p className="text-sm text-content-secondary">
          {t(
            isDockerAvailable
              ? 'walletSetup.dockerReady'
              : 'walletSetup.startDockerHint'
          )}
        </p>
      </div>

      {/* Message when no backend is available */}
      {!isNativeSupported && !isDockerAvailable && (
        <div className="mb-8 p-4 rounded-xl bg-status-warning/10 border border-status-warning/30">
          <p className="text-sm text-status-warning font-medium mb-1">
            {t('walletSetup.noBackendAvailable')}
          </p>
          <p className="text-xs text-content-secondary">
            {t('walletSetup.noBackendHint')}
          </p>
        </div>
      )}

      {/* Create/Restore wallet actions (shown when a backend mode is selected) */}
      {localNodeMode && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <WalletAction
            description={t('walletSetup.createWalletDescription')}
            icon={<Wallet className="w-6 h-6 text-status-success" />}
            onClick={() => navigateToWalletInit(WALLET_INIT_PATH)}
            primary
            title={t('walletSetup.createWalletTitle')}
          />
          <WalletAction
            description={t('walletSetup.restoreWalletDescription')}
            icon={<ArrowLeftRight className="w-6 h-6 text-status-success" />}
            onClick={() => navigateToWalletInit(WALLET_RESTORE_PATH)}
            title={t('walletSetup.restoreWalletTitle')}
          />
        </div>
      )}
    </div>
  )
}

export const Component = () => {
  const [search] = useSearchParams()
  return (
    <Layout>
      <div className="h-full min-h-0 overflow-y-auto">
        {search.get('node') === 'local' ? <LocalNodeSetup /> : <NodeAccounts />}
      </div>
    </Layout>
  )
}
