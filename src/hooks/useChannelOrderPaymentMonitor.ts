import { useCallback, useEffect, useRef, useState } from 'react'

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
  ) => Promise<{ data?: Lsps1GetOrderResponse; error?: unknown }>
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
  const getOrderRef = useRef(getOrder)
  const onTerminalStateRef = useRef(onTerminalState)
  const orderPayloadRef = useRef(orderPayload)
  const paymentReceivedRef = useRef(paymentReceived)

  useEffect(() => {
    getOrderRef.current = getOrder
  }, [getOrder])

  useEffect(() => {
    onTerminalStateRef.current = onTerminalState
  }, [onTerminalState])

  useEffect(() => {
    orderPayloadRef.current = orderPayload
  }, [orderPayload])

  useEffect(() => {
    paymentReceivedRef.current = paymentReceived
  }, [paymentReceived])

  const markPaymentReceived = useCallback(
    (method?: ChannelOrderPaymentMethod | null) => {
      paymentReceivedRef.current = true
      setPaymentReceived(true)
      setIsProcessingPayment(true)
      if (method) {
        setPaymentMethod(method)
      }
    },
    []
  )

  const reset = useCallback(() => {
    paymentReceivedRef.current = false
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

    let cancelled = false
    let timeoutId: number | undefined

    const persistOrder = async (orderData: Lsps1GetOrderResponse) => {
      if (!orderPayloadRef.current) {
        return
      }

      try {
        await persistChannelOrder({
          fallbackAccessToken: accessToken,
          order: orderData,
          orderId,
          orderPayload: orderPayloadRef.current,
        })
      } catch (error) {
        console.error('Error saving order to database:', error)
      }
    }

    const scheduleNextPoll = () => {
      timeoutId = window.setTimeout(pollOrder, pollIntervalMs)
    }

    const pollOrder = async () => {
      if (cancelled) {
        return
      }

      let reachedTerminalState = false

      try {
        const orderResponse = await getOrderRef.current({
          access_token: accessToken,
          order_id: orderId,
        })

        if (orderResponse.error) {
          console.error('Error polling channel order:', orderResponse.error)
          return
        }

        const orderData = orderResponse.data

        if (!orderData) {
          return
        }

        const paymentSnapshot = getChannelOrderPaymentSnapshot(orderData)

        if (paymentSnapshot.paymentReceived && !paymentReceivedRef.current) {
          markPaymentReceived(paymentSnapshot.paymentMethod)
          await persistOrder(orderData)
        }

        const terminalStatus = getChannelOrderTerminalStatus(orderData)
        if (!terminalStatus) {
          return
        }

        reachedTerminalState = true
        await persistOrder(orderData)
        setPaymentStatus(terminalStatus)
        onTerminalStateRef.current?.(terminalStatus, orderData)
      } catch (error) {
        console.error('Error polling channel order:', error)
      } finally {
        if (!cancelled && !reachedTerminalState) {
          scheduleNextPoll()
        }
      }
    }

    pollOrder()

    return () => {
      cancelled = true
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [
    accessToken,
    enabled,
    markPaymentReceived,
    orderId,
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
