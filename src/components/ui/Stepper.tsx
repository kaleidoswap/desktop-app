import { Check } from 'lucide-react'
import React from 'react'

interface StepperProps {
  steps: {
    label: string
    completed: boolean
  }[]
  currentStep: number
}

export const Stepper: React.FC<StepperProps> = ({ steps, currentStep }) => {
  return (
    <div className="flex items-center w-full">
      {steps.map((step, index) => {
        const isActive = index + 1 === currentStep
        const isCompleted = step.completed

        return (
          <React.Fragment key={index}>
            {/* Step circle */}
            <div className="relative flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  isCompleted
                    ? 'bg-blue-500 border-blue-500'
                    : isActive
                      ? 'border-blue-500 bg-transparent'
                      : 'border-border-default bg-transparent'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4 text-white" />
                ) : (
                  <span
                    className={`text-sm font-medium ${
                      isActive ? 'text-blue-500' : 'text-content-tertiary'
                    }`}
                  >
                    {index + 1}
                  </span>
                )}
              </div>
              <div
                className={`absolute top-10 whitespace-nowrap text-xs font-medium ${
                  isActive || isCompleted ? 'text-blue-500' : 'text-content-tertiary'
                }`}
              >
                {step.label}
              </div>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 ${
                  steps[index].completed ? 'bg-primary' : 'bg-surface-elevated'
                }`}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
