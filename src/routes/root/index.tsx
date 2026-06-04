import { useEffect } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'

import { webSocketService } from '../../app/hubs/websocketService'
import {
  ROOT_PATH,
  WALLET_SETUP_PATH,
  TRADE_MARKET_MAKER_PATH,
} from '../../app/router/paths'
import { Layout } from '../../components/Layout'
import { logger } from '../../utils/logger'

export const RootRoute = () => {
  const location = useLocation()
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

  // The welcome (account picker + mode + connect) lives on the wallet-setup
  // screen, which is always the entry point. "/" simply forwards there.
  if (isIndexRoute) {
    return <Navigate replace to={WALLET_SETUP_PATH} />
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}
