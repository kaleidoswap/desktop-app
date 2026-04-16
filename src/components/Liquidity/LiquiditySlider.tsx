import { useEffect, useRef, useState } from 'react'
import { twJoin } from 'tailwind-merge'

interface LiquiditySliderProps {
  value: number
  min: number
  max: number
  step?: number
  outboundLabel: string
  inboundLabel: string
  outboundColor: string
  inboundColor: string
  thumbBorderClass: string
  unit?: string
  inputTextClass?: string
  inputFocusClass?: string
  showInput?: boolean
  inputLabel?: string
  inputHint?: string
  minLabel?: string
  maxLabel?: string
  onChange: (value: number) => void
}

export function LiquiditySlider({
  value,
  min,
  max,
  step = 1,
  outboundLabel,
  inboundLabel,
  outboundColor,
  inboundColor,
  thumbBorderClass,
  unit,
  inputTextClass = 'text-content-primary',
  inputFocusClass = 'focus:border-primary',
  showInput = true,
  inputLabel = 'Available to send now',
  inputHint = 'Drag the handle or type the exact amount.',
  minLabel,
  maxLabel,
  onChange,
}: LiquiditySliderProps) {
  const safeMax = Math.max(min, max)
  const range = safeMax - min || 1
  const clamped = Math.min(safeMax, Math.max(min, value))
  const outPct = ((clamped - min) / range) * 100

  // Local string state so intermediate typing (e.g. "1." or "0.0") isn't destroyed
  const [inputText, setInputText] = useState(clamped.toString())
  const isFocused = useRef(false)

  // Sync from prop when not actively typing (slider drag, Max button, parent change)
  useEffect(() => {
    if (!isFocused.current) {
      setInputText(clamped.toString())
    }
  }, [clamped])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border-subtle/70 bg-surface-base/35 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-content-tertiary">
            {inputLabel}
          </div>
          {showInput && unit !== undefined ? (
            <div className="mt-2 flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  className={twJoin(
                    'h-10 w-full rounded-xl border border-border-default bg-background px-3 pr-14 text-left text-sm font-semibold outline-none transition-colors',
                    inputFocusClass,
                    inputTextClass
                  )}
                  max={safeMax}
                  min={min}
                  onBlur={(e) => {
                    isFocused.current = false
                    const val = parseFloat(e.target.value)
                    if (!isNaN(val)) {
                      const final = Math.min(safeMax, Math.max(min, val))
                      onChange(final)
                      setInputText(final.toString())
                    } else {
                      setInputText(clamped.toString())
                    }
                  }}
                  onChange={(e) => {
                    setInputText(e.target.value)
                    const val = parseFloat(e.target.value)
                    if (!isNaN(val)) {
                      onChange(Math.min(safeMax, Math.max(min, val)))
                    }
                  }}
                  onFocus={() => {
                    isFocused.current = true
                    setInputText(clamped.toString())
                  }}
                  step="any"
                  type="number"
                  value={isFocused.current ? inputText : clamped}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-content-tertiary">
                  {unit}
                </span>
              </div>
              <button
                className="rounded-lg border border-border-default/60 bg-surface-overlay/60 px-2 py-1 text-[11px] font-semibold text-content-secondary transition-colors hover:border-border-default hover:text-content-primary"
                onClick={() => onChange(safeMax)}
                type="button"
              >
                Max
              </button>
            </div>
          ) : (
            <div className="mt-1 text-sm font-semibold text-content-primary">
              {outboundLabel}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border-subtle/70 bg-surface-base/35 px-3 py-2 text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-content-tertiary">
            Can receive
          </div>
          <div className="mt-1 text-sm font-semibold text-content-primary">
            {inboundLabel}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border-subtle/70 bg-surface-base/30 px-3 py-4">
        <div className="mb-3 flex items-center justify-between gap-3 text-[11px]">
          <div className="min-w-0">
            <span className="font-semibold uppercase tracking-[0.14em] text-content-tertiary">
              Outbound
            </span>
            <span className="ml-2 font-semibold text-content-primary">
              {outboundLabel}
            </span>
          </div>
          <div className="min-w-0 text-right">
            <span className="font-semibold uppercase tracking-[0.14em] text-content-tertiary">
              Inbound
            </span>
            <span className="ml-2 font-semibold text-content-primary">
              {inboundLabel}
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="absolute left-0 right-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full border border-border-subtle/60 bg-surface-overlay/75 p-[3px]">
            <div className="flex h-full overflow-hidden rounded-full bg-surface-base/50">
              <div
                className={twJoin(outboundColor, 'transition-all duration-150')}
                style={{ width: `${outPct}%` }}
              />
              <div
                className={twJoin(inboundColor, 'transition-all duration-150')}
                style={{ width: `${100 - outPct}%` }}
              />
            </div>
          </div>

          <div
            className={twJoin(
              'absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white shadow-lg shadow-black/30 transition-[left] duration-150',
              thumbBorderClass
            )}
            style={{ left: `${outPct}%` }}
          />

          <input
            className="relative z-20 h-8 w-full cursor-pointer opacity-0"
            max={safeMax}
            min={min}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            step={step}
            style={{ WebkitAppearance: 'none', appearance: 'none' }}
            type="range"
            value={clamped}
          />
        </div>

        {(minLabel || maxLabel) && (
          <div className="mt-3 flex justify-between text-[10px] text-content-tertiary">
            <span>{minLabel ?? ''}</span>
            <span>{maxLabel ?? ''}</span>
          </div>
        )}
        {inputHint && (
          <div className="mt-3 rounded-xl border border-border-subtle/60 bg-surface-overlay/40 px-3 py-2 text-[11px] leading-relaxed text-content-secondary">
            {inputHint}
          </div>
        )}
      </div>
    </div>
  )
}
