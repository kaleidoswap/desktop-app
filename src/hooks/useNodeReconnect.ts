import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { useCallback, useState, useRef } from 'react'

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

  const pending = useRef(false)
  const [lastResult, setLastResult] = useState<
    'reachable' | 'slow' | 'unreachable' | null
  >(null)
  const reconnect = useCallback(async () => {
    if (pending.current) return false
    pending.current = true
    setLastResult(null)
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
              status:
                /timeout|timed out/i.test(getNodeErrorMessage(error)) ||
                error.status === 'TIMEOUT_ERROR'
                  ? 'slow'
                  : 'unreachable',
            })
          )
          setLastResult(
            /timeout|timed out/i.test(getNodeErrorMessage(error)) ||
              error.status === 'TIMEOUT_ERROR'
              ? 'slow'
              : 'unreachable'
          )
          return false
        }
      }

      setLastResult('reachable')
      dispatch(setNodeReachability({ status: 'reachable' }))
      return true
    } catch (error) {
      setLastResult('unreachable')
      dispatch(
        setNodeReachability({
          error: getNodeErrorMessage(error),
          status: 'unreachable',
        })
      )
      return false
    } finally {
      pending.current = false
      setIsReconnecting(false)
    }
  }, [dispatch])

  return { isReconnecting, lastResult, reconnect }
}
