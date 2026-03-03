import { Check } from 'lucide-react'
import React from 'react'

export interface Step {
  id: string
  label: string
  active?: boolean
  completed?: boolean
}

interface StepIndicatorProps {
  steps: Step[]
  currentStep: string
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  currentStep,
}) => {
  // Process steps to ensure active and completed states are set correctly
  const processedSteps = steps.map((step, index) => {
    const currentStepIndex = steps.findIndex((s) => s.id === currentStep)
    return {
      ...step,
      active: step.id === currentStep,
      completed: index < currentStepIndex,
    }
  })

  return (
    <div className="w-full">
      {/* Horizontal layout for all screen sizes */}
      <div className="flex items-center justify-between px-2">
        {processedSteps.map((step, index) => (
          <React.Fragment key={step.id}>
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center
                          transition-all duration-300
                          ${
                            step.completed
                              ? 'bg-cyan text-blue-darkest shadow-lg shadow-primary/20'
                              : step.active
                                ? 'bg-primary/20 border-2 border-cyan text-primary shadow-lg shadow-primary/10'
                                : 'bg-surface-overlay/50 border-2 border-border-default/50 text-content-tertiary'
                          }`}
              >
                {step.completed ? (
                  <Check className="w-4 h-4 md:w-5 md:h-5" />
                ) : (
                  <span className="text-xs md:text-sm font-medium">
                    {index + 1}
                  </span>
                )}
              </div>
              {/* Step Label */}
              <span
                className={`mt-2 text-xs font-medium transition-all duration-300
                          ${
                            step.active
                              ? 'text-primary'
                              : step.completed
                                ? 'text-content-secondary'
                                : 'text-content-tertiary'
                          }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector Line (except after the last step) */}
            {index < steps.length - 1 && (
              <div
                className={`h-[2px] flex-1 mx-2 md:mx-4 transition-all duration-500
                          ${step.completed ? 'bg-cyan' : 'bg-surface-high/50'}`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
