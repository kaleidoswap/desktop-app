import { ReactNode } from 'react'
import { twJoin } from 'tailwind-merge'

type LiquidityCardTone = 'amber' | 'emerald' | 'violet' | 'cyan' | 'neutral'

interface LiquidityCardProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  action?: ReactNode
  meta?: ReactNode
  tone?: LiquidityCardTone
  className?: string
  children: ReactNode
}

const toneClasses: Record<
  LiquidityCardTone,
  {
    border: string
    glow: string
    icon: string
  }
> = {
  amber: {
    border:
      'border-amber-400/20 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]',
    glow: 'from-amber-400/35 via-amber-300/10 to-transparent',
    icon: 'bg-amber-400/12 text-amber-300 ring-1 ring-amber-400/20',
  },
  emerald: {
    border:
      'border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.12),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]',
    glow: 'from-emerald-400/35 via-emerald-300/10 to-transparent',
    icon: 'bg-emerald-400/12 text-emerald-300 ring-1 ring-emerald-400/20',
  },
  violet: {
    border:
      'border-violet-400/20 bg-[radial-gradient(circle_at_top_left,rgba(167,139,250,0.14),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]',
    glow: 'from-violet-400/35 via-violet-300/10 to-transparent',
    icon: 'bg-violet-400/12 text-violet-300 ring-1 ring-violet-400/20',
  },
  cyan: {
    border:
      'border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]',
    glow: 'from-cyan-400/35 via-sky-300/10 to-transparent',
    icon: 'bg-cyan-400/12 text-cyan-300 ring-1 ring-cyan-400/20',
  },
  neutral: {
    border:
      'border-border-subtle bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]',
    glow: 'from-primary/20 via-primary/5 to-transparent',
    icon: 'bg-surface-overlay text-content-primary ring-1 ring-border-subtle',
  },
}

export function LiquidityCard({
  title,
  subtitle,
  icon,
  action,
  meta,
  tone = 'neutral',
  className,
  children,
}: LiquidityCardProps) {
  const styles = toneClasses[tone]

  return (
    <section
      className={twJoin(
        'relative overflow-hidden rounded-2xl border p-4 md:p-5 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.65)]',
        styles.border,
        className
      )}
    >
      <div
        className={twJoin(
          'pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b opacity-80',
          styles.glow
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-3">
          {icon && (
            <div
              className={twJoin(
                'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl backdrop-blur-sm',
                styles.icon
              )}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-content-primary">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <div className="relative z-10 flex flex-shrink-0 items-start gap-2">
          {meta}
          {action}
        </div>
      </div>

      <div className="relative mt-4 space-y-4">{children}</div>
    </section>
  )
}
