import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  CalendarClock,
  RefreshCw,
  BarChart2,
  Info,
  X,
  TrendingUp,
  ShoppingCart,
} from 'lucide-react'
import { createPortal } from 'react-dom'

import { ORDER_CHANNEL_PATH } from '../../../app/router/paths'
import {
  getModalPortalTarget,
  getModalPositionClass,
} from '../../../helpers/modalPortal'

import { DcaBagIcon } from '../../../components/icons/DcaBagIcon'
import { IconButton } from '../../../components/ui'
import { TradeNav } from '../../../components/Trade'

import { useAppSelector } from '../../../app/store/hooks'
import bitcoinLogo from '../../../assets/bitcoin-logo.svg'
import tetherLogo from '../../../assets/tether-logo.svg'
import { useBitcoinPrice } from '../../../hooks/useBitcoinPrice'
import { nodeApi } from '../../../slices/nodeApi/nodeApi.slice'
import { BuyChannelModal } from '../../../components/BuyChannelModal'
import { DcaOrderCard } from './components/DcaOrderCard'
import { CreateDcaForm } from './components/CreateDcaForm'
import { GetUsdtModal } from './components/GetUsdtModal'
import { HowItWorksModal } from './components/HowItWorksModal'
import { AnalyticsModal } from './components/AnalyticsModal'

type Tab = 'active' | 'history'

function formatSats(sats: number): string {
  if (sats >= 1_000_000) return `${(sats / 1_000_000).toFixed(2)}M`
  if (sats >= 1_000) return `${(sats / 1_000).toFixed(1)}k`
  return sats.toLocaleString('en-US')
}

function formatUsdt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function formatPrice(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function AssetIcon({
  alt,
  className,
  src,
}: {
  alt: string
  className?: string
  src: string
}) {
  return <img alt={alt} className={className} src={src} />
}

// ── Modal wrapper ──────────────────────────────────────────────────────────
function CreateOrderModal({
  currentBtcPrice,
  onClose,
}: {
  currentBtcPrice?: number
  onClose: () => void
}) {
  const { t } = useTranslation()
  const pos = getModalPositionClass()
  return createPortal(
    <div
      className={`${pos} inset-0 z-50 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 pointer-events-none">
        <div className="bg-surface-base p-6 sm:p-8 rounded-3xl border border-border-subtle/50 max-w-xl w-full shadow-2xl max-h-[calc(100vh-2rem)] overflow-y-auto pointer-events-auto">
          <div className="flex items-center justify-between pb-4 border-b border-divider/10 mb-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-primary flex-shrink-0" />
              <h3 className="text-xl font-bold text-white">
                {t('dca.createOrder', 'New DCA Order')}
              </h3>
            </div>
            <button
              className="p-1.5 rounded-md text-content-secondary hover:text-white hover:bg-surface-overlay/50 transition-colors"
              onClick={onClose}
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <CreateDcaForm
            currentBtcPrice={currentBtcPrice}
            onCreated={onClose}
          />
        </div>
      </div>
    </div>,
    getModalPortalTarget()
  )
}

export const Component = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('active')
  const [showModal, setShowModal] = useState(false)
  const [showGetUsdt, setShowGetUsdt] = useState(false)
  const [showGetBtc, setShowGetBtc] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)

  // Custom open props for buy modal
  const [buyModalProps, setBuyModalProps] = useState<{
    defaultCapacitySat?: string
    defaultClientBalanceSat?: string
    preselectedAsset?: { assetId: string; amount: number }
    defaultTotalAssetAmount?: string
  }>({})

  const orders = useAppSelector((s) => s.dca.orders)
  const { btcPrice: currentBtcPrice } = useBitcoinPrice()

  const {
    data: channelsData,
    isFetching: isChannelsFetching,
    refetch: refetchChannels,
  } = nodeApi.endpoints.listChannels.useQuery(undefined, {
    pollingInterval: 30_000,
  })

  const {
    data: assetsData,
    isFetching: isAssetsFetching,
    refetch: refetchAssets,
  } = nodeApi.endpoints.listAssets.useQuery(undefined, {
    pollingInterval: 60_000,
  })

  // ── Order stats ────────────────────────────────────────────────────────
  const activeOrders = orders.filter(
    (o) => o.status === 'active' || o.status === 'paused'
  )
  const doneOrders = orders.filter(
    (o) => o.status === 'completed' || o.status === 'cancelled'
  )
  const displayedOrders = tab === 'active' ? activeOrders : doneOrders

  const allSuccess = orders.flatMap((o) =>
    o.executions.filter((e) => e.status === 'success')
  )
  const totalBuys = allSuccess.length
  const totalSats = allSuccess.reduce((s, e) => s + e.toAmountSats, 0)
  const avgPrice =
    totalBuys > 0
      ? allSuccess.reduce((s, e) => s + e.priceBtcUsdt, 0) / totalBuys
      : undefined

  const thirtyDaysAgo = Date.now() - 30 * 24 * 3600 * 1000
  const monthlyBuys = allSuccess.filter(
    (e) => e.timestamp >= thirtyDaysAgo
  ).length
  const totalFeeSats = allSuccess.reduce((s, e) => s + (e.feeSats ?? 0), 0)
  const avgPriceDeltaPct =
    avgPrice != null && currentBtcPrice != null && avgPrice > 0
      ? ((currentBtcPrice - avgPrice) / avgPrice) * 100
      : undefined

  const activeScheduled = activeOrders.filter(
    (o) => o.type === 'scheduled'
  ).length
  const activePriceTarget = activeOrders.filter(
    (o) => o.type === 'price-target'
  ).length

  // ── Balances ───────────────────────────────────────────────────────────
  const allChannels = channelsData?.channels ?? []
  const readyChannels = allChannels.filter((ch: any) => ch.ready)

  const usdtAsset = (assetsData?.nia ?? []).find(
    (a: any) => a.ticker === 'USDT'
  )
  const usdtPrecision = usdtAsset?.precision ?? 6
  const usdtChannels = usdtAsset
    ? readyChannels.filter((ch: any) => ch.asset_id === usdtAsset.asset_id)
    : []
  const pendingUsdtChannels = usdtAsset
    ? allChannels.filter(
        (ch: any) => ch.asset_id === usdtAsset.asset_id && !ch.ready
      )
    : []

  // Derive the LSP peer pubkey from USDT channels (they always connect to the LSP)
  const lspPubkey: string | undefined = usdtChannels[0]?.peer_pubkey

  // BTC balance counts ALL ready channels to the same LSP peer
  // (both pure BTC channels and RGB/asset channels share BTC capacity with the LSP)
  const lspChannels = lspPubkey
    ? readyChannels.filter((ch: any) => ch.peer_pubkey === lspPubkey)
    : readyChannels
  const btcLnOut = lspChannels.reduce(
    (s: number, ch: any) => s + (ch.local_balance_sat ?? 0),
    0
  )
  const btcLnIn = lspChannels.reduce(
    (s: number, ch: any) =>
      s + Math.round((ch.inbound_balance_msat ?? 0) / 1000),
    0
  )
  const totalBtcSats = btcLnOut + btcLnIn

  const usdtLnOut = usdtChannels.reduce(
    (s: number, ch: any) =>
      s + (ch.asset_local_amount ?? 0) / Math.pow(10, usdtPrecision),
    0
  )
  const usdtLnIn = usdtChannels.reduce(
    (s: number, ch: any) =>
      s + (ch.asset_remote_amount ?? 0) / Math.pow(10, usdtPrecision),
    0
  )
  const btcChannelUsdValue =
    currentBtcPrice != null
      ? (totalBtcSats / 100_000_000) * currentBtcPrice
      : undefined

  const hasRgbChannels = readyChannels.some((ch: any) => ch.asset_id)

  const isRefreshing = isChannelsFetching || isAssetsFetching
  const handleRefresh = () =>
    void Promise.all([refetchChannels(), refetchAssets()])

  return (
    <>
      <div className="mx-auto w-full max-w-screen-xl px-4 pt-2">
        <TradeNav />
      </div>

      {/* ── Create order modal ──────────────────────────────────────────── */}
      {showModal && (
        <CreateOrderModal
          currentBtcPrice={currentBtcPrice}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* ── Get USDT modal ──────────────────────────────────────────────── */}
      <GetUsdtModal
        isOpen={showGetUsdt}
        onClose={() => setShowGetUsdt(false)}
        onSuccess={() => {
          setShowGetUsdt(false)
          void Promise.all([refetchChannels(), refetchAssets()])
        }}
      />

      {/* ── Get BTC liquidity modal ─────────────────────────────────────── */}
      <BuyChannelModal
        isOpen={showGetBtc}
        onClose={() => setShowGetBtc(false)}
        onSuccess={() => {
          setShowGetBtc(false)
          void refetchChannels()
        }}
        {...buyModalProps}
      />

      {/* ── How it works modal ────────────────────────────────────────── */}
      <HowItWorksModal isOpen={infoOpen} onClose={() => setInfoOpen(false)} />

      {/* ── Analytics modal ───────────────────────────────────────────── */}
      <AnalyticsModal
        activeOrdersCount={activeOrders.length}
        activePriceTarget={activePriceTarget}
        activeScheduled={activeScheduled}
        currentBtcPrice={currentBtcPrice}
        formatPrice={formatPrice}
        formatSats={formatSats}
        isOpen={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        totalBuys={totalBuys}
        totalFeeSats={totalFeeSats}
        totalSats={totalSats}
      />

      <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6 px-4 py-6">
        <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
          <section className="h-full overflow-hidden rounded-2xl border border-border-default/60 bg-surface-overlay shadow-xl p-5">
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-xs">
                  <h1 className="text-xl font-bold text-white">
                    {t('dca.title', 'DCA Orders')}
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-content-secondary">
                    Build recurring BTC buys from your USDT Lightning balance.
                    Keep enough USDT to send and enough BTC room to receive each
                    execution.
                  </p>
                </div>

                <button
                  className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-primary hover:bg-primary-emphasis px-4 text-sm font-semibold text-[#12131C] transition-colors"
                  onClick={() => setShowModal(true)}
                  title={t('dca.createOrder', 'New DCA Order')}
                >
                  <Plus className="h-5 w-5" />
                  <span className="hidden sm:inline">
                    {t('dca.createOrder', 'New DCA Order')}
                  </span>
                </button>
              </div>

              <div className="flex-1 flex items-center py-4">
                <div className="w-full grid gap-3 sm:grid-cols-2 items-stretch">
                  <div className="flex flex-col justify-between min-h-[90px] rounded-2xl border border-border-default/50 bg-surface-elevated/40 p-4">
                    <p className="text-xs text-white/60">
                      {t('dca.metrics.currentBtcPrice', 'Current BTC price')}
                    </p>
                    <p className="text-xl font-bold text-content-primary">
                      {currentBtcPrice != null
                        ? formatPrice(currentBtcPrice)
                        : '—'}
                    </p>
                  </div>
                  <div className="flex flex-col justify-between min-h-[90px] rounded-2xl border border-border-default/50 bg-surface-elevated/40 p-4">
                    <p className="text-xs text-white/60">
                      Average BTC price vs current
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-bold text-content-primary">
                        {avgPrice != null ? formatPrice(avgPrice) : '—'}
                      </p>
                      {avgPriceDeltaPct != null && (
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            avgPriceDeltaPct >= 0
                              ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                              : 'border-rose-400/25 bg-rose-400/10 text-rose-300'
                          }`}
                        >
                          {avgPriceDeltaPct >= 0 ? '+' : ''}
                          {avgPriceDeltaPct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col justify-between min-h-[90px] rounded-2xl border border-border-default/50 bg-surface-elevated/40 p-4">
                    <p className="text-xs text-white/60">
                      {t('dca.metrics.activeSchedules', 'Active schedules')}
                    </p>
                    <p className="text-xl font-bold text-content-primary">
                      {activeOrders.length}
                    </p>
                  </div>
                  <div className="flex flex-col justify-between min-h-[90px] rounded-2xl border border-border-default/50 bg-surface-elevated/40 p-4">
                    <p className="text-xs text-white/60">Successful buys</p>
                    <p className="text-xl font-bold text-content-primary">
                      {monthlyBuys}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/30 hover:border-white/50 bg-transparent hover:bg-white/5 px-2.5 text-xs font-semibold text-white transition-colors"
                  onClick={() => setInfoOpen((v) => !v)}
                  title={t('dca.howItWorks.title', 'How DCA works')}
                >
                  <Info className="h-3.5 w-3.5" />
                  {t('dca.howItWorks.title', 'How DCA works')}
                </button>
                <p className="text-xs text-content-tertiary">
                  {t(
                    'dca.heroHint',
                    'Recurring buys stay active until you pause or cancel them.'
                  )}
                </p>
              </div>
            </div>
          </section>

          <section className="h-full rounded-2xl border border-border-default/60 bg-surface-overlay shadow-xl p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-content-primary">
                {t('dca.section.balances', 'Channel Balances')}
              </h2>
              <IconButton
                aria-label={t('dca.refreshAmounts', 'Refresh')}
                disabled={isRefreshing}
                icon={
                  <RefreshCw
                    className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                  />
                }
                onClick={handleRefresh}
                variant="outline"
              />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {[
                {
                  label: 'USDT spendable',
                  value: `${formatUsdt(usdtLnOut)} USDT`,
                },
                {
                  label: t(
                    'dca.section.readyUsdtChannels',
                    'Ready USDT channels'
                  ),
                  value: String(usdtChannels.length),
                },
                {
                  label: t(
                    'dca.section.pendingUsdtChannels',
                    'Pending USDT channels'
                  ),
                  value: String(pendingUsdtChannels.length),
                },
              ].map(({ label, value }) => (
                <div
                  className="rounded-2xl border border-border-default/50 bg-surface-base/35 px-3.5 py-3 flex flex-col justify-between"
                  key={label}
                >
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/60 leading-snug">
                    {label}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-content-primary">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-5">
              {!hasRgbChannels ? (
                /* ── No RGB channels: prompt to buy ── */
                <div className="flex flex-col items-center gap-3 rounded-xl border border-border-subtle/50 bg-surface-elevated/30 py-6 px-4 text-center">
                  <p className="text-sm text-content-secondary">
                    {t(
                      'dca.noRgbChannels.description',
                      'You need a USDT Lightning channel to run DCA orders.'
                    )}
                  </p>
                  <button
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-[#12131C] transition-colors hover:bg-primary-emphasis"
                    onClick={() => navigate(ORDER_CHANNEL_PATH)}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {t('dca.noRgbChannels.cta', 'Buy USDT in Channel')}
                  </button>
                </div>
              ) : (
                /* ── Has RGB channels: show balances + add-liquidity buttons ── */
                <>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AssetIcon
                          alt="BTC"
                          className="h-4 w-4 rounded-full"
                          src={bitcoinLogo}
                        />
                        <span className="text-sm font-semibold text-content-primary">
                          BTC LN
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-content-primary">
                        {formatSats(totalBtcSats)} sats
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-amber-400/20 flex">
                      {totalBtcSats > 0 ? (
                        <>
                          <div
                            className="h-full bg-amber-400"
                            style={{
                              width: `${(btcLnOut / totalBtcSats) * 100}%`,
                            }}
                          />
                          <div
                            className="h-full bg-amber-400/40"
                            style={{
                              width: `${(btcLnIn / totalBtcSats) * 100}%`,
                            }}
                          />
                        </>
                      ) : (
                        <div className="h-full w-full bg-surface-overlay/20" />
                      )}
                    </div>
                    <div className="flex justify-between text-[11px] text-content-secondary">
                      <span title="Outbound (Spendable)">
                        Out: {formatSats(btcLnOut)}
                      </span>
                      <span title="Inbound (Receivable)">
                        In: {formatSats(btcLnIn)}
                      </span>
                    </div>
                    <button
                      className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-white/30 hover:border-white/50 bg-transparent hover:bg-white/5 px-2.5 text-xs font-semibold text-white transition-colors"
                      onClick={() => {
                        setBuyModalProps({
                          defaultCapacitySat: '500000',
                          defaultClientBalanceSat: '20000',
                        })
                        setShowGetBtc(true)
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      {t('dca.receiveBtcLn', 'Receive BTC/LN')}
                    </button>
                  </div>

                  <div className="space-y-2.5 border-t border-border-subtle/50 pt-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AssetIcon
                          alt="USDT"
                          className="h-4 w-4 rounded-full"
                          src={tetherLogo}
                        />
                        <span className="text-sm font-semibold text-content-primary">
                          USDT LN
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-content-primary">
                        {formatUsdt(usdtLnOut + usdtLnIn)} USDT
                      </span>
                    </div>
                    <div
                      className="h-2 w-full overflow-hidden rounded-full flex"
                      style={{ background: 'rgba(38,161,123,0.2)' }}
                    >
                      {usdtLnOut + usdtLnIn > 0 ? (
                        <>
                          <div
                            className="h-full"
                            style={{
                              background: '#26A17B',
                              width: `${(usdtLnOut / (usdtLnOut + usdtLnIn)) * 100}%`,
                            }}
                          />
                          <div
                            className="h-full"
                            style={{
                              background: 'rgba(38,161,123,0.4)',
                              width: `${(usdtLnIn / (usdtLnOut + usdtLnIn)) * 100}%`,
                            }}
                          />
                        </>
                      ) : (
                        <div className="h-full w-full bg-surface-overlay/20" />
                      )}
                    </div>
                    <div className="flex justify-between text-[11px] text-content-secondary">
                      <span title="Outbound (Spendable)">
                        Out: {formatUsdt(usdtLnOut)}
                      </span>
                      <span title="Inbound (Receivable)">
                        In: {formatUsdt(usdtLnIn)}
                      </span>
                    </div>
                    {pendingUsdtChannels.length > 0 && (
                      <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-amber-200">
                            {t(
                              'dca.section.pendingUsdtTitle',
                              'New USDT channel pending'
                            )}
                          </span>
                          <span className="rounded-full border border-amber-400/30 bg-amber-400/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                            {pendingUsdtChannels.length}{' '}
                            {t('dca.section.pendingBadge', 'pending')}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-amber-100/80">
                          {t(
                            'dca.section.pendingUsdtDescription',
                            'Your new USDT Lightning channel is on the way and will appear in the spendable balance once confirmed.'
                          )}
                        </p>
                      </div>
                    )}
                    <button
                      className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-white/30 hover:border-white/50 bg-transparent hover:bg-white/5 px-2.5 text-xs font-semibold text-white transition-colors"
                      onClick={() => {
                        if (usdtAsset) {
                          setBuyModalProps({
                            defaultCapacitySat: '500000',
                            defaultClientBalanceSat: '20000',
                            defaultTotalAssetAmount: '100',
                            preselectedAsset: {
                              amount: 100,
                              assetId: usdtAsset.asset_id || '',
                            },
                          })
                          setShowGetBtc(true)
                        } else {
                          setShowGetUsdt(true)
                        }
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      {t('dca.addUsdtLn', 'Add USDT/LN')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        <section className="min-h-[420px] rounded-2xl border border-border-subtle bg-surface-overlay p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-content-primary">
              {tab === 'active'
                ? t('dca.orders.activeTitle', 'Scheduled DCA Orders')
                : t('dca.orders.historyTitle', 'Executed & Closed Orders')}
            </h2>
            <div className="flex gap-1 rounded-xl bg-surface-base/35 p-1">
              <button
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:outline-none ${
                  tab === 'active'
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'text-content-secondary hover:text-white border border-transparent'
                }`}
                onClick={() => setTab('active')}
              >
                <CalendarClock className="h-3.5 w-3.5" />
                {t('dca.tabs.active', 'Active')}
                <span
                  className={`text-xs ${tab === 'active' ? 'text-primary' : 'text-white/60'}`}
                >
                  ({activeOrders.length})
                </span>
              </button>
              <button
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:outline-none ${
                  tab === 'history'
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'text-content-secondary hover:text-white border border-transparent'
                }`}
                onClick={() => setTab('history')}
              >
                <BarChart2 className="h-3.5 w-3.5" />
                {t('dca.tabs.history', 'History')}
                <span
                  className={`text-xs ${tab === 'history' ? 'text-primary' : 'text-white/60'}`}
                >
                  ({doneOrders.length})
                </span>
              </button>
            </div>
          </div>

          <div className="mt-5">
            {displayedOrders.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center space-y-3 rounded-2xl border border-dashed border-border-subtle bg-surface-base/40 px-6 text-center">
                <div className="rounded-2xl bg-surface-overlay/50 p-4 text-content-secondary">
                  <TrendingUp className="h-8 w-8" />
                </div>
                <p className="text-sm font-medium text-content-secondary">
                  {tab === 'active'
                    ? t('dca.empty.active', 'No active DCA orders')
                    : t('dca.empty.history', 'No order history yet')}
                </p>
                {tab === 'active' && (
                  <button
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary hover:bg-primary-emphasis px-4 py-2 text-sm font-semibold text-[#12131C] transition-colors"
                    onClick={() => setShowModal(true)}
                  >
                    <Plus className="h-4 w-4" />
                    {t('dca.createOrder', 'New Order')}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {displayedOrders.map((order) => (
                  <DcaOrderCard
                    currentBtcPrice={currentBtcPrice}
                    key={order.id}
                    order={order}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  )
}
