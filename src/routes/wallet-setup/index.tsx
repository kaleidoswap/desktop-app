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

          {/* Support button at bottom of sidebar */}
          <div className="p-4 border-t border-divider/10">
            <button
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 
                bg-blue-dark/50 hover:bg-blue-dark text-cyan rounded-lg 
                transition-colors duration-200"
              onClick={() => setShowSupportModal(true)}
            >
              <HelpCircle className="w-4 h-4" />
              <span>Get Help & Support</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="min-h-screen py-6 md:py-12 flex items-center justify-center p-3">
            <Card className="p-5 md:p-8 w-full max-w-4xl backdrop-blur-md bg-blue-dark/30 border-divider/30 shadow-xl shadow-blue-darkest/30">
              <div
                className="fade-in content-container"
                id="wallet-setup-content"
              >
                {!nodeType ? (
                  <>
                    <div className="text-center mb-10 slide-in">
                      <div
                        className={`${IconWrapper} bg-gradient-to-br from-cyan/30 to-cyan/5 border border-cyan/30 
                        inline-flex rounded-2xl mb-5 shadow-lg shadow-cyan/5`}
                      >
                        <Zap className="w-8 h-8 text-cyan" />
                      </div>
                      <h1 className="text-2xl md:text-3xl font-bold mb-3 bg-gradient-to-r from-cyan to-blue-400 bg-clip-text text-transparent">
                        Connect to RGB Lightning Network
                      </h1>
                      <p className="text-gray-400 text-sm md:text-base max-w-xl mx-auto">
                        Choose your preferred way to connect to the network
                      </p>
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
                      <div className="mt-6 text-center">
                        <p className="text-gray-400 text-sm">
                          Local node is not supported on Windows. Use a remote
                          node connection instead.
                        </p>
                      </div>
                    )}
                  </>
                ) : nodeType === 'local' ? (
                  <>
                    <div className="mb-6 slide-in">
                      <Button
                        className="hover:bg-blue-dark/60"
                        icon={<ArrowLeft className="w-4 h-4" />}
                        onClick={() => handleNodeTypeChange(null)}
                        size="sm"
                        variant="outline"
                      >
                        Back to Connection Options
                      </Button>
                    </div>

                    <div className="text-center mb-8 slide-in">
                      <div
                        className={`${IconWrapper} bg-gradient-to-br from-cyan/20 to-cyan/5 border border-cyan/20 
                        inline-flex rounded-2xl mb-4 shadow-lg shadow-cyan/5`}
                      >
                        <Server className="w-7 h-7 text-cyan" />
                      </div>
                      <h1 className="text-2xl md:text-3xl font-bold mb-3 bg-gradient-to-r from-cyan to-blue-400 bg-clip-text text-transparent">
                        Set Up Local Node
                      </h1>
                      <p className="text-gray-400 text-sm md:text-base max-w-xl mx-auto">
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
                    <div className="mb-6 slide-in">
                      <Button
                        className="hover:bg-blue-dark/60"
                        icon={<ArrowLeft className="w-4 h-4" />}
                        onClick={() => handleNodeTypeChange(null)}
                        size="sm"
                        variant="outline"
                      >
                        Back to Connection Options
                      </Button>
                    </div>

                    <div className="text-center mb-8 slide-in">
                      <div
                        className={`${IconWrapper} bg-gradient-to-br from-cyan/20 to-cyan/5 border border-cyan/20 
                        inline-flex rounded-2xl mb-4 shadow-lg shadow-cyan/5`}
                      >
                        <Cloud className="w-7 h-7 text-cyan" />
                      </div>
                      <h1 className="text-2xl md:text-3xl font-bold mb-3 bg-gradient-to-r from-cyan to-blue-400 bg-clip-text text-transparent">
                        Connect to Remote Node
                      </h1>
                      <p className="text-gray-400 text-sm md:text-base max-w-xl mx-auto">
                        Connect to an existing RGB Lightning node hosted by you
                        or a provider
                      </p>
                    </div>

                    <RemoteNodeInfo />

                    <div className="flex justify-center mt-6 fade-in">
                      <Button
                        icon={<ArrowRight className="w-5 h-5 ml-1" />}
                        iconPosition="right"
                        onClick={() => navigate(WALLET_REMOTE_PATH)}
                        size="lg"
                        variant="primary"
                      >
                        Continue to Connection Setup
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
