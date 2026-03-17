import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  CalendarClock,
  RefreshCw,
  BarChart2,
  Info,
  X,
} from 'lucide-react'

import { useAppSelector } from '../../../app/store/hooks'
import bitcoinLogo from '../../../assets/bitcoin-logo.svg'
import tetherLogo from '../../../assets/tether-logo.svg'
import { DcaBagIcon } from '../../../components/icons/DcaBagIcon'
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
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-base/70 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-surface-base border border-border-subtle rounded-2xl shadow-2xl shadow-black/30 overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <DcaBagIcon className="h-[1.125rem] w-[1.125rem]" />
            </div>
            <h2 className="text-sm font-semibold text-content-primary">
              {t('dca.createOrder', 'New DCA Order')}
            </h2>
          </div>
          <button
            className="p-1.5 rounded-lg text-content-secondary hover:text-content-primary hover:bg-surface-overlay transition-colors"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Modal body */}
        <div className="p-5">
          <CreateDcaForm
            currentBtcPrice={currentBtcPrice}
            onCreated={onClose}
          />
        </div>
      </div>
    </div>
  )
}

export const Component = () => {
  const { t } = useTranslation()
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

  const isRefreshing = isChannelsFetching || isAssetsFetching
  const handleRefresh = () =>
    void Promise.all([refetchChannels(), refetchAssets()])

  return (
    <>
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

      <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6">
        <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
          <section className="h-full overflow-hidden rounded-3xl border border-border-subtle bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-5 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.7)]">
            <div className="flex h-full flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                    <DcaBagIcon className="h-4 w-4" />
                    {t('navigation.dca', 'DCA')}
                  </div>
                  <h1 className="mt-3 text-3xl font-semibold text-content-primary">
                    {t('dca.title', 'DCA Orders')}
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-content-secondary">
                    Build recurring BTC buys from your USDT Lightning balance.
                    Keep enough USDT to send and enough BTC room to receive each
                    execution.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                    <button
                      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 font-medium transition-colors ${
                        infoOpen
                          ? 'border-primary/30 bg-primary/15 text-primary'
                          : 'border-border-subtle bg-surface-overlay/60 text-content-secondary hover:text-content-primary'
                      }`}
                      onClick={() => setInfoOpen((v) => !v)}
                      title={t('dca.howItWorks.title', 'How DCA works')}
                    >
                      <Info className="h-3.5 w-3.5" />
                      {t('dca.howItWorks.title', 'How DCA works')}
                    </button>
                    <span className="text-content-tertiary">
                      {t(
                        'dca.heroHint',
                        'Recurring buys stay active until you pause or cancel them.'
                      )}
                    </span>
                  </div>
                </div>

                <button
                  className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl border border-primary/30 bg-primary/15 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/25"
                  onClick={() => setShowModal(true)}
                  title={t('dca.createOrder', 'New DCA Order')}
                >
                  <Plus className="h-5 w-5" />
                  <span className="hidden sm:inline">
                    {t('dca.createOrder', 'New DCA Order')}
                  </span>
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border-subtle bg-surface-base/35 p-3.5">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-content-tertiary">
                    {t('dca.metrics.currentBtcPrice', 'Current BTC price')}
                  </p>
                  <p className="mt-1.5 text-lg font-semibold text-content-primary">
                    {currentBtcPrice != null
                      ? formatPrice(currentBtcPrice)
                      : '—'}
                  </p>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-surface-base/35 p-3.5">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-content-tertiary">
                    Average BTC price
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <p className="text-lg font-semibold text-content-primary">
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
                  <p className="mt-1 text-[11px] text-content-secondary">
                    vs current price
                  </p>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-surface-base/35 p-3.5">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-content-tertiary">
                    {t('dca.metrics.activeSchedules', 'Active schedules')}
                  </p>
                  <p className="mt-1.5 text-lg font-semibold text-content-primary">
                    {activeOrders.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-surface-base/35 p-3.5">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-content-tertiary">
                    Successful buys
                  </p>
                  <p className="mt-1.5 text-lg font-semibold text-content-primary">
                    {monthlyBuys}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex gap-1 rounded-xl bg-surface-overlay/50 p-1">
                    <button
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                        tab === 'active'
                          ? 'bg-surface-elevated text-content-primary shadow-sm'
                          : 'text-content-secondary hover:text-content-primary'
                      }`}
                      onClick={() => setTab('active')}
                    >
                      <CalendarClock className="h-3.5 w-3.5" />
                      {t('dca.tabs.active', 'Active')}
                      <span className="text-xs text-content-secondary">
                        ({activeOrders.length})
                      </span>
                    </button>
                    <button
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                        tab === 'history'
                          ? 'bg-surface-elevated text-content-primary shadow-sm'
                          : 'text-content-secondary hover:text-content-primary'
                      }`}
                      onClick={() => setTab('history')}
                    >
                      <BarChart2 className="h-3.5 w-3.5" />
                      {t('dca.tabs.history', 'History')}
                      <span className="text-xs text-content-secondary">
                        ({doneOrders.length})
                      </span>
                    </button>
                  </div>

                  <button
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-overlay/60 px-3 text-sm font-medium text-content-secondary transition-colors hover:text-content-primary"
                    onClick={() => setAnalyticsOpen(true)}
                  >
                    <BarChart2 className="h-3.5 w-3.5" />
                    {t('dca.analytics.button', 'Stats & Analytics')}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="h-full rounded-3xl border border-border-subtle bg-surface-raised p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-content-secondary" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-content-secondary">
                  {t('dca.section.balances', 'Channel Balances')}
                </span>
              </div>
              <button
                className="rounded-md p-1 text-content-secondary transition-colors hover:bg-surface-elevated hover:text-content-primary disabled:opacity-50"
                disabled={isRefreshing}
                onClick={handleRefresh}
                title={t('dca.refreshAmounts', 'Refresh')}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2.5">
              <div className="min-w-[132px] flex-1 rounded-2xl border border-border-subtle bg-surface-base/45 px-3.5 py-3">
                <p className="text-[10px] uppercase tracking-[0.22em] text-content-tertiary">
                  BTC value
                </p>
                <p className="mt-1.5 text-sm font-semibold text-content-primary">
                  {btcChannelUsdValue != null
                    ? formatPrice(btcChannelUsdValue)
                    : '—'}
                </p>
              </div>
              <div className="min-w-[132px] flex-1 rounded-2xl border border-border-subtle bg-surface-base/45 px-3.5 py-3">
                <p className="text-[10px] uppercase tracking-[0.22em] text-content-tertiary">
                  Ready channels
                </p>
                <p className="mt-1.5 text-sm font-semibold text-content-primary">
                  {readyChannels.length}
                </p>
              </div>
              <div className="min-w-[132px] flex-1 rounded-2xl border border-border-subtle bg-surface-base/45 px-3.5 py-3">
                <p className="text-[10px] uppercase tracking-[0.22em] text-content-tertiary">
                  USDT spendable
                </p>
                <p className="mt-1.5 text-sm font-semibold text-content-primary">
                  {formatUsdt(usdtLnOut)} USDT
                </p>
              </div>
              <div className="min-w-[132px] flex-1 rounded-2xl border border-border-subtle bg-surface-base/45 px-3.5 py-3">
                <p className="text-[10px] uppercase tracking-[0.22em] text-content-tertiary">
                  {t(
                    'dca.section.pendingUsdtChannels',
                    'Pending USDT channels'
                  )}
                </p>
                <p className="mt-1.5 text-sm font-semibold text-content-primary">
                  {pendingUsdtChannels.length}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-5">
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
                  className="mt-2 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 text-sm font-semibold text-amber-300 transition-colors hover:bg-amber-400/20"
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
                <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-400/20 flex">
                  {usdtLnOut + usdtLnIn > 0 ? (
                    <>
                      <div
                        className="h-full bg-emerald-400"
                        style={{
                          width: `${(usdtLnOut / (usdtLnOut + usdtLnIn)) * 100}%`,
                        }}
                      />
                      <div
                        className="h-full bg-emerald-400/40"
                        style={{
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
                  <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2.5">
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
                  className="mt-2 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/20"
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
            </div>
          </section>
        </div>

        <section className="min-h-[420px] rounded-3xl border border-border-subtle bg-surface-raised p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-content-secondary">
                {tab === 'active'
                  ? t('dca.tabs.active', 'Active')
                  : t('dca.tabs.history', 'History')}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-content-primary">
                {tab === 'active'
                  ? t('dca.orders.activeTitle', 'Scheduled DCA Orders')
                  : t('dca.orders.historyTitle', 'Executed & Closed Orders')}
              </h2>
            </div>
            <span className="rounded-full border border-border-subtle bg-surface-overlay/60 px-3 py-1 text-xs font-medium text-content-secondary">
              {displayedOrders.length}{' '}
              {tab === 'active'
                ? t('dca.tabs.active', 'active')
                : t('dca.tabs.history', 'history')}
            </span>
          </div>

          <div className="mt-5">
            {displayedOrders.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center space-y-3 rounded-2xl border border-dashed border-border-subtle bg-surface-base/40 px-6 text-center">
                <div className="rounded-2xl bg-surface-overlay/50 p-4 text-content-secondary">
                  <DcaBagIcon className="h-8 w-8" />
                </div>
                <p className="text-sm font-medium text-content-secondary">
                  {tab === 'active'
                    ? t('dca.empty.active', 'No active DCA orders')
                    : t('dca.empty.history', 'No order history yet')}
                </p>
                {tab === 'active' && (
                  <button
                    className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/15 px-4 py-2 text-sm font-medium text-primary transition-all duration-200 hover:bg-primary/25"
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
