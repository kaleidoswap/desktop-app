import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  X,
  Zap,
  Package,
  Loader2,
  CheckCircle,
  AlertCircle,
  Info,
} from 'lucide-react'
import { toast } from 'react-toastify'

import { useAppDispatch } from '../../../../app/store/hooks'
import { BuyChannelModal } from '../../../../components/BuyChannelModal'
import {
  MIN_CHANNEL_CAPACITY,
  MAX_CHANNEL_CAPACITY,
} from '../../../../constants'
import { makerApi } from '../../../../slices/makerApi/makerApi.slice'
import { nodeApi } from '../../../../slices/nodeApi/nodeApi.slice'
import { uiSliceActions } from '../../../../slices/ui/ui.slice'

interface GetUsdtModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type OnChainState = 'idle' | 'loading' | 'success' | 'error'

function formatSats(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString('en-US')
}

export function GetUsdtModal({
  isOpen,
  onClose,
  onSuccess,
}: GetUsdtModalProps) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [showBuyModal, setShowBuyModal] = useState(false)

  // Option B state
  const [usdtAmount, setUsdtAmount] = useState('')
  const [capacitySat, setCapacitySat] = useState('')
  const [onChainState, setOnChainState] = useState<OnChainState>('idle')
  const [onChainError, setOnChainError] = useState<string | null>(null)

  // LSP limits fetched on open
  const [lspMinSat, setLspMinSat] = useState(MIN_CHANNEL_CAPACITY)
  const [lspMaxSat, setLspMaxSat] = useState(MAX_CHANNEL_CAPACITY)
  const [lspUrl, setLspUrl] = useState<string | null>(null)

  const [getInfo] = makerApi.endpoints.get_info.useLazyQuery()
  const [connectPeer] = nodeApi.endpoints.connectPeer.useMutation()
  const [openChannel] = nodeApi.endpoints.openChannel.useMutation()

  const { data: assetsData } = nodeApi.endpoints.listAssets.useQuery(
    undefined,
    {
      skip: !isOpen,
    }
  )
  const usdtAsset = (assetsData?.nia ?? []).find(
    (a: any) => a.ticker === 'USDT'
  )

  const { data: balanceData } = nodeApi.endpoints.assetBalance.useQuery(
    { asset_id: usdtAsset?.asset_id ?? '' },
    { skip: !isOpen || !usdtAsset?.asset_id }
  )

  const precision = usdtAsset?.precision ?? 6
  const spendableRaw = balanceData?.spendable ?? 0
  const spendableUsdt = spendableRaw / Math.pow(10, precision)
  const hasOnChain = spendableRaw > 0

  // Fetch LSP info on open to get capacity constraints
  useEffect(() => {
    if (!isOpen) return
    setUsdtAmount('')
    setOnChainState('idle')
    setOnChainError(null)
    setShowBuyModal(false)

    getInfo().then((res) => {
      if (res.data) {
        const opts = res.data.options
        const min = opts?.min_channel_balance_sat ?? MIN_CHANNEL_CAPACITY
        const max = opts?.max_channel_balance_sat ?? MAX_CHANNEL_CAPACITY
        const effectiveMin = Math.max(min, MIN_CHANNEL_CAPACITY)
        const effectiveMax = Math.min(max, MAX_CHANNEL_CAPACITY)
        setLspMinSat(effectiveMin)
        setLspMaxSat(effectiveMax)
        setCapacitySat(String(effectiveMin))
        if (res.data.lsp_connection_url) {
          setLspUrl(res.data.lsp_connection_url)
        }
      } else {
        setCapacitySat(String(MIN_CHANNEL_CAPACITY))
      }
    })
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleOpenChannel() {
    if (!usdtAsset?.asset_id) return
    const amountUsdt = parseFloat(usdtAmount)
    if (isNaN(amountUsdt) || amountUsdt <= 0 || amountUsdt > spendableUsdt)
      return
    const satNum = parseInt(capacitySat, 10)
    if (isNaN(satNum) || satNum < lspMinSat || satNum > lspMaxSat) return

    setOnChainState('loading')
    setOnChainError(null)

    try {
      let connectionUrl = lspUrl
      if (!connectionUrl) {
        const infoResult = await getInfo()
        if (infoResult.error || !infoResult.data?.lsp_connection_url) {
          throw new Error(
            t('dca.getUsdt.errorLspInfo', 'Failed to get LSP info')
          )
        }
        connectionUrl = infoResult.data.lsp_connection_url
      }

      // Connect peer (ignore if already connected)
      await connectPeer({ peer_pubkey_and_addr: connectionUrl })
        .unwrap()
        .catch(() => {})

      const assetAmount = Math.round(amountUsdt * Math.pow(10, precision))
      await openChannel({
        asset_amount: assetAmount,
        asset_id: usdtAsset.asset_id,
        capacity_sat: satNum,
        peer_pubkey_and_opt_addr: connectionUrl,
      }).unwrap()

      setOnChainState('success')
      toast.success(
        t('dca.getUsdt.channelOpened', 'USDT channel opening initiated')
      )
      setTimeout(() => onSuccess(), 1500)
    } catch (err: any) {
      const msg = err?.data?.error ?? err?.message ?? String(err)
      setOnChainError(msg)
      setOnChainState('error')
    }
  }

  if (!isOpen) return null

  if (showBuyModal) {
    return (
      <BuyChannelModal
        defaultTotalAssetAmount="250"
        isOpen={true}
        onClose={() => setShowBuyModal(false)}
        onSuccess={() => {
          setShowBuyModal(false)
          onSuccess()
        }}
        preselectedAsset={
          usdtAsset?.asset_id
            ? { amount: 100, assetId: usdtAsset.asset_id }
            : undefined
        }
      />
    )
  }

  const usdtNum = parseFloat(usdtAmount)
  const satNum = parseInt(capacitySat, 10)
  const isUsdtValid = !isNaN(usdtNum) && usdtNum > 0 && usdtNum <= spendableUsdt
  const isSatValid =
    !isNaN(satNum) && satNum >= lspMinSat && satNum <= lspMaxSat
  const canSubmit =
    isUsdtValid &&
    isSatValid &&
    onChainState !== 'loading' &&
    onChainState !== 'success'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-base/70 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl bg-surface-base border border-border-subtle rounded-2xl shadow-2xl shadow-black/30 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-border-subtle/50">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {t('dca.getUsdt.title', 'Get USDT on Lightning')}
            </h2>
          </div>
          <button
            className="p-1.5 rounded-lg text-content-secondary hover:text-content-primary hover:bg-surface-overlay transition-colors mt-1"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <div className="grid grid-cols-2 gap-3">
            {/* Option A: Buy via LSP */}
            <div className="bg-surface-overlay/80 border border-border-default/50 rounded-xl p-6 flex flex-col gap-4">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10 text-primary">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-base font-semibold text-content-primary">
                    {t('dca.getUsdt.buyTitle', 'Buy via Kaleido LSP')}
                  </p>
                  <p className="text-sm text-content-secondary mt-3 leading-relaxed">
                    {t(
                      'dca.getUsdt.buyDesc',
                      'Pay BTC and receive inbound USDT Lightning liquidity. Choose the channel capacity to set your max BTC receive limit.'
                    )}
                  </p>
                </div>
              </div>
              <button
                className="mt-auto w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#15E99A] hover:bg-[#12C97E] px-4 text-sm font-semibold text-gray-900 transition-colors"
                onClick={() => setShowBuyModal(true)}
              >
                {t('dca.getUsdt.buyButton', 'Buy USDT Channel')}
              </button>
            </div>

            {/* Option B: Open with on-chain USDT */}
            <div className="bg-surface-overlay/80 border border-border-default/50 rounded-xl p-6 flex flex-col gap-4">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10 text-primary">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-base font-semibold text-content-primary">
                    {t('dca.getUsdt.onChainTitle', 'Open with On-Chain USDT')}
                  </p>
                  <p className="text-sm text-content-secondary mt-3">
                    {hasOnChain
                      ? t(
                          'dca.getUsdt.onChainBalance',
                          'On-chain balance: {{amount}} USDT',
                          {
                            amount: spendableUsdt.toLocaleString('en-US', {
                              maximumFractionDigits: 2,
                            }),
                          }
                        )
                      : t(
                          'dca.getUsdt.noOnChain',
                          'No on-chain USDT available.'
                        )}
                  </p>
                </div>
              </div>

              {!hasOnChain && (
                <button
                  className="mt-auto w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-transparent border border-white/30 hover:border-white/50 hover:bg-white/5 px-4 text-sm font-semibold text-white transition-colors"
                  onClick={() => {
                    onClose()
                    if (usdtAsset?.asset_id) {
                      dispatch(
                        uiSliceActions.setModal({
                          assetId: usdtAsset.asset_id,
                          type: 'deposit',
                        })
                      )
                    }
                  }}
                >
                  {t('dca.getUsdt.depositAction', 'Deposit USDT')}
                </button>
              )}

              {hasOnChain && (
                <>
                  {/* USDT amount row */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-content-secondary uppercase tracking-wider">
                      {t('dca.getUsdt.usdtAmountLabel', 'USDT amount')}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        className="flex-1 bg-surface-overlay border border-white/10 rounded-xl px-3 py-2
                                 text-sm text-white placeholder:text-white/30
                                 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20
                                 disabled:opacity-50"
                        disabled={
                          onChainState === 'loading' ||
                          onChainState === 'success'
                        }
                        max={spendableUsdt}
                        min="0"
                        onChange={(e) => setUsdtAmount(e.target.value)}
                        placeholder="0.00"
                        step="any"
                        type="number"
                        value={usdtAmount}
                      />
                      <span className="text-xs text-content-secondary font-medium flex-shrink-0">
                        USDT
                      </span>
                      <button
                        className="px-2.5 py-2 rounded-xl bg-transparent border border-white/30 hover:border-white/50 hover:bg-white/5
                                 text-xs text-white font-semibold transition-colors flex-shrink-0 disabled:opacity-50"
                        disabled={
                          onChainState === 'loading' ||
                          onChainState === 'success'
                        }
                        onClick={() =>
                          setUsdtAmount(
                            spendableUsdt.toFixed(6).replace(/\.?0+$/, '') ||
                              '0'
                          )
                        }
                      >
                        {t('dca.getUsdt.useAll', 'Use all')}
                      </button>
                    </div>
                  </div>

                  {/* Capacity row */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] font-semibold text-content-secondary uppercase tracking-wider">
                        {t('dca.getUsdt.capacityLabel', 'Channel capacity')}
                      </label>
                      <span className="group relative">
                        <Info className="w-3 h-3 text-content-secondary cursor-help" />
                        <span
                          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 p-2
                                       bg-surface-elevated border border-white/15 rounded-lg text-[11px]
                                       text-content-secondary leading-relaxed shadow-lg z-10
                                       invisible group-hover:visible whitespace-normal"
                        >
                          {t(
                            'dca.getUsdt.capacityHint',
                            'BTC capacity of the channel. Also sets the max BTC you can receive per DCA execution.'
                          )}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        className="flex-1 bg-surface-overlay border border-white/10 rounded-xl px-3 py-2
                                 text-sm text-white placeholder:text-white/30
                                 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20
                                 disabled:opacity-50"
                        disabled={
                          onChainState === 'loading' ||
                          onChainState === 'success'
                        }
                        max={lspMaxSat}
                        min={lspMinSat}
                        onChange={(e) => setCapacitySat(e.target.value)}
                        step="1000"
                        type="number"
                        value={capacitySat}
                      />
                      <span className="text-xs text-content-secondary font-medium flex-shrink-0">
                        sats
                      </span>
                    </div>
                    <p className="text-[11px] text-content-secondary">
                      {t(
                        'dca.getUsdt.capacityRange',
                        'Min {{min}} – max {{max}} sats',
                        {
                          max: formatSats(lspMaxSat),
                          min: formatSats(lspMinSat),
                        }
                      )}
                      {satNum > 0 && isSatValid && (
                        <span className="ml-2">
                          {'· '}
                          {t(
                            'dca.getUsdt.maxReceive',
                            'max receive ≈ {{sats}} sats BTC',
                            { sats: formatSats(satNum) }
                          )}
                        </span>
                      )}
                    </p>
                  </div>

                  {onChainState === 'error' && onChainError && (
                    <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span className="break-all">{onChainError}</span>
                    </div>
                  )}

                  {onChainState === 'success' && (
                    <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-xl text-xs text-primary">
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {t(
                        'dca.getUsdt.channelOpened',
                        'USDT channel opening initiated'
                      )}
                    </div>
                  )}

                  <button
                    className="mt-auto w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#15E99A] hover:bg-[#12C97E] px-4 text-sm font-semibold text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!canSubmit}
                    onClick={handleOpenChannel}
                  >
                    {onChainState === 'loading' && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    {t('dca.getUsdt.openButton', 'Open USDT Channel')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
