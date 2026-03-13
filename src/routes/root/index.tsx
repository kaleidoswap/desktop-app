import { AlertCircle, Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'

import { webSocketService } from '../../app/hubs/websocketService'
import {
  ROOT_PATH,
  WALLET_DASHBOARD_PATH,
  WALLET_SETUP_PATH,
  WALLET_UNLOCK_PATH,
  TRADE_MARKET_MAKER_PATH,
} from '../../app/router/paths'
import { Layout } from '../../components/Layout'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { logger } from '../../utils/logger'

const withTimeout = <T,>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
        ms
      )
    ),
  ])

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const RootRoute = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [nodeInfo, nodeInfoResponse] = nodeApi.endpoints.nodeInfo.useLazyQuery()
  const { t } = useTranslation()
  const isIndexRoute = location.pathname === ROOT_PATH

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
    if (!isIndexRoute) {
      return
    }

    let cancelled = false

    async function run() {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const nodeInfoResponse = await withTimeout(
            nodeInfo(),
            10000,
            'Node status check'
          )
          const error: any = nodeInfoResponse.error

          if (cancelled) {
            return
          }

          if (nodeInfoResponse.isSuccess) {
            navigate(WALLET_DASHBOARD_PATH)
            return
          }

          const isTransientError =
            error?.status === 'FETCH_ERROR' ||
            error?.status === 'TIMEOUT_ERROR' ||
            error?.data?.error ===
              'Cannot call other APIs while node is changing state'

          if (attempt < 2 && isTransientError) {
            await sleep(1000 * (attempt + 1))
            continue
          }

          if (error?.status !== 400) {
            navigate(WALLET_UNLOCK_PATH)
          } else {
            navigate(WALLET_SETUP_PATH)
          }
          return
        } catch (error) {
          if (cancelled) {
            return
          }

          if (attempt < 2) {
            await sleep(1000 * (attempt + 1))
            continue
          }

          navigate(WALLET_UNLOCK_PATH)
          return
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [isIndexRoute, navigate, nodeInfo])

  if (!isIndexRoute) {
    return (
      <Layout>
        <Outlet />
      </Layout>
    )
  }

  return (
    <Layout>
      {nodeInfoResponse.isSuccess ? (
        <Outlet />
      ) : nodeInfoResponse.isError ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <div className="w-full max-w-md bg-surface-overlay/80 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-border-default">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>

              <h2 className="text-2xl font-bold text-white mb-3">
                {t('rootRoute.connectionErrorTitle')}
              </h2>

              <p className="text-content-secondary mb-6">
                {nodeInfoResponse.error &&
                typeof nodeInfoResponse.error === 'object' &&
                'status' in nodeInfoResponse.error &&
                (nodeInfoResponse.error as any).status === 400
                  ? t('rootRoute.noWalletFound')
                  : t('rootRoute.nodeNotRunning')}
              </p>

              <button
                className="w-full px-6 py-3 bg-primary hover:bg-primary-emphasis text-primary-foreground font-semibold rounded-xl transition-colors"
                onClick={() => navigate(WALLET_SETUP_PATH)}
              >
                {t('rootRoute.returnToSetup')}
              </button>

              {!!nodeInfoResponse.error &&
                typeof nodeInfoResponse.error === 'object' &&
                'message' in nodeInfoResponse.error && (
                  <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg w-full">
                    <p className="text-sm text-red-400 break-all">
                      {t('rootRoute.errorMessage', {
                        message: (nodeInfoResponse.error as any).message,
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
          <p className="text-content-secondary">
            {t('rootRoute.connectingDescription')}
          </p>
        </div>
      )}
    </Layout>
  )
}
