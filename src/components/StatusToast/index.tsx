import { ArrowRight } from 'lucide-react'
import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import { useSettings } from '../../hooks/useSettings'
import { useAssetIcon } from '../../helpers/utils'
import { nodeApi, SwapDetails } from '../../slices/nodeApi/nodeApi.slice'
import { useNotification } from '../NotificationSystem'

const formatAmount = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 8,
    minimumFractionDigits: 2,
  }).format(amount)
}

const AssetDisplay: React.FC<{
  amount: number
  asset: string
  align?: 'left' | 'right'
}> = ({ amount, asset, align = 'left' }) => {
  const [imgSrc] = useAssetIcon(asset)

  return (
    <div
      className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : ''}`}
    >
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
        <img alt={`${asset} icon`} className="w-4 h-4" src={imgSrc} />
      </div>
      <div>
        <div className="font-medium text-gray-700 dark:text-content-primary">
          {formatAmount(amount)} {asset}
        </div>
      </div>
    </div>
  )
}

const SwapStatusContent: React.FC<{
  swap: SwapDetails
  assets: any[]
  timestamp?: Date
}> = ({ swap, assets, timestamp }) => {
  const { bitcoinUnit } = useSettings()

  const fromAssetTicker =
    assets.find((asset) => asset.asset_id === swap.from_asset)?.ticker ||
    bitcoinUnit
  let fromAssetQty =
    (swap.qty_from ?? 0) /
    Math.pow(
      10,
      assets.find((asset) => asset.asset_id === swap.from_asset)?.precision || 8
    )
  if (fromAssetTicker === 'BTC') {
    fromAssetQty /= 1000
  } else if (fromAssetTicker === 'SAT') {
    fromAssetQty *= 100000
  }

  const toAssetTicker =
    assets.find((asset) => asset.asset_id === swap.to_asset)?.ticker ||
    bitcoinUnit
  let toAssetQty =
    (swap.qty_to ?? 0) /
    Math.pow(
      10,
      assets.find((asset) => asset.asset_id === swap.to_asset)?.precision || 8
    )
  if (toAssetTicker === 'BTC') {
    toAssetQty /= 1000
  } else if (toAssetTicker === 'SAT') {
    toAssetQty *= 100000
  }

  // Define status colors
  const getStatusColor = () => {
    switch (swap.status) {
      case 'Succeeded':
        return 'text-green-500 dark:text-green-400'
      case 'Failed':
      case 'Expired':
        return 'text-red-500 dark:text-red-400'
      case 'Pending':
        return 'text-blue-500 dark:text-blue-400'
      default:
        return 'text-content-tertiary dark:text-content-secondary'
    }
  }

  return (
    <div className="space-y-3 bg-gray-50/90 dark:bg-surface-overlay p-4 rounded-lg border border-gray-200 dark:border-blue-700">
      {/* Status badge at the top */}
      <div className={`font-medium ${getStatusColor()} flex items-center`}>
        <span className="mr-2">Swap {swap.status}</span>
        {swap.status === 'Pending' && (
          <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse"></div>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 bg-white dark:bg-blue-900/80 p-3 rounded-lg shadow-md border border-gray-100 dark:border-blue-800">
        <div className="flex-1">
          <span className="text-sm text-content-tertiary dark:text-content-secondary">From</span>
          <AssetDisplay amount={fromAssetQty} asset={fromAssetTicker} />
        </div>

        <ArrowRight
          className={`text-content-secondary w-4 h-4 flex-shrink-0 ${swap.status === 'Pending' ? 'animate-pulse' : ''}`}
        />

        <div className="flex-1">
          <span className="text-sm text-content-tertiary dark:text-content-secondary">To</span>
          <AssetDisplay
            align="right"
            amount={toAssetQty}
            asset={toAssetTicker}
          />
        </div>
      </div>

      <div className="text-xs text-content-tertiary dark:text-content-secondary">
        {(timestamp || new Date()).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}
      </div>
    </div>
  )
}

interface SwapNotificationState {
  id: string
  status: string
  timestamp: Date
  dismissed: boolean
}

export const StatusToast: React.FC<{
  assets: any[]
}> = ({ assets }) => {
  const { t } = useTranslation()
  const { addNotification, removeNotification } = useNotification()
  const swapStates = useRef<Record<string, SwapNotificationState>>({})
  const autoRemoveTimeoutsRef = useRef<Record<string, number>>({})

  // Clear any existing timeouts when component unmounts
  useEffect(() => {
    return () => {
      Object.values(autoRemoveTimeoutsRef.current).forEach((timeout) => {
        clearTimeout(timeout)
      })
    }
  }, [])

  const { data } = nodeApi.useListSwapsQuery(undefined, {
    pollingInterval: 6000,
  })

  useEffect(() => {
    if (!data?.taker) return

    // Process new and existing swaps
    data.taker.forEach((swap) => {
      const paymentHash = swap.payment_hash || ''
      if (!paymentHash) return

      const currentState = swapStates.current[paymentHash]

      // Skip if the swap was dismissed and has a final status
      if (
        currentState?.dismissed &&
        ['Succeeded', 'Failed', 'Expired'].includes(currentState.status)
      ) {
        return
      }

      // Create or update notification
      const timestamp = currentState?.timestamp || new Date()
      const notificationConfig = {
        message: (
          <SwapStatusContent
            assets={assets}
            swap={swap}
            timestamp={timestamp}
          />
        ),
        onClose: () => {
          if (paymentHash && swapStates.current[paymentHash]) {
            swapStates.current[paymentHash].dismissed = true
          }
        },
        showProgress: swap.status === 'Pending',
        timestamp,
        title: `Swap ${swap.status}`,
      }

      // Handle status changes
      if (currentState) {
        if (currentState.status !== swap.status) {
          // Clear any existing auto-remove timeout for this swap
          if (autoRemoveTimeoutsRef.current[paymentHash]) {
            clearTimeout(autoRemoveTimeoutsRef.current[paymentHash])
            delete autoRemoveTimeoutsRef.current[paymentHash]
          }

          removeNotification(currentState.id)
          const newId = addNotification({
            ...notificationConfig,
            autoClose: ['Succeeded', 'Failed', 'Expired'].includes(
              swap.status ?? ''
            )
              ? 5000
              : undefined,
            type: getNotificationType(swap.status ?? 'Pending'),
          })
          swapStates.current[paymentHash] = {
            dismissed: false,
            id: newId,
            status: swap.status ?? 'Pending',
            timestamp,
          }

          // Auto-remove successful or expired swaps
          if (['Succeeded', 'Expired'].includes(swap.status ?? '')) {
            console.log('auto-removing swap', paymentHash)
            autoRemoveTimeoutsRef.current[paymentHash] = setTimeout(() => {
              if (swapStates.current[paymentHash]) {
                removeNotification(swapStates.current[paymentHash].id)
                delete swapStates.current[paymentHash]
                delete autoRemoveTimeoutsRef.current[paymentHash]
              }
            }, 5000) as unknown as number

            if (swap.status === 'Succeeded') {
              toast.success(t('trade.statusToast.swapSucceeded'))
            } else if (swap.status === 'Expired') {
              toast.error(t('trade.statusToast.swapExpired'))
            }
          }
        }
      } else if (swap.status === 'Pending') {
        // New pending swap
        const id = addNotification({
          ...notificationConfig,
          type: 'loading',
        })
        swapStates.current[paymentHash] = {
          dismissed: false,
          id,
          status: swap.status,
          timestamp,
        }
      }
    })

    // Clean up completed swaps that are no longer in the data
    Object.entries(swapStates.current).forEach(([hash, state]) => {
      const swapExists = (data?.taker || []).some(
        (swap) => swap.payment_hash === hash
      )
      const isFinalStatus = ['Succeeded', 'Failed', 'Expired'].includes(
        state.status
      )

      // Remove the notification if:
      // 1. The swap no longer exists in the data AND
      // 2. Either it's not in a final status OR it's been dismissed
      if (!swapExists && (!isFinalStatus || state.dismissed)) {
        removeNotification(state.id)
        delete swapStates.current[hash]

        // Clear any existing timeout
        if (autoRemoveTimeoutsRef.current[hash]) {
          clearTimeout(autoRemoveTimeoutsRef.current[hash])
          delete autoRemoveTimeoutsRef.current[hash]
        }
      }
    })
  }, [data, assets, addNotification, removeNotification, t])

  // Add a subtle floating component to draw attention to pending swaps
  const pendingSwapCount = Object.values(swapStates.current).filter(
    (state) => state.status === 'Pending' && !state.dismissed
  ).length

  const pendingText = t('trade.statusToast.pendingSwaps', {
    count: pendingSwapCount,
  })

  const hasNewSwaps = pendingSwapCount > 0

  if (pendingSwapCount === 0) {
    return null
  }

  return (
    <div
      className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ease-in-out ${hasNewSwaps ? 'animate-bounce' : ''}`}
    >
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 backdrop-blur-md p-3 rounded-lg shadow-xl border border-blue-700 flex items-center">
        <div className="text-white font-medium flex items-center">
          <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse mr-3"></div>
          <span>{pendingText}</span>
        </div>
      </div>
    </div>
  )
}

function getNotificationType(status: string) {
  switch (status) {
    case 'Succeeded':
      return 'success'
    case 'Failed':
    case 'Expired':
      return 'error'
    case 'Pending':
      return 'loading'
    default:
      return 'info'
  }
}
