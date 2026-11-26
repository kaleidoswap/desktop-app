import { invoke } from '@tauri-apps/api/core'
import {
  ArrowRight,
  ArrowLeftRight,
  Wallet,
  Cloud,
  Server,
  Container,
  ArrowLeft,
  Brain,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch } from 'react-redux'

import {
  WALLET_INIT_PATH,
  WALLET_REMOTE_PATH,
  WALLET_RESTORE_PATH,
  KALEIDO_MIND_PATH,
  P2P_WALLET_PATH,
  P2P_NODE_PATH,
} from '../../app/router/paths'
import { findTradingWallet } from '../p2p-home/navigation'
import { Layout } from '../../components/Layout'
import { Toolbar } from '../../components/Toolbar'
import { WalletAction, IconWrapper } from '../../components/wallet-setup'
import { setAppMode } from '../../slices/settings/settings.slice'
import { useLocalNodeCapabilities } from './useLocalNodeCapabilities'
import { nodeSettingsActions } from '../../slices/nodeSettings/nodeSettings.slice'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { saveNetwork, writeSelectedWalletId } from '../trade/nostr-p2p/wallets'

export const Component = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { state } = useLocation()
  const dispatch = useDispatch()
  const [search, setSearch] = useSearchParams()
  const localSetup = search.get('node') === 'local'
  const [showAccounts, setShowAccounts] = useState(false)
  const {
    isNativeSupported,
    isDockerAvailable,
    capabilitiesLoaded,
    localNodeMode,
    setLocalNodeMode,
    checkingCapabilities,
    checkCapabilities,
  } = useLocalNodeCapabilities()

  const [p2pWhere, setP2pWhere] = useState<{
    backend: string | null
    hint: string | null
  } | null>(null)
  useEffect(() => {
    invoke<{ backend: string | null; hint: string | null }>('p2p_available')
      .then(setP2pWhere)
      .catch(() => setP2pWhere({ backend: null, hint: 'unknown' }))
  }, [])

  const p2pBlocked = p2pWhere?.hint === 'image_unpublished'
  const p2pNote =
    p2pWhere?.hint === 'docker_missing'
      ? t('launcher.p2pNeedsDocker', {
          defaultValue:
            'On this system the P2P wallet runs in Docker: install Docker Desktop first.',
        })
      : p2pWhere?.hint === 'docker_stopped'
        ? t('launcher.p2pStartDocker', {
            defaultValue:
              'Start Docker Desktop first: the P2P wallet runs in it here.',
          })
        : p2pBlocked
          ? t('launcher.p2pUnavailable', {
              defaultValue:
                'The P2P wallet is not available on this system yet.',
            })
          : null

  // someone who already made a trading wallet here goes straight back to it
  const [tradingWallet, setTradingWallet] =
    useState<Awaited<ReturnType<typeof findTradingWallet>>>(null)
  useEffect(() => {
    let active = true
    findTradingWallet()
      .then((found) => {
        if (active) setTradingWallet(found)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  const openTradingWallet = () => {
    if (tradingWallet) {
      const { network, wallet } = tradingWallet
      saveNetwork(network.key)
      writeSelectedWalletId(network.network, wallet.id)
    }
    navigate(P2P_WALLET_PATH)
  }

  // the node list only earns its column when there are nodes in it
  const [hasNodes, setHasNodes] = useState(false)
  useEffect(() => {
    invoke<unknown[]>('get_accounts')
      .then((a) => setHasNodes(Array.isArray(a) && a.length > 0))
      .catch(() => setHasNodes(false))
  }, [])

  const [mindLaunchError, setMindLaunchError] = useState<string | null>(null)
  const openMindOnly = async () => {
    setMindLaunchError(null)
    try {
      await invoke('set_current_account', { accountName: null })
      dispatch(nodeSettingsActions.resetNodeSettings())
      dispatch(nodeApi.util.resetApiState())
      dispatch(setAppMode('mind'))
      navigate(KALEIDO_MIND_PATH)
    } catch {
      setMindLaunchError(
        'Could not disconnect the node from Mind. Please try again.'
      )
    }
  }

  const navigateToWalletInit = (path: string) => {
    if (localNodeMode === 'docker') {
      // Docker env will be auto-created in wallet-init based on account name
      navigate(`${path}?mode=docker`, { state: { fromLocalSetup: true } })
    } else {
      navigate(path, { state: { fromLocalSetup: true } })
    }
  }

  return (
    <Layout>
      <div className="flex h-full min-h-0 flex-col overflow-hidden lg:flex-row">
        {hasNodes && (
          <aside className="shrink-0 border-b border-divider/20 bg-surface-base lg:w-56 lg:border-b-0 lg:border-r">
            <button
              aria-controls="saved-node-accounts"
              aria-expanded={showAccounts}
              className="w-full px-4 py-3 text-left text-sm font-medium text-primary lg:hidden"
              onClick={() => setShowAccounts(!showAccounts)}
              type="button"
            >
              {t('launcher.yourAccounts')}
            </button>
            <div
              className={`${showAccounts ? 'block' : 'hidden'} h-48 lg:block lg:h-full`}
              id="saved-node-accounts"
            >
              <Toolbar />
            </div>
          </aside>
        )}

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/* Animated background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan/5 via-transparent to-blue-500/5 pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(6,182,212,0.1),transparent_50%)] pointer-events-none" />

          <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 py-6 sm:px-8 sm:py-10">
            <div
              className={`w-full ${!localSetup ? 'max-w-6xl' : 'max-w-4xl'}`}
            >
              <div
                className="fade-in content-container"
                id="wallet-setup-content"
              >
                {!localSetup ? (
                  <div className="flex flex-col gap-5 slide-in">
                    {mindLaunchError && (
                      <p className="text-sm text-status-danger" role="alert">
                        {mindLaunchError}
                      </p>
                    )}

                    <h1 className="text-3xl font-bold tracking-tight text-content-primary">
                      {t('unified.accounts')}
                    </h1>
                    <section className="flex flex-col gap-4 rounded-2xl border border-divider/20 bg-surface-elevated p-5">
                      <h2 className="text-lg font-semibold text-content-primary">
                        {t('unified.testMarketLabel')}
                      </h2>
                      {tradingWallet && (
                        <p className="text-sm text-content-secondary">
                          {tradingWallet.wallet.label} ·{' '}
                          {tradingWallet.network.label}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3 pt-1">
                        {tradingWallet ? (
                          <button
                            className="flex min-h-12 items-center gap-2 rounded-lg bg-primary px-6 text-base font-bold text-surface-base transition-opacity hover:opacity-90 disabled:opacity-50"
                            disabled={p2pBlocked}
                            onClick={openTradingWallet}
                            type="button"
                          >
                            {t('launcher.openWallet', {
                              defaultValue: 'Open your trading wallet',
                            })}
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        ) : (
                          <>
                            <button
                              className="flex min-h-12 items-center rounded-lg bg-primary px-6 text-base font-bold text-surface-base transition-opacity hover:opacity-90 disabled:opacity-50"
                              disabled={p2pBlocked}
                              onClick={() => navigate(P2P_WALLET_PATH)}
                              type="button"
                            >
                              {t('launcher.createWallet', {
                                defaultValue: 'Create a wallet',
                              })}
                            </button>
                            <button
                              className="flex min-h-12 items-center rounded-lg border border-divider/30 px-5 text-base font-medium text-content-primary transition-colors hover:bg-surface-overlay/50 disabled:opacity-50"
                              disabled={p2pBlocked}
                              onClick={() =>
                                navigate(`${P2P_WALLET_PATH}?setup=restore`)
                              }
                              type="button"
                            >
                              {t('launcher.restoreWallet', {
                                defaultValue: 'Restore from a recovery phrase',
                              })}
                            </button>
                          </>
                        )}
                      </div>
                      {p2pNote ? (
                        <p className="text-sm text-status-warning">{p2pNote}</p>
                      ) : (
                        <p className="text-sm text-content-tertiary">
                          {tradingWallet
                            ? t('launcher.walletReady', {
                                defaultValue:
                                  'Your trading wallet is on this computer. Touch ID unlocks it.',
                              })
                            : t('launcher.twoMinutes', {
                                defaultValue:
                                  'Takes about two minutes: you write down 12 words, then you can deposit and trade.',
                              })}
                        </p>
                      )}
                    </section>

                    <section className="flex flex-col gap-3">
                      <div className="grid gap-3 md:grid-cols-3">
                        <button
                          className="group flex items-center gap-3 rounded-xl border border-divider/20 bg-surface-elevated/30 p-4 text-left transition-colors hover:border-primary/40"
                          onClick={() => {
                            dispatch(setAppMode('both'))
                            navigate(WALLET_REMOTE_PATH)
                          }}
                          type="button"
                        >
                          <Cloud className="h-5 w-5 flex-none text-content-tertiary group-hover:text-primary" />
                          <span className="flex flex-col">
                            <span className="text-sm font-medium text-content-primary">
                              {t('launcher.cards.remote', {
                                defaultValue: 'Connect a node',
                              })}
                            </span>
                            <span className="text-xs text-content-tertiary">
                              {t('launcher.remoteShort', {
                                defaultValue: 'Hosted or self-hosted',
                              })}
                            </span>
                          </span>
                        </button>
                        <button
                          className="group flex items-center gap-3 rounded-xl border border-divider/20 bg-surface-elevated/30 p-4 text-left transition-colors hover:border-primary/40 disabled:cursor-wait disabled:opacity-50"
                          disabled={!capabilitiesLoaded}
                          onClick={() => {
                            dispatch(setAppMode('both'))
                            setSearch({ node: 'local' })
                          }}
                          type="button"
                        >
                          <Server className="h-5 w-5 flex-none text-content-tertiary group-hover:text-primary" />
                          <span className="flex flex-col">
                            <span className="text-sm font-medium text-content-primary">
                              {t('launcher.cards.local', {
                                defaultValue: 'Run a node here',
                              })}
                            </span>
                            <span className="text-xs text-content-tertiary">
                              {capabilitiesLoaded
                                ? t('launcher.localShort', {
                                    defaultValue: 'For developers and testing',
                                  })
                                : t('launcher.checking', {
                                    defaultValue: 'Checking this computer…',
                                  })}
                            </span>
                          </span>
                        </button>
                        <button
                          className="group flex items-center gap-3 rounded-xl border border-divider/20 bg-surface-elevated/30 p-4 text-left transition-colors hover:border-primary/40"
                          onClick={() => void openMindOnly()}
                          type="button"
                        >
                          <Brain className="h-5 w-5 flex-none text-content-tertiary group-hover:text-primary" />
                          <span className="flex flex-col">
                            <span className="text-sm font-medium text-content-primary">
                              KaleidoMind
                            </span>
                            <span className="text-xs text-content-tertiary">
                              {t('launcher.mindShort', {
                                defaultValue: 'Local AI on this desktop',
                              })}
                            </span>
                          </span>
                        </button>
                      </div>
                    </section>
                  </div>
                ) : (
                  <>
                    <div className="mb-8 slide-in">
                      <button
                        className="px-3 py-2 text-content-secondary hover:text-white transition-colors flex items-center gap-1.5 hover:bg-surface-overlay/50 rounded-lg text-sm"
                        onClick={() =>
                          state?.from === P2P_NODE_PATH
                            ? navigate(P2P_NODE_PATH)
                            : setSearch({})
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
                          icon={
                            <Wallet className="w-6 h-6 text-status-success" />
                          }
                          onClick={() => navigateToWalletInit(WALLET_INIT_PATH)}
                          primary
                          title={t('walletSetup.createWalletTitle')}
                        />
                        <WalletAction
                          description={t(
                            'walletSetup.restoreWalletDescription'
                          )}
                          icon={
                            <ArrowLeftRight className="w-6 h-6 text-status-success" />
                          }
                          onClick={() =>
                            navigateToWalletInit(WALLET_RESTORE_PATH)
                          }
                          title={t('walletSetup.restoreWalletTitle')}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
