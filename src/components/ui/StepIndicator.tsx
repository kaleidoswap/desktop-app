import { Check } from 'lucide-react'
import React from 'react'

interface StepIndicatorProps {
  steps: string[]
  currentStep: number
  className?: string
}

/**
 * Step indicator for multi-step forms
 */
export const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  currentStep,
  className = '',
}) => {
  return (
    <div className={`flex items-center justify-center w-full ${className}`}>
      {steps.map((step, index) => {
        const isActive = index === currentStep
        const isCompleted = index < currentStep
        const isLast = index === steps.length - 1

        return (
          <React.Fragment key={index}>
            <div className="flex flex-col items-center">
              <div
                className={`
                  flex items-center justify-center w-8 h-8 rounded-full
                  transition-all duration-200 border-2
                  ${
                    isActive
                      ? 'bg-primary/20 border-cyan text-primary'
                      : isCompleted
                        ? 'bg-cyan border-cyan text-surface-base'
                        : 'bg-surface-overlay/50 border-border-default/50 text-content-tertiary'
                  }
                `}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>
              <span
                className={`
                  mt-2 text-xs font-medium
                  ${
                    isActive
                      ? 'text-primary'
                      : isCompleted
                        ? 'text-white'
                        : 'text-content-tertiary'
                  }
                `}
              >
                {step}
              </span>
            </div>

            {!isLast && (
              <div
                className={`
                  flex-1 h-0.5 mx-2
                  ${index < currentStep ? 'bg-cyan' : 'bg-border-default/50'}
                `}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

/**
 * Vertical step indicator for multi-step forms
 */
export const VerticalStepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  currentStep,
  className = '',
}) => {
  return (
    <div className={`flex flex-col ${className}`}>
      {steps.map((step, index) => {
        const isActive = index === currentStep
        const isCompleted = index < currentStep
        const isLast = index === steps.length - 1

        return (
          <div className="flex" key={index}>
            <div className="flex flex-col items-center mr-4">
              <div
                className={`
                  flex items-center justify-center w-8 h-8 rounded-full
                  transition-all duration-200 border-2
                  ${
                    isActive
                      ? 'bg-primary/20 border-cyan text-primary'
                      : isCompleted
                        ? 'bg-cyan border-cyan text-surface-base'
                        : 'bg-surface-overlay/50 border-border-default/50 text-content-tertiary'
                  }
                `}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>

              {!isLast && (
                <div
                  className={`
                    w-0.5 h-full my-1
                    ${index < currentStep ? 'bg-cyan' : 'bg-border-default/50'}
                  `}
                />
              )}
            </div>

            <div className={`pb-8 ${isLast ? '' : 'mb-2'}`}>
              <h4
                className={`
                  font-medium mb-1
                  ${
                    isActive
                      ? 'text-primary'
                      : isCompleted
                        ? 'text-white'
                        : 'text-content-tertiary'
                  }
                `}
              >
                {step}
              </h4>
            </div>
          </div>
        )
      })}
    </div>
  )
}
