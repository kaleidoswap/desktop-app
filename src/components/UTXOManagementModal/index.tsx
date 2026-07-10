import {
  Plus,
  Loader,
  Zap,
  Wallet,
  Paintbrush,
  ArrowLeft,
  Info,
  Database,
  Clock,
  Rocket,
  Settings,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import { formatBitcoinAmount } from '../../helpers/number'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { getAssignmentAmount } from '../../utils/rgbUtils'
import { Modal } from '../ui/Modal'

interface UTXOManagementModalProps {
  onClose: () => void
  bitcoinUnit: string
}

interface UTXOSummary {
  totalColorable: number
  totalColored: number
  totalNormal: number
  colorableCount: number
  coloredCount: number
  normalCount: number
}

interface CreateFormFields {
  num: number
  size: number
  fee_rate: string
}

export const UTXOManagementModal = ({
  onClose,
  bitcoinUnit,
}: UTXOManagementModalProps) => {
  const { t } = useTranslation()
  const [step, setStep] = useState<'list' | 'create'>('list')

  // ── List step state ──────────────────────────────────────────────────────
  const [listUnspents, { data: unspentsData, isLoading }] =
    nodeApi.useLazyListUnspentsQuery()

  useEffect(() => {
    listUnspents()
    const intervalId = setInterval(() => listUnspents(), 10000)
    return () => clearInterval(intervalId)
  }, [listUnspents])

  const { colorableUtxos, coloredUtxos, normalUtxos, summary } = useMemo(() => {
    if (!unspentsData?.unspents) {
      return {
        colorableUtxos: [],
        coloredUtxos: [],
        normalUtxos: [],
        summary: {
          colorableCount: 0,
          coloredCount: 0,
          normalCount: 0,
          totalColorable: 0,
          totalColored: 0,
          totalNormal: 0,
        },
      }
    }

    const colored = unspentsData.unspents.filter(
      (u: any) =>
        u.utxo?.colorable &&
        Array.isArray(u.rgb_allocations) &&
        u.rgb_allocations.length > 0
    )
    const colorable = unspentsData.unspents.filter(
      (u: any) =>
        u.utxo?.colorable &&
        (!Array.isArray(u.rgb_allocations) || u.rgb_allocations.length <= 0)
    )
    const normal = unspentsData.unspents.filter((u: any) => !u.utxo?.colorable)

    const summary: UTXOSummary = {
      colorableCount: colorable.length,
      coloredCount: colored.length,
      normalCount: normal.length,
      totalColorable: colorable.reduce(
        (sum: number, u: any) => sum + (u.utxo?.btc_amount || 0),
        0
      ),
      totalColored: colored.reduce(
        (sum: number, u: any) => sum + (u.utxo?.btc_amount || 0),
        0
      ),
      totalNormal: normal.reduce(
        (sum: number, u: any) => sum + (u.utxo?.btc_amount || 0),
        0
      ),
    }

    return {
      colorableUtxos: colorable,
      coloredUtxos: colored,
      normalUtxos: normal,
      summary,
    }
  }, [unspentsData])

  const [activeFilter, setActiveFilter] = useState<
    'all' | 'colorable' | 'colored' | 'normal'
  >('all')

  const getUtxoStatusLabel = (unspent: any) => {
    if (!unspent.utxo?.colorable) return t('utxoManagement.status.normal')
    if (unspent.rgb_allocations && unspent.rgb_allocations.length > 0)
      return t('utxoManagement.status.colored')
    return t('utxoManagement.status.colorable')
  }

  const getUtxoStatusStyle = (unspent: any) => {
    if (!unspent.utxo?.colorable) return 'bg-blue-500/20 text-blue-400'
    if (unspent.rgb_allocations && unspent.rgb_allocations.length > 0)
      return 'bg-purple-500/20 text-purple-400'
    return 'bg-green-500/20 text-green-400'
  }

  const UTXOCard = ({ unspent }: { unspent: any }) => (
    <div className="bg-surface-overlay/50 rounded-lg border border-border-default p-4">
      <div className="flex justify-between items-start mb-2">
        <div className="text-sm font-medium text-content-secondary">
          {unspent.utxo?.outpoint?.split(':')[0]}
        </div>
        <div
          className={`px-2 py-1 rounded-lg text-xs font-medium ${getUtxoStatusStyle(unspent)}`}
        >
          {getUtxoStatusLabel(unspent)}
        </div>
      </div>
      <div className="text-lg font-medium text-white">
        {formatBitcoinAmount(
          parseInt(unspent.utxo?.btc_amount || '0'),
          bitcoinUnit
        )}{' '}
        {bitcoinUnit}
      </div>
      {unspent.rgb_allocations && unspent.rgb_allocations.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border-default">
          <div className="text-sm text-content-secondary">
            {t('utxoManagement.card.rgbAllocations')}
          </div>
          {unspent.rgb_allocations.map((allocation: any, i: number) => (
            <div
              className="text-sm text-content-secondary flex justify-between"
              key={i}
            >
              <span className="truncate">{allocation.asset_id}</span>
              <span>{getAssignmentAmount(allocation.assignment)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const summaryCards = [
    {
      bullets: t('utxoManagement.summary.colorable.bullets', {
        returnObjects: true,
      }) as string[],
      count: summary.colorableCount,
      dotClass: 'bg-green-500',
      icon: <Zap className="w-5 h-5 text-green-500" />,
      key: 'colorable',
      title: t('utxoManagement.summary.colorable.title'),
      total: summary.totalColorable,
    },
    {
      bullets: t('utxoManagement.summary.colored.bullets', {
        returnObjects: true,
      }) as string[],
      count: summary.coloredCount,
      dotClass: 'bg-purple-500',
      icon: <Paintbrush className="w-5 h-5 text-purple-500" />,
      key: 'colored',
      title: t('utxoManagement.summary.colored.title'),
      total: summary.totalColored,
    },
    {
      bullets: t('utxoManagement.summary.normal.bullets', {
        returnObjects: true,
      }) as string[],
      count: summary.normalCount,
      dotClass: 'bg-blue-500',
      icon: <Wallet className="w-5 h-5 text-blue-500" />,
      key: 'normal',
      title: t('utxoManagement.summary.normal.title'),
      total: summary.totalNormal,
    },
  ]

  // ── Create step state ────────────────────────────────────────────────────
  const [feeEstimations, setFeeEstimations] = useState({
    fast: 3,
    normal: 2,
    slow: 1,
  })
  const [customFee, setCustomFee] = useState(1.0)
  const [isCreating, setIsCreating] = useState(false)

  const { handleSubmit, register, watch, setValue } = useForm<CreateFormFields>(
    {
      defaultValues: { fee_rate: 'normal', num: 4, size: 32500 },
    }
  )

  const feeRateOptions = [
    {
      icon: <Clock className="w-4 h-4" />,
      label: t('withdrawModal.form.fees.options.slow'),
      rate: feeEstimations.slow,
      value: 'slow',
    },
    {
      icon: <Zap className="w-4 h-4" />,
      label: t('withdrawModal.form.fees.options.normal'),
      rate: feeEstimations.normal,
      value: 'normal',
    },
    {
      icon: <Rocket className="w-4 h-4" />,
      label: t('withdrawModal.form.fees.options.fast'),
      rate: feeEstimations.fast,
      value: 'fast',
    },
    {
      icon: <Settings className="w-4 h-4" />,
      label: t('withdrawModal.form.fees.options.custom'),
      rate: customFee,
      value: 'custom',
    },
  ]

  const num = watch('num')
  const size = watch('size')
  const feeRate = watch('fee_rate')

  const [btcBalance, btcBalanceResponse] =
    nodeApi.endpoints.btcBalance.useLazyQuery()
  const [createutxos] = nodeApi.useCreateUtxosMutation()
  const [estimateFee] = nodeApi.useLazyEstimateFeeQuery()

  const refreshBalance = useCallback(() => {
    btcBalance()
  }, [btcBalance])

  useEffect(() => {
    if (step !== 'create') return
    const fetchFees = async () => {
      try {
        const [slowFee, normalFee, fastFee] = await Promise.all([
          estimateFee({ blocks: 6 }).unwrap(),
          estimateFee({ blocks: 3 }).unwrap(),
          estimateFee({ blocks: 1 }).unwrap(),
        ])
        setFeeEstimations({
          fast: Math.round(fastFee.fee_rate ?? 3),
          normal: Math.round(normalFee.fee_rate ?? 2),
          slow: Math.round(slowFee.fee_rate ?? 1),
        })
      } catch (e) {
        console.error(e)
      }
    }
    fetchFees()
    refreshBalance()
    const intervalId = setInterval(refreshBalance, 15_000)
    return () => clearInterval(intervalId)
  }, [step, estimateFee, refreshBalance])

  const onSubmitCreate = (data: CreateFormFields) => {
    setIsCreating(true)
    createutxos({
      fee_rate: Math.round(
        data.fee_rate === 'slow'
          ? feeEstimations.slow
          : data.fee_rate === 'normal'
            ? feeEstimations.normal
            : data.fee_rate === 'fast'
              ? feeEstimations.fast
              : customFee
      ),
      num: data.num,
      size: data.size,
      up_to: false,
    }).then((res: any) => {
      setIsCreating(false)
      if (res.error) {
        toast.error(res.error.data.error)
      } else {
        toast.success(t('createUtxos.toastSuccess'))
        listUnspents()
        setStep('list')
      }
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Modal isOpen onClose={onClose} size="lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-divider/10">
        <div className="flex items-center gap-3">
          {step === 'create' ? (
            <Paintbrush className="w-5 h-5 text-purple-400" />
          ) : (
            <Database className="w-5 h-5 text-primary" />
          )}
          <h3 className="text-xl font-semibold text-white">
            {step === 'list'
              ? t('utxoManagement.title')
              : t('createUtxos.title')}
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
      {step === 'list' ? (
        <div className="p-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {summaryCards.map((card) => (
              <div
                className="bg-surface-overlay/50 rounded-lg border border-border-default p-4 flex flex-col"
                key={card.key}
              >
                <div className="flex items-center gap-2 mb-2">
                  {card.icon}
                  <h3 className="text-base font-medium text-white">
                    {card.title}
                  </h3>
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  {card.bullets.map((bullet) => (
                    <div
                      className="flex items-center gap-2 text-sm text-content-secondary"
                      key={bullet}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${card.dotClass}`}
                      />
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-border-default/50">
                  <div className="text-xl font-bold text-white">
                    {formatBitcoinAmount(card.total, bitcoinUnit)} {bitcoinUnit}
                  </div>
                  <div className="text-sm text-content-secondary mt-0.5">
                    {t('utxoManagement.summary.countLabel', {
                      count: card.count,
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            className="w-full px-4 py-2.5 bg-primary hover:bg-primary-emphasis text-primary-foreground rounded-lg
                     text-sm font-medium transition-colors flex items-center justify-center gap-2"
            onClick={() => setStep('create')}
          >
            <Plus className="w-4 h-4" />
            {t('utxoManagement.actions.create')}
          </button>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : unspentsData?.unspents && unspentsData.unspents.length > 0 ? (
            <div>
              {/* Filter tabs */}
              <div className="flex gap-1 rounded-xl bg-surface-overlay/40 p-1 mb-4 w-fit">
                {(
                  [
                    {
                      count:
                        colorableUtxos.length +
                        coloredUtxos.length +
                        normalUtxos.length,
                      icon: null,
                      key: 'all',
                      label: t('utxoManagement.filter.all'),
                    },
                    {
                      count: colorableUtxos.length,
                      icon: <Zap className="h-3.5 w-3.5" />,
                      key: 'colorable',
                      label: t('utxoManagement.sections.colorable'),
                    },
                    {
                      count: coloredUtxos.length,
                      icon: <Paintbrush className="h-3.5 w-3.5" />,
                      key: 'colored',
                      label: t('utxoManagement.sections.colored'),
                    },
                    {
                      count: normalUtxos.length,
                      icon: <Wallet className="h-3.5 w-3.5" />,
                      key: 'normal',
                      label: t('utxoManagement.sections.normal'),
                    },
                  ] as const
                ).map(({ key, label, count, icon }) => (
                  <button
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:outline-none ${
                      activeFilter === key
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'text-content-secondary hover:text-white border border-transparent'
                    }`}
                    key={key}
                    onClick={() => setActiveFilter(key)}
                  >
                    {icon}
                    {label}
                    <span
                      className={`text-xs ${activeFilter === key ? 'text-primary' : 'text-white/60'}`}
                    >
                      ({count})
                    </span>
                  </button>
                ))}
              </div>

              {/* UTXO list */}
              <div className="space-y-3">
                {(activeFilter === 'all' || activeFilter === 'colorable') &&
                  colorableUtxos.map((u: any) => (
                    <UTXOCard key={u.utxo?.outpoint} unspent={u} />
                  ))}
                {(activeFilter === 'all' || activeFilter === 'colored') &&
                  coloredUtxos.map((u: any) => (
                    <UTXOCard key={u.utxo?.outpoint} unspent={u} />
                  ))}
                {(activeFilter === 'all' || activeFilter === 'normal') &&
                  normalUtxos.map((u: any) => (
                    <UTXOCard key={u.utxo?.outpoint} unspent={u} />
                  ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-content-secondary text-sm">
              {t('utxoManagement.empty')}
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 space-y-6">
          {/* Description */}
          <div className="flex items-start gap-3 rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-300">
              {t('createUtxos.description')}
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit(onSubmitCreate)}>
            {/* Number of UTXOs */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-content-secondary">
                {t('createUtxos.fields.numberOfUtxos')}
              </label>
              <input
                {...register('num', { valueAsNumber: true })}
                className="w-full bg-surface-overlay/50 text-white px-4 py-2.5 rounded-lg border border-border-default
                         focus:border-primary/50 focus:ring-1 focus:ring-primary/20 focus:outline-none text-sm"
                max={10}
                min={1}
                placeholder={t('createUtxos.fields.numberPlaceholder')}
                type="number"
              />
            </div>

            {/* UTXO Size */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-content-secondary">
                {t('createUtxos.fields.sizeLabel')}
              </label>
              <div className="flex items-center gap-4">
                <input
                  {...register('size', { valueAsNumber: true })}
                  className="flex-1 bg-surface-overlay/50 text-white px-4 py-2.5 rounded-lg border border-border-default
                           focus:border-primary/50 focus:ring-1 focus:ring-primary/20 focus:outline-none text-sm"
                  max={
                    btcBalanceResponse.data
                      ? Math.floor(
                          (btcBalanceResponse.data?.vanilla?.spendable ?? 0) /
                            num
                        )
                      : 0
                  }
                  min={0}
                  placeholder={t('createUtxos.fields.sizePlaceholder')}
                  type="number"
                />
                <span className="text-base font-semibold text-white min-w-[100px] text-right">
                  {size.toLocaleString()}
                </span>
              </div>
              <input
                className="w-full h-2 bg-surface-high rounded-lg appearance-none cursor-pointer mt-2"
                max={
                  btcBalanceResponse.data
                    ? Math.floor(
                        (btcBalanceResponse.data?.vanilla?.spendable ?? 0) / num
                      )
                    : 0
                }
                min={0}
                onChange={(e) => setValue('size', Number(e.target.value))}
                step="1000"
                type="range"
                value={size}
              />
            </div>

            {/* Available balance */}
            <p className="text-sm text-content-secondary">
              {t('createUtxos.fields.availableBalance', {
                defaultValue: 'Available Balance',
              })}
              :{' '}
              <span className="text-white font-semibold">
                {btcBalanceResponse.data
                  ? (
                      btcBalanceResponse.data?.vanilla?.spendable ?? 0
                    ).toLocaleString()
                  : '0'}{' '}
                sats
              </span>
            </p>

            {/* Fee Rate */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-content-secondary">
                {t('createUtxos.fields.feeRate')}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {feeRateOptions.map((fee) => (
                  <button
                    className={`py-1.5 px-2 flex flex-col items-center justify-center gap-0.5
                            rounded-lg transition-colors duration-200 border text-xs
                            ${
                              feeRate === fee.value
                                ? 'bg-primary/10 border-primary text-primary'
                                : 'border-border-default hover:border-primary/50 text-content-secondary'
                            }`}
                    key={fee.value}
                    onClick={() => setValue('fee_rate', fee.value)}
                    type="button"
                  >
                    {fee.icon}
                    <span className="text-[10px]">{fee.label}</span>
                    <span className="text-[9px]">{fee.rate} sat/vB</span>
                  </button>
                ))}
              </div>
              {feeRate === 'custom' && (
                <input
                  className="w-full bg-surface-overlay/50 text-white px-4 py-2.5 mt-2 rounded-lg border border-border-default
                           focus:border-primary/50 focus:ring-1 focus:ring-primary/20 focus:outline-none text-sm"
                  defaultValue={customFee}
                  onChange={(e) => setCustomFee(parseFloat(e.target.value))}
                  step={0.1}
                  type="number"
                />
              )}
            </div>

            {/* Footer actions */}
            <div className="flex justify-between items-center pt-2">
              <button
                className="px-3 py-2 text-content-secondary hover:text-white transition-colors flex items-center gap-1.5 hover:bg-surface-overlay/50 rounded-lg text-sm"
                onClick={() => setStep('list')}
                type="button"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t('common.back')}</span>
              </button>
              <button
                className="px-4 py-2 bg-primary hover:bg-primary-emphasis disabled:opacity-50 disabled:cursor-not-allowed
                         text-primary-foreground rounded-lg transition-colors flex items-center gap-1.5 text-sm font-semibold"
                disabled={isCreating}
                type="submit"
              >
                {isCreating ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {t('createUtxos.actions.create')}
              </button>
            </div>
          </form>
        </div>
      )}
    </Modal>
  )
}
