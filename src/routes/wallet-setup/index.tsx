import { invoke } from '@tauri-apps/api/core'
import {
  Wallet,
  ArrowLeftRight,
  Cloud,
  Server,
  ArrowRight,
  Zap,
  ArrowLeft,
  HelpCircle,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  WALLET_INIT_PATH,
  WALLET_REMOTE_PATH,
  WALLET_RESTORE_PATH,
} from '../../app/router/paths'
import logo from '../../assets/logo.svg'
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

export const Component = () => {
  const navigate = useNavigate()
  const [nodeType, setNodeType] = useState<'local' | 'remote' | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [isLocalNodeSupported, setIsLocalNodeSupported] = useState(true)

  // Check if local node is supported on this platform
  useEffect(() => {
    const checkLocalNodeSupport = async () => {
      try {
        const supported = await invoke<boolean>('is_local_node_supported')
        setIsLocalNodeSupported(supported)
      } catch (error) {
        console.error('Failed to check local node support:', error)
        // If we can't check, assume it's not supported to be safe
        setIsLocalNodeSupported(false)
      }
    }

    checkLocalNodeSupport()
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

  return (
    <Layout>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar with Toolbar */}
        <div className="w-72 h-full bg-blue-darkest border-r border-divider/10 flex flex-col">
          <div className="flex items-center p-4 border-b border-divider/10">
            <img
              alt="KaleidoSwap"
              className="h-8 cursor-pointer"
              onClick={() => {}}
              src={logo}
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
                text-cyan rounded-xl border border-cyan/20 hover:border-cyan/30
                transition-all duration-300 shadow-lg shadow-cyan/5 hover:shadow-cyan/10
                group relative overflow-hidden"
              onClick={() => setShowSupportModal(true)}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan/0 via-cyan/5 to-cyan/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <HelpCircle className="w-4 h-4 relative z-10" />
              <span className="relative z-10 font-medium">
                Get Help & Support
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

          <div className="min-h-screen py-8 md:py-16 flex items-center justify-center p-4 relative z-10">
            <Card
              className="p-6 md:p-10 w-full max-w-4xl backdrop-blur-xl bg-gradient-to-br from-blue-dark/40 via-blue-dark/30 to-blue-dark/40 
              border-2 border-cyan/20 shadow-2xl shadow-cyan/10 
              hover:shadow-cyan/20 transition-all duration-500 
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
                          className={`${IconWrapper} bg-gradient-to-br from-cyan/30 via-cyan/20 to-blue-500/20 border-2 border-cyan/40 
                          rounded-2xl shadow-2xl shadow-cyan/20 
                          relative z-10 transition-all duration-300 group-hover:scale-110 group-hover:shadow-cyan/30`}
                        >
                          <Zap className="w-8 h-8 text-cyan drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
                        </div>
                        {/* Glow effect */}
                        <div className="absolute inset-0 bg-cyan/20 rounded-2xl blur-xl scale-150 opacity-50 group-hover:opacity-75 transition-opacity duration-300" />
                      </div>
                      <h1 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-cyan via-blue-400 to-cyan bg-clip-text text-transparent leading-tight tracking-tight">
                        Connect to RGB Lightning Network
                      </h1>
                      <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                        Choose your preferred way to connect to the network
                      </p>
                      <div className="mt-4 flex items-center justify-center space-x-2">
                        <div className="h-1 w-1 rounded-full bg-cyan/60 animate-pulse" />
                        <div className="h-1 w-8 rounded-full bg-gradient-to-r from-cyan/60 to-transparent" />
                        <div className="h-1 w-1 rounded-full bg-cyan/60 animate-pulse delay-75" />
                      </div>
                    </div>
                    <div
                      className={`grid gap-6 ${isLocalNodeSupported ? 'grid-cols-1 md:grid-cols-2' : 'max-w-md mx-auto'}`}
                    >
                      <NodeOption
                        description="Connect to a hosted node or self-hosted instance. Recommended for most users and advanced setups."
                        icon={<Cloud className="w-6 h-6" />}
                        onClick={() => handleNodeTypeChange('remote')}
                        recommended={true}
                        title="Remote Node"
                      />
                      {isLocalNodeSupported && (
                        <NodeOption
                          description="Run a node on your local machine. Ideal for developers and testing environments."
                          icon={<Server className="w-6 h-6" />}
                          onClick={() => handleNodeTypeChange('local')}
                          title="Local Node"
                        />
                      )}
                    </div>
                    {!isLocalNodeSupported && (
                      <div className="mt-8 text-center fade-in">
                        <div className="inline-flex items-center space-x-2 px-4 py-3 bg-blue-dark/40 border border-cyan/20 rounded-xl">
                          <div className="w-2 h-2 rounded-full bg-cyan/60 animate-pulse" />
                          <p className="text-gray-400 text-sm">
                            Local node is not supported on Windows. Use a remote
                            node connection instead.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                ) : nodeType === 'local' ? (
                  <>
                    <div className="mb-8 slide-in">
                      <Button
                        className="hover:bg-blue-dark/60 hover:border-cyan/40 transition-all duration-300"
                        icon={<ArrowLeft className="w-4 h-4" />}
                        onClick={() => handleNodeTypeChange(null)}
                        size="sm"
                        variant="outline"
                      >
                        Back to Connection Options
                      </Button>
                    </div>

                    <div className="text-center mb-10 slide-in">
                      <div className="relative inline-flex mb-6 group">
                        <div
                          className={`${IconWrapper} bg-gradient-to-br from-cyan/25 via-cyan/15 to-blue-500/15 border-2 border-cyan/30 
                          rounded-2xl shadow-2xl shadow-cyan/15 
                          relative z-10 transition-all duration-300 group-hover:scale-110 group-hover:shadow-cyan/25`}
                        >
                          <Server className="w-7 h-7 text-cyan drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]" />
                        </div>
                        <div className="absolute inset-0 bg-cyan/15 rounded-2xl blur-xl scale-150 opacity-50 group-hover:opacity-75 transition-opacity duration-300" />
                      </div>
                      <h1 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-cyan via-blue-400 to-cyan bg-clip-text text-transparent leading-tight tracking-tight">
                        Set Up Local Node
                      </h1>
                      <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                        Choose an option to get started with your local RGB
                        Lightning node
                      </p>
                    </div>
                    {/* TODO: Add local node warning after mainnet launch */}
                    {/* <LocalNodeWarning /> */}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <WalletAction
                        description="Create a new wallet with a fresh seed phrase and set up your node."
                        icon={<Wallet className="w-6 h-6 text-white" />}
                        onClick={() => navigate(WALLET_INIT_PATH)}
                        primary
                        title="Create New Wallet"
                      />
                      <WalletAction
                        description="Restore a wallet using your existing encrypted backup."
                        icon={<ArrowLeftRight className="w-6 h-6 text-white" />}
                        onClick={() => navigate(WALLET_RESTORE_PATH)}
                        title="Restore Wallet"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-8 slide-in">
                      <Button
                        className="hover:bg-blue-dark/60 hover:border-cyan/40 transition-all duration-300"
                        icon={<ArrowLeft className="w-4 h-4" />}
                        onClick={() => handleNodeTypeChange(null)}
                        size="sm"
                        variant="outline"
                      >
                        Back to Connection Options
                      </Button>
                    </div>

                    <div className="text-center mb-10 slide-in">
                      <div className="relative inline-flex mb-6 group">
                        <div
                          className={`${IconWrapper} bg-gradient-to-br from-cyan/25 via-cyan/15 to-blue-500/15 border-2 border-cyan/30 
                          rounded-2xl shadow-2xl shadow-cyan/15 
                          relative z-10 transition-all duration-300 group-hover:scale-110 group-hover:shadow-cyan/25`}
                        >
                          <Cloud className="w-7 h-7 text-cyan drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]" />
                        </div>
                        <div className="absolute inset-0 bg-cyan/15 rounded-2xl blur-xl scale-150 opacity-50 group-hover:opacity-75 transition-opacity duration-300" />
                      </div>
                      <h1 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-cyan via-blue-400 to-cyan bg-clip-text text-transparent leading-tight tracking-tight">
                        Connect to Remote Node
                      </h1>
                      <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                        Connect to an existing RGB Lightning node hosted by you
                        or a provider
                      </p>
                    </div>

                    <RemoteNodeInfo />

                    <div className="flex justify-center mt-8 fade-in">
                      <Button
                        className="group relative overflow-hidden shadow-xl shadow-cyan/20 hover:shadow-cyan/30 transition-all duration-300"
                        icon={
                          <ArrowRight className="w-5 h-5 ml-1 group-hover:translate-x-1 transition-transform duration-300" />
                        }
                        iconPosition="right"
                        onClick={() => navigate(WALLET_REMOTE_PATH)}
                        size="lg"
                        variant="primary"
                      >
                        <span className="relative z-10">
                          Continue to Connection Setup
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
