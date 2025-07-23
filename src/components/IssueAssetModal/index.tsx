import { X } from 'lucide-react'
import React, { useState, useMemo } from 'react'
import { toast } from 'react-toastify'

import { useUtxoErrorHandler } from '../../hooks/useUtxoErrorHandler'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { CreateUTXOModal } from '../CreateUTXOModal'

interface IssueAssetModalProps {
  onClose: () => void
  onSuccess: () => void
}

export const IssueAssetModal: React.FC<IssueAssetModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const [ticker, setTicker] = useState('')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [precision, setPrecision] = useState('0')
  const [isLoading, setIsLoading] = useState(false)

  const { showUtxoModal, setShowUtxoModal, utxoModalProps, handleApiError } =
    useUtxoErrorHandler()

  const [issueAsset] = nodeApi.endpoints.issueNiaAsset.useLazyQuery()

  // Calculate the actual amount that will be issued with decimal places
  const actualAmount = useMemo(() => {
    if (
      !amount ||
      isNaN(Number(amount)) ||
      !precision ||
      isNaN(Number(precision))
    ) {
      return '0'
    }

    // Convert to base units (add zeros based on precision)
    const baseAmount = Number(amount) * Math.pow(10, Number(precision))
    return baseAmount.toString()
  }, [amount, precision])

  // Format preview amount with decimal places
  const previewAmount = useMemo(() => {
    if (!amount || isNaN(Number(amount))) {
      return '0'
    }

    // Clamp precision between 0 and 10
    let safePrecision = Number(precision)
    if (isNaN(safePrecision) || safePrecision < 0) safePrecision = 0
    if (safePrecision > 10) safePrecision = 10

    // Display with appropriate decimal places
    return Number(amount).toFixed(safePrecision)
  }, [amount, precision])

  const issueAssetOperation = async () => {
    return await issueAsset({
      amounts: [Number(actualAmount)],
      name,
      precision: Number(precision),
      ticker: ticker.toUpperCase(),
    }).unwrap()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await issueAssetOperation()
      toast.success('Asset issued successfully!')
      onSuccess()
      onClose()
    } catch (error: any) {
      // Check if it's a UTXO-related error
      const wasHandled = handleApiError(
        error,
        'issuance',
        0,
        issueAssetOperation
      )

      // Only show toast for errors that weren't handled by the UTXO modal
      if (!wasHandled) {
        toast.error(
          error?.data?.error ||
            (error instanceof Error ? error.message : 'Failed to issue asset')
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Issue New Asset</h2>
            <button
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              onClick={onClose}
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
            <p className="text-blue-400 text-sm">
              Note: Issuing a new asset requires colored UTXOs. The process may
              involve an on-chain transaction if you don't have enough colored
              UTXOs.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Ticker Symbol
              </label>
              <input
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                maxLength={5}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="BTC"
                required
                type="text"
                value={ticker}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Asset Name
              </label>
              <input
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                onChange={(e) => setName(e.target.value)}
                placeholder="Bitcoin"
                required
                type="text"
                value={name}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Amount to Issue
              </label>
              <input
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                min="0"
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                required
                type="number"
                value={amount}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Precision (decimal places)
              </label>
              <input
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                max="18"
                min="0"
                onChange={(e) => {
                  // removing fraction inputs
                  let val = e.target.value
                  const floored = Math.floor(Number(val))
                  setPrecision(String(floored))
                }}
                placeholder="8"
                required
                step="1"
                type="number"
                value={precision}
              />
              {(Number(precision) > 10 || Number(precision) < 0) &&
                precision !== '' && (
                  <p className="text-red-500 text-xs mt-1">
                    Precision value must be between 0 and 10.
                  </p>
                )}
            </div>

            {amount && (
              <p className="mt-2 text-sm text-slate-400">
                You will issue:{' '}
                <span className="text-white font-medium">{previewAmount}</span>
              </p>
            )}
            <button
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 
                       text-white rounded-xl font-medium transition-colors
                       disabled:bg-blue-600/50 disabled:cursor-not-allowed"
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? 'Issuing...' : 'Issue Asset'}
            </button>
          </form>
        </div>
      </div>

      {/* UTXO Modal for handling UTXO-related errors */}
      <CreateUTXOModal
        channelCapacity={utxoModalProps.channelCapacity}
        error={utxoModalProps.error}
        isOpen={showUtxoModal}
        onClose={() => setShowUtxoModal(false)}
        onSuccess={onClose}
        operationType={utxoModalProps.operationType}
        retryFunction={utxoModalProps.retryFunction}
      />
    </>
  )
}
