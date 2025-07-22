import { ChevronDown, Info, Loader, Settings, Zap } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'

import { ERROR_NOT_ENOUGH_UNCOLORED, DEFAULT_UTXO_SIZE } from '../../constants'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'

interface CreateUTXOModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  operationType: 'issuance' | 'channel'
  channelCapacity?: number
  error?: string
  retryFunction?: () => Promise<any>
}

export const CreateUTXOModal: React.FC<CreateUTXOModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  operationType,
  channelCapacity = 0,
  error,
  retryFunction,
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [feeRate, setFeeRate] = useState(0)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [numUtxos, setNumUtxos] = useState(() => {
    // For channel creation with no uncolored UTXOs, always use 1 UTXO
    if (
      operationType === 'channel' &&
      (error?.includes(ERROR_NOT_ENOUGH_UNCOLORED) ||
        error?.includes('No uncolored UTXOs available'))
    ) {
      return 1
    }
    return 3
  })
  const [utxoSize, setUtxoSize] = useState(() => {
    // For channel creation with no uncolored UTXOs, use the channel capacity
    if (
      operationType === 'channel' &&
      (error?.includes(ERROR_NOT_ENOUGH_UNCOLORED) ||
        error?.includes('No uncolored UTXOs available'))
    ) {
      console.log(
        'CreateUTXOModal: Detected channel UTXO error, using channelCapacity:',
        channelCapacity
      )
      return channelCapacity || DEFAULT_UTXO_SIZE
    }
    // Default size for issuing an asset
    if (operationType === 'issuance') {
      return DEFAULT_UTXO_SIZE
    }
    // For channel, use the channel capacity
    console.log(
      'CreateUTXOModal: Using channelCapacity for regular channel operation:',
      channelCapacity
    )
    return channelCapacity || DEFAULT_UTXO_SIZE
  })

  // For createutxos API
  const [createUtxos] = nodeApi.useLazyCreateUTXOsQuery()
  // For 6-block fee estimation
  const [estimateFee] = nodeApi.useLazyEstimateFeeQuery()
  // For getting BTC balance
  const [getBtcBalance, { data: btcBalanceData }] =
    nodeApi.endpoints.btcBalance.useLazyQuery()

  useEffect(() => {
    const fetchFeeRate = async () => {
      try {
        const response = await estimateFee({ blocks: 6 }).unwrap()
        setFeeRate(response.fee_rate)
      } catch (error) {
        console.error('Failed to fetch fee rate:', error)
        // Default to a reasonable fee rate if we can't fetch it
        setFeeRate(1.0)
      }
    }

    if (isOpen) {
      fetchFeeRate()
      getBtcBalance({ skip_sync: false })
    }
  }, [isOpen, estimateFee, getBtcBalance])

  // Update UTXO size when channelCapacity changes
  useEffect(() => {
    if (
      channelCapacity &&
      channelCapacity > 0 &&
      operationType === 'channel' &&
      (error?.includes(ERROR_NOT_ENOUGH_UNCOLORED) ||
        error?.includes('No uncolored UTXOs available'))
    ) {
      console.log(
        'CreateUTXOModal: Updating UTXO size based on channelCapacity:',
        channelCapacity
      )
      setUtxoSize(channelCapacity)
    }
  }, [channelCapacity, operationType, error])

  const toggleAdvanced = () => {
    setShowAdvanced((prev) => !prev)
  }

  const handleCreateUTXOs = async () => {
    setIsLoading(true)

    try {
      await createUtxos({
        fee_rate: feeRate,
        num: numUtxos,
        size: utxoSize,
        skip_sync: false,
      }).unwrap()

      toast.success('UTXOs created successfully')

      // Close the modal first
      setIsLoading(false)
      onClose()

      // If we have a retry function, call it after closing the modal
      if (retryFunction) {
        try {
          await retryFunction()
          onSuccess()
        } catch (retryError) {
          console.error('Error retrying operation:', retryError)
          toast.error('Created UTXOs but failed to complete the operation')
        }
      } else {
        onSuccess()
      }
    } catch (error: any) {
      toast.error(error?.data?.error || 'Failed to create UTXOs')
      setIsLoading(false)
    }
  }

  // Calculate the maximum possible size based on available balance
  const maxPossibleSize = btcBalanceData
    ? Math.floor(btcBalanceData.vanilla.spendable / numUtxos)
    : utxoSize

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-b from-blue-dark to-blue-darker p-0 rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-divider/20 animate-scaleIn overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed */}
        <div className="relative px-6 pt-6 pb-4 border-b border-divider/10 flex-shrink-0">
          <h3 className="text-xl font-bold text-white flex items-center">
            <Zap className="mr-2 text-blue-400" size={20} />
            Create Colored UTXOs
          </h3>
          <button
            aria-label="Close"
            className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors"
            onClick={onClose}
          >
            <svg
              fill="none"
              height="18"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="18"
              xmlns="http://www.w3.org/2000/svg"
            >
              <line x1="18" x2="6" y1="6" y2="18"></line>
              <line x1="6" x2="18" y1="6" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 shadow-inner animate-pulse">
                <div className="flex items-center gap-2">
                  <svg
                    className="text-red-400"
                    fill="none"
                    height="16"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="16"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" x2="12" y1="8" y2="12"></line>
                    <line x1="12" x2="12.01" y1="16" y2="16"></line>
                  </svg>
                  <p className="text-sm font-medium text-red-300">
                    Error: {error}
                  </p>
                </div>
              </div>
            )}

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3 mb-6 shadow-inner">
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-200">
                <p className="mb-2 font-medium">
                  {operationType === 'issuance'
                    ? 'Issuing an RGB asset requires colorable UTXOs.'
                    : 'Opening a channel with RGB assets requires colorable UTXOs.'}
                </p>
                <p className="text-slate-300">
                  This operation requires an on-chain transaction. A fee of
                  approximately{' '}
                  <span className="font-medium text-white">
                    {feeRate.toFixed(2)} sat/vB
                  </span>{' '}
                  will be used.
                </p>
              </div>
            </div>

            <button
              className="w-full flex items-center justify-between py-3 px-4 mb-5 text-sm font-medium text-slate-200 hover:text-white bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/50 rounded-xl transition-all duration-200 group hover:shadow-md"
              onClick={toggleAdvanced}
            >
              <div className="flex items-center">
                <Settings
                  className="mr-2 text-blue-400 group-hover:text-blue-300 transition-colors"
                  size={15}
                />
                <span>Advanced Settings</span>
              </div>
              <div
                className={`transition-transform duration-300 ease-in-out ${showAdvanced ? 'rotate-180' : ''}`}
              >
                <ChevronDown
                  className="text-slate-400 group-hover:text-blue-300 transition-colors"
                  size={16}
                />
              </div>
            </button>

            {showAdvanced && (
              <div className="mb-6 space-y-5 bg-blue-darker/90 p-5 rounded-xl border border-slate-700/30 shadow-inner animate-fadeIn max-h-[200px] overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2 flex items-center">
                    Number of UTXOs
                    <div className="relative ml-2 group">
                      <Info
                        className="text-slate-400 hover:text-blue-400 cursor-help"
                        size={14}
                      />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-slate-800 text-xs text-slate-200 rounded-lg shadow-lg w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-10">
                        Creating multiple UTXOs allows for parallel transactions
                        but uses more chain space.
                      </div>
                    </div>
                  </label>
                  <div className="flex rounded-lg overflow-hidden border border-slate-600 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                    <button
                      className="bg-slate-700 text-white px-3 py-2 hover:bg-slate-600 disabled:opacity-50 transition-colors"
                      disabled={numUtxos <= 1}
                      onClick={() =>
                        setNumUtxos((prev) => Math.max(1, prev - 1))
                      }
                    >
                      <svg
                        fill="none"
                        height="16"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        width="16"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <line x1="5" x2="19" y1="12" y2="12"></line>
                      </svg>
                    </button>
                    <input
                      className="w-full bg-slate-800/80 text-white px-4 py-2 text-center focus:outline-none"
                      max="10"
                      min="1"
                      onChange={(e) =>
                        setNumUtxos(Math.max(1, parseInt(e.target.value) || 1))
                      }
                      type="number"
                      value={numUtxos}
                    />
                    <button
                      className="bg-slate-700 text-white px-3 py-2 hover:bg-slate-600 disabled:opacity-50 transition-colors"
                      disabled={numUtxos >= 10}
                      onClick={() =>
                        setNumUtxos((prev) => Math.min(10, prev + 1))
                      }
                    >
                      <svg
                        fill="none"
                        height="16"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        width="16"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <line x1="12" x2="12" y1="5" y2="19"></line>
                        <line x1="5" x2="19" y1="12" y2="12"></line>
                      </svg>
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Recommended: 1-10 UTXOs
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2 flex items-center">
                    UTXO Size (in satoshis)
                    <div className="relative ml-2 group">
                      <Info
                        className="text-slate-400 hover:text-blue-400 cursor-help"
                        size={14}
                      />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-slate-800 text-xs text-slate-200 rounded-lg shadow-lg w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-10">
                        Larger UTXOs allow for larger operations but require
                        more capital.
                      </div>
                    </div>
                  </label>
                  <input
                    className="w-full bg-slate-800/80 text-white px-4 py-2 rounded-lg border border-slate-600 
                           focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    max={maxPossibleSize}
                    min="5000"
                    onChange={(e) =>
                      setUtxoSize(
                        Math.max(5000, parseInt(e.target.value) || 5000)
                      )
                    }
                    type="number"
                    value={utxoSize}
                  />
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Available balance:</span>
                      <span className="text-slate-200 font-medium">
                        {btcBalanceData
                          ? btcBalanceData.vanilla.spendable.toLocaleString()
                          : '...'}{' '}
                        sats
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Total amount:</span>
                      <span className="text-blue-300 font-medium">
                        {(numUtxos * utxoSize).toLocaleString()} sats
                      </span>
                    </div>
                    <div className="w-full bg-slate-700/50 rounded-full h-1.5 mt-1">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                        style={{
                          backgroundColor:
                            numUtxos * utxoSize >
                            (btcBalanceData?.vanilla.spendable || 0)
                              ? 'rgb(239, 68, 68)'
                              : undefined,
                          width: btcBalanceData
                            ? `${Math.min(100, ((numUtxos * utxoSize) / btcBalanceData.vanilla.spendable) * 100)}%`
                            : '0%',
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="px-6 py-4 border-t border-divider/10 bg-blue-darker flex-shrink-0 sticky bottom-0 z-10">
          <div className="flex justify-end space-x-4">
            <button
              className="px-5 py-2.5 rounded-lg text-slate-300 bg-slate-800/50 hover:bg-slate-700/70 border border-slate-700/50 transition-colors disabled:opacity-50"
              disabled={isLoading}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium flex items-center justify-center min-w-[120px] transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                isLoading ||
                (btcBalanceData &&
                  numUtxos * utxoSize > btcBalanceData.vanilla.spendable)
              }
              onClick={handleCreateUTXOs}
            >
              {isLoading ? (
                <>
                  <Loader className="animate-spin mr-2" size={18} />
                  Processing...
                </>
              ) : (
                <>
                  <Zap className="mr-2" size={18} />
                  Create UTXOs
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
