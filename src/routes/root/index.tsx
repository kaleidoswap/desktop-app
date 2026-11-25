import { useEffect, useState } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'

import { webSocketService } from '../../app/hubs/websocketService'
import { ROOT_PATH, TRADE_MARKET_MAKER_PATH } from '../../app/router/paths'
import { useAppSelector } from '../../app/store/hooks'
import { startupPath } from '../p2p-home/navigation'
import { Layout } from '../../components/Layout'
import { logger } from '../../utils/logger'

function Startup() {
  const mindOnly = useAppSelector((state) => state.settings.appMode === 'mind')
  const [path, setPath] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    void startupPath(mindOnly).then((target) => {
      if (active) setPath(target)
    })
    return () => {
      active = false
    }
  }, [mindOnly])
  return path ? <Navigate replace to={path} /> : null
}

export const RootRoute = () => {
  const location = useLocation()
  const isIndexRoute = location.pathname === ROOT_PATH

  useEffect(() => {
    const currentPath = location.pathname

    if (currentPath !== TRADE_MARKET_MAKER_PATH) {
      logger.info(
        `Route changed from market maker to ${currentPath}, cleaning up WebSocket connection`
      )
      webSocketService.close()
    }
  }, [location.pathname])

  // Cleanup WebSocket on component unmount (app closing)
  useEffect(() => {
    return () => {
      logger.info(
        'Root component unmounting - cleaning up WebSocket connections'
      )
      webSocketService.close()
    }
  }, [])

  if (isIndexRoute) {
    return <Startup />
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}
