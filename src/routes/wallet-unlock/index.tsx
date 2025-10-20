import { invoke } from '@tauri-apps/api/core'
import {
  ChevronDown,
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  Shield,
  Server,
  Globe,
  Zap,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import {
  WALLET_DASHBOARD_PATH,
  WALLET_SETUP_PATH,
} from '../../app/router/paths'
import { useAppSelector } from '../../app/store/hooks'
import { Layout } from '../../components/Layout'
import { Button, Card, SetupLayout } from '../../components/ui'
import { UnlockingProgress } from '../../components/UnlockingProgress'
import { parseRpcUrl } from '../../helpers/utils'
import { nodeApi, NodeApiError } from '../../slices/nodeApi/nodeApi.slice'

interface Fields {
  password: string
}

export const Component = () => {
  const nodeSettings = useAppSelector((state) => state.nodeSettings.data)
  const [unlock] = nodeApi.endpoints.unlock.useLazyQuery()
  const [nodeInfo] = nodeApi.endpoints.nodeInfo.useLazyQuery()

  const navigate = useNavigate()

  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [showInitModal, setShowInitModal] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [isConnectionDetailsOpen, setIsConnectionDetailsOpen] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(true)

  // Check if the node is already unlocked when the component mounts
  useEffect(() => {
    const checkNodeStatus = async () => {
      setIsCheckingStatus(true)
      try {
        const nodeInfoRes = await nodeInfo()
        if (nodeInfoRes.isSuccess) {
          navigate(WALLET_DASHBOARD_PATH)
        }
      } catch (error: any) {
        // Only show error toast if it's not a FETCH_ERROR (connection error)
        // as we expect connection errors when node is not running
        if (error?.status !== 'FETCH_ERROR') {
          toast.error(
            'Failed to check node status: ' +
              (error.message || 'Unknown error'),
            {
              autoClose: 5000,
              position: 'top-right',
            }
          )
        }
      } finally {
        setIsCheckingStatus(false)
      }
    }
    checkNodeStatus()
  }, [])

  const unlockForm = useForm<Fields>({
    defaultValues: {
      password: '',
    },
  })

  const onSubmit: SubmitHandler<Fields> = async (data) => {
    let shouldRetry = true
    let pollingInterval = 2000 // Start with 2 seconds
    const maxPollingInterval = 15000 // Max 15 seconds
    let doubleFetchErrorFlag = false

    setIsUnlocking(true)
    setErrors([])
    setUnlockError(null)

    while (shouldRetry) {
      try {
        const rpcConfig = parseRpcUrl(nodeSettings.rpc_connection_url)

        await unlock({
          bitcoind_rpc_host: rpcConfig.host,
          bitcoind_rpc_password: rpcConfig.password,
          bitcoind_rpc_port: rpcConfig.port,
          bitcoind_rpc_username: rpcConfig.username,
          indexer_url: nodeSettings.indexer_url,
          password: data.password,
          proxy_endpoint: nodeSettings.proxy_endpoint,
        }).unwrap()

        const nodeInfoRes = await nodeInfo()
        if (nodeInfoRes.isSuccess) {
          toast.success('Wallet unlocked successfully!', {
            autoClose: 3000,
            position: 'bottom-right',
          })
          navigate(WALLET_DASHBOARD_PATH)
        } else {
          throw new Error('Failed to get node info after unlock')
        }

        shouldRetry = false
      } catch (e: any) {
        // Handle any kind of timeout or resource loading error
        if (
          e?.message?.includes('timeout') ||
          e?.message?.includes('timed out') ||
          e?.message?.includes('The request timed out')
        ) {
          // For timeouts, silently retry with backoff
          await new Promise((res) => setTimeout(res, pollingInterval))
          pollingInterval = Math.min(pollingInterval * 1.5, maxPollingInterval)
          continue
        }

        const error = e as NodeApiError
        let errorMessage: string

        if (error?.data?.error) {
          errorMessage = error.data.error
        } else if (e instanceof Error) {
          errorMessage = e.message
        } else {
          errorMessage = 'An unknown error occurred'
        }

        // Handle network/connection errors - silently retry like timeouts
        if (
          typeof error.status === 'string' &&
          (error?.status === 'FETCH_ERROR' || error?.status === 'TIMEOUT_ERROR')
        ) {
          // Don't show any error, just retry
          await new Promise((res) => setTimeout(res, pollingInterval))
          pollingInterval = Math.min(pollingInterval * 1.5, maxPollingInterval)
          if (!doubleFetchErrorFlag) {
            doubleFetchErrorFlag = true
          }
          continue
        }

        // Handle node state change - silently retry with backoff
        if (
          error?.status === 403 &&
          errorMessage === 'Cannot call other APIs while node is changing state'
        ) {
          await new Promise((res) => setTimeout(res, pollingInterval))
          pollingInterval = Math.min(pollingInterval * 1.5, maxPollingInterval)
          continue
        }

        if (error?.status === 401 && errorMessage === 'Invalid password') {
          setUnlockError('Invalid password')
          toast.error('Invalid password', {
            autoClose: 5000,
            position: 'top-right',
          })
          shouldRetry = false
          continue
        }

        // Handle initialization and already unlocked cases
        if (
          error.status === 403 &&
          errorMessage === 'Wallet has not been initialized (hint: call init)'
        ) {
          setShowInitModal(true)
          shouldRetry = false
        } else if (errorMessage === 'Node has already been unlocked') {
          toast.info('Node is already unlocked', {
            autoClose: 3000,
            position: 'bottom-right',
          })
          navigate(WALLET_DASHBOARD_PATH)
          shouldRetry = false
        } else {
          // For any other error that we haven't explicitly handled, retry silently
          await new Promise((res) => setTimeout(res, pollingInterval))
          pollingInterval = Math.min(pollingInterval * 1.5, maxPollingInterval)
          continue
        }
      }
    }

    if (!shouldRetry && !showInitModal) {
      setIsUnlocking(false)
    }
  }

  const handleBack = async () => {
    if (nodeSettings.datapath) {
      try {
        await invoke('stop_node')
        toast.info('Node stopped', {
          autoClose: 2000,
          position: 'bottom-right',
        })
      } catch (error) {
        console.error('Failed to stop node:', error)
      }
    }
    navigate(WALLET_SETUP_PATH)
  }

  const handleCancelUnlocking = () => {
    setIsUnlocking(false)
    setUnlockError(null)
    toast.info('Unlocking process cancelled', {
      autoClose: 3000,
      position: 'bottom-right',
    })
  }

  const ConnectionDetailsCard = () => {
    const rpcConfig = parseRpcUrl(nodeSettings.rpc_connection_url)

    return (
      <div className="mb-8">
        <button
          className="w-full group flex items-center justify-between p-4 bg-gradient-to-r from-slate-800/40 to-slate-700/40 backdrop-blur-sm text-slate-200 border border-slate-600/30 rounded-xl hover:border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10"
          onClick={() => setIsConnectionDetailsOpen(!isConnectionDetailsOpen)}
        >
          <span className="flex items-center">
            <div className="p-2 bg-blue-500/20 rounded-lg mr-3 group-hover:bg-blue-500/30 transition-colors">
              <Server className="w-5 h-5 text-blue-400" />
            </div>
            <span className="font-medium">Connection Details</span>
          </span>
          <ChevronDown
            className={`w-5 h-5 transition-all duration-300 text-slate-400 group-hover:text-blue-400 ${
              isConnectionDetailsOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${
            isConnectionDetailsOpen
              ? 'max-h-96 opacity-100 mt-3'
              : 'max-h-0 opacity-0'
          }`}
        >
          <div className="p-5 bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm border border-slate-600/30 rounded-xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Globe className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm font-medium">Node URL</p>
                  <p className="text-slate-200 font-mono text-sm">
                    {nodeSettings.node_url}
                  </p>
                </div>
              </div>
              <div className="w-full h-[1px] bg-slate-700 my-4" />
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Zap className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm font-medium">
                    Bitcoind RPC
                  </p>
                  <p className="text-slate-200 font-mono text-sm">
                    {rpcConfig.host}:{rpcConfig.port}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-orange-500/20 rounded-lg mt-0.5">
                  <Server className="w-4 h-4 text-orange-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-slate-400 text-sm font-medium mb-1">
                    Indexer URL
                  </p>
                  <p className="text-slate-200 font-mono text-sm break-all bg-slate-800/50 p-2 rounded-lg">
                    {nodeSettings.indexer_url}
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-cyan-500/20 rounded-lg mt-0.5">
                  <Globe className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-slate-400 text-sm font-medium mb-1">
                    RGB Proxy Endpoint
                  </p>
                  <p className="text-slate-200 font-mono text-sm break-all bg-slate-800/50 p-2 rounded-lg">
                    {nodeSettings.proxy_endpoint}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderUnlockForm = () => (
    <div className="w-full max-w-lg mx-auto">
      {/* Header Section */}
      <div className="text-center mb-8">
        <div className="relative inline-block mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-lg opacity-30 animate-pulse"></div>
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl">
            <Shield className="w-12 h-12 text-white" />
          </div>
        </div>

        <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent mb-3">
          Unlock Your Wallet
        </h1>
        <p className="text-slate-400 text-lg">
          Enter your password to securely access your wallet
        </p>
      </div>

      {/* Main Card */}
      <Card className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-600/30 rounded-2xl shadow-2xl shadow-black/20 overflow-hidden">
        <div className="p-8">
          <form
            className="space-y-6"
            onSubmit={unlockForm.handleSubmit(onSubmit)}
          >
            {/* Connection details */}
            <ConnectionDetailsCard />

            {/* Password field */}
            <div className="space-y-3">
              <label
                className="block text-sm font-semibold text-slate-300 mb-2"
                htmlFor="password"
              >
                Wallet Password
              </label>

              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center">
                  <div className="absolute left-4 z-10">
                    <Lock className="w-5 h-5 text-slate-400" />
                  </div>
                  <input
                    className="w-full pl-12 pr-12 py-4 bg-slate-800/50 backdrop-blur-sm border border-slate-600/50 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 text-white placeholder-slate-500 font-medium"
                    id="password"
                    placeholder="Enter your secure password"
                    type={isPasswordVisible ? 'text' : 'password'}
                    {...unlockForm.register('password', {
                      required: 'Password is required',
                    })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        unlockForm.handleSubmit(onSubmit)()
                      }
                    }}
                  />

                  <button
                    className="absolute right-4 text-slate-400 hover:text-blue-400 transition-colors duration-200 z-10"
                    onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                    type="button"
                  >
                    {isPasswordVisible ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {unlockForm.formState.errors.password && (
                <div className="flex items-center space-x-2 text-red-400 text-sm">
                  <div className="w-1 h-1 bg-red-400 rounded-full"></div>
                  <p>{unlockForm.formState.errors.password.message}</p>
                </div>
              )}
            </div>

            {/* Error messages */}
            {errors.length > 0 && (
              <div className="p-4 bg-gradient-to-r from-red-900/40 to-red-800/40 border border-red-500/30 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-red-300 space-y-1">
                  {errors.map((error, index) => (
                    <div className="flex items-center space-x-2" key={index}>
                      <div className="w-1 h-1 bg-red-400 rounded-full"></div>
                      <p>{error}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-4 space-y-4">
              <Button
                className="w-full relative group bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white py-4 rounded-xl font-semibold text-lg transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-blue-500/25 overflow-hidden"
                disabled={isUnlocking}
                type="submit"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                <span className="relative flex items-center justify-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Unlock Wallet
                </span>
              </Button>

              <button
                className="w-full flex items-center justify-center text-slate-400 hover:text-white py-3 bg-transparent hover:bg-slate-800/30 rounded-xl transition-all duration-300 group"
                onClick={handleBack}
                type="button"
              >
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform duration-200" />
                Back to Wallet Setup
              </button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  )

  const ModernModal = () => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md">
        <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-slate-600/30 rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Initialize Wallet
              </h3>
              <p className="text-slate-300 leading-relaxed">
                Your wallet hasn't been initialized yet. Would you like to set
                it up now?
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700/50 py-3 rounded-xl transition-all duration-200"
                onClick={() => setShowInitModal(false)}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                onClick={() => {
                  setShowInitModal(false)
                  navigate(WALLET_SETUP_PATH)
                }}
              >
                Initialize
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )

  return (
    <Layout className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {isCheckingStatus ? (
        <div className="flex items-center justify-center min-h-screen px-4 py-12">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-transparent to-purple-600/5 pointer-events-none"></div>
          <div className="absolute inset-0">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
          </div>
          <div className="relative z-10 w-full max-w-lg mx-auto">
            <div className="text-center">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-lg opacity-30 animate-pulse"></div>
                <div className="relative w-24 h-24 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl">
                  <Shield className="w-12 h-12 text-white animate-pulse" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                Checking Wallet Status
              </h2>
              <p className="text-slate-400">
                Please wait while we verify your wallet...
              </p>
            </div>
          </div>
        </div>
      ) : isUnlocking ? (
        <SetupLayout
          centered={true}
          className="flex items-center justify-center min-h-screen py-8"
          fullHeight
          maxWidth="2xl"
          title="Wallet Access"
        >
          <UnlockingProgress
            errorMessage={unlockError || undefined}
            isUnlocking={isUnlocking}
            onBack={handleBack}
            onCancel={handleCancelUnlocking}
          />
        </SetupLayout>
      ) : (
        <div className="flex items-center justify-center min-h-screen px-4 py-12">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-transparent to-purple-600/5 pointer-events-none"></div>
          <div className="absolute inset-0">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
          </div>
          <div className="relative z-10 w-full">{renderUnlockForm()}</div>
        </div>
      )}

      {showInitModal && <ModernModal />}
    </Layout>
  )
}
