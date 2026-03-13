import React from 'react'
import { useTranslation } from 'react-i18next'

interface PaymentMethodTabsProps {
  paymentMethod: 'lightning' | 'onchain'
  onMethodChange: (method: 'lightning' | 'onchain') => void
}

export const PaymentMethodTabs: React.FC<PaymentMethodTabsProps> = ({
  paymentMethod,
  onMethodChange,
}) => {
  const { t } = useTranslation()

  return (
    <div className="flex justify-start">
      <div className="grid w-full grid-cols-2 gap-2 rounded-2xl border border-border-subtle bg-surface-overlay/50 p-1.5">
        {['lightning', 'onchain'].map((method) => (
          <button
            className={`rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
              paymentMethod === method
                ? method === 'lightning'
                  ? 'bg-cyan-400/15 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.18)]'
                  : 'bg-amber-400/15 text-amber-100 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.18)]'
                : 'text-content-secondary hover:bg-surface-base/70 hover:text-content-primary'
            }`}
            key={method}
            onClick={() => onMethodChange(method as 'lightning' | 'onchain')}
          >
            {method === 'lightning'
              ? t('orderChannel.step3.lightningTab')
              : t('orderChannel.step3.onchainTab')}
          </button>
        ))}
      </div>
    </div>
  )
}
