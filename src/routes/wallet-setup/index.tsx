import { invoke } from '@tauri-apps/api/core'
import {
  Wallet,
  ArrowLeftRight,
  Cloud,
  Server,
  Container,
  ArrowLeft,
  HelpCircle,
  Bell,
  Brain,
  Coins,
} from 'lucide-react'
import React, { useState, useEffect } from 'react'
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
import logoIcon from '../../assets/logo.svg'
import { AppVersion } from '../../components/AppVersion'
import { Layout } from '../../components/Layout'
import { SupportModal } from '../../components/SupportModal'
import { Toolbar } from '../../components/Toolbar'
import { WalletAction, IconWrapper } from '../../components/wallet-setup'
import { setAppMode } from '../../slices/settings/settings.slice'
import { logger } from '../../utils/logger'
import { nodeSettingsActions } from '../../slices/nodeSettings/nodeSettings.slice'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'

/** One way into the app: an icon, what it does, and what it needs. */
const LaunchCard = ({
  title,
  description,
  icon,
  tag,
  onClick,
  disabled,
}: {
  title: string
  description: string
  icon: React.ReactNode
  tag?: string
  onClick: () => void
  disabled?: boolean
}) => (
  <button
    className="group relative flex h-full w-full flex-col gap-3 rounded-2xl border-2 border-divider/20 bg-surface-elevated/40 p-6 text-left backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-surface-elevated/60 hover:shadow-lg hover:shadow-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-wait disabled:opacity-50 disabled:hover:translate-y-0"
    disabled={disabled}
    onClick={onClick}
    type="button"
  >
    <div className="flex items-center gap-4">
      <div className="flex items-center justify-center rounded-xl bg-primary/5 p-3 text-primary/80 transition-colors group-hover:bg-primary/15 group-hover:text-primary">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white">{title}</h3>
      {tag && (
        <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
          {tag}
        </span>
      )}
    </div>
    <p className="text-sm leading-relaxed text-content-secondary">
      {description}
    </p>
  </button>
)

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
        {/* Sidebar with Toolbar */}
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

        {/* Main Content */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          {/* Top bar with Support + Notifications */}
          <div className="flex-shrink-0 z-30 bg-surface-base/80 backdrop-blur-xl border-b border-divider/20 px-6 py-4 flex justify-end items-center gap-2">
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

          <div className="flex-1 flex items-center justify-center p-4 relative z-10 overflow-hidden">
            <div className="w-full max-w-4xl">
              <div
                className="fade-in content-container"
                id="wallet-setup-content"
              >
                {!nodeType || nodeType === 'remote' ? (
                  <>
                    <div className="text-center mb-10 slide-in">
                      <div className="relative inline-flex mb-6">
                        {/* Purple ripple rings */}
                        <div className="absolute inset-0 rounded-2xl bg-purple/15 animate-ripple-1 pointer-events-none" />
                        <div className="absolute inset-0 rounded-2xl bg-purple/10 animate-ripple-2 pointer-events-none" />
                        <div className="absolute inset-0 rounded-2xl bg-purple/8 animate-ripple-3 pointer-events-none" />
                        <div
                          className={`${IconWrapper} bg-gradient-to-br from-primary/20 via-primary/10 to-purple/10 border-2 border-primary/40
                          rounded-2xl shadow-2xl shadow-primary/20
                          relative z-10`}
                        >
                          <img
                            alt="KaleidoSwap"
                            className="w-8 h-8 brightness-0 invert"
                            src={logoIcon}
                          />
                        </div>
                        {/* Green glow */}
                        <div className="absolute inset-0 bg-primary/10 rounded-2xl blur-xl scale-150 opacity-30 [animation:pulse_6s_ease-in-out_infinite]" />
                      </div>
                      <h1 className="text-3xl md:text-5xl font-bold mb-4 text-white tracking-tight leading-tight py-2">
                        {t('walletSetup.welcomeTo')}{' '}
                        <span className="bg-gradient-to-r from-primary to-purple bg-clip-text text-transparent">
                          KaleidoSwap
                        </span>
                      </h1>
                      <p className="mx-auto max-w-xl text-base text-content-secondary">
                        {t('launcher.subtitle', {
                          defaultValue:
                            'Choose how you want to use it. You can change later.',
                        })}
                      </p>
                    </div>

                    {mindLaunchError && (
                      <p className="mb-4 text-sm text-red-400" role="alert">
                        {mindLaunchError}
                      </p>
                    )}

                    {/* Four ways in, each doing one thing. The node entries start Node + Mind,
                        the default; "only node" is a setting. */}
                    <div className="flex flex-col gap-8 slide-in">
                      <section className="flex flex-col gap-3">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-content-tertiary">
                          {t('launcher.groups.noNode', {
                            defaultValue: 'Start without a node',
                          })}
                        </h2>
                        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                          <LaunchCard
                            description={t('launcher.cards.p2p.body', {
                              defaultValue:
                                'Trade RGB assets directly with other people, from a wallet of its own kept with a recovery phrase.',
                            })}
                            disabled={p2pWhere?.hint === 'image_unpublished'}
                            icon={<Coins className="w-6 h-6" />}
                            onClick={() => navigate(P2P_WALLET_PATH)}
                            tag={
                              p2pWhere?.hint === 'docker_missing'
                                ? t('launcher.cards.p2p.needsDocker', {
                                    defaultValue: 'Needs Docker',
                                  })
                                : p2pWhere?.hint === 'docker_stopped'
                                  ? t('launcher.cards.p2p.startDocker', {
                                      defaultValue: 'Start Docker first',
                                    })
                                  : p2pWhere?.hint === 'image_unpublished'
                                    ? t('launcher.cards.p2p.unavailable', {
                                        defaultValue: 'Not available yet',
                                      })
                                    : undefined
                            }
                            title={t('launcher.cards.p2p.title', {
                              defaultValue: 'P2P Wallet',
                            })}
                          />
                          <LaunchCard
                            description={t('launcher.cards.mind.body', {
                              defaultValue:
                                'Run local AI models on this desktop. You can connect a node any time later.',
                            })}
                            icon={<Brain className="w-6 h-6" />}
                            onClick={() => void openMindOnly()}
                            title="KaleidoMind"
                          />
                        </div>
                      </section>

                      <section className="flex flex-col gap-3">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-content-tertiary">
                          {t('launcher.groups.node', {
                            defaultValue: 'Use an RGB Lightning node',
                          })}
                        </h2>
                        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                          <LaunchCard
                            description={t('walletSetup.remoteNodeDescription')}
                            icon={<Cloud className="w-6 h-6" />}
                            onClick={() => {
                              dispatch(setAppMode('both'))
                              navigate(WALLET_REMOTE_PATH)
                            }}
                            tag={t('launcher.recommended', {
                              defaultValue: 'Recommended',
                            })}
                            title={t('launcher.cards.remote', {
                              defaultValue: 'Connect a node',
                            })}
                          />
                          <LaunchCard
                            description={t('walletSetup.localNodeDescription')}
                            disabled={!capabilitiesLoaded}
                            icon={<Server className="w-6 h-6" />}
                            onClick={() => {
                              dispatch(setAppMode('both'))
                              handleNodeTypeChange('local')
                            }}
                            title={t('launcher.cards.local', {
                              defaultValue: 'Run a node here',
                            })}
                          />
                        </div>
                      </section>
                    </div>
                  </>
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
