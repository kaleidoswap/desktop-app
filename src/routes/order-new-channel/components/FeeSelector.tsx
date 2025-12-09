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
    <div>
      <label className="text-sm font-medium text-gray-400 mb-3 block">
        {t('orderChannel.step3.feeRateLabel')}
      </label>
      <div className="grid grid-cols-2 gap-3">
        {feeRates.map((rate) => (
          <button
            className={`p-3 rounded-xl border-2 transition-all duration-200 flex items-center justify-between text-sm ${
              selectedFee === rate.value
                ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                : 'border-gray-700 text-gray-400 hover:border-blue-500/50'
            }`}
            key={rate.value}
            onClick={() => onFeeChange(rate.value)}
            type="button"
          >
            <div className="flex items-center gap-2">
              {getFeeIcon(rate.value)}
              <span>{rate.label}</span>
            </div>
            {rate.value !== 'custom' && <span>{rate.rate} {t('orderChannel.feeUnit')}</span>}
          </button>
        ))}
      </div>
      {selectedFee === 'custom' && (
        <input
          className="mt-3 w-full px-4 py-3 bg-gray-800/50 rounded-xl border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white"
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
