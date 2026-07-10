import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { useCallback, useState } from 'react'

import { useAppDispatch } from '../app/store/hooks'
import { setNodeReachability } from '../slices/node/node.slice'
import { nodeApi } from '../slices/nodeApi/nodeApi.slice'

const getNodeErrorMessage = (error: unknown) => {
  if (!error) return 'Unknown node connection error'
  if (typeof error === 'string') return error

  if (typeof error === 'object' && error !== null) {
    if ('error' in error && typeof error.error === 'string') {
      return error.error
    }

    if ('data' in error) {
      const data = error.data
      if (typeof data === 'string') return data
      if (typeof data === 'object' && data !== null && 'error' in data) {
        return String(data.error)
      }
    }
  }

  return String(error)
}

const isNodeReachabilityError = (error: FetchBaseQueryError) => {
  if (error.status === 'FETCH_ERROR' || error.status === 'TIMEOUT_ERROR') {
    return true
  }

  const message = getNodeErrorMessage(error).toLowerCase()
  return (
    message.includes('failed to fetch') ||
    message.includes('load failed') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('connection refused') ||
    message.includes('connection reset')
  )
}

/**
 * Manually re-probe the node and update its reachability. Shared by the
 * blocking "node offline" overlay and the user-menu reconnect button so both
 * trigger the exact same forced nodeInfo refetch and reachability update.
 * Returns true when the node responded, false when it's still unreachable.
 */
export const useNodeReconnect = () => {
  const dispatch = useAppDispatch()
  const [isReconnecting, setIsReconnecting] = useState(false)

  const reconnect = useCallback(async () => {
    setIsReconnecting(true)
    try {
      const result = await dispatch(
        nodeApi.endpoints.nodeInfo.initiate(undefined, {
          forceRefetch: true,
          subscribe: false,
        })
      )

      if ('error' in result && result.error) {
        const error = result.error as FetchBaseQueryError
        if (isNodeReachabilityError(error)) {
          dispatch(
            setNodeReachability({
              error: getNodeErrorMessage(error),
              status: 'unreachable',
            })
          )
          return false
        }
      }

      dispatch(setNodeReachability({ status: 'reachable' }))
      return true
    } finally {
      setIsReconnecting(false)
    }
  }, [dispatch])

  return { isReconnecting, reconnect }
}
