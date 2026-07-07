import { Check } from 'lucide-react'
import { Fragment } from 'react'

interface ChannelWizardStepsProps {
  /** Ordered, already-translated step labels. */
  steps: string[]
  /** 1-based index of the active step. */
  current: number
  className?: string
}

/**
 * Compact progress indicator for the multi-step channel wizards (Open Channel /
 * Buy Channel). Renders a numbered circle per step joined by a fill bar that
 * advances as steps complete. Purely presentational — the parent owns `current`.
 */
export const ChannelWizardSteps = ({
  steps,
  current,
  className = '',
}: ChannelWizardStepsProps) => (
  <div className={`flex items-start ${className}`}>
    {steps.map((label, index) => {
      const stepNumber = index + 1
      const isDone = current > stepNumber
      const isActive = current === stepNumber
      const isLast = index === steps.length - 1

      return (
        <Fragment key={label}>
          <div className="flex flex-col items-center gap-1.5 w-16 sm:w-20 flex-shrink-0">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors duration-300 ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : isDone
                    ? 'bg-primary/20 text-primary'
                    : 'bg-surface-high text-content-tertiary'
              }`}
            >
              {isDone ? <Check className="h-4 w-4" /> : stepNumber}
            </div>
            <span
              className={`text-center text-[11px] leading-tight transition-colors duration-300 ${
                isActive
                  ? 'font-medium text-white'
                  : isDone
                    ? 'text-content-secondary'
                    : 'text-content-tertiary'
              }`}
            >
              {label}
            </span>
          </div>

          {!isLast && (
            <div className="mt-4 h-0.5 flex-1 overflow-hidden rounded-full bg-surface-high">
              <div
                className={`h-full rounded-full bg-primary transition-all duration-300 ${
                  isDone ? 'w-full' : 'w-0'
                }`}
              />
            </div>
          )}
        </Fragment>
      )
    })}
  </div>
)
