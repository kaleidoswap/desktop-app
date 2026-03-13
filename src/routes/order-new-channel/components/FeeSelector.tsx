import { Clock, Rocket, Settings, Zap } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

interface FeeSelectorProps {
  selectedFee: string
  customFee: number
  onFeeChange: (fee: string) => void
  onCustomFeeChange: (fee: number) => void
}

const getFeeIcon = (type: string) => {
  switch (type) {
    case 'slow':
      return <Clock className="w-4 h-4" />
    case 'fast':
      return <Rocket className="w-4 h-4" />
    case 'custom':
      return <Settings className="w-4 h-4" />
    default:
      return <Zap className="w-4 h-4" />
  }
}

export const FeeSelector: React.FC<FeeSelectorProps> = ({
  selectedFee,
  customFee,
  onFeeChange,
  onCustomFeeChange,
}) => {
  const { t } = useTranslation()

  const feeRates = [
    { label: t('orderChannel.step3.feeSlow'), rate: 1, value: 'slow' },
    { label: t('orderChannel.step3.feeNormal'), rate: 2, value: 'normal' },
    { label: t('orderChannel.step3.feeFast'), rate: 3, value: 'fast' },
    { label: t('orderChannel.step3.feeCustom'), rate: 0, value: 'custom' },
  ]
  return (
    <div className="space-y-3">
      <label className="block text-[11px] font-semibold uppercase tracking-[0.28em] text-content-tertiary">
        {t('orderChannel.step3.feeRateLabel')}
      </label>
      <div className="grid grid-cols-2 gap-3">
        {feeRates.map((rate) => (
          <button
            className={`flex items-center justify-between rounded-2xl border px-3 py-3 text-sm transition-all duration-200 ${
              selectedFee === rate.value
                ? 'border-cyan-400/25 bg-cyan-400/10 text-cyan-100'
                : 'border-border-subtle bg-surface-base/45 text-content-secondary hover:border-cyan-400/25 hover:text-content-primary'
            }`}
            key={rate.value}
            onClick={() => onFeeChange(rate.value)}
            type="button"
          >
            <div className="flex items-center gap-2">
              {getFeeIcon(rate.value)}
              <span>{rate.label}</span>
            </div>
            {rate.value !== 'custom' && (
              <span>
                {rate.rate} {t('orderChannel.feeUnit')}
              </span>
            )}
          </button>
        ))}
      </div>
      {selectedFee === 'custom' && (
        <input
          className="w-full rounded-2xl border border-border-subtle bg-surface-base/60 px-4 py-3 text-white focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/30"
          onChange={(e) => onCustomFeeChange(parseFloat(e.target.value))}
          placeholder={t('orderChannel.step3.customFeePlaceholder')}
          step="0.1"
          type="number"
          value={customFee}
        />
      )}
    </div>
  )
}
