import { ArrowRightLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'

import { Button, Modal } from '../../../components/ui'

import { fmtSats, fmtUnits } from './format'
import { useTr } from './market/hooks'
import { cx } from './market/ui'
import { daemonBalance, tauriDaemon, type DaemonBalance } from './p2p'

interface Props {
  isOpen: boolean
  onClose: () => void
  /** Offered when a node is connected: send to it instead of to an address. */
  onToNode?: () => void
}

/** Send bitcoin to an address, or an RGB asset to an invoice, out of the trading wallet. */
export function WithdrawModal({ isOpen, onClose, onToNode }: Props) {
  const tr = useTr()
  const [tab, setTab] = useState<'btc' | 'rgb'>('btc')
  const [balance, setBalance] = useState<DaemonBalance | null>(null)
  const [address, setAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [assetId, setAssetId] = useState('')
  const [invoice, setInvoice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    void daemonBalance()
      .then(setBalance)
      .catch(() => setBalance(null))
  }, [isOpen])

  const assets = (balance?.assets ?? []).filter((a) => a.spendable > 0)
  const chosen = assetId || assets[0]?.asset_id || ''
  // an on-chain send leaves a little for the miner
  const maxSats = Math.max(0, (balance?.btc_spendable_sat ?? 0) - 1_000)

  const sendBtc = async () => {
    const sats = Math.floor(Number(amount))
    if (!address.trim() || !Number.isFinite(sats) || sats <= 0)
      throw new Error(
        tr('withdraw.needBtc', 'Enter an address and an amount above zero.')
      )
    await tauriDaemon.sendBtc(address.trim(), sats)
  }

  const sendRgb = async () => {
    if (!invoice.trim() || !chosen)
      throw new Error(
        tr('withdraw.needRgb', 'Paste an invoice and choose an asset.')
      )
    await tauriDaemon.sendToInvoice(invoice.trim(), chosen)
  }

  const submit = async () => {
    setBusy(true)
    try {
      await (tab === 'btc' ? sendBtc() : sendRgb())
      toast.success(
        tr('withdraw.sent', 'Sent. It confirms after the next block.')
      )
      setAddress('')
      setAmount('')
      setInvoice('')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={tr('withdraw.title', 'Withdraw')}
      viewport
    >
      <div className="flex flex-col gap-4 p-5">
        <p className="text-caption text-content-secondary">
          {tr(
            'withdraw.explain',
            'Send funds out of the trading wallet to any address or invoice. Funds in an open order stay put until it is taken or cancelled.'
          )}
        </p>

        {onToNode && (
          <button
            className="flex items-center justify-center gap-2 rounded-xl bg-surface-raised px-3 py-2 text-caption font-medium text-content-primary transition-colors hover:bg-surface-high"
            onClick={onToNode}
            type="button"
          >
            <ArrowRightLeft aria-hidden size={14} />
            {tr('withdraw.toNode', 'Send to my node instead')}
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
                ? tr('withdraw.btc', 'Bitcoin')
                : tr('withdraw.rgb', 'RGB asset')}
            </button>
          ))}
        </div>

        {tab === 'btc' ? (
          <>
            <label className="flex flex-col gap-1.5 text-caption text-content-secondary">
              {tr('withdraw.address', 'Address')}
              <input
                className="rounded-xl bg-surface-inset px-3 py-2.5 text-body text-content-primary outline-none focus:ring-2 focus:ring-primary/40"
                onChange={(e) => setAddress(e.target.value)}
                placeholder="tb1…"
                spellCheck={false}
                value={address}
              />
            </label>
            <div className="flex flex-col gap-1.5 text-caption text-content-secondary">
              <div className="flex items-baseline justify-between">
                <label htmlFor="p2p-withdraw-amount">
                  {tr('withdraw.amount', 'Amount (sats)')}
                </label>
                <button
                  className="font-medium text-primary hover:underline"
                  onClick={() => setAmount(String(maxSats))}
                  type="button"
                >
                  {tr('withdraw.max', 'Max')} {fmtSats(maxSats)}
                </button>
              </div>
              <input
                className="rounded-xl bg-surface-inset px-3 py-2.5 text-body text-content-primary outline-none focus:ring-2 focus:ring-primary/40"
                id="p2p-withdraw-amount"
                inputMode="numeric"
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                value={amount}
              />
            </div>
          </>
        ) : (
          <>
            {assets.length === 0 ? (
              <p className="text-caption text-content-tertiary">
                {tr('withdraw.noAssets', 'No RGB asset to send yet.')}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2" role="group">
                {assets.map((a) => (
                  <button
                    aria-pressed={chosen === a.asset_id}
                    className={cx(
                      'rounded-full px-3 py-1 text-caption font-medium transition-colors',
                      chosen === a.asset_id
                        ? 'bg-primary/15 text-primary'
                        : 'bg-surface-raised text-content-secondary hover:text-content-primary'
                    )}
                    key={a.asset_id}
                    onClick={() => setAssetId(a.asset_id)}
                    type="button"
                  >
                    {a.ticker} · {fmtUnits(a.spendable, a.precision)}
                  </button>
                ))}
              </div>
            )}
            <label className="flex flex-col gap-1.5 text-caption text-content-secondary">
              {tr('withdraw.invoice', 'RGB invoice from the receiver')}
              <textarea
                className="min-h-20 rounded-xl bg-surface-inset p-3 text-body text-content-primary outline-none focus:ring-2 focus:ring-primary/40"
                onChange={(e) => setInvoice(e.target.value)}
                placeholder="rgb:…"
                spellCheck={false}
                value={invoice}
              />
            </label>
          </>
        )}

        <Button
          disabled={busy}
          fullWidth
          isLoading={busy}
          onClick={() => void submit()}
        >
          {tr('withdraw.send', 'Send')}
        </Button>
      </div>
    </Modal>
  )
}
