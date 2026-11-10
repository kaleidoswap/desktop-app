import { ArrowRightLeft, Copy, Loader2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'

import { Button, Modal } from '../../../components/ui'

import { marketApi, type Balance } from './api'
import { short } from './format'
import { useTr } from './market/hooks'
import { cx } from './market/ui'
import { createReceiveInvoice } from './p2p'

interface Props {
  isOpen: boolean
  onClose: () => void
  /** Offered when a node is connected: move funds from it instead of from outside. */
  onFromNode?: () => void
}

const copy = async (text: string, done: string, failed: string) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(done)
  } catch {
    toast.error(failed)
  }
}

/** Bring bitcoin or an RGB asset into the trading wallet from anywhere: an address and an invoice. */
export function DepositModal({ isOpen, onClose, onFromNode }: Props) {
  const tr = useTr()
  const [tab, setTab] = useState<'btc' | 'rgb'>('btc')
  const [address, setAddress] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [assetId, setAssetId] = useState('')
  const [invoice, setInvoice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // what the wallet held when the dialog opened, so a deposit shows up as a change
  const [baseline, setBaseline] = useState<number | null>(null)
  const [seen, setSeen] = useState<Balance | null>(null)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    void marketApi
      .info()
      .then((i) => !cancelled && setAddress(i.address))
      .catch(() => !cancelled && setAddress(null))
    // while the dialog is open, look for the deposit every few seconds
    // confirmed plus waiting: a deposit counts from the moment it is seen
    const total = (b: Balance) =>
      (b.btc_settled_sat ?? b.btc_spendable_sat) + (b.btc_pending_sat ?? 0)
    const look = async () => {
      try {
        await marketApi.refresh()
        const b = await marketApi.balance()
        if (cancelled) return
        setBaseline((base) => base ?? total(b))
        setSeen(b)
      } catch {
        // the next look tries again
      }
    }
    void look()
    const id = setInterval(() => void look(), 6_000)
    return () => {
      cancelled = true
      clearInterval(id)
      // the next opening starts from what the wallet holds then
      setBaseline(null)
      setSeen(null)
    }
  }, [isOpen])

  const arrived =
    seen && baseline !== null
      ? (seen.btc_settled_sat ?? seen.btc_spendable_sat) +
        (seen.btc_pending_sat ?? 0) -
        baseline
      : 0

  const makeInvoice = async () => {
    setBusy(true)
    try {
      const n = Math.floor(Number(amount))
      if (!Number.isFinite(n) || n <= 0)
        throw new Error(tr('deposit.needAmount', 'Enter an amount above zero.'))
      const out = await createReceiveInvoice(n, assetId.trim() || undefined)
      setInvoice(out.invoice)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const copied = tr('deposit.copied', 'Copied')
  const copyFailed = tr('deposit.copyFailed', 'Could not copy')

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={tr('deposit.title', 'Deposit')}
      viewport
    >
      <div className="flex flex-col gap-4 p-5">
        <p className="text-caption text-content-secondary">
          {tr(
            'deposit.explain',
            'Send bitcoin or an RGB asset to your trading wallet from any wallet or exchange. It shows up here once the transaction is seen.'
          )}
        </p>

        {onFromNode && (
          <button
            className="flex items-center justify-center gap-2 rounded-xl bg-surface-raised px-3 py-2 text-caption font-medium text-content-primary transition-colors hover:bg-surface-high"
            onClick={onFromNode}
            type="button"
          >
            <ArrowRightLeft aria-hidden size={14} />
            {tr('deposit.fromNode', 'Move from my node instead')}
          </button>
        )}

        <div
          className="grid grid-cols-2 gap-1 rounded-xl bg-surface-inset p-1"
          role="tablist"
        >
          {(['btc', 'rgb'] as const).map((t) => (
            <button
              aria-selected={tab === t}
              className={cx(
                'rounded-lg px-3 py-2 text-body font-medium transition-colors',
                tab === t
                  ? 'bg-primary text-text-on-accent'
                  : 'text-content-secondary hover:text-content-primary'
              )}
              key={t}
              onClick={() => setTab(t)}
              role="tab"
              type="button"
            >
              {t === 'btc'
                ? tr('deposit.btc', 'Bitcoin')
                : tr('deposit.rgb', 'RGB asset')}
            </button>
          ))}
        </div>

        {tab === 'btc' && (
          <div className="flex flex-col items-center gap-3">
            {address ? (
              <>
                <div className="rounded-xl bg-white p-3">
                  <QRCodeSVG size={168} value={address} />
                </div>
                <div className="flex w-full items-start gap-2 rounded-xl bg-surface-inset px-3 py-2">
                  <code className="min-w-0 flex-1 break-all text-left font-mono text-tiny text-content-secondary">
                    {address}
                  </code>
                  <button
                    aria-label={tr('deposit.copyAddress', 'Copy address')}
                    className="shrink-0 text-content-secondary hover:text-content-primary"
                    onClick={() => void copy(address, copied, copyFailed)}
                    type="button"
                  >
                    <Copy aria-hidden size={14} />
                  </button>
                </div>
                {arrived > 0 ? (
                  <p className="w-full rounded-xl bg-status-success-subtle p-3 text-center text-caption text-content-primary">
                    {(seen?.btc_pending_sat ?? 0) > 0
                      ? tr(
                          'deposit.seenPending',
                          'Deposit seen: {{n}} sats. It is available after one confirmation.',
                          { n: arrived.toLocaleString('en-US') }
                        )
                      : tr('deposit.arrived', 'Deposit received: {{n}} sats.', {
                          n: arrived.toLocaleString('en-US'),
                        })}
                  </p>
                ) : (
                  <p className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-inset p-3 text-center text-caption text-content-secondary">
                    <Loader2
                      aria-hidden
                      className="shrink-0 animate-spin"
                      size={14}
                    />
                    {tr(
                      'deposit.waiting',
                      'Waiting for your deposit… this checks the chain every few seconds.'
                    )}
                  </p>
                )}
                <p className="text-center text-caption text-content-tertiary">
                  {tr(
                    'deposit.btcNote',
                    'Send each deposit to this address. Several separate deposits give you several coins, so you can run several swaps at once.'
                  )}
                </p>
              </>
            ) : (
              <p className="flex items-center gap-2 py-6 text-caption text-content-tertiary">
                <Loader2 aria-hidden className="animate-spin" size={14} />
                {tr('deposit.loading', 'Loading the address…')}
              </p>
            )}
          </div>
        )}

        {tab === 'rgb' && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-caption text-content-secondary">
              {tr('deposit.amount', 'Amount (in the asset’s smallest unit)')}
              <input
                className="rounded-xl bg-surface-inset px-3 py-2.5 text-body text-content-primary outline-none focus:ring-2 focus:ring-primary/40"
                inputMode="numeric"
                onChange={(e) => {
                  setAmount(e.target.value)
                  setInvoice(null)
                }}
                placeholder="0"
                value={amount}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-caption text-content-secondary">
              {tr('deposit.assetId', 'Asset ID (leave empty to accept any)')}
              <input
                className="rounded-xl bg-surface-inset px-3 py-2.5 text-body text-content-primary outline-none focus:ring-2 focus:ring-primary/40"
                onChange={(e) => {
                  setAssetId(e.target.value)
                  setInvoice(null)
                }}
                placeholder="rgb:…"
                spellCheck={false}
                value={assetId}
              />
            </label>
            <Button
              disabled={busy}
              isLoading={busy}
              onClick={() => void makeInvoice()}
            >
              {tr('deposit.makeInvoice', 'Create invoice')}
            </Button>
            {invoice && (
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-xl bg-white p-3">
                  <QRCodeSVG level="L" size={168} value={invoice} />
                </div>
                <div className="flex w-full items-center gap-2 rounded-xl bg-surface-inset px-3 py-2">
                  <code
                    className="min-w-0 flex-1 truncate text-caption text-content-secondary"
                    title={invoice}
                  >
                    {short(invoice, 16)}
                  </code>
                  <button
                    aria-label={tr('deposit.copyInvoice', 'Copy invoice')}
                    className="shrink-0 text-content-secondary hover:text-content-primary"
                    onClick={() => void copy(invoice, copied, copyFailed)}
                    type="button"
                  >
                    <Copy aria-hidden size={14} />
                  </button>
                </div>
                <p className="text-center text-caption text-content-tertiary">
                  {tr(
                    'deposit.invoiceNote',
                    'Give this invoice to whoever sends the asset. It works once and expires in an hour.'
                  )}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
