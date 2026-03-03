import { X } from 'lucide-react'
import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const [ticker, setTicker] = useState('')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [precision, setPrecision] = useState('0')
  const [isLoading, setIsLoading] = useState(false)

  const { showUtxoModal, setShowUtxoModal, utxoModalProps, handleApiError } =
    useUtxoErrorHandler()

  const [issueAsset] = nodeApi.endpoints.issueNiaAsset.useMutation()

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
      ticker: (ticker || '').toUpperCase(),
    }).unwrap()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await issueAssetOperation()
      toast.success(t('issueAssetModal.success'))
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
            (error instanceof Error
              ? error.message
              : t('issueAssetModal.failure'))
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-surface-overlay rounded-xl border border-border-default p-6 w-full max-w-md">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">
              {t('issueAssetModal.title')}
            </h2>
            <button
              className="p-2 hover:bg-surface-high rounded-lg transition-colors"
              onClick={onClose}
            >
              <X className="w-5 h-5 text-content-secondary" />
            </button>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
            <p className="text-blue-400 text-sm">{t('issueAssetModal.note')}</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-2">
                {t('issueAssetModal.tickerLabel')}
              </label>
              <input
                className="w-full bg-surface-base border border-border-default rounded-lg px-4 py-2 text-white"
                maxLength={5}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder={t('issueAssetModal.tickerPlaceholder')}
                required
                type="text"
                value={ticker}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-content-secondary mb-2">
                {t('issueAssetModal.nameLabel')}
              </label>
              <input
                className="w-full bg-surface-base border border-border-default rounded-lg px-4 py-2 text-white"
                onChange={(e) => setName(e.target.value)}
                placeholder={t('issueAssetModal.namePlaceholder')}
                required
                type="text"
                value={name}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-content-secondary mb-2">
                {t('issueAssetModal.amountLabel')}
              </label>
              <input
                className="w-full bg-surface-base border border-border-default rounded-lg px-4 py-2 text-white"
                min="0"
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t('issueAssetModal.amountPlaceholder')}
                required
                type="number"
                value={amount}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-content-secondary mb-2">
                {t('issueAssetModal.precisionLabel')}
              </label>
              <input
                className="w-full bg-surface-base border border-border-default rounded-lg px-4 py-2 text-white"
                max="18"
                min="0"
                onChange={(e) => {
                  // removing fraction inputs
                  const val = e.target.value
                  const floored = Math.floor(Number(val))
                  setPrecision(String(floored))
                }}
                placeholder={t('issueAssetModal.precisionPlaceholder')}
                required
                step="1"
                type="number"
                value={precision}
              />
              {(Number(precision) > 10 || Number(precision) < 0) &&
                precision !== '' && (
                  <p className="text-red-500 text-xs mt-1">
                    {t('issueAssetModal.precisionError')}
                  </p>
                )}
            </div>

            {amount && (
              <p className="mt-2 text-sm text-content-secondary">
                {t('issueAssetModal.previewPrefix')}{' '}
                <span className="text-white font-medium">{previewAmount}</span>
              </p>
            )}
            <button
              className="w-full px-6 py-3 bg-primary hover:bg-primary-emphasis
                       text-primary-foreground rounded-xl font-medium transition-colors
                       disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isLoading}
              type="submit"
            >
              {isLoading
                ? t('issueAssetModal.submitting')
                : t('issueAssetModal.submit')}
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
