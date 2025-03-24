import { ArrowLeft, XCircle } from 'lucide-react'

import { Button } from '../ui'

interface UnlockingProgressProps {
  isUnlocking: boolean
  errorMessage?: string
  onBack?: () => void
  onCancel?: () => void
}

export const UnlockingProgress = ({
  isUnlocking,
  errorMessage,
  onBack,
  onCancel,
}: UnlockingProgressProps) => {
  const steps = [
    { title: 'Decrypting wallet' },
    { title: 'Synchronizing Bitcoin blockchain' },
    { title: 'Connecting to RGB proxy' },
    { title: 'Connecting to Lightning' },
  ]

  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="w-full max-w-2xl flex flex-col items-center">
        {/* Animated Progress Ring with Gradient */}
        <div className="relative w-28 h-28 mb-8">
          {/* Outer static ring */}
          <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20" />

          {/* Spinning gradient ring */}
          <div
            className={`absolute inset-0 rounded-full border-4 border-transparent ${errorMessage ? 'border-t-red-400 border-r-red-500' : 'border-t-cyan-400 border-r-cyan-500'} animate-[spin_3s_linear_infinite]`}
          />

          {/* Inner pulsing circle */}
          <div className="absolute inset-0 m-auto w-14 h-14">
            <div
              className={`w-full h-full rounded-full ${errorMessage ? 'bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/30' : 'bg-gradient-to-br from-cyan-400 to-blue-500 shadow-cyan-500/30'} animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] shadow-lg flex items-center justify-center`}
            >
              {errorMessage ? (
                <XCircle className="w-7 h-7 text-red-100" />
              ) : (
                <svg
                  className="w-7 h-7 text-blue-900"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 15V3m0 12l-4-4m4 4l4-4M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* Status Text and Steps */}
        <div className="text-center space-y-6 w-full">
          <h3 className="text-2xl font-medium text-white">
            {errorMessage
              ? 'Error Unlocking Wallet'
              : isUnlocking
                ? 'Unlocking wallet...'
                : 'Verifying recovery phrase...'}
          </h3>

          {/* Error Message Display */}
          {errorMessage && (
            <div className="p-4 rounded-lg bg-red-900/30 border border-red-500/20 text-red-200 animate-[fadeIn_0.5s_ease-out] max-w-xl mx-auto">
              <p>{errorMessage}</p>
            </div>
          )}

          {isUnlocking && !errorMessage && (
            <div className="space-y-4 animate-[fadeIn_0.5s_ease-out] max-w-xl mx-auto">
              <div className="grid grid-cols-2 gap-4">
                {steps.map((step, index) => (
                  <div
                    className="flex items-center space-x-3 p-3.5 rounded-lg bg-gradient-to-r from-transparent to-cyan-500/5 backdrop-blur-sm border border-cyan-500/10 animate-[slideInRight_0.5s_ease-out]"
                    key={step.title}
                    style={{ animationDelay: `${index * 150}ms` }}
                  >
                    {/* Progress indicator */}
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-[pulse_2s_infinite]" />

                    {/* Step title */}
                    <span className="text-sm text-gray-200 font-medium">
                      {step.title}
                    </span>
                  </div>
                ))}
              </div>

              {/* Note card */}
              <div
                className="mt-6 p-4 rounded-lg bg-blue-900/30 border border-cyan-500/10 text-sm text-gray-400 animate-[fadeIn_0.5s_ease-out]"
                style={{ animationDelay: '600ms' }}
              >
                <p>
                  Please keep the application open while we complete the setup.
                </p>
                <p className="mt-2">
                  Note: If your node has been offline for some time,
                  synchronization may take a few minutes.
                </p>
              </div>
            </div>
          )}

          {(onBack || onCancel) && (
            <div
              className="mt-8 flex justify-center gap-4 animate-[fadeIn_0.5s_ease-out]"
              style={{ animationDelay: '800ms' }}
            >
              {onBack && (
                <Button
                  icon={<ArrowLeft className="w-4 h-4" />}
                  iconPosition="left"
                  onClick={onBack}
                  variant="outline"
                >
                  Back to Setup
                </Button>
              )}

              {onCancel && (
                <Button
                  icon={<XCircle className="w-4 h-4" />}
                  iconPosition="left"
                  onClick={onCancel}
                  variant={errorMessage ? 'outline' : 'danger'}
                >
                  {errorMessage ? 'Try Again' : 'Cancel'}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
