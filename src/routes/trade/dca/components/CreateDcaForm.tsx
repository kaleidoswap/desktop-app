import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import { Wallet, Target, CalendarClock, ArrowRight } from 'lucide-react'

import { useAppDispatch } from '../../../../app/store/hooks'
import bitcoinLogo from '../../../../assets/bitcoin-logo.svg'
import tetherLogo from '../../../../assets/tether-logo.svg'
import {
  DcaIntervalHours,
  DcaOrderType,
  createOrder,
} from '../../../../slices/dcaSlice'
import { nodeApi } from '../../../../slices/nodeApi/nodeApi.slice'

interface Props {
  currentBtcPrice?: number
  onCreated?: () => void
}

const ONE_MINUTE_IN_HOURS = 1 / 60

const INTERVALS: { label: string; value: DcaIntervalHours }[] = [
  { label: '1m', value: ONE_MINUTE_IN_HOURS },
  { label: '1h', value: 1 },
  { label: '4h', value: 4 },
  { label: '8h', value: 8 },
  { label: '24h', value: 24 },
  { label: '1w', value: 168 },
]

const DROP_OPTIONS = [0.1, 3, 5, 10, 15, 20]

function useUsdtLnBalance(): number | undefined {
  const { data: channelsData } = nodeApi.endpoints.listChannels.useQuery(
    undefined,
    {
      pollingInterval: 30_000,
    }
  )
  const { data: assetsData } = nodeApi.endpoints.listAssets.useQuery(
    undefined,
    {
      pollingInterval: 30_000,
    }
  )

  if (!channelsData?.channels || !assetsData?.nia) return undefined

  // Find USDT asset_id
  const usdtAsset = assetsData.nia.find((a: any) => a.ticker === 'USDT')
  if (!usdtAsset) return undefined

  const usdtAssetId = usdtAsset.asset_id as string
  const usdtPrecision = usdtAsset.precision ?? 6
  const precisionFactor = Math.pow(10, usdtPrecision)

  // Sum asset_local_amount across ready channels with this asset_id
  return channelsData.channels
    .filter((ch: any) => ch.asset_id === usdtAssetId && ch.ready)
    .reduce(
      (sum: number, ch: any) =>
        sum + (ch.asset_local_amount ?? 0) / precisionFactor,
      0
    )
}

export function CreateDcaForm({ currentBtcPrice, onCreated }: Props) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const usdtBalance = useUsdtLnBalance()

  const [type, setType] = useState<DcaOrderType>('scheduled')
  const [amountUsdt, setAmountUsdt] = useState('')
  const [intervalHours, setIntervalHours] = useState<DcaIntervalHours>(24)
  const [targetDropPercent, setTargetDropPercent] = useState(5)

  const amount = parseFloat(amountUsdt)
  const insufficientBalance =
    usdtBalance !== undefined && amount > 0 && amount > usdtBalance
  const estimatedSats =
    currentBtcPrice && amount > 0
      ? Math.round((amount / currentBtcPrice) * 100_000_000)
      : undefined
  const availableAfterOrder =
    usdtBalance !== undefined && amount > 0 ? usdtBalance - amount : undefined

  const handleCreate = () => {
    if (!amount || amount <= 0) {
      toast.error(
        t('dca.errors.invalidAmount', 'Please enter a valid USDT amount')
      )
      return
    }
    if (type === 'price-target' && !currentBtcPrice) {
      toast.error(t('dca.errors.noPriceData', 'BTC price not available'))
      return
    }

    dispatch(
      createOrder({
        amountUsdt: amount,
        creationPriceBtcUsdt:
          type === 'price-target' ? currentBtcPrice : undefined,
        intervalHours: type === 'scheduled' ? intervalHours : undefined,
        targetDropPercent:
          type === 'price-target' ? targetDropPercent : undefined,
        type,
      })
    )

    toast.success(t('dca.toast.created', 'DCA order created'))
    setAmountUsdt('')
    onCreated?.()
  }

  return (
    <div className="bg-surface-raised border border-border-subtle rounded-2xl p-5 md:p-6 space-y-5 shadow-sm">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-content-primary">
          {t('dca.createOrder', 'New DCA Order')}
        </h3>
        <p className="text-sm text-content-primary/90 leading-relaxed">
          {t(
            'dca.form.subtitle',
            'Choose how much USDT to spend per buy and when the order should fire. Every successful execution converts that fixed USDT amount into BTC sats.'
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-overlay/50 px-3 py-2">
        <img
          alt="USDT"
          className="w-4 h-4 rounded-full flex-shrink-0"
          src={tetherLogo}
        />
        <span className="text-xs font-medium text-content-primary">USDT</span>
        <ArrowRight className="w-3.5 h-3.5 text-content-tertiary" />
        <img
          alt="BTC"
          className="w-4 h-4 rounded-full flex-shrink-0"
          src={bitcoinLogo}
        />
        <span className="text-xs font-medium text-content-primary">BTC</span>
        <span className="text-xs text-content-secondary">
          {t(
            'dca.form.conversionHint',
            'Each execution spends USDT once and credits BTC sats.'
          )}
        </span>
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {(['scheduled', 'price-target'] as DcaOrderType[]).map((t_) => (
          <button
            className={`py-2.5 px-3 rounded-lg text-sm font-medium border transition-all duration-200 text-left ${
              type === t_
                ? 'bg-primary/15 text-primary border-primary/40 shadow-sm'
                : 'bg-surface-overlay/30 text-content-secondary border-border-subtle hover:border-border-default'
            }`}
            key={t_}
            onClick={() => setType(t_)}
          >
            <div className="inline-flex items-center gap-1.5">
              {t_ === 'scheduled' ? (
                <CalendarClock className="w-4 h-4" />
              ) : (
                <Target className="w-4 h-4" />
              )}
              <span>
                {t_ === 'scheduled'
                  ? t('dca.type.scheduled', 'Scheduled')
                  : t('dca.type.priceTarget', 'Price Target')}
              </span>
            </div>
            <p className="text-xs mt-1 text-content-secondary leading-relaxed">
              {t_ === 'scheduled'
                ? t(
                    'dca.form.scheduledHint',
                    'Buys the same USDT amount on a fixed cadence'
                  )
                : t(
                    'dca.form.targetHint',
                    'Waits for a BTC dip, then buys once and re-arms'
                  )}
            </p>
          </button>
        ))}
      </div>

      {/* Amount + USDT balance */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-content-secondary font-medium">
            {t('dca.amountLabel', 'Amount per buy')} (USDT)
          </label>
          {usdtBalance !== undefined && (
            <button
              className="flex items-center gap-1 text-xs text-content-secondary hover:text-primary transition-colors"
              onClick={() => setAmountUsdt(String(usdtBalance))}
            >
              <Wallet className="w-3 h-3" />
              <span>
                {usdtBalance.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{' '}
                USDT
              </span>
            </button>
          )}
        </div>
        <input
          className={`w-full bg-surface-overlay border rounded-lg px-3 py-2.5
                     text-sm text-content-primary placeholder:text-content-tertiary
                     focus:outline-none focus:ring-1 transition-colors
                     ${
                       insufficientBalance
                         ? 'border-status-danger/50 focus:border-status-danger/70 focus:ring-status-danger/20'
                         : 'border-border-subtle focus:border-primary/50 focus:ring-primary/20'
                     }`}
          min="0"
          placeholder="50"
          step="any"
          type="number"
          value={amountUsdt}
          onChange={(e) => setAmountUsdt(e.target.value)}
        />
        {estimatedSats != null && estimatedSats > 0 && (
          <div className="bg-surface-overlay/50 border border-border-subtle rounded-lg p-2 text-xs">
            <p className="text-content-secondary">
              {t('dca.form.estimatedReceive', 'Estimated receive per buy')}
            </p>
            <p className="text-content-primary font-semibold">
              ~{estimatedSats.toLocaleString()} sats
            </p>
          </div>
        )}
        <p className="text-xs text-content-secondary leading-relaxed">
          {t(
            'dca.form.liquidityHint',
            'DCA needs spendable USDT Lightning balance plus enough BTC receive capacity for each execution.'
          )}
        </p>
        {availableAfterOrder != null && !insufficientBalance && (
          <p className="text-xs text-content-secondary">
            {t('dca.form.remainingBalance', 'Remaining after each buy')}:{' '}
            {availableAfterOrder.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}{' '}
            USDT
          </p>
        )}
        {insufficientBalance && (
          <p className="text-xs text-status-danger">
            {t(
              'dca.errors.insufficientBalance',
              'Exceeds available USDT channel balance'
            )}
          </p>
        )}
      </div>

      {/* Scheduled options */}
      {type === 'scheduled' && (
        <div className="space-y-1.5">
          <label className="text-xs text-content-secondary font-medium">
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
                key={label}
                onClick={() => setIntervalHours(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-content-secondary leading-relaxed">
            {t(
              'dca.form.scheduleNote',
              'The app checks due orders about every 5 seconds while your node is unlocked.'
            )}
          </p>
        </div>
      )}

      {/* Price-target options */}
      {type === 'price-target' && (
        <div className="space-y-1.5">
          <label className="text-xs text-content-secondary font-medium">
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
            <div className="bg-surface-overlay/50 border border-border-subtle rounded-lg p-2 mt-1">
              <p className="text-xs text-content-secondary leading-relaxed">
                {t('dca.triggerPrice', 'Triggers at ≤')}:{' '}
                <span className="text-status-warning font-medium">
                  $
                  {(
                    currentBtcPrice *
                    (1 - targetDropPercent / 100)
                  ).toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </span>{' '}
                <span className="text-content-secondary">
                  (now: $
                  {currentBtcPrice.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                  )
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      <button
        className="w-full py-2.5 rounded-xl bg-primary text-white font-semibold text-sm
                   hover:bg-primary/90 active:scale-[0.98] transition-all duration-200
                   disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!amountUsdt || amount <= 0 || insufficientBalance}
        onClick={handleCreate}
      >
        {t('dca.createButton', 'Create Order')}
      </button>
    </div>
  )
}
