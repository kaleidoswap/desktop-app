import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppDispatch, useAppSelector } from '../app/store/hooks'
import { useNotification } from '../components/NotificationSystem'
import { nodeApi } from '../slices/nodeApi/nodeApi.slice'
import { setNodeReachability } from '../slices/node/node.slice'

const POLLING_INTERVAL_MS = 10_000
const FAILURE_THRESHOLD = 2

const getErrorMessage = (error: unknown) => {
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

const isReachabilityError = (error: FetchBaseQueryError | undefined) => {
  if (!error) return false

  if (error.status === 'FETCH_ERROR' || error.status === 'TIMEOUT_ERROR') {
    return true
  }

  const message = getErrorMessage(error).toLowerCase()
  return (
    message.includes('failed to fetch') ||
    message.includes('load failed') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('connection refused') ||
    message.includes('connection reset')
  )
}

export const useNodeReachabilityMonitor = ({
  accountKey,
  skip,
}: {
  accountKey?: string | null
  skip: boolean
}) => {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const { addNotification, removeNotification } = useNotification()
  const reachability = useAppSelector((state) => state.node.reachability)
  const notificationIdRef = useRef<string | null>(null)
  const consecutiveFailuresRef = useRef(0)
  const wasUnreachableRef = useRef(false)
  const addNotificationRef = useRef(addNotification)
  const removeNotificationRef = useRef(removeNotification)

  useEffect(() => {
    addNotificationRef.current = addNotification
    removeNotificationRef.current = removeNotification
  }, [addNotification, removeNotification])

  const nodeInfo = nodeApi.useNodeInfoQuery(undefined, {
    pollingInterval: skip ? 0 : POLLING_INTERVAL_MS,
    refetchOnFocus: true,
    refetchOnReconnect: true,
    skip,
  })

  useEffect(() => {
    consecutiveFailuresRef.current = 0
    wasUnreachableRef.current = false

    if (notificationIdRef.current) {
      removeNotificationRef.current(notificationIdRef.current)
      notificationIdRef.current = null
    }

    dispatch(
      setNodeReachability({
        status: 'unknown',
      })
    )
  }, [accountKey, dispatch, skip])

  useEffect(() => {
    if (reachability === 'unreachable' || !wasUnreachableRef.current) {
      return
    }

    wasUnreachableRef.current = false

    if (notificationIdRef.current) {
      removeNotificationRef.current(notificationIdRef.current)
      notificationIdRef.current = null
    }
  }, [reachability])

  useEffect(() => {
    if (skip) return

    if (nodeInfo.isSuccess) {
      consecutiveFailuresRef.current = 0
      dispatch(setNodeReachability({ status: 'reachable' }))

      if (wasUnreachableRef.current) {
        wasUnreachableRef.current = false

        if (notificationIdRef.current) {
          removeNotificationRef.current(notificationIdRef.current)
          notificationIdRef.current = null
        }

        addNotificationRef.current({
          autoClose: 4000,
          message: t('nodeReachability.restoredMessage', {
            defaultValue: 'The node is reachable again.',
          }),
          title: t('nodeReachability.restoredTitle', {
            defaultValue: 'Node connection restored',
          }),
          type: 'success',
        })
      }

      return
    }

    if (!nodeInfo.isError) return

    const error = nodeInfo.error as FetchBaseQueryError | undefined

    if (!isReachabilityError(error)) {
      consecutiveFailuresRef.current = 0
      dispatch(setNodeReachability({ status: 'reachable' }))
      return
    }

    consecutiveFailuresRef.current += 1

    if (consecutiveFailuresRef.current < FAILURE_THRESHOLD) {
      return
    }

    const message = getErrorMessage(error)
    dispatch(
      setNodeReachability({
        error: message,
        status: 'unreachable',
      })
    )

    if (wasUnreachableRef.current) {
      return
    }

    wasUnreachableRef.current = true
    notificationIdRef.current = addNotificationRef.current({
      autoClose: 0,
      message: t('nodeReachability.lostMessage', {
        defaultValue:
          'The node is not reachable. We will keep checking and reconnect automatically once it responds.',
      }),
      title: t('nodeReachability.lostTitle', {
        defaultValue: 'Node connection lost',
      }),
      type: 'warning',
    })
  }, [
    dispatch,
    nodeInfo.error,
    nodeInfo.isError,
    nodeInfo.isSuccess,
    nodeInfo.startedTimeStamp,
    skip,
    t,
  ])
}
