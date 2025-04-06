import { invoke } from '@tauri-apps/api/core'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'

import {
  WALLET_DASHBOARD_PATH,
  WALLET_SETUP_PATH,
  WALLET_UNLOCK_PATH,
} from '../../app/router/paths'
import { Layout } from '../../components/Layout'
import { Updater } from '../../components/Updater'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'

export const RootRoute = () => {
  const [updateChecked, setUpdateChecked] = useState(false)
  const navigate = useNavigate()
  const [nodeInfo, nodeInfoResponse] = nodeApi.endpoints.nodeInfo.useLazyQuery()

  useEffect(() => {
    const closeSplashscreen = async () => {
      try {
        // Wait for DOM to be fully ready
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await invoke('close_splashscreen')
      } catch (error) {
        console.error('Failed to close splashscreen:', error)
      }
    }

    // Call it when component mounts
    closeSplashscreen()
  }, [])

  useEffect(() => {
    async function run() {
      if (updateChecked) {
        const nodeInfoResponse = await nodeInfo()
        const error: any = nodeInfoResponse.error

        if (nodeInfoResponse.isError) {
          if (error.status !== 400) {
            navigate(WALLET_UNLOCK_PATH)
          } else {
            navigate(WALLET_SETUP_PATH)
          }
        } else {
          navigate(WALLET_DASHBOARD_PATH)
        }
      }
    }
    run()
  }, [navigate, nodeInfo, updateChecked])

  return (
    <Layout>
      {!updateChecked ? (
        <Updater setUpdateChecked={setUpdateChecked} />
      ) : nodeInfoResponse.isSuccess ? (
        <Outlet />
      ) : nodeInfoResponse.isError ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <div className="w-full max-w-md bg-gray-800/80 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>

              <h2 className="text-2xl font-bold text-white mb-3">
                Connection Error
              </h2>

              <p className="text-gray-400 mb-6">
                {nodeInfoResponse.error &&
                'status' in nodeInfoResponse.error &&
                nodeInfoResponse.error.status === 400
                  ? 'No wallet found. Please set up your wallet to continue.'
                  : 'The node is not running. Please try restarting the app.'}
              </p>

              <button
                className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors"
                onClick={() => navigate(WALLET_SETUP_PATH)}
              >
                Return to Wallet Setup
              </button>

              {nodeInfoResponse.error &&
                'message' in nodeInfoResponse.error && (
                  <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg w-full">
                    <p className="text-sm text-red-400 break-all">
                      Error: {nodeInfoResponse.error.message}
                    </p>
                  </div>
                )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            Connecting to Node
          </h2>
          <p className="text-gray-400">
            Please wait while we establish connection...
          </p>
        </div>
      )}
    </Layout>
  )
}
