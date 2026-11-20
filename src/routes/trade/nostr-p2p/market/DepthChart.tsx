import type { Order } from '../api'
import { splitBook, withDepth } from '../book'
import { fmtPrice } from '../format'

import { useTr } from './hooks'

const W = 640
const H = 150

/** Cumulative depth: bids stepping left from the best bid, asks stepping right from the best ask. */
export function DepthChart({
  orders,
  ticker,
  loading = false,
}: {
  orders: Order[]
  ticker: string
  loading?: boolean
}) {
  const tr = useTr()
  const { asks, bids } = splitBook(orders)
  if (loading && !asks.length && !bids.length) {
    return (
      <div className="flex h-full min-h-36 items-center justify-center text-caption text-content-tertiary">
        {tr('depth.loading', 'Loading depth…')}
      </div>
    )
  }
  if (!asks.length && !bids.length) {
    return (
      <div className="flex h-full min-h-36 items-center justify-center text-caption text-content-tertiary">
        {tr('depth.empty', 'The depth chart fills in as orders arrive.')}
      </div>
    )
  }
  const A = withDepth(asks).map((r) => ({ c: r.cum, p: r.order.unit_price }))
  const B = withDepth(bids).map((r) => ({ c: r.cum, p: r.order.unit_price }))
  const all = [...A, ...B]
  const pMin = Math.min(...all.map((x) => x.p))
  const pMax = Math.max(...all.map((x) => x.p))
  const span = Math.max(pMax - pMin, pMax * 0.02, 1e-9)
  const lo = pMin - span * 0.2
  const hi = pMax + span * 0.2
  const cMax = Math.max(...all.map((x) => x.c)) * 1.12
  const X = (p: number) => ((p - lo) / (hi - lo)) * W
  const Y = (c: number) => H - (c / cMax) * (H - 12)

  const area = (rows: { p: number; c: number }[], edge: number) => {
    const first = rows[0]
    if (!first) return ''
    let d = `M ${X(first.p)} ${H} L ${X(first.p)} ${Y(first.c)}`
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1]!
      const cur = rows[i]!
      d += ` L ${X(cur.p)} ${Y(prev.c)} L ${X(cur.p)} ${Y(cur.c)}`
    }
    const last = rows[rows.length - 1]!
    return `${d} L ${edge} ${Y(last.c)} L ${edge} ${H} Z`
  }
  const bestBid = B[0]?.p
  const bestAsk = A[0]?.p
  const mid =
    bestBid !== undefined && bestAsk !== undefined
      ? (bestBid + bestAsk) / 2
      : undefined

  return (
    <svg
      aria-label={tr('depth.label', 'Depth chart for {{ticker}}', { ticker })}
      className="h-full min-h-40 w-full"
      preserveAspectRatio="none"
      role="img"
      viewBox={`0 0 ${W} ${H + 20}`}
    >
      <path
        className="fill-status-success/20 stroke-status-success"
        d={area(B, 0)}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <path
        className="fill-status-danger/20 stroke-status-danger"
        d={area(A, W)}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      {mid !== undefined && (
        <line
          className="stroke-content-tertiary"
          strokeDasharray="3 4"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          x1={X(mid)}
          x2={X(mid)}
          y1={0}
          y2={H}
        />
      )}
      <text className="fill-content-tertiary text-tiny" x={4} y={H + 15}>
        {fmtPrice(lo)}
      </text>
      <text
        className="fill-content-tertiary text-tiny"
        textAnchor="end"
        x={W - 4}
        y={H + 15}
      >
        {fmtPrice(hi)}
      </text>
    </svg>
  )
}
