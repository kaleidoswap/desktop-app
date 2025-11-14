import { AlertCircle, Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'

import { webSocketService } from '../../app/hubs/websocketService'
import {
  WALLET_DASHBOARD_PATH,
  WALLET_SETUP_PATH,
  WALLET_UNLOCK_PATH,
  TRADE_MARKET_MAKER_PATH,
} from '../../app/router/paths'
import { Layout } from '../../components/Layout'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { logger } from '../../utils/logger'

export const RootRoute = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [nodeInfo, nodeInfoResponse] = nodeApi.endpoints.nodeInfo.useLazyQuery()
  const { t } = useTranslation()

  useEffect(() => {
    const currentPath = location.pathname

    if (
      currentPath !== TRADE_MARKET_MAKER_PATH &&
      webSocketService.isConnected()
    ) {
      logger.info(
        `Route changed from market maker to ${currentPath}, cleaning up WebSocket connection`
      )
      webSocketService.close()
    }
  }, [location.pathname])

  // Cleanup WebSocket on component unmount (app closing)
  useEffect(() => {
    return () => {
      if (webSocketService.isConnected()) {
        logger.info(
          'Root component unmounting - cleaning up WebSocket connections'
        )
        webSocketService.close()
      }
    }
  }, [])

  useEffect(() => {
    async function run() {
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
    run()
  }, [navigate, nodeInfo])

  return (
    <Layout>
      {nodeInfoResponse.isSuccess ? (
        <Outlet />
      ) : nodeInfoResponse.isError ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <div className="w-full max-w-md bg-gray-800/80 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>

              <h2 className="text-2xl font-bold text-white mb-3">
                {t('rootRoute.connectionErrorTitle')}
              </h2>

              <p className="text-gray-400 mb-6">
                {nodeInfoResponse.error &&
                'status' in nodeInfoResponse.error &&
                nodeInfoResponse.error.status === 400
                  ? t('rootRoute.noWalletFound')
                  : t('rootRoute.nodeNotRunning')}
              </p>

              <button
                className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors"
                onClick={() => navigate(WALLET_SETUP_PATH)}
              >
                {t('rootRoute.returnToSetup')}
              </button>

              {nodeInfoResponse.error &&
                'message' in nodeInfoResponse.error && (
                  <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg w-full">
                    <p className="text-sm text-red-400 break-all">
                      {t('rootRoute.errorMessage', {
                        message: nodeInfoResponse.error.message,
                      })}
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
            {t('rootRoute.connectingTitle')}
          </h2>
          <p className="text-gray-400">
            {t('rootRoute.connectingDescription')}
          </p>
        </div>
      )}
    </Layout>
  )
}
