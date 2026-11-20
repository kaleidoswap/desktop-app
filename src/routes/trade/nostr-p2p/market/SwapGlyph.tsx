import { useTr } from './hooks'
import { cx } from './ui'

export type Phase =
  'idle' | 'requested' | 'signing' | 'confirming' | 'settled' | 'failed'

interface Props {
  phase: Phase
  /** What you hand over and what you get, as written in the receipt ("53,000 sats", "1,000 USDT"). */
  send: string
  receive: string
  fee: string
  counterparty: string
  /** Confirmations on the swap transaction, or null before it is broadcast. */
  confirmations: number | null
  required: number
}

const STYLE = `
@keyframes swt-travel { from { transform: translateX(0); opacity: 0 } 10% { opacity: 1 } 90% { opacity: 1 } to { transform: translateX(268px); opacity: 0 } }
@keyframes swt-scan { from { transform: translateY(0); opacity: 0 } 15% { opacity: .9 } 85% { opacity: .9 } to { transform: translateY(150px); opacity: 0 } }
@keyframes swt-flow { to { stroke-dashoffset: -24 } }
@keyframes swt-breathe { 0%, 100% { opacity: .55 } 50% { opacity: 1 } }
@keyframes swt-pop { 0% { transform: scale(.4); opacity: 0 } 70% { transform: scale(1.15); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
@keyframes swt-ring { 0% { transform: scale(.9); opacity: .7 } 100% { transform: scale(1.7); opacity: 0 } }
.swt-travel { animation: swt-travel 1.8s ease-in-out infinite }
.swt-scan { animation: swt-scan 2.2s ease-in-out infinite }
.swt-flow { animation: swt-flow 1.1s linear infinite }
.swt-breathe { animation: swt-breathe 1.6s ease-in-out infinite }
.swt-pop { animation: swt-pop .5s cubic-bezier(.16,1,.3,1) both; transform-box: fill-box; transform-origin: center }
.swt-ring { animation: swt-ring 1.6s ease-out infinite; transform-box: fill-box; transform-origin: center }
@media (prefers-reduced-motion: reduce) { .swt-travel, .swt-scan, .swt-flow, .swt-breathe, .swt-ring { animation: none } }
`

/**
 * The idea of the product in one picture: what you send and what the other side sends meet in a
 * single Bitcoin transaction, so both happen or neither does. The picture follows the swap: the
 * request goes out, both sides sign, the transaction collects confirmations, the outputs land.
 */
export function SwapGlyph({
  phase,
  send,
  receive,
  fee,
  counterparty,
  confirmations,
  required,
}: Props) {
  const tr = useTr()
  const live = phase !== 'idle'
  const signing = phase === 'signing'
  const confirming = phase === 'confirming'
  const settled = phase === 'settled'
  const failed = phase === 'failed'
  const requested = phase === 'requested'
  const tone = failed
    ? 'text-status-danger'
    : settled
      ? 'text-status-success'
      : live
        ? 'text-primary'
        : 'text-content-tertiary'
  const pips = Math.max(required, 1)
  const filled = settled ? pips : Math.min(confirmations ?? 0, pips)
  const lit = signing || confirming || settled
  const rowOpacity = lit ? 1 : 0.4

  const caption = failed
    ? tr('glyph.failed', 'The swap did not go through. Nothing was spent.')
    : settled
      ? tr('glyph.settled', 'Both sides received what they were owed')
      : confirming
        ? tr('glyph.confirming', 'On Bitcoin, waiting for confirmations')
        : signing
          ? tr('glyph.signing', 'Checking the proof, then signing')
          : requested
            ? tr('glyph.requested', 'Asking {{who}}', { who: counterparty })
            : tr(
                'glyph.idle',
                'Both sides move in one transaction, or neither does'
              )

  const party = (x: number, label: string, glow: boolean) => (
    <g transform={`translate(${x} 118)`}>
      {glow && (
        <circle className="swt-ring" fill="none" r="20" stroke="currentColor" />
      )}
      <circle
        className={cx(glow && 'swt-breathe')}
        fill="currentColor"
        fillOpacity=".12"
        r="20"
        stroke="currentColor"
        strokeOpacity={glow ? 0.9 : 0.35}
      />
      <text
        fill="currentColor"
        fontSize="10"
        fontWeight="600"
        textAnchor="middle"
        y="4"
      >
        {label.slice(0, 3).toUpperCase()}
      </text>
    </g>
  )

  const row = (y: number, who: string, what: string, done: boolean) => (
    <g key={`${y}${who}`} opacity={rowOpacity}>
      <text className="fill-current" fontSize="10" opacity=".6" y={y - 11}>
        {who}
      </text>
      <text className="fill-current" fontSize="12.5" fontWeight="600" y={y + 4}>
        {what.length > 15 ? `${what.slice(0, 14)}…` : what}
      </text>
      {done && (
        <g
          className="text-status-success"
          transform={`translate(104 ${y - 6})`}
        >
          <g className="swt-pop">
            <circle fill="currentColor" fillOpacity=".18" r="7" />
            <path
              d="M-3.2 .2 L-.9 2.6 L3.4 -2.4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </g>
        </g>
      )}
    </g>
  )

  return (
    <div
      className={cx(
        'flex flex-col items-center gap-2 rounded-2xl bg-surface-inset px-3 pb-3 pt-4',
        tone
      )}
    >
      <style>{STYLE}</style>
      <svg
        aria-label={tr(
          'glyph.aria',
          'One Bitcoin transaction carries both sides of the swap'
        )}
        className="w-full max-w-[560px] text-content-primary"
        role="img"
        viewBox="0 0 440 236"
      >
        <g className={tone}>
          {party(34, tr('glyph.you', 'You'), live && !settled && !failed)}
          {party(
            406,
            counterparty || tr('glyph.maker', 'Maker'),
            live && !settled && !failed
          )}
          <line
            className={cx(live && !failed && !settled && !lit && 'swt-flow')}
            stroke="currentColor"
            strokeDasharray="4 8"
            strokeOpacity=".35"
            strokeWidth="1.5"
            x1="58"
            x2="84"
            y1="118"
            y2="118"
          />
          <line
            className={cx(live && !failed && !settled && !lit && 'swt-flow')}
            stroke="currentColor"
            strokeDasharray="4 8"
            strokeOpacity=".35"
            strokeWidth="1.5"
            x1="356"
            x2="382"
            y1="118"
            y2="118"
          />
          {requested && (
            <circle
              className="swt-travel"
              cx="64"
              cy="118"
              fill="currentColor"
              r="4"
            />
          )}
        </g>

        <g>
          <rect
            className={cx(tone, requested && 'swt-flow')}
            fill="currentColor"
            fillOpacity=".06"
            height="184"
            rx="16"
            stroke="currentColor"
            strokeDasharray={lit ? undefined : '6 6'}
            strokeOpacity={lit ? 0.9 : 0.5}
            strokeWidth={lit ? 2 : 1.5}
            width="272"
            x="84"
            y="26"
          />
          <text
            className="fill-current text-content-primary"
            fontSize="11.5"
            fontWeight="600"
            textAnchor="middle"
            x="220"
            y="50"
          >
            {tr('glyph.tx', 'One Bitcoin transaction')}
          </text>

          {signing && (
            <rect
              className={cx('swt-scan', tone)}
              fill="currentColor"
              fillOpacity=".5"
              height="2"
              rx="1"
              width="248"
              x="96"
              y="62"
            />
          )}

          <g className="text-content-primary" transform="translate(100 0)">
            <text className="fill-current" fontSize="9.5" opacity=".5" y="74">
              {tr('glyph.in', 'IN')}
            </text>
            {row(100, tr('glyph.you', 'You'), send, false)}
            {row(
              140,
              counterparty || tr('glyph.maker', 'Maker'),
              receive,
              false
            )}
          </g>
          <g className="text-content-primary" transform="translate(228 0)">
            <text className="fill-current" fontSize="9.5" opacity=".5" y="74">
              {tr('glyph.out', 'OUT')}
            </text>
            {row(
              100,
              counterparty || tr('glyph.maker', 'Maker'),
              send,
              settled
            )}
            {row(140, tr('glyph.you', 'You'), receive, settled)}
            {row(180, tr('glyph.feeTo', 'Fee'), fee, settled)}
          </g>
          <path
            className={tone}
            d="M208 108 h10 m-4 -4 l4 4 l-4 4"
            fill="none"
            opacity={rowOpacity}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </g>
      </svg>

      <div
        aria-hidden={!confirming && !settled}
        className="flex h-4 items-center gap-1"
      >
        {(confirming || settled) &&
          Array.from({ length: pips }, (_, i) => (
            <span
              aria-label={i === 0 ? `${filled} / ${pips}` : undefined}
              className={cx(
                'h-1.5 w-6 rounded-full transition-colors duration-500',
                i < filled ? 'bg-current' : 'bg-content-tertiary/30'
              )}
              key={i}
            />
          ))}
      </div>
      <p className="text-center text-caption text-content-secondary">
        {caption}
      </p>
    </div>
  )
}
