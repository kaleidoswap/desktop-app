import {
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import React, { useCallback } from 'react'

import { AssetOption } from '../../components/Trade'
import { calculateAndFormatRate } from '../../helpers/number'
import { TradingPair } from '../../slices/makerApi/makerApi.slice'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'

export interface SwapDetails {
  price: number
  fromAmount: string
  fromAsset: string
  toAmount: string
  toAsset: string
  timestamp: string
  selectedPair: TradingPair | null
  payment_hash: string
}

interface SwapRecapProps {
  isOpen: boolean
  onClose: () => void
  swapDetails: SwapDetails
  bitcoinUnit: string
  getAssetPrecision: (asset: string) => number
}

const getDisplayAsset = (asset: string, bitcoinUnit: string) => {
  return asset === 'BTC' && bitcoinUnit === 'SAT' ? 'SAT' : asset
}

const getStatusConfig = (status: string | undefined) => {
  switch (status?.toLowerCase()) {
    case 'succeeded':
      return {
        bg: 'bg-emerald-500/10',
        color: 'text-emerald-500',
        icon: CheckCircle,
        message: 'Swap completed successfully',
      }
    case 'expired':
      return {
        bg: 'bg-red-500/10',
        color: 'text-red-500',
        icon: AlertCircle,
        message: 'Swap expired - The maker did not respond in time',
      }
    case 'pending':
      return {
        bg: 'bg-blue-500/10',
        color: 'text-blue-500',
        icon: Clock,
        message: 'Processing swap with maker...',
      }
    case 'waiting':
      return {
        bg: 'bg-amber-500/10',
        color: 'text-amber-500',
        icon: Clock,
        message: 'Waiting for maker to process swap...',
      }
    default:
      return {
        bg: 'bg-amber-500/10',
        color: 'text-amber-500',
        icon: Clock,
        message: 'Waiting for maker to process swap...',
      }
  }
}

export const SwapRecap: React.FC<SwapRecapProps> = ({
  isOpen,
  onClose,
  swapDetails,
  bitcoinUnit,
  getAssetPrecision,
}) => {
  const {
    price,
    fromAmount,
    fromAsset,
    toAmount,
    toAsset,
    timestamp,
    selectedPair,
    payment_hash,
  } = swapDetails

  const { data: swapsData, isLoading: isSwapsLoading } =
    nodeApi.useListSwapsQuery(undefined, {
      pollingInterval: 3000,
    })

  const currentSwap = swapsData?.taker.find(
    (swap) => swap.payment_hash === payment_hash
  )

  const displayFromAsset = getDisplayAsset(fromAsset, bitcoinUnit)
  const displayToAsset = getDisplayAsset(toAsset, bitcoinUnit)

  const exchangeRate = calculateAndFormatRate(
    fromAsset,
    toAsset,
    price,
    selectedPair,
    bitcoinUnit,
    getAssetPrecision
  )

  const isPending = currentSwap?.status?.toLowerCase() === 'pending'
  const isWaiting = currentSwap?.status?.toLowerCase() === 'waiting'
  const isSucceeded = currentSwap?.status?.toLowerCase() === 'succeeded'
  const isExpired = currentSwap?.status?.toLowerCase() === 'expired'
  // If currentSwap is null/undefined, assume it's still in progress (waiting for initial status)
  const isInProgress =
    isPending || isWaiting || !currentSwap || (!isSucceeded && !isExpired)

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className="bg-slate-900/90 rounded-2xl border border-slate-800/50 w-full max-w-md shadow-xl animate-in slide-in-from-bottom-8 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Swap Details
              {isInProgress && (
                <span className="ml-2 text-sm font-normal text-slate-400">
                  (Please wait...)
                </span>
              )}
            </h2>
            <button
              aria-label="Close"
              className="p-2.5 rounded-xl transition-all duration-200 text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95"
              onClick={handleClose}
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Status Card */}
          <div
            className={`${getStatusConfig(currentSwap?.status).bg} rounded-xl p-5 space-y-4 transition-all duration-300`}
          >
            <div className="flex flex-col space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  {isSwapsLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  ) : isInProgress ? (
                    <div className="relative">
                      <Clock
                        className={`w-5 h-5 ${getStatusConfig(currentSwap?.status).color} transition-colors duration-300`}
                      />
                      <div
                        className={`absolute inset-0 rounded-full ${getStatusConfig(currentSwap?.status).color} animate-ping opacity-75`}
                      />
                    </div>
                  ) : (
                    <span
                      className={`${getStatusConfig(currentSwap?.status).color} transition-colors duration-300`}
                    >
                      {React.createElement(
                        getStatusConfig(currentSwap?.status).icon,
                        { size: 20 }
                      )}
                    </span>
                  )}
                  <span className="font-semibold text-slate-100">Status</span>
                </div>
                <span
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-300
                    ${getStatusConfig(currentSwap?.status).color} 
                    ${getStatusConfig(currentSwap?.status).bg}`}
                >
                  {currentSwap?.status || 'Waiting'}
                </span>
              </div>

              {/* Status Message */}
              <div
                className={`text-sm ${getStatusConfig(currentSwap?.status).color} transition-colors duration-300`}
              >
                {getStatusConfig(currentSwap?.status).message}
              </div>
            </div>

            {/* Progress Bar for Waiting/Pending States */}
            {isInProgress && (
              <div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${isWaiting ? 'bg-amber-500' : 'bg-blue-500'} 
                    animate-[progress_2s_ease-in-out_infinite] transition-colors duration-300`}
                  style={{
                    animation: 'progress 2s ease-in-out infinite',
                    background: isWaiting
                      ? 'linear-gradient(90deg, rgba(245, 158, 11, 0.5) 0%, rgba(245, 158, 11, 1) 50%, rgba(245, 158, 11, 0.5) 100%)'
                      : 'linear-gradient(90deg, rgba(59, 130, 246, 0.5) 0%, rgba(59, 130, 246, 1) 50%, rgba(59, 130, 246, 0.5) 100%)',
                    transform: 'translateX(-100%)',
                  }}
                />
              </div>
            )}

            {/* Show warning message for expired swaps */}
            {isExpired && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <p className="text-red-500 font-semibold">Swap Failed</p>
                    <p className="text-red-400/90 leading-relaxed">
                      The swap request expired because the maker did not respond
                      in time. This could be due to network issues or the maker
                      being temporarily unavailable. Please try again.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Swap Details */}
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-800/50 rounded-xl p-5 backdrop-blur-sm">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <span className="text-sm text-slate-400">You sent</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-semibold text-white break-all">
                      {fromAmount}
                    </span>
                    <AssetOption ticker={displayFromAsset} />
                  </div>
                </div>
                <ArrowRight className="text-slate-500 mx-3 w-5 h-5 flex-shrink-0" />
                <div className="space-y-1.5 min-w-0 flex-1 text-right">
                  <span className="text-sm text-slate-400">You received</span>
                  <div className="flex items-center gap-2 justify-end flex-wrap">
                    <span className="text-lg font-semibold text-white break-all">
                      {toAmount}
                    </span>
                    <AssetOption ticker={displayToAsset} />
                  </div>
                </div>
              </div>

              <div className="space-y-3.5 bg-slate-800/50 rounded-xl p-5 backdrop-blur-sm">
                <div className="flex justify-between items-center text-sm gap-4">
                  <span className="text-slate-400 flex-shrink-0">
                    Exchange rate
                  </span>
                  <span className="text-white font-medium break-all text-right">
                    {exchangeRate}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm gap-4">
                  <span className="text-slate-400 flex-shrink-0">Time</span>
                  <span className="text-white text-right">
                    {new Date(timestamp).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            className={`w-full py-3.5 px-4 rounded-xl font-medium transition-all duration-200 
              flex items-center justify-center gap-2.5 text-base
              ${
                isExpired
                  ? 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-lg shadow-red-500/20'
                  : isInProgress
                    ? 'bg-slate-700/50 text-slate-300 cursor-not-allowed opacity-75'
                    : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-lg shadow-blue-500/20'
              } ${!isInProgress ? 'active:scale-[0.98]' : ''}`}
            disabled={isInProgress}
            onClick={isInProgress ? undefined : handleClose}
          >
            {isSucceeded ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Done
              </>
            ) : isExpired ? (
              <>
                <RefreshCw className="w-5 h-5" />
                Try Again
              </>
            ) : isInProgress ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              'OK'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
