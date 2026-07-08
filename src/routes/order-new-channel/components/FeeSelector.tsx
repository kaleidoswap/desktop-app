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
    <div className="space-y-1">
      <label className="text-xs font-medium text-content-secondary">
        {t('orderChannel.step3.feeRateLabel')}
      </label>
      <div className="grid grid-cols-4 gap-2">
        {feeRates.map((rate) => (
          <button
            className={`py-1.5 px-2 flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors duration-200 border text-xs ${
              selectedFee === rate.value
                ? 'bg-primary/10 border-primary text-primary'
                : 'border-border-default hover:border-primary/50 text-content-secondary'
            }`}
            key={rate.value}
            onClick={() => onFeeChange(rate.value)}
            type="button"
          >
            {getFeeIcon(rate.value)}
            <span className="text-[10px]">{rate.label}</span>
            {rate.value !== 'custom' && (
              <span className="text-[9px]">
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
