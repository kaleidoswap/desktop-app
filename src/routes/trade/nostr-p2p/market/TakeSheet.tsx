import { Copy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'

import { Modal } from '../../../../components/ui'
import { marketApi, type Info, type Order, type Trade } from '../api'
import {
  fmtPrice,
  fmtSats,
  fmtUnits,
  short,
  takerCost,
  tickerOf,
} from '../format'

import { useTr } from './hooks'
import { failureKind, swapProgress, type Stage } from './progress'
import { SwapGlyph } from './SwapGlyph'
import { SummaryRows, Steps, cx, type Step } from './ui'

interface Props {
  orders: Order[]
  trades: Trade[]
  info: Info
  onClose: () => void
  onChanged: () => void
}

const order = ['requested', 'signing', 'confirming', 'settled'] as const
const reached = (stage: Stage, at: (typeof order)[number]) =>
  stage !== 'failed' && order.indexOf(stage) >= order.indexOf(at)

export function TakeSheet({ orders, trades, info, onClose, onChanged }: Props) {
  const tr = useTr()
  // seconds; trades from earlier attempts at the same order do not count
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const started = startedAt !== null
  const [busy, setBusy] = useState(false)
  const [checked, setChecked] = useState(false)

  const first = orders[0]!
  const ticker = tickerOf(first)
  const buying = first.side === 'sell' // the taker does the opposite of the maker
  const ids = useMemo(() => new Set(orders.map((o) => o.order_id)), [orders])
  const mine = trades.filter(
    (t) =>
      ids.has(t.id) &&
      t.role === 'taker' &&
      startedAt !== null &&
      t.ts >= startedAt
  )
  const p = swapProgress(mine)

  const costs = orders.map(takerCost)
  const assetBase = orders.reduce((s, o) => s + o.amount, 0)
  const priceSats = orders.reduce((s, o) => s + o.price_sat, 0)
  const platform = orders.reduce((s, o) => s + o.platform_fee_sat, 0)
  const network = orders.reduce((s, o) => s + o.network_fee_sat, 0)
  const pay = costs.reduce((s, c) => s + c.pay, 0)
  const receiveSats = costs.reduce((s, c) => s + c.receive, 0)
  const asset = `${fmtUnits(assetBase, first.precision)} ${ticker}`
  const sats = buying ? `${fmtSats(pay)} sats` : `${fmtSats(receiveSats)} sats`

  const unverified = orders.some((o) => !o.verified)
  const imitation = orders.find((o) => o.impersonates)?.impersonates ?? null
  const away = orders.some((o) => o.away)
  const done = p.stage === 'settled'

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const confirm = async () => {
    setBusy(true)
    const since = Math.floor(Date.now() / 1000) - 2
    const results = await Promise.allSettled(
      orders.map((o) => marketApi.take(o.order_id))
    )
    const failed = results.find(
      (r): r is PromiseRejectedResult => r.status === 'rejected'
    )
    if (failed)
      toast.error(
        failed.reason instanceof Error
          ? failed.reason.message
          : String(failed.reason)
      )
    if (results.some((r) => r.status === 'fulfilled')) setStartedAt(since)
    setBusy(false)
    onChanged()
  }

  const copy = (text: string) =>
    void navigator.clipboard?.writeText(text).then(
      () => toast.success(tr('take.copied', 'Copied')),
      () => undefined
    )

  const steps: Step[] = [
    {
      description:
        p.stage === 'requested'
          ? tr('take.waitMaker', 'Waiting for the other side to answer')
          : tr('take.accepted', 'The other side accepted'),
      id: 'req',
      label: tr('take.s1', 'Order accepted'),
      status: reached(p.stage, 'signing')
        ? 'done'
        : p.stage === 'failed'
          ? 'failed'
          : 'active',
    },
    {
      description:
        p.stage === 'signing'
          ? tr('take.signing', 'Each side signs its part')
          : undefined,
      id: 'sign',
      label: tr('take.s2', 'Both sides sign'),
      status: reached(p.stage, 'confirming')
        ? 'done'
        : p.stage === 'signing'
          ? 'active'
          : p.stage === 'failed'
            ? 'failed'
            : 'pending',
    },
    {
      description: p.txids.length ? short(p.txids[0]!, 8) : undefined,
      id: 'bcast',
      label: tr('take.s3', 'Sent to Bitcoin'),
      status: reached(p.stage, 'confirming') ? 'done' : 'pending',
    },
    {
      description:
        p.stage === 'confirming'
          ? p.required > 0
            ? tr('take.conf', '{{have}} of {{need}} confirmations', {
                have: p.confirmations,
                need: p.required,
              })
            : tr('take.confNone', 'Waiting for the indexer')
          : undefined,
      id: 'conf',
      label: tr('take.s4', 'Confirming'),
      status:
        p.stage === 'settled'
          ? 'done'
          : p.stage === 'confirming'
            ? 'active'
            : 'pending',
    },
    {
      description: done ? tr('take.landed', 'Yours to spend') : undefined,
      id: 'done',
      label: buying
        ? tr('take.s5buy', 'In your wallet')
        : tr('take.s5sell', 'Sats in your wallet'),
      status: done ? 'done' : 'pending',
    },
  ]

  const rows = [
    {
      label: buying ? tr('take.send', 'You send') : tr('take.give', 'You give'),
      value: buying ? `${fmtSats(pay)} sats` : asset,
    },
    {
      emphasis: true,
      label: tr('take.receive', 'You receive'),
      tone: 'success' as const,
      value: buying ? asset : `${fmtSats(receiveSats)} sats`,
    },
    {
      label: tr('take.price', 'Price'),
      value: `${fmtPrice(priceSats / (assetBase / 10 ** first.precision))} sats / ${ticker}`,
    },
    {
      label: tr('take.platformFee', 'Platform fee'),
      value: `${fmtSats(platform)} sats`,
    },
    {
      label: tr('take.networkFee', 'Network fee'),
      value: `${fmtSats(network)} sats`,
    },
    {
      label:
        orders.length > 1
          ? tr('take.orders', 'Orders')
          : tr('take.counterparty', 'Counterparty'),
      value: orders.length > 1 ? String(orders.length) : first.maker,
    },
  ]

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="md"
      title={
        started
          ? done
            ? tr('take.titleDone', 'Swap complete')
            : tr('take.titleRun', 'Swapping')
          : buying
            ? tr('take.titleBuy', 'Confirm purchase')
            : tr('take.titleSell', 'Confirm sale')
      }
    >
      <div className="flex flex-col gap-5 p-5">
        <SwapGlyph
          confirmations={
            reached(p.stage, 'confirming') ? p.confirmations : null
          }
          failed={p.stage === 'failed'}
          receive={buying ? asset : sats}
          required={p.required || info.min_confirmations}
          send={buying ? sats : asset}
          settled={done}
        />

        {!started && (
          <>
            <SummaryRows rows={rows} />
            {imitation && (
              <p className="rounded-xl bg-status-danger-subtle p-3 text-caption text-content-primary">
                {tr(
                  'take.imitation',
                  'This asset uses the ticker of {{name}} but is a different asset. Check the asset ID before you go on.',
                  { name: imitation }
                )}
              </p>
            )}
            {unverified && (
              <div className="flex flex-col gap-2 rounded-xl bg-status-warning-subtle p-3 text-caption text-content-primary">
                <p className="font-medium">
                  {tr(
                    'take.unverifiedTitle',
                    'This asset is not on the verified list'
                  )}
                </p>
                <p className="text-content-secondary">
                  {tr(
                    'take.unverifiedBody',
                    'Anyone can issue an asset with any ticker. Its ID is its only identity.'
                  )}
                </p>
                <button
                  className="flex items-center gap-2 break-all rounded-lg bg-surface-inset px-2 py-1.5 text-left font-mono text-tiny text-content-secondary"
                  onClick={() => copy(first.asset_id)}
                  type="button"
                >
                  <span className="flex-1">{first.asset_id}</span>
                  <Copy aria-hidden size={12} />
                </button>
                <label className="flex items-center gap-2">
                  <input
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                    type="checkbox"
                  />
                  {tr('take.checked', 'I checked the asset ID')}
                </label>
              </div>
            )}
            {away && (
              <p className="rounded-xl bg-surface-inset p-3 text-caption text-content-secondary">
                {tr(
                  'take.away',
                  'The other side has not been seen for a while. Your request waits up to {{min}} minutes for an answer, and nothing is spent if it times out.',
                  { min: Math.round(info.taker_wait_secs / 60) }
                )}
              </p>
            )}
            <p className="text-caption text-content-secondary">
              {tr(
                'take.atomic',
                'One Bitcoin transaction carries both sides, so either both transfers happen or neither does. Nobody holds your funds in between, and the platform fee is paid inside the same transaction.'
              )}
            </p>
            <button
              className={cx(
                'rounded-xl py-3 text-body font-bold transition-opacity disabled:cursor-not-allowed disabled:opacity-40',
                buying
                  ? 'bg-status-success text-text-on-accent'
                  : 'bg-status-danger text-white'
              )}
              disabled={busy || (unverified && !checked)}
              onClick={() => void confirm()}
              type="button"
            >
              {busy
                ? tr('take.starting', 'Starting…')
                : buying
                  ? tr('take.confirmBuy', 'Confirm purchase')
                  : tr('take.confirmSell', 'Confirm sale')}
            </button>
          </>
        )}

        {started && (
          <>
            <Steps steps={steps} />
            {p.failures.length > 0 && (
              <div className="flex flex-col gap-1 rounded-xl bg-status-danger-subtle p-3 text-caption text-content-primary">
                <p className="font-medium">
                  {p.stage === 'failed'
                    ? tr('take.allFailed', 'The swap did not complete.')
                    : tr(
                        'take.someFailed',
                        '{{n}} of {{total}} swaps could not start. The others carry on.',
                        { n: p.failures.length, total: mine.length }
                      )}
                </p>
                {[
                  ...new Set(
                    p.failures.map((f) =>
                      failureKind(f.error) === 'funds' ? 'funds' : f.error
                    )
                  ),
                ].map((e) => (
                  <p className="text-content-secondary" key={e}>
                    {e === 'funds'
                      ? tr(
                          'take.noCoin',
                          'Each swap spends its own coin, and your other swap is still using the only one you have. Try again once it has settled, or split your bitcoin first.'
                        )
                      : e || tr('take.failed', 'The swap did not complete.')}
                  </p>
                ))}
                <p className="text-content-tertiary">
                  {tr(
                    'take.nothingSpent',
                    'Nothing was spent: the transaction is only sent once both sides have signed.'
                  )}
                </p>
              </div>
            )}
            {p.txids.length > 0 && (
              <button
                className="flex items-center justify-center gap-2 text-caption text-content-secondary hover:text-content-primary"
                onClick={() => copy(p.txids.join('\n'))}
                type="button"
              >
                <Copy aria-hidden size={12} />{' '}
                {tr('take.copyTx', 'Copy transaction ID')}
              </button>
            )}
            <button
              className="rounded-xl bg-surface-raised py-3 text-body font-medium text-content-primary hover:bg-surface-high"
              onClick={onClose}
              type="button"
            >
              {done || p.stage === 'failed'
                ? tr('take.close', 'Close')
                : tr('take.background', 'Keep going in the background')}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
