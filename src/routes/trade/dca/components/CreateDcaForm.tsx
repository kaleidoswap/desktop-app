import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import { useAppDispatch } from '../../../../app/store/hooks'
import { DcaIntervalHours, DcaOrderType, createOrder } from '../../../../slices/dcaSlice'

interface Props {
  currentBtcPrice?: number
  onCreated?: () => void
}

const INTERVALS: { label: string; value: DcaIntervalHours }[] = [
  { label: '1h', value: 1 },
  { label: '4h', value: 4 },
  { label: '8h', value: 8 },
  { label: '24h', value: 24 },
  { label: '1w', value: 168 },
]

const DROP_OPTIONS = [3, 5, 10, 15, 20]

export function CreateDcaForm({ currentBtcPrice, onCreated }: Props) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  const [type, setType] = useState<DcaOrderType>('scheduled')
  const [amountUsdt, setAmountUsdt] = useState('')
  const [intervalHours, setIntervalHours] = useState<DcaIntervalHours>(24)
  const [targetDropPercent, setTargetDropPercent] = useState(5)

  const handleCreate = () => {
    const amount = parseFloat(amountUsdt)
    if (!amount || amount <= 0) {
      toast.error(t('dca.errors.invalidAmount', 'Please enter a valid USDT amount'))
      return
    }

    if (type === 'price-target' && !currentBtcPrice) {
      toast.error(t('dca.errors.noPriceData', 'BTC price not available'))
      return
    }

    dispatch(
      createOrder({
        amountUsdt: amount,
        creationPriceBtcUsdt: type === 'price-target' ? currentBtcPrice : undefined,
        intervalHours: type === 'scheduled' ? intervalHours : undefined,
        targetDropPercent: type === 'price-target' ? targetDropPercent : undefined,
        type,
      })
    )

    toast.success(t('dca.toast.created', 'DCA order created'))
    setAmountUsdt('')
    onCreated?.()
  }

  return (
    <div className="bg-surface-raised border border-border-subtle rounded-xl p-5 space-y-5">
      <h3 className="text-sm font-semibold text-content-primary">
        {t('dca.createOrder', 'New DCA Order')}
      </h3>

      {/* Type selector */}
      <div className="flex gap-2">
        {(['scheduled', 'price-target'] as DcaOrderType[]).map((t_) => (
          <button
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all duration-200 ${
              type === t_
                ? 'bg-primary/15 text-primary border-primary/40'
                : 'bg-surface-overlay/30 text-content-secondary border-border-subtle hover:border-border-default'
            }`}
            key={t_}
            onClick={() => setType(t_)}
          >
            {t_ === 'scheduled'
              ? t('dca.type.scheduled', 'Scheduled')
              : t('dca.type.priceTarget', 'Price Target')}
          </button>
        ))}
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <label className="text-xs text-content-tertiary font-medium">
          {t('dca.amountLabel', 'Amount per buy')} (USDT)
        </label>
        <input
          className="w-full bg-surface-overlay border border-border-subtle rounded-lg px-3 py-2.5
                     text-sm text-content-primary placeholder:text-content-tertiary
                     focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20
                     transition-colors"
          min="0"
          placeholder="50"
          step="any"
          type="number"
          value={amountUsdt}
          onChange={(e) => setAmountUsdt(e.target.value)}
        />
      </div>

      {/* Scheduled options */}
      {type === 'scheduled' && (
        <div className="space-y-1.5">
          <label className="text-xs text-content-tertiary font-medium">
            {t('dca.intervalLabel', 'Buy every')}
          </label>
          <div className="flex gap-2 flex-wrap">
            {INTERVALS.map(({ label, value }) => (
              <button
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${
                  intervalHours === value
                    ? 'bg-primary/15 text-primary border-primary/40'
                    : 'bg-surface-overlay/30 text-content-secondary border-border-subtle hover:border-border-default'
                }`}
                key={value}
                onClick={() => setIntervalHours(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Price-target options */}
      {type === 'price-target' && (
        <div className="space-y-1.5">
          <label className="text-xs text-content-tertiary font-medium">
            {t('dca.dropLabel', 'Drop threshold')}
          </label>
          <div className="flex gap-2 flex-wrap">
            {DROP_OPTIONS.map((pct) => (
              <button
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${
                  targetDropPercent === pct
                    ? 'bg-status-warning/15 text-status-warning border-status-warning/40'
                    : 'bg-surface-overlay/30 text-content-secondary border-border-subtle hover:border-border-default'
                }`}
                key={pct}
                onClick={() => setTargetDropPercent(pct)}
              >
                -{pct}%
              </button>
            ))}
          </div>
          {currentBtcPrice && (
            <p className="text-xs text-content-tertiary pt-1">
              {t('dca.triggerPrice', 'Triggers at ≤')}:{' '}
              <span className="text-status-warning font-medium">
                $
                {(currentBtcPrice * (1 - targetDropPercent / 100)).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </span>{' '}
              <span className="text-content-tertiary">
                (now: ${currentBtcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })})
              </span>
            </p>
          )}
        </div>
      )}

      <button
        className="w-full py-2.5 rounded-xl bg-primary text-white font-semibold text-sm
                   hover:bg-primary/90 active:scale-[0.98] transition-all duration-200
                   disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!amountUsdt || parseFloat(amountUsdt) <= 0}
        onClick={handleCreate}
      >
        {t('dca.createButton', 'Create Order')}
      </button>
    </div>
  )
}
