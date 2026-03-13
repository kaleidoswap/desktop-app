import { DcaExecution } from '../../../../slices/dcaSlice'

interface Props {
  executions: DcaExecution[]
}

const W = 560
const H = 140
const PAD = { top: 12, right: 16, bottom: 28, left: 52 }

function formatSats(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

export function DcaHistoryChart({ executions }: Props) {
  const successes = executions.filter((e) => e.status === 'success')
  if (successes.length < 2) return null

  // Build cumulative BTC sats over time
  let cumSats = 0
  const points = successes.map((e) => {
    cumSats += e.toAmountSats
    return { cumSats, price: e.priceBtcUsdt, ts: e.timestamp }
  })

  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const minTs = points[0].ts
  const maxTs = points[points.length - 1].ts
  const tsRange = maxTs - minTs || 1

  const prices = points.map((p) => p.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const priceRange = maxPrice - minPrice || 1

  const toX = (ts: number) => PAD.left + ((ts - minTs) / tsRange) * chartW
  const toPriceY = (p: number) =>
    PAD.top + ((maxPrice - p) / priceRange) * chartH

  // Price line
  const pricePath = points
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'} ${toX(p.ts).toFixed(1)} ${toPriceY(p.price).toFixed(1)}`
    )
    .join(' ')

  // Area under price line
  const firstX = toX(points[0].ts)
  const lastX = toX(points[points.length - 1].ts)
  const bottomY = PAD.top + chartH
  const areaPath = `${pricePath} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`

  // Y axis ticks (price)
  const priceTicks = [minPrice, (minPrice + maxPrice) / 2, maxPrice]

  // X axis: first & last date
  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-content-tertiary px-1">
        <span>BTC buy price history</span>
        <span className="text-content-secondary font-medium">
          Total: {formatSats(cumSats)} sats
        </span>
      </div>

      <svg
        className="w-full overflow-visible"
        style={{ maxWidth: W }}
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Gradient */}
        <defs>
          <linearGradient id="dcaGrad" x1="0" x2="0" y1="0" y2="1">
            <stop
              offset="0%"
              stopColor="rgb(var(--color-primary))"
              stopOpacity="0.25"
            />
            <stop
              offset="100%"
              stopColor="rgb(var(--color-primary))"
              stopOpacity="0.02"
            />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {priceTicks.map((tick, i) => (
          <line
            key={i}
            stroke="rgb(var(--color-border-subtle))"
            strokeOpacity="0.4"
            strokeWidth="1"
            x1={PAD.left}
            x2={PAD.left + chartW}
            y1={toPriceY(tick)}
            y2={toPriceY(tick)}
          />
        ))}

        {/* Price area fill */}
        <path d={areaPath} fill="url(#dcaGrad)" />

        {/* Price line */}
        <path
          d={pricePath}
          fill="none"
          stroke="rgb(var(--color-primary))"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />

        {/* Buy dots */}
        {points.map((p, i) => (
          <circle
            cx={toX(p.ts)}
            cy={toPriceY(p.price)}
            fill="rgb(var(--color-primary))"
            key={i}
            r="3.5"
            stroke="rgb(var(--color-surface-base))"
            strokeWidth="1.5"
          />
        ))}

        {/* Y axis labels */}
        {priceTicks.map((tick, i) => (
          <text
            dominantBaseline="middle"
            fill="rgb(var(--color-content-tertiary))"
            fontSize="9"
            key={i}
            textAnchor="end"
            x={PAD.left - 6}
            y={toPriceY(tick)}
          >
            ${tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick.toFixed(0)}
          </text>
        ))}

        {/* X axis labels */}
        <text
          dominantBaseline="hanging"
          fill="rgb(var(--color-content-tertiary))"
          fontSize="9"
          textAnchor="start"
          x={PAD.left}
          y={PAD.top + chartH + 6}
        >
          {formatDate(points[0].ts)}
        </text>
        <text
          dominantBaseline="hanging"
          fill="rgb(var(--color-content-tertiary))"
          fontSize="9"
          textAnchor="end"
          x={PAD.left + chartW}
          y={PAD.top + chartH + 6}
        >
          {formatDate(points[points.length - 1].ts)}
        </text>
      </svg>
    </div>
  )
}
