import { invoke } from '@tauri-apps/api/core'
import {
  Wallet,
  ArrowLeftRight,
  Cloud,
  Server,
  Container,
  ArrowRight,
  Zap,
  ArrowLeft,
  HelpCircle,
  Languages,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'

import {
  WALLET_INIT_PATH,
  WALLET_REMOTE_PATH,
  WALLET_RESTORE_PATH,
} from '../../app/router/paths'
import logoFull from '../../assets/logo-full.svg'
import { AppVersion } from '../../components/AppVersion'
import { Layout } from '../../components/Layout'
import { SupportModal } from '../../components/SupportModal'
import { Toolbar } from '../../components/Toolbar'
import { Card, Button } from '../../components/ui'
import {
  NodeOption,
  WalletAction,
  RemoteNodeInfo,
  IconWrapper,
} from '../../components/wallet-setup'
import { LANGUAGES } from '../../i18n/config'
import { setLanguage } from '../../slices/settings/settings.slice'
import type { RootState } from '../../app/store'

export const Component = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const currentLanguage = useSelector(
    (state: RootState) => state.settings.language
  )
  const [nodeType, setNodeType] = useState<'local' | 'remote' | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  // Docker / local node mode
  const [isNativeSupported, setIsNativeSupported] = useState(false)
  const [isDockerAvailable, setIsDockerAvailable] = useState(false)
  const [capabilitiesLoaded, setCapabilitiesLoaded] = useState(false)
  const [localNodeMode, setLocalNodeMode] = useState<
    'native' | 'docker' | null
  >(null)

  const handleLanguageChange = (languageCode: string) => {
    dispatch(setLanguage(languageCode))
    i18n.changeLanguage(languageCode)
  }

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

        // If only one option, auto-select it
        if (native && !docker) {
          setLocalNodeMode('native')
        } else if (docker && !native) {
          setLocalNodeMode('docker')
        }
        // When both available, leave null so user picks
      } catch (error) {
        console.error('Failed to check local node capabilities:', error)
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
            if (!localNodeMode) setLocalNodeMode('docker')
          }
        } catch {
          // Docker command not available
        }
      }
      setCapabilitiesLoaded(true)
    }

    checkCapabilities()
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
        setIsTransitioning(false)

        if (content) {
          content.classList.remove('fade-out')
          content.classList.add('fade-in')
        }
      }, 250)
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

          {/* Support button and version at bottom of sidebar */}
          <div className="p-4 border-t border-divider/10 space-y-3">
            <button
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 
                bg-gradient-to-r from-cyan/10 to-blue-500/10 hover:from-cyan/20 hover:to-blue-500/20 
                text-primary rounded-xl border border-primary/20 hover:border-primary/30
                transition-all duration-300 shadow-lg shadow-primary/5 hover:shadow-primary/10
                group relative overflow-hidden"
              onClick={() => setShowSupportModal(true)}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan/0 via-cyan/5 to-cyan/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <HelpCircle className="w-4 h-4 relative z-10" />
              <span className="relative z-10 font-medium">
                {t('walletSetup.getHelpSupport')}
              </span>
            </button>
            <AppVersion className="relative" />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto relative">
          {/* Animated background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan/5 via-transparent to-blue-500/5 pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(6,182,212,0.1),transparent_50%)] pointer-events-none" />

          {/* Language Selector */}
          <div className="absolute top-4 right-4 z-20">
            <div className="relative group">
              <div className="flex items-center space-x-2 px-4 py-2 bg-surface-elevated/60 backdrop-blur-xl border border-primary/20 rounded-lg hover:border-primary/40 transition-all duration-300 shadow-lg shadow-primary/5 hover:shadow-primary/10">
                <Languages className="w-4 h-4 text-primary" />
                <select
                  className="bg-transparent text-white text-sm font-medium cursor-pointer focus:outline-none appearance-none pr-6"
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  value={currentLanguage || 'en'}
                >
                  {Object.entries(LANGUAGES).map(([code, { name, flag }]) => (
                    <option key={code} value={code}>
                      {flag} {name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg
                    className="w-4 h-4 text-content-secondary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M19 9l-7 7-7-7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-screen py-8 md:py-16 flex items-center justify-center p-4 relative z-10">
            <Card
              className="p-6 md:p-10 w-full max-w-4xl backdrop-blur-xl bg-gradient-to-br from-blue-dark/40 via-blue-dark/30 to-blue-dark/40 
              border-2 border-primary/20 shadow-2xl shadow-primary/10 
              hover:shadow-primary/20 transition-all duration-500 
              ring-1 ring-cyan/10 hover:ring-cyan/20"
            >
              <div
                className="fade-in content-container"
                id="wallet-setup-content"
              >
                {!nodeType ? (
                  <>
                    <div className="text-center mb-12 slide-in">
                      <div className="relative inline-flex mb-6 group">
                        <div
                          className={`${IconWrapper} bg-gradient-to-br from-cyan/30 via-cyan/20 to-blue-500/20 border-2 border-primary/40 
                          rounded-2xl shadow-2xl shadow-primary/20 
                          relative z-10 transition-all duration-300 group-hover:scale-110 group-hover:shadow-primary/30`}
                        >
                          <Zap className="w-8 h-8 text-primary drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
                        </div>
                        {/* Glow effect */}
                        <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl scale-150 opacity-50 group-hover:opacity-75 transition-opacity duration-300" />
                      </div>
                      <h1 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-purple-400 to-violet-500 bg-clip-text text-transparent tracking-tight py-2">
                        {t('walletSetup.connectTitle')}
                      </h1>
                      <p className="text-content-secondary text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                        {t('walletSetup.connectSubtitle')}
                      </p>
                      <div className="mt-4 flex items-center justify-center space-x-2">
                        <div className="h-1 w-1 rounded-full bg-primary/60 animate-pulse" />
                        <div className="h-1 w-8 rounded-full bg-gradient-to-r from-cyan/60 to-transparent" />
                        <div className="h-1 w-1 rounded-full bg-primary/60 animate-pulse delay-75" />
                      </div>
                    </div>
                    {!capabilitiesLoaded ? (
                      <div className="flex justify-center py-12">
                        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
                        <NodeOption
                          description={t('walletSetup.remoteNodeDescription')}
                          icon={<Cloud className="w-6 h-6" />}
                          onClick={() => handleNodeTypeChange('remote')}
                          recommended={true}
                          title={t('walletSetup.remoteNodeTitle')}
                        />
                        <NodeOption
                          description={t('walletSetup.localNodeDescription')}
                          icon={<Server className="w-6 h-6" />}
                          onClick={() => handleNodeTypeChange('local')}
                          title={t('walletSetup.localNodeTitle')}
                        />
                      </div>
                    )}
                  </>
                ) : nodeType === 'local' ? (
                  <>
                    <div className="mb-8 slide-in">
                      <Button
                        className="hover:bg-surface-elevated/60 hover:border-primary/40 transition-all duration-300"
                        icon={<ArrowLeft className="w-4 h-4" />}
                        onClick={() => {
                          setLocalNodeMode(null)
                          handleNodeTypeChange(null)
                        }}
                        size="sm"
                        variant="outline"
                      >
                        {t('walletSetup.backToOptions')}
                      </Button>
                    </div>

                    <div className="text-center mb-10 slide-in">
                      <div className="relative inline-flex mb-6 group">
                        <div
                          className={`${IconWrapper} bg-gradient-to-br from-cyan/25 via-cyan/15 to-blue-500/15 border-2 border-primary/30
                          rounded-2xl shadow-2xl shadow-primary/15
                          relative z-10 transition-all duration-300 group-hover:scale-110 group-hover:shadow-primary/25`}
                        >
                          <Server className="w-7 h-7 text-primary drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]" />
                        </div>
                        <div className="absolute inset-0 bg-primary/15 rounded-2xl blur-xl scale-150 opacity-50 group-hover:opacity-75 transition-opacity duration-300" />
                      </div>
                      <h1 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-cyan via-blue-400 to-cyan bg-clip-text text-transparent leading-tight tracking-tight">
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
                            className={`w-5 h-5 ${localNodeMode === 'native' ? 'text-cyan' : 'text-content-secondary'}`}
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
                        <div className="absolute top-2 right-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {t('walletSetup.recommended')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mb-2">
                          <Container
                            className={`w-5 h-5 ${localNodeMode === 'docker' ? 'text-purple-400' : 'text-content-secondary'}`}
                          />
                          <span
                            className={`font-semibold ${localNodeMode === 'docker' ? 'text-white' : 'text-content-secondary'}`}
                          >
                            {t('walletSetup.backendDocker')}
                          </span>
                          {!isDockerAvailable && (
                            <span className="text-xs text-content-tertiary ml-auto">
                              {t('walletSetup.backendUnavailable')}
                            </span>
                          )}
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
                          icon={<Wallet className="w-6 h-6 text-white" />}
                          onClick={() => navigateToWalletInit(WALLET_INIT_PATH)}
                          primary
                          title={t('walletSetup.createWalletTitle')}
                        />
                        <WalletAction
                          description={t(
                            'walletSetup.restoreWalletDescription'
                          )}
                          icon={
                            <ArrowLeftRight className="w-6 h-6 text-white" />
                          }
                          onClick={() =>
                            navigateToWalletInit(WALLET_RESTORE_PATH)
                          }
                          title={t('walletSetup.restoreWalletTitle')}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="mb-8 slide-in">
                      <Button
                        className="hover:bg-surface-elevated/60 hover:border-primary/40 transition-all duration-300"
                        icon={<ArrowLeft className="w-4 h-4" />}
                        onClick={() => handleNodeTypeChange(null)}
                        size="sm"
                        variant="outline"
                      >
                        {t('walletSetup.backToOptions')}
                      </Button>
                    </div>

                    <div className="text-center mb-10 slide-in">
                      <div className="relative inline-flex mb-6 group">
                        <div
                          className={`${IconWrapper} bg-gradient-to-br from-cyan/25 via-cyan/15 to-blue-500/15 border-2 border-primary/30
                          rounded-2xl shadow-2xl shadow-primary/15
                          relative z-10 transition-all duration-300 group-hover:scale-110 group-hover:shadow-primary/25`}
                        >
                          <Cloud className="w-7 h-7 text-primary drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]" />
                        </div>
                        <div className="absolute inset-0 bg-primary/15 rounded-2xl blur-xl scale-150 opacity-50 group-hover:opacity-75 transition-opacity duration-300" />
                      </div>
                      <h1 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-cyan via-blue-400 to-cyan bg-clip-text text-transparent leading-tight tracking-tight">
                        {t('walletSetup.connectRemoteTitle')}
                      </h1>
                      <p className="text-content-secondary text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                        {t('walletSetup.connectRemoteSubtitle')}
                      </p>
                    </div>

                    <RemoteNodeInfo />

                    <div className="flex justify-center mt-8 fade-in">
                      <Button
                        className="group relative overflow-hidden shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all duration-300"
                        icon={
                          <ArrowRight className="w-5 h-5 ml-1 group-hover:translate-x-1 transition-transform duration-300" />
                        }
                        iconPosition="right"
                        onClick={() => navigate(WALLET_REMOTE_PATH)}
                        size="lg"
                        variant="primary"
                      >
                        <span className="relative z-10">
                          {t('walletSetup.continueSetup')}
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan/0 via-white/10 to-cyan/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Card>
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
