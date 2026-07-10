import { Plus, Loader, Info, X } from 'lucide-react'
import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import { useUtxoErrorHandler } from '../../hooks/useUtxoErrorHandler'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { CreateUTXOModal } from '../CreateUTXOModal'
import { Modal } from '../ui/Modal'

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

  const actualAmount = useMemo(() => {
    if (
      !amount ||
      isNaN(Number(amount)) ||
      !precision ||
      isNaN(Number(precision))
    )
      return '0'
    return (Number(amount) * Math.pow(10, Number(precision))).toString()
  }, [amount, precision])

  const previewAmount = useMemo(() => {
    if (!amount || isNaN(Number(amount))) return '0'
    let safePrecision = Number(precision)
    if (isNaN(safePrecision) || safePrecision < 0) safePrecision = 0
    if (safePrecision > 10) safePrecision = 10
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
      const wasHandled = handleApiError(
        error,
        'issuance',
        0,
        issueAssetOperation
      )
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

  const inputClass =
    'w-full bg-surface-overlay/50 text-white px-4 py-2.5 rounded-lg border border-border-default ' +
    'focus:border-primary/50 focus:ring-1 focus:ring-primary/20 focus:outline-none text-sm placeholder-content-tertiary'

  return (
    <>
      <Modal isOpen onClose={onClose} size="sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-divider/10">
          <div className="flex items-center gap-3">
            <Plus className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-semibold text-white">
              {t('issueAssetModal.title')}
            </h3>
          </div>
          <button
            aria-label="Close modal"
            className="p-2 rounded-full hover:bg-surface-overlay text-content-secondary hover:text-white transition-colors"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Info banner */}
          <div className="flex items-start gap-3 rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-300">{t('issueAssetModal.note')}</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-2">
                {t('issueAssetModal.tickerLabel')}
              </label>
              <input
                className={inputClass}
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
                className={inputClass}
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
                className={inputClass}
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
                className={inputClass}
                max="18"
                min="0"
                onChange={(e) => {
                  const floored = Math.floor(Number(e.target.value))
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
              <p className="text-sm text-content-secondary">
                {t('issueAssetModal.previewPrefix')}{' '}
                <span className="text-white font-medium">{previewAmount}</span>
              </p>
            )}

            <button
              className="w-full px-4 py-2.5 bg-primary hover:bg-primary-emphasis
                       text-primary-foreground rounded-lg text-sm font-semibold transition-colors
                       disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {isLoading
                ? t('issueAssetModal.submitting')
                : t('issueAssetModal.submit')}
            </button>
          </form>
        </div>
      </Modal>

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
