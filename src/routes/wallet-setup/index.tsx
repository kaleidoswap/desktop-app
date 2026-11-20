import { invoke } from '@tauri-apps/api/core'
import {
  ArrowRight,
  ArrowLeftRight,
  Wallet,
  Lock,
  Network,
  ShieldCheck,
  Cloud,
  Server,
  Container,
  ArrowLeft,
  HelpCircle,
  Bell,
  Brain,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'

import { useNotification } from '../../components/NotificationSystem'

import {
  WALLET_INIT_PATH,
  WALLET_REMOTE_PATH,
  WALLET_RESTORE_PATH,
  KALEIDO_MIND_PATH,
  P2P_WALLET_PATH,
} from '../../app/router/paths'
import logoFull from '../../assets/logo-full.svg'
import { AppVersion } from '../../components/AppVersion'
import { Layout } from '../../components/Layout'
import { SupportModal } from '../../components/SupportModal'
import { Toolbar } from '../../components/Toolbar'
import { WalletAction, IconWrapper } from '../../components/wallet-setup'
import { setAppMode } from '../../slices/settings/settings.slice'
import { logger } from '../../utils/logger'
import { nodeSettingsActions } from '../../slices/nodeSettings/nodeSettings.slice'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { walletAccountFor } from '../../constants/p2p'
import { p2pNetworks, p2pProfileGet } from '../trade/nostr-p2p/p2p'
import { readSelectedWalletId } from '../trade/nostr-p2p/wallets'

export const Component = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [nodeType, setNodeType] = useState<'local' | 'remote' | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const { toggleNotificationPanel, notifications } = useNotification()
  // Docker / local node mode
  const [isNativeSupported, setIsNativeSupported] = useState(false)
  const [isDockerAvailable, setIsDockerAvailable] = useState(false)
  const [capabilitiesLoaded, setCapabilitiesLoaded] = useState(false)
  const [localNodeMode, setLocalNodeMode] = useState<
    'native' | 'docker' | null
  >(null)

  // Check local node capabilities (native binary + Docker)
  useEffect(() => {
    const checkCapabilities = async () => {
      try {
        const caps = await invoke<Record<string, boolean>>(
          'get_local_node_capabilities'
        )
        const native = caps.native ?? false
        const docker = caps.docker ?? false
        setIsNativeSupported(native)
        setIsDockerAvailable(docker)

        // Prefer Docker when present so local setup can proceed immediately.
        if (docker) {
          setLocalNodeMode('docker')
        } else if (native) {
          setLocalNodeMode('native')
        }
      } catch (error) {
        logger.error('Failed to check local node capabilities:', error)
        // Fallback: check each backend separately
        try {
          const supported = await invoke<boolean>('is_local_node_supported')
          if (supported) {
            setIsNativeSupported(true)
            setLocalNodeMode('native')
          }
        } catch {
          // Native not available
        }
        try {
          const docker = await invoke<boolean>('is_docker_available')
          if (docker) {
            setIsDockerAvailable(true)
            setLocalNodeMode((mode) => mode ?? 'docker')
          }
        } catch {
          // Docker command not available
        }
      }
      setCapabilitiesLoaded(true)
    }

    checkCapabilities()
  }, [])

  // the P2P market is not bundled on every system (not on Windows yet)
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
  const [hasTradingWallet, setHasTradingWallet] = useState(false)
  useEffect(() => {
    let cancelled = false
    p2pNetworks()
      .then(async (nets) => {
        const net = nets[0]
        if (!net) return
        const account = walletAccountFor(net, readSelectedWalletId(net.network))
        const profile = await p2pProfileGet(account)
        if (!cancelled) setHasTradingWallet(!!profile)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  // the node list only earns its column when there are nodes in it
  const [hasNodes, setHasNodes] = useState(false)
  useEffect(() => {
    invoke<unknown[]>('get_accounts')
      .then((a) => setHasNodes(Array.isArray(a) && a.length > 0))
      .catch(() => setHasNodes(false))
  }, [])

  // Handle transitions
  const handleNodeTypeChange = (type: 'local' | 'remote' | null) => {
    if (type !== nodeType && !isTransitioning) {
      setIsTransitioning(true)

      // Apply fade-out class first
      const content = document.getElementById('wallet-setup-content')
      if (content) {
        content.classList.remove('fade-in')
        content.classList.add('fade-out')
      }

      // Short delay for transition
      setTimeout(() => {
        setNodeType(type)
        if (type === 'local' && !localNodeMode) {
          if (isDockerAvailable) {
            setLocalNodeMode('docker')
          } else if (isNativeSupported) {
            setLocalNodeMode('native')
          }
        }
        setIsTransitioning(false)

        if (content) {
          content.classList.remove('fade-out')
          content.classList.add('fade-in')
        }
      }, 250)
    }
  }

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
      navigate(`${path}?mode=docker`)
    } else {
      navigate(path)
    }
  }

  return (
    <Layout>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar with the node list, when there are nodes */}
        {hasNodes && (
          <div className="w-72 h-full bg-surface-base border-r border-divider/10 flex flex-col">
            <div className="flex items-center p-4 border-b border-divider/10">
              <img
                alt="KaleidoSwap"
                className="h-8 cursor-pointer"
                onClick={() => {}}
                src={logoFull}
              />
            </div>

            {/* Toolbar */}
            <div className="flex-1 overflow-hidden">
              <Toolbar />
            </div>

            {/* App version at bottom of sidebar */}
            <div className="p-4 border-t border-divider/10">
              <AppVersion className="relative" />
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          {/* Top bar with Support + Notifications */}
          <div className="flex-shrink-0 z-30 bg-surface-base/80 backdrop-blur-xl border-b border-divider/20 px-6 py-4 flex justify-end items-center gap-2">
            {!hasNodes && (
              <>
                <img alt="KaleidoSwap" className="h-7" src={logoFull} />
                <span className="flex-1" />
                <AppVersion className="relative mr-2" />
              </>
            )}
            <button
              aria-label="Support"
              className="p-3 text-content-secondary hover:text-white rounded-xl hover:bg-gradient-to-r hover:from-surface-overlay hover:to-surface-overlay/50
                         transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => setShowSupportModal(true)}
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              aria-label="Toggle notifications"
              className="relative p-3 text-content-secondary hover:text-white rounded-xl hover:bg-gradient-to-r hover:from-surface-overlay hover:to-surface-overlay/50
                         transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
              onClick={toggleNotificationPanel}
            >
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-gradient-to-br from-cyan to-cyan/80 text-white text-xs font-bold flex items-center justify-center rounded-full shadow-lg shadow-primary/30 animate-pulse ring-2 ring-surface-base">
                  {notifications.length}
                </span>
              )}
            </button>
          </div>

          {/* Animated background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan/5 via-transparent to-blue-500/5 pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(6,182,212,0.1),transparent_50%)] pointer-events-none" />

          <div className="flex-1 flex items-center justify-center px-8 py-10 relative z-10 overflow-y-auto">
            <div
              className={`w-full ${!nodeType || nodeType === 'remote' ? 'max-w-6xl' : 'max-w-4xl'}`}
            >
              <div
                className="fade-in content-container"
                id="wallet-setup-content"
              >
                {!nodeType || nodeType === 'remote' ? (
                  <div className="flex flex-col gap-12 slide-in">
                    {mindLaunchError && (
                      <p className="text-sm text-status-danger" role="alert">
                        {mindLaunchError}
                      </p>
                    )}

                    <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
                      <section className="flex flex-col gap-5">
                        <span className="text-xs font-medium tracking-[0.12em] text-primary">
                          {t('launcher.eyebrow', {
                            defaultValue:
                              'PEER TO PEER · ON BITCOIN · OVER NOSTR',
                          })}
                        </span>
                        <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-white md:text-5xl">
                          {t('launcher.headline', {
                            defaultValue:
                              'Trade RGB assets directly with other people.',
                          })}
                        </h1>
                        <p className="max-w-xl text-lg leading-relaxed text-content-secondary">
                          {t('launcher.lede', {
                            defaultValue:
                              'A wallet of your own, a market run by independent makers, and every swap settled in one Bitcoin transaction you sign. No account, no node to set up.',
                          })}
                        </p>
                        <div className="flex flex-wrap gap-3 pt-1">
                          {hasTradingWallet ? (
                            <button
                              className="flex min-h-12 items-center gap-2 rounded-lg bg-primary px-6 text-base font-bold text-surface-base transition-opacity hover:opacity-90 disabled:opacity-50"
                              disabled={p2pBlocked}
                              onClick={() => navigate(P2P_WALLET_PATH)}
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
                                  defaultValue:
                                    'Restore from a recovery phrase',
                                })}
                              </button>
                            </>
                          )}
                        </div>
                        {p2pNote ? (
                          <p className="text-sm text-status-warning">
                            {p2pNote}
                          </p>
                        ) : (
                          <p className="text-sm text-content-tertiary">
                            {hasTradingWallet
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

                      <ul className="flex flex-col gap-3">
                        {(
                          [
                            [
                              <Lock className="h-5 w-5" key="i" />,
                              'bg-primary/10 text-primary',
                              t('launcher.why.keys.title', {
                                defaultValue: 'Your keys, on this computer',
                              }),
                              t('launcher.why.keys.body', {
                                defaultValue:
                                  'Kept in the system keychain behind Touch ID. Nobody else can move your funds.',
                              }),
                            ],
                            [
                              <Network className="h-5 w-5" key="i" />,
                              'bg-purple/15 text-purple',
                              t('launcher.why.relays.title', {
                                defaultValue: 'A market on open relays',
                              }),
                              t('launcher.why.relays.body', {
                                defaultValue:
                                  'Offers travel over Nostr relays you can choose. If one goes down, the market keeps working.',
                              }),
                            ],
                            [
                              <ShieldCheck className="h-5 w-5" key="i" />,
                              'bg-primary/10 text-primary',
                              t('launcher.why.atomic.title', {
                                defaultValue: 'All or nothing',
                              }),
                              t('launcher.why.atomic.body', {
                                defaultValue:
                                  'Both sides of a swap are in the same transaction: you get the asset, or your bitcoin never leaves.',
                              }),
                            ],
                          ] as const
                        ).map(([icon, tone, title, body]) => (
                          <li
                            className="flex gap-4 rounded-2xl border border-divider/10 bg-surface-elevated/40 p-5"
                            key={title}
                          >
                            <span
                              className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${tone}`}
                            >
                              {icon}
                            </span>
                            <span className="flex flex-col gap-1">
                              <span className="font-medium text-content-primary">
                                {title}
                              </span>
                              <span className="text-sm leading-relaxed text-content-tertiary">
                                {body}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <section className="flex flex-col gap-3 border-t border-divider/10 pt-6">
                      <h2 className="text-sm text-content-tertiary">
                        {t('launcher.nodeQuestion', {
                          defaultValue:
                            'Already run an RGB Lightning node, or want to try KaleidoMind?',
                        })}
                      </h2>
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
                            handleNodeTypeChange('local')
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
                ) : nodeType === 'local' ? (
                  <>
                    <div className="mb-8 slide-in">
                      <button
                        className="px-3 py-2 text-content-secondary hover:text-white transition-colors flex items-center gap-1.5 hover:bg-surface-overlay/50 rounded-lg text-sm"
                        onClick={() => handleNodeTypeChange(null)}
                        type="button"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back
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
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <SupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />
    </Layout>
  )
}
