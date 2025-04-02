import { useState } from 'react'

import {
  ERROR_NOT_ENOUGH_UNCOLORED,
  ERROR_INSUFFICIENT_UTXOs,
} from '../constants'
/**
 * Custom hook to handle UTXO-related errors and show the CreateUTXOModal when needed
 */
export const useUtxoErrorHandler = () => {
  const [showUtxoModal, setShowUtxoModal] = useState(false)
  const [utxoModalProps, setUtxoModalProps] = useState({
    channelCapacity: 0,
    error: '',
    operationType: 'issuance' as 'issuance' | 'channel',
    retryFunction: undefined as (() => Promise<any>) | undefined,
  })

  /**
   * Check if the error is related to insufficient UTXOs
   */
  const isUtxoError = (error: any): boolean => {
    if (!error || !error.data || !error.data.error) {
      return false
    }

    return ERROR_INSUFFICIENT_UTXOs.some((errorMsg) =>
      error.data.error.includes(errorMsg)
    )
  }

  /**
   * Handle an API error by showing the UTXO modal if the error is UTXO-related
   * @returns true if the error was handled, false otherwise
   */
  const handleApiError = (
    error: any,
    operationType: 'issuance' | 'channel' = 'issuance',
    channelCapacity = 0,
    retryFunction?: () => Promise<any>
  ): boolean => {
    if (isUtxoError(error)) {
      // For channel creation with no uncolored UTXOs, suggest 1 UTXO with channel capacity
      if (
        operationType === 'channel' &&
        error.data.error.includes(ERROR_NOT_ENOUGH_UNCOLORED)
      ) {
        setUtxoModalProps({
          channelCapacity,
          error: `No uncolored UTXOs available. We'll create 1 UTXO of ${channelCapacity} sats to open your channel.`,
          operationType,
          retryFunction,
        })
      } else {
        setUtxoModalProps({
          channelCapacity,
          error: error.data.error,
          operationType,
          retryFunction,
        })
      }
      setShowUtxoModal(true)
      return true
    }
    return false
  }

  return {
    handleApiError,
    isUtxoError,
    setShowUtxoModal,
    showUtxoModal,
    utxoModalProps,
  }
}
