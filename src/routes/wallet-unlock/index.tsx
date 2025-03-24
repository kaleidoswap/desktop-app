import { invoke } from '@tauri-apps/api/core'
import { ChevronDown, ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react'
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

  // Check if the node is already unlocked when the component mounts
  useEffect(() => {
    const checkNodeStatus = async () => {
      const nodeInfoRes = await nodeInfo()
      if (nodeInfoRes.isSuccess) {
        navigate(WALLET_DASHBOARD_PATH)
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
    let pollingInterval = 2000
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
        const error = e as NodeApiError
        if (
          typeof error.status === 'string' &&
          error?.status === 'FETCH_ERROR'
        ) {
          if (doubleFetchErrorFlag) {
            const errorMessage =
              error.data?.error || 'Connection error occurred'
            setUnlockError(errorMessage)
            toast.error(errorMessage, {
              autoClose: 5000,
              position: 'top-right',
            })
            shouldRetry = false
            continue
          } else {
            doubleFetchErrorFlag = true
            continue
          }
        }

        if (
          error?.status === 403 &&
          error?.data.error ===
            'Cannot call other APIs while node is changing state'
        ) {
          await new Promise((res) => setTimeout(res, pollingInterval))
          pollingInterval = Math.min(pollingInterval * 2, 15000)
          continue
        }

        if (
          error.status === 403 &&
          error.data?.error ===
            'Wallet has not been initialized (hint: call init)'
        ) {
          setShowInitModal(true)
          shouldRetry = false
        } else if (error.data?.error === 'Node has already been unlocked') {
          toast.info('Node is already unlocked', {
            autoClose: 3000,
            position: 'bottom-right',
          })
          navigate(WALLET_DASHBOARD_PATH)
          shouldRetry = false
        } else {
          const errorMessage = error.data?.error || 'An error occurred'
          setUnlockError(errorMessage)
          toast.error(errorMessage, {
            autoClose: 5000,
            position: 'top-right',
          })
          shouldRetry = false
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

  const SimpleConnectionDetails = () => {
    const rpcConfig = parseRpcUrl(nodeSettings.rpc_connection_url)

    return (
      <div className="mb-6">
        <button
          className="w-full flex items-center justify-between p-3 bg-transparent text-gray-300 border border-gray-700/50 rounded-lg"
          onClick={() => setIsConnectionDetailsOpen(!isConnectionDetailsOpen)}
        >
          <span className="flex items-center">
            <svg
              className="w-5 h-5 mr-2 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
            >
              <rect
                height="18"
                rx="2"
                stroke="currentColor"
                strokeWidth="2"
                width="18"
                x="3"
                y="3"
              />
              <line
                stroke="currentColor"
                strokeWidth="2"
                x1="8"
                x2="16"
                y1="10"
                y2="10"
              />
              <line
                stroke="currentColor"
                strokeWidth="2"
                x1="8"
                x2="16"
                y1="14"
                y2="14"
              />
            </svg>
            Connection Details
          </span>
          <ChevronDown
            className={`w-5 h-5 transition-transform duration-200 ${
              isConnectionDetailsOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isConnectionDetailsOpen && (
          <div className="mt-2 p-4 bg-gray-800/50 border border-gray-700/50 rounded-lg text-gray-300 text-sm space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500 mb-1">Node Host</p>
                <p>{rpcConfig.host}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Port</p>
                <p>{rpcConfig.port}</p>
              </div>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Indexer URL</p>
              <p className="break-all">{nodeSettings.indexer_url}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Proxy Endpoint</p>
              <p className="break-all">{nodeSettings.proxy_endpoint}</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderUnlockForm = () => (
    <Card className="w-full max-w-md mx-auto bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
      <div className="flex flex-col items-center pt-12 pb-6">
        <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center mb-6">
          <Lock className="w-10 h-10 text-white" />
        </div>

        <h2 className="text-2xl font-semibold text-white text-center">
          Unlock Your Wallet
        </h2>
        <p className="text-gray-400 text-center mt-2">
          Enter your password to access your wallet
        </p>
      </div>

      <div className="px-6 pb-8">
        <form
          className="space-y-6"
          onSubmit={unlockForm.handleSubmit(onSubmit)}
        >
          {/* Connection details dropdown */}
          <SimpleConnectionDetails />

          {/* Password field */}
          <div className="space-y-2">
            <label
              className="block text-sm font-medium text-gray-300"
              htmlFor="password"
            >
              Password
            </label>

            <div className="relative">
              <input
                className="w-full px-4 py-3 bg-gray-800/70 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                id="password"
                placeholder="Enter your wallet password"
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
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

            {unlockForm.formState.errors.password && (
              <p className="text-sm text-red-400">
                {unlockForm.formState.errors.password.message}
              </p>
            )}
          </div>

          {/* Error messages */}
          {errors.length > 0 && (
            <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
              <div className="text-sm text-red-300">
                {errors.map((error, index) => (
                  <p key={index}>{error}</p>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 space-y-4">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg flex items-center justify-center"
              disabled={isUnlocking}
              type="submit"
            >
              Unlock Wallet
            </Button>

            <button
              className="w-full flex items-center justify-center text-gray-400 hover:text-white py-2 bg-transparent"
              onClick={handleBack}
              type="button"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Wallet Setup
            </button>
          </div>
        </form>
      </div>
    </Card>
  )

  const SimpleModal = () => (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-white mb-2">
            Initialize Wallet
          </h3>
          <p className="text-gray-300 mb-6">
            Wallet is not initialized. Would you like to initialize it now?
          </p>
          <div className="flex justify-end gap-3">
            <Button
              className="border-gray-600 text-gray-300"
              onClick={() => setShowInitModal(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="bg-blue-600 text-white"
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
  )

  return (
    <Layout className="min-h-screen bg-gradient-to-b from-gray-900 to-black">
      {isUnlocking ? (
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
          {renderUnlockForm()}
        </div>
      )}

      {showInitModal && <SimpleModal />}
    </Layout>
  )
}
