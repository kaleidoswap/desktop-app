import { useCallback, useEffect, useState } from 'react'

import type {
  Lsps1GetOrderRequest,
  Lsps1GetOrderResponse,
} from '../slices/makerApi/makerApi.slice'
import { persistChannelOrder } from '../utils/channelOrderPersistence'
import {
  getChannelOrderPaymentSnapshot,
  getChannelOrderTerminalStatus,
  type ChannelOrderPaymentMethod,
  type ChannelOrderTerminalStatus,
} from '../utils/channelOrderUtils'

interface UseChannelOrderPaymentMonitorOptions {
  accessToken?: string | null
  enabled: boolean
  getOrder: (
    args: Lsps1GetOrderRequest
  ) => Promise<{ data?: Lsps1GetOrderResponse }>
  onTerminalState?: (
    status: ChannelOrderTerminalStatus,
    order: Lsps1GetOrderResponse
  ) => void
  orderId?: string | null
  orderPayload?: unknown | null
  pollIntervalMs?: number
}

interface UseChannelOrderPaymentMonitorResult {
  isProcessingPayment: boolean
  markPaymentReceived: (method?: ChannelOrderPaymentMethod | null) => void
  paymentMethod: ChannelOrderPaymentMethod | null
  paymentReceived: boolean
  paymentStatus: ChannelOrderTerminalStatus | null
  reset: () => void
  setPaymentStatus: (status: ChannelOrderTerminalStatus | null) => void
}

export const useChannelOrderPaymentMonitor = ({
  accessToken,
  enabled,
  getOrder,
  onTerminalState,
  orderId,
  orderPayload,
  pollIntervalMs = 5000,
}: UseChannelOrderPaymentMonitorOptions): UseChannelOrderPaymentMonitorResult => {
  const [paymentStatus, setPaymentStatusState] =
    useState<ChannelOrderTerminalStatus | null>(null)
  const [paymentReceived, setPaymentReceived] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [paymentMethod, setPaymentMethod] =
    useState<ChannelOrderPaymentMethod | null>(null)

  const markPaymentReceived = useCallback(
    (method?: ChannelOrderPaymentMethod | null) => {
      setPaymentReceived(true)
      setIsProcessingPayment(true)
      if (method) {
        setPaymentMethod(method)
      }
    },
    []
  )

  const reset = useCallback(() => {
    setPaymentStatusState(null)
    setPaymentReceived(false)
    setIsProcessingPayment(false)
    setPaymentMethod(null)
  }, [])

  const setPaymentStatus = useCallback(
    (status: ChannelOrderTerminalStatus | null) => {
      setPaymentStatusState(status)
      if (status) {
        setIsProcessingPayment(false)
      }
    },
    []
  )

  useEffect(() => {
    if (!enabled || !orderId || !accessToken) {
      return
    }

    const intervalId = window.setInterval(async () => {
      const orderResponse = await getOrder({
        access_token: accessToken,
        order_id: orderId,
      })
      const orderData = orderResponse.data

      if (!orderData) {
        return
      }

      const paymentSnapshot = getChannelOrderPaymentSnapshot(orderData)

      if (paymentSnapshot.paymentReceived && !paymentReceived) {
        markPaymentReceived(paymentSnapshot.paymentMethod)

        if (orderPayload) {
          try {
            await persistChannelOrder({
              fallbackAccessToken: accessToken,
              order: orderData,
              orderId,
              orderPayload,
            })
          } catch (error) {
            console.error('Error saving order to database:', error)
          }
        }
      }

      const terminalStatus = getChannelOrderTerminalStatus(orderData)
      if (!terminalStatus) {
        return
      }

      window.clearInterval(intervalId)
      setPaymentStatus(terminalStatus)
      onTerminalState?.(terminalStatus, orderData)
    }, pollIntervalMs)

    return () => window.clearInterval(intervalId)
  }, [
    accessToken,
    enabled,
    getOrder,
    markPaymentReceived,
    onTerminalState,
    orderId,
    orderPayload,
    paymentReceived,
    pollIntervalMs,
    setPaymentStatus,
  ])

  return {
    isProcessingPayment,
    markPaymentReceived,
    paymentMethod,
    paymentReceived,
    paymentStatus,
    reset,
    setPaymentStatus,
  }
}
