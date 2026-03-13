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
        peer_pubkey_and_opt_addr: connectionUrl,
        capacity_sat: satNum,
        asset_id: usdtAsset.asset_id,
        asset_amount: assetAmount,
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
        isOpen={true}
        onClose={() => setShowBuyModal(false)}
        onSuccess={() => {
          setShowBuyModal(false)
          onSuccess()
        }}
        defaultTotalAssetAmount="250"
        preselectedAsset={
          usdtAsset?.asset_id
            ? { assetId: usdtAsset.asset_id, amount: 100 }
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
      <div className="w-full max-w-md bg-surface-base border border-border-subtle rounded-2xl shadow-2xl shadow-black/30 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-status-success/10 text-status-success">
              <Zap className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-content-primary">
              {t('dca.getUsdt.title', 'Get USDT on Lightning')}
            </h2>
          </div>
          <button
            className="p-1.5 rounded-lg text-content-secondary hover:text-content-primary hover:bg-surface-overlay transition-colors"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Option A: Buy via LSP */}
          <div className="border border-border-subtle rounded-xl p-4 space-y-3 bg-surface-raised">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0 mt-0.5">
                <Zap className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-content-primary">
                  {t('dca.getUsdt.buyTitle', 'Buy via Kaleido LSP')}
                </p>
                <p className="text-xs text-content-secondary mt-0.5 leading-relaxed">
                  {t(
                    'dca.getUsdt.buyDesc',
                    'Pay BTC and receive inbound USDT Lightning liquidity. Choose the channel capacity to set your max BTC receive limit.'
                  )}
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                className="px-3 py-1.5 rounded-lg bg-primary/15 text-primary border border-primary/30
                           hover:bg-primary/25 font-medium text-xs transition-all active:scale-[0.97]"
                onClick={() => setShowBuyModal(true)}
              >
                {t('dca.getUsdt.buyButton', 'Buy USDT Channel')}
              </button>
            </div>
          </div>

          {/* Option B: Open with on-chain USDT */}
          <div
            className={`border rounded-xl p-4 space-y-3 bg-surface-raised ${
              hasOnChain ? 'border-border-subtle' : 'border-border-subtle/50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-lg flex-shrink-0 mt-0.5 ${
                  hasOnChain
                    ? 'bg-status-success/10 text-status-success'
                    : 'bg-surface-overlay text-content-secondary'
                }`}
              >
                <Package className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-content-primary">
                  {t('dca.getUsdt.onChainTitle', 'Open with On-Chain USDT')}
                </p>
                <div className="text-xs mt-1.5">
                  {hasOnChain ? (
                    <span className="text-content-secondary">
                      {t(
                        'dca.getUsdt.onChainBalance',
                        'On-chain balance: {{amount}} USDT',
                        {
                          amount: spendableUsdt.toLocaleString('en-US', {
                            maximumFractionDigits: 2,
                          }),
                        }
                      )}
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-content-secondary">
                        {t(
                          'dca.getUsdt.noOnChain',
                          'No on-chain USDT available'
                        )}
                      </span>
                      <button
                        className="text-primary hover:text-primary-emphasis hover:underline font-semibold"
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
                    </div>
                  )}
                </div>
              </div>
            </div>

            {hasOnChain && (
              <>
                {/* USDT amount row */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-content-secondary uppercase tracking-wide">
                    {t('dca.getUsdt.usdtAmountLabel', 'USDT amount')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max={spendableUsdt}
                      value={usdtAmount}
                      onChange={(e) => setUsdtAmount(e.target.value)}
                      placeholder="0.00"
                      disabled={
                        onChainState === 'loading' || onChainState === 'success'
                      }
                      className="flex-1 bg-surface-overlay border border-border-subtle rounded-lg px-3 py-1.5
                                 text-sm text-content-primary placeholder:text-content-secondary/60
                                 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20
                                 disabled:opacity-50"
                    />
                    <span className="text-xs text-content-secondary font-medium flex-shrink-0">
                      USDT
                    </span>
                    <button
                      className="px-2 py-1.5 rounded-lg border border-border-subtle bg-surface-overlay
                                 text-xs text-content-secondary hover:text-content-primary hover:border-border-default
                                 transition-colors flex-shrink-0 disabled:opacity-50"
                      onClick={() =>
                        setUsdtAmount(
                          spendableUsdt.toFixed(6).replace(/\.?0+$/, '') || '0'
                        )
                      }
                      disabled={
                        onChainState === 'loading' || onChainState === 'success'
                      }
                    >
                      {t('dca.getUsdt.useAll', 'Use all')}
                    </button>
                  </div>
                </div>

                {/* Capacity row */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] font-medium text-content-secondary uppercase tracking-wide">
                      {t('dca.getUsdt.capacityLabel', 'Channel capacity')}
                    </label>
                    <span className="group relative">
                      <Info className="w-3 h-3 text-content-secondary cursor-help" />
                      <span
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 p-2
                                       bg-surface-elevated border border-border-subtle rounded-lg text-[11px]
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
                      type="number"
                      step="1000"
                      min={lspMinSat}
                      max={lspMaxSat}
                      value={capacitySat}
                      onChange={(e) => setCapacitySat(e.target.value)}
                      disabled={
                        onChainState === 'loading' || onChainState === 'success'
                      }
                      className="flex-1 bg-surface-overlay border border-border-subtle rounded-lg px-3 py-1.5
                                 text-sm text-content-primary placeholder:text-content-secondary/60
                                 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20
                                 disabled:opacity-50"
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
                        min: formatSats(lspMinSat),
                        max: formatSats(lspMaxSat),
                      }
                    )}
                    {satNum > 0 && isSatValid && (
                      <span className="ml-2 text-content-secondary">
                        {'· '}
                        {t(
                          'dca.getUsdt.maxReceive',
                          'max receive ≈ {{sats}} sats BTC',
                          {
                            sats: formatSats(satNum),
                          }
                        )}
                      </span>
                    )}
                  </p>
                </div>

                {onChainState === 'error' && onChainError && (
                  <div className="flex items-start gap-2 p-2.5 bg-status-danger/10 border border-status-danger/20 rounded-lg text-xs text-status-danger">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span className="break-all">{onChainError}</span>
                  </div>
                )}

                {onChainState === 'success' && (
                  <div className="flex items-center gap-2 p-2.5 bg-status-success/10 border border-status-success/20 rounded-lg text-xs text-status-success">
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {t(
                      'dca.getUsdt.channelOpened',
                      'USDT channel opening initiated'
                    )}
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    className="px-3 py-1.5 rounded-lg bg-status-success/15 text-status-success border border-status-success/30
                               hover:bg-status-success/25 font-medium text-xs transition-all active:scale-[0.97]
                               disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                    onClick={handleOpenChannel}
                    disabled={!canSubmit}
                  >
                    {onChainState === 'loading' && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    {t('dca.getUsdt.openButton', 'Open USDT Channel')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
