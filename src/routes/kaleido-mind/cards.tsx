// Typed result cards for KaleidoMind chat.
//
// The sidecar streams `chat_tool_call` / `chat_tool_result` events for every
// tool the agent runs. Instead of letting the model re-narrate JSON as prose,
// we render a standardized card per known tool (balance, channels, invoice, …)
// keyed by tool name — a Claude-like structured experience. Unknown tools fall
// back to a generic, defensive renderer. Every card reads whatever fields exist
// and degrades gracefully, since tool output shapes can drift.

import { QRCodeSVG } from 'qrcode.react'
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  Coins,
  Copy,
  Loader2,
  MapPin,
  Network,
  QrCode,
  Send,
  Server,
  ShoppingBag,
  Store,
  Wallet,
} from 'lucide-react'
import React, { useState } from 'react'

import { useBitcoinPrice } from '../../hooks/useBitcoinPrice'

import type { ChatToolEvent } from './shared'

// ── Formatting helpers ───────────────────────────────────────────────────

/** Format a sats value (number or numeric string) → "12,345 sats", else null. */
export function fmtSats(n: unknown): string | null {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? `${v.toLocaleString('en-US')} sats` : null
}

/** Format a millisat value → "12,345 sats" (msat/1000), else null. */
export function fmtMsat(n: unknown): string | null {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? fmtSats(Math.round(v / 1000)) : null
}

function num(n: unknown): number | null {
  // Treat null/undefined/'' as "no value" — `Number(null)` is 0, which would
  // otherwise render real null amounts (e.g. an amountless invoice) as "0 sats".
  if (n == null || n === '') return null
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? v : null
}

/** Tool results arrive as a JSON string (MCP text content). Coerce to a value. */
export function coerce(result: unknown): unknown {
  if (typeof result === 'string') {
    const s = result.trim()
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        return JSON.parse(s)
      } catch {
        return result
      }
    }
    return result
  }
  return result
}

function asObj(result: unknown): Record<string, unknown> | null {
  const v = coerce(result)
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

function truncMiddle(s: string, head = 10, tail = 8): string {
  return s.length > head + tail + 1
    ? `${s.slice(0, head)}…${s.slice(-tail)}`
    : s
}

/** Humanize a tool name for the live "running" pill, e.g. "Checking balance". */
export function humanizeToolName(name: string): string {
  const map: Record<string, string> = {
    find_merchant_locations: 'Finding merchants nearby',
    kaleidoswap_get_quote: 'Getting a quote',
    kaleidoswap_lsp_create_asset_channel: 'Buying a channel',
    kaleidoswap_lsp_estimate_fees: 'Estimating channel fees',
    kaleidoswap_lsp_get_info: 'Checking the LSP',
    kaleidoswap_lsp_quote_asset_channel: 'Quoting a channel',
    rln_close_channel: 'Closing a channel',
    rln_create_ln_invoice: 'Creating an invoice',
    rln_create_rgb_invoice: 'Creating an RGB invoice',
    rln_get_address: 'Getting an address',
    rln_get_asset_balance: 'Checking asset balance',
    rln_get_balances: 'Checking your balance',
    rln_get_node_info: 'Reading node info',
    rln_list_assets: 'Listing your assets',
    rln_list_channels: 'Reading your channels',
    rln_list_payments: 'Loading payments',
    rln_list_swaps: 'Loading swaps',
    rln_open_channel: 'Opening a channel',
    rln_pay_invoice: 'Paying the invoice',
    rln_send_asset: 'Sending the asset',
    rln_send_btc: 'Sending BTC',
  }
  const base = name.replace(/^(wdk|rln)_/, 'rln_')
  return map[name] ?? map[base] ?? name.replace(/_/g, ' ')
}

// ── Small UI atoms ───────────────────────────────────────────────────────

const CopyButton: React.FC<{ value: string; label?: string }> = ({
  value,
  label,
}) => {
  const [done, setDone] = useState(false)
  return (
    <button
      className="inline-flex items-center gap-1 rounded-md border border-border-default px-1.5 py-0.5 text-[0.68rem] text-content-tertiary transition-colors hover:bg-surface-overlay hover:text-content-secondary"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1200)
        })
      }}
      title="Copy"
      type="button"
    >
      {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {label}
    </button>
  )
}

const Shell: React.FC<{
  icon: React.ReactNode
  title: string
  accent?: string
  children: React.ReactNode
}> = ({ icon, title, accent = 'text-primary', children }) => (
  <div className="my-2 overflow-hidden rounded-xl border border-border-default bg-surface-base/60">
    <div className="flex items-center gap-2 border-b border-divider/10 bg-surface-overlay/40 px-3 py-2">
      <span className={accent}>{icon}</span>
      <span className="text-xs font-semibold text-content-primary">
        {title}
      </span>
    </div>
    <div className="px-3 py-2.5">{children}</div>
  </div>
)

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="flex items-baseline justify-between gap-3 py-0.5 text-sm">
    <span className="text-content-tertiary">{label}</span>
    <span className="text-right font-medium text-content-primary">
      {children}
    </span>
  </div>
)

/** Horizontal outbound/inbound capacity bar (msat in). */
const CapacityBar: React.FC<{ outMsat: number; inMsat: number }> = ({
  outMsat,
  inMsat,
}) => {
  const total = Math.max(outMsat + inMsat, 1)
  const outPct = Math.round((outMsat / total) * 100)
  return (
    <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-surface-overlay">
      <div className="bg-primary" style={{ width: `${outPct}%` }} />
      <div
        className="bg-status-info/60"
        style={{ width: `${100 - outPct}%` }}
      />
    </div>
  )
}

type CardProps = {
  data: unknown
  args?: Record<string, unknown>
}

// ── Cards ────────────────────────────────────────────────────────────────

const BalanceCard: React.FC<CardProps> = ({ data }) => {
  const { formatFiat } = useBitcoinPrice()
  const o = asObj(data)
  if (!o) return <GenericCard data={data} />
  const oc = asObj(o.btc_onchain) ?? {}
  const onchain =
    (num(oc.vanilla_spendable_sats) ?? 0) +
    (num(oc.colored_spendable_sats) ?? 0)
  const ln = num(o.lightning_balance_sat)
  // Asset balance shape (rln_get_asset_balance): { asset_id, spendable, ... }
  const assetId = typeof o.asset_id === 'string' ? o.asset_id : null
  const assetSpendable = num(o.spendable)
  const fiat = (sats: number) => formatFiat(sats)
  return (
    <Shell icon={<Wallet className="h-4 w-4" />} title="Balance">
      {ln != null && (
        <Row label="Lightning">
          {fmtSats(ln)}
          {fiat(ln) && (
            <span className="ml-1.5 text-xs text-content-tertiary">
              {fiat(ln)}
            </span>
          )}
        </Row>
      )}
      {!assetId && (
        <Row label="On-chain (spendable)">
          {fmtSats(onchain)}
          {fiat(onchain) && (
            <span className="ml-1.5 text-xs text-content-tertiary">
              {fiat(onchain)}
            </span>
          )}
        </Row>
      )}
      {assetId && assetSpendable != null && (
        <Row label={`Asset ${truncMiddle(assetId)}`}>
          {assetSpendable.toLocaleString('en-US')}
        </Row>
      )}
      {ln != null && !assetId && (
        <div className="mt-1.5 flex items-center justify-between border-t border-divider/10 pt-1.5 text-sm">
          <span className="text-content-secondary">Total spendable</span>
          <span className="font-semibold text-content-primary">
            {fmtSats(ln + onchain)}
          </span>
        </div>
      )}
    </Shell>
  )
}

const ChannelsCard: React.FC<CardProps> = ({ data }) => {
  const o = asObj(data)
  const channels = Array.isArray(o?.channels)
    ? (o!.channels as Record<string, unknown>[])
    : Array.isArray(coerce(data))
      ? (coerce(data) as Record<string, unknown>[])
      : []
  if (!channels.length) {
    return (
      <Shell icon={<Network className="h-4 w-4" />} title="Channels">
        <p className="text-sm text-content-tertiary">No channels yet.</p>
      </Shell>
    )
  }
  const totalOut = num(o?.total_outbound_msat)
  const totalIn = num(o?.total_inbound_msat)
  return (
    <Shell
      icon={<Network className="h-4 w-4" />}
      title={`Channels · ${channels.length}`}
    >
      {(totalOut != null || totalIn != null) && (
        <div className="mb-2 flex gap-4 text-xs text-content-tertiary">
          {totalOut != null && (
            <span>
              Send <b className="text-content-secondary">{fmtMsat(totalOut)}</b>
            </span>
          )}
          {totalIn != null && (
            <span>
              Receive{' '}
              <b className="text-content-secondary">{fmtMsat(totalIn)}</b>
            </span>
          )}
        </div>
      )}
      <div className="space-y-2.5">
        {channels.slice(0, 6).map((c, i) => {
          const out = num(c.outbound_balance_msat) ?? 0
          const inb = num(c.inbound_balance_msat) ?? 0
          const peer =
            (typeof c.peer_alias === 'string' && c.peer_alias) ||
            (typeof c.peer_pubkey === 'string' && c.peer_pubkey) ||
            (typeof c.counterparty === 'string' && c.counterparty) ||
            (typeof c.channel_id === 'string' && c.channel_id) ||
            `Channel ${i + 1}`
          const usable = c.is_usable === true || c.ready === true
          const assetId = typeof c.asset_id === 'string' ? c.asset_id : null
          return (
            <div key={(c.channel_id as string) ?? i}>
              <div className="flex items-center justify-between text-xs">
                <span className="truncate font-mono text-content-secondary">
                  {truncMiddle(String(peer))}
                </span>
                <span
                  className={`ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium ${
                    usable
                      ? 'bg-status-success/15 text-status-success'
                      : 'bg-surface-overlay text-content-tertiary'
                  }`}
                >
                  {usable ? 'usable' : 'pending'}
                </span>
              </div>
              <CapacityBar inMsat={inb} outMsat={out} />
              <div className="mt-0.5 flex justify-between text-[0.65rem] text-content-tertiary">
                <span>{fmtMsat(out)} out</span>
                {assetId && <span>RGB {truncMiddle(assetId, 6, 4)}</span>}
                <span>{fmtMsat(inb)} in</span>
              </div>
            </div>
          )
        })}
        {channels.length > 6 && (
          <p className="text-[0.65rem] text-content-tertiary">
            +{channels.length - 6} more
          </p>
        )}
      </div>
    </Shell>
  )
}

const AssetsCard: React.FC<CardProps> = ({ data }) => {
  const v = coerce(data)
  // Accept an array, or an object whose values are asset arrays (nia/cfa/…).
  let assets: Record<string, unknown>[] = []
  if (Array.isArray(v)) assets = v as Record<string, unknown>[]
  else if (v && typeof v === 'object') {
    for (const val of Object.values(v as Record<string, unknown>)) {
      if (Array.isArray(val)) assets.push(...(val as Record<string, unknown>[]))
    }
  }
  if (!assets.length) return <GenericCard data={data} />
  return (
    <Shell
      icon={<Coins className="h-4 w-4" />}
      title={`Assets · ${assets.length}`}
    >
      <div className="space-y-1">
        {assets.slice(0, 8).map((a, i) => {
          const ticker =
            (typeof a.ticker === 'string' && a.ticker) ||
            (typeof a.name === 'string' && a.name) ||
            'Asset'
          // Balance is a nested object in raw base units; show the spendable
          // amount (on-chain, else the LN-outbound holding) scaled by precision.
          const balObj = asObj(a.balance)
          const precision = num(a.precision) ?? 0
          const rawBal = balObj
            ? num(balObj.spendable) ||
              num(balObj.offchain_outbound) ||
              num(balObj.settled) ||
              0
            : (num(a.balance) ?? num(a.spendable) ?? 0)
          const bal = precision > 0 ? rawBal / 10 ** precision : rawBal
          return (
            <div
              className="flex items-baseline justify-between gap-2 text-sm"
              key={(a.asset_id as string) ?? i}
            >
              <span className="truncate font-medium text-content-primary">
                {ticker}
                {typeof a.name === 'string' && a.name !== ticker && (
                  <span className="ml-1.5 text-xs font-normal text-content-tertiary">
                    {a.name}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-mono text-content-secondary">
                {bal.toLocaleString('en-US', {
                  maximumFractionDigits: Math.min(precision, 8),
                })}
              </span>
            </div>
          )
        })}
      </div>
    </Shell>
  )
}

const InvoiceCard: React.FC<CardProps> = ({ data, args }) => {
  const o = asObj(data) ?? {}
  const payable =
    (typeof o.invoice === 'string' && o.invoice) ||
    (typeof o.address === 'string' && o.address) ||
    (typeof o.bolt11 === 'string' && o.bolt11) ||
    (typeof o.recipient_id === 'string' && o.recipient_id) ||
    (typeof coerce(data) === 'string' ? (coerce(data) as string) : '')
  const amount = num(args?.amount_sat) ?? num(args?.amount) ?? num(o.amount_sat)
  if (!payable) return <GenericCard data={data} />
  return (
    <Shell icon={<QrCode className="h-4 w-4" />} title="Payment request">
      <div className="flex flex-col items-center gap-2">
        <div className="rounded-lg bg-white p-2">
          <QRCodeSVG level="M" size={148} value={payable} />
        </div>
        {amount != null && (
          <span className="text-sm font-semibold text-content-primary">
            {fmtSats(amount)}
          </span>
        )}
        <div className="flex w-full items-center gap-2 rounded-md border border-border-default bg-surface-overlay/40 px-2 py-1">
          <span className="flex-1 truncate font-mono text-[0.68rem] text-content-tertiary">
            {payable}
          </span>
          <CopyButton value={payable} />
        </div>
      </div>
    </Shell>
  )
}

const PaymentSentCard: React.FC<CardProps> = ({ data }) => {
  const o = asObj(data)
  if (!o) return <GenericCard data={data} />
  const amount =
    num(o.amount_sat) ?? num(o.amount_msat) ?? num(o.amount_display)
  const isMsat = o.amount_msat != null && o.amount_sat == null
  const ref =
    (typeof o.txid === 'string' && o.txid) ||
    (typeof o.payment_hash === 'string' && o.payment_hash) ||
    (typeof o.payment_preimage === 'string' && o.payment_preimage) ||
    null
  const status =
    (typeof o.status === 'string' && o.status) ||
    (o.sent ? 'sent' : 'submitted')
  return (
    <Shell
      accent="text-status-success"
      icon={<Send className="h-4 w-4" />}
      title="Payment sent"
    >
      {amount != null && (
        <Row label="Amount">
          {isMsat
            ? fmtMsat(amount)
            : (fmtSats(amount) ?? amount.toLocaleString())}
        </Row>
      )}
      {num(o.fee_sat) != null && <Row label="Fee">{fmtSats(o.fee_sat)}</Row>}
      <Row label="Status">
        <span className="capitalize text-status-success">{status}</span>
      </Row>
      {ref && (
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="truncate font-mono text-[0.68rem] text-content-tertiary">
            {truncMiddle(ref, 12, 10)}
          </span>
          <CopyButton value={ref} />
        </div>
      )}
    </Shell>
  )
}

const PaymentsCard: React.FC<CardProps> = ({ data }) => {
  const v = coerce(data)
  const list = Array.isArray(v)
    ? (v as Record<string, unknown>[])
    : Array.isArray(asObj(data)?.payments)
      ? (asObj(data)!.payments as Record<string, unknown>[])
      : Array.isArray(asObj(data)?.swaps)
        ? (asObj(data)!.swaps as Record<string, unknown>[])
        : []
  if (!list.length) {
    return (
      <Shell icon={<ArrowLeftRight className="h-4 w-4" />} title="Payments">
        <p className="text-sm text-content-tertiary">No payments found.</p>
      </Shell>
    )
  }
  return (
    <Shell
      icon={<ArrowLeftRight className="h-4 w-4" />}
      title={`Payments · ${list.length}`}
    >
      <div className="space-y-1.5">
        {list.slice(0, 8).map((p, i) => {
          const inbound =
            p.inbound === true ||
            p.direction === 'inbound' ||
            p.direction === 'received'
          const amt = num(p.amount_sat) ?? fmtMsat(p.amt_msat) ?? num(p.amount)
          const status =
            (typeof p.status === 'string' && p.status) ||
            (typeof p.state === 'string' && p.state) ||
            ''
          return (
            <div
              className="flex items-center gap-2 text-sm"
              key={(p.payment_hash as string) ?? i}
            >
              {inbound ? (
                <ArrowDownLeft className="h-3.5 w-3.5 shrink-0 text-status-success" />
              ) : (
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-status-info" />
              )}
              <span className="flex-1 font-medium text-content-primary">
                {typeof amt === 'number' ? fmtSats(amt) : (amt ?? '—')}
              </span>
              {status && (
                <span
                  className={`text-[0.65rem] capitalize ${
                    /fail|error|expired/i.test(status)
                      ? 'text-status-danger'
                      : /succe|complete|paid/i.test(status)
                        ? 'text-status-success'
                        : 'text-content-tertiary'
                  }`}
                >
                  {status}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </Shell>
  )
}

const ChannelBuyCard: React.FC<CardProps> = ({ data, args }) => {
  const o = asObj(data) ?? {}
  const asset = String(args?.asset ?? o.asset ?? '')
  const amount = args?.asset_amount ?? o.asset_amount
  const total = fmtSats(
    o.total_sat ?? o.order_total_sat ?? o.onchain_amount_sat ?? args?.total_sat
  )
  const fee = fmtSats(
    o.channel_fee_sat ?? o.fee_total_sat ?? o.total_fee ?? o.fee_sat
  )
  const price = fmtSats(o.btc_amount_sat)
  const state =
    (typeof o.order_state === 'string' && o.order_state) ||
    (typeof o.status === 'string' && o.status) ||
    null
  return (
    <Shell icon={<Network className="h-4 w-4" />} title="Channel quote">
      {asset && (
        <Row label="Asset">
          {amount ? `${amount} ` : ''}
          {asset}
        </Row>
      )}
      {price && <Row label="Asset price">{price}</Row>}
      {fee && <Row label="Channel fee">{fee}</Row>}
      {state && <Row label="Status">{state}</Row>}
      {total && (
        <div className="mt-1.5 flex items-center justify-between border-t border-divider/10 pt-1.5 text-sm">
          <span className="text-content-secondary">You pay</span>
          <span className="font-semibold text-content-primary">{total}</span>
        </div>
      )}
      {!asset && !total && <GenericCard data={data} />}
    </Shell>
  )
}

const NodeInfoCard: React.FC<CardProps> = ({ data }) => {
  const o = asObj(data)
  if (!o) return <GenericCard data={data} />
  const pubkey =
    (typeof o.pubkey === 'string' && o.pubkey) ||
    (typeof o.node_id === 'string' && o.node_id) ||
    null
  return (
    <Shell icon={<Server className="h-4 w-4" />} title="Node">
      {pubkey && (
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="truncate font-mono text-[0.68rem] text-content-tertiary">
            {truncMiddle(pubkey, 14, 10)}
          </span>
          <CopyButton value={pubkey} />
        </div>
      )}
      {num(o.num_channels) != null && (
        <Row label="Channels">
          {String(o.num_channels)}
          {num(o.num_usable_channels) != null &&
            ` (${o.num_usable_channels} usable)`}
        </Row>
      )}
      {num(o.num_peers) != null && (
        <Row label="Peers">{String(o.num_peers)}</Row>
      )}
      {num(o.local_balance_sat) != null && (
        <Row label="Lightning">{fmtSats(o.local_balance_sat)}</Row>
      )}
      {typeof o.network === 'string' && <Row label="Network">{o.network}</Row>}
      {num(o.block_height) != null && (
        <Row label="Block height">
          {(num(o.block_height) as number).toLocaleString('en-US')}
        </Row>
      )}
    </Shell>
  )
}

/** Format a distance in metres → "420 m" or "1.3 km". */
function fmtDistance(m: unknown): string | null {
  const v = num(m)
  if (v == null) return null
  return v < 1000 ? `${Math.round(v)} m` : `${(v / 1000).toFixed(1)} km`
}

const MerchantCard: React.FC<CardProps> = ({ data }) => {
  const o = asObj(data)
  const merchants = Array.isArray(o?.merchants)
    ? (o!.merchants as Record<string, unknown>[])
    : Array.isArray(coerce(data))
      ? (coerce(data) as Record<string, unknown>[])
      : []
  if (!merchants.length) {
    const note = o && typeof o.note === 'string' ? o.note : null
    return (
      <Shell icon={<Store className="h-4 w-4" />} title="Merchants">
        <p className="text-sm text-content-tertiary">
          {note ?? 'No Bitcoin-accepting merchants found nearby.'}
        </p>
      </Shell>
    )
  }
  return (
    <Shell
      icon={<Store className="h-4 w-4" />}
      title={`Merchants · ${merchants.length}`}
    >
      <div className="space-y-2">
        {merchants.slice(0, 8).map((m, i) => {
          const name =
            (typeof m.name === 'string' && m.name) || `Merchant ${i + 1}`
          const category = typeof m.category === 'string' ? m.category : null
          const address = typeof m.address === 'string' ? m.address : null
          const dist = fmtDistance(m.distance_m)
          return (
            <div
              className="flex items-start gap-2 border-b border-divider/10 pb-2 last:border-0 last:pb-0"
              key={(m.id as string | number) ?? i}
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-content-primary">
                    {name}
                  </span>
                  {dist && (
                    <span className="shrink-0 text-xs text-content-tertiary">
                      {dist}
                    </span>
                  )}
                </div>
                {(category || address) && (
                  <p className="truncate text-xs text-content-tertiary">
                    {[category, address].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Shell>
  )
}

/** Generic fallback: arrays → compact list, objects → key/value rows. */
const GenericCard: React.FC<CardProps & { title?: string }> = ({
  data,
  title = 'Result',
}) => {
  const v = coerce(data)
  if (Array.isArray(v)) {
    return (
      <Shell icon={<ShoppingBag className="h-4 w-4" />} title={title}>
        <div className="space-y-1">
          {v.slice(0, 8).map((item, i) => (
            <div className="truncate text-sm text-content-secondary" key={i}>
              {typeof item === 'object'
                ? Object.values(item as Record<string, unknown>)
                    .filter(
                      (x) => typeof x === 'string' || typeof x === 'number'
                    )
                    .slice(0, 3)
                    .join(' · ')
                : String(item)}
            </div>
          ))}
        </div>
      </Shell>
    )
  }
  const o = asObj(data)
  if (o) {
    const entries = Object.entries(o).filter(
      ([, val]) => val != null && typeof val !== 'object'
    )
    return (
      <Shell icon={<ShoppingBag className="h-4 w-4" />} title={title}>
        {entries.slice(0, 8).map(([k, val]) => (
          <Row key={k} label={k.replace(/_/g, ' ')}>
            <span className="font-mono text-xs">
              {truncMiddle(String(val), 16, 8)}
            </span>
          </Row>
        ))}
      </Shell>
    )
  }
  return (
    <Shell icon={<ShoppingBag className="h-4 w-4" />} title={title}>
      <p className="whitespace-pre-wrap break-words text-sm text-content-secondary">
        {String(v).slice(0, 600)}
      </p>
    </Shell>
  )
}

const ErrorCard: React.FC<CardProps & { name: string }> = ({ data, name }) => {
  const o = asObj(data)
  const msg =
    (o && typeof o.error === 'string' && o.error) ||
    (o && o.declined ? `Declined${o.reason ? `: ${o.reason}` : ''}` : '') ||
    'Tool failed'
  return (
    <Shell
      accent="text-status-danger"
      icon={<AlertTriangle className="h-4 w-4" />}
      title={humanizeToolName(name)}
    >
      <p className="text-sm text-status-danger">{msg}</p>
    </Shell>
  )
}

// ── Registry + dispatch ──────────────────────────────────────────────────

type CardComponent = React.FC<CardProps>

/** Map a tool name (rln_/wdk_/kaleidoswap_) to its card. */
function cardFor(name: string): CardComponent {
  const n = name.replace(/^wdk_/, 'rln_')
  const registry: Record<string, CardComponent> = {
    find_merchant_locations: MerchantCard,
    kaleidoswap_lsp_create_asset_channel: ChannelBuyCard,
    kaleidoswap_lsp_estimate_fees: ChannelBuyCard,
    kaleidoswap_lsp_quote_asset_channel: ChannelBuyCard,
    rln_create_ln_invoice: InvoiceCard,
    rln_create_rgb_invoice: InvoiceCard,
    rln_get_address: InvoiceCard,
    rln_get_asset_balance: BalanceCard,
    rln_get_balances: BalanceCard,
    rln_get_node_info: NodeInfoCard,
    rln_list_assets: AssetsCard,
    rln_list_channels: ChannelsCard,
    rln_list_payments: PaymentsCard,
    rln_list_swaps: PaymentsCard,
    rln_pay_invoice: PaymentSentCard,
    rln_send_asset: PaymentSentCard,
    rln_send_btc: PaymentSentCard,
  }
  return registry[n] ?? ((p) => <GenericCard {...p} />)
}

/**
 * Render a single tool event: a live "running" pill, the typed result card, or
 * an error card. This is what chat.tsx drops inline into the assistant bubble.
 */
export const ToolEventView: React.FC<{ event: ChatToolEvent }> = ({
  event,
}) => {
  if (event.status === 'running') {
    return (
      <div className="my-1.5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary">
        <Loader2 className="h-3 w-3 animate-spin" />
        {humanizeToolName(event.name)}…
      </div>
    )
  }
  if (event.status === 'error') {
    return <ErrorCard data={event.result} name={event.name} />
  }
  const Card = cardFor(event.name)
  return <Card args={event.arguments} data={event.result} />
}
