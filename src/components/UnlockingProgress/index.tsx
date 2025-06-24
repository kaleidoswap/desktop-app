import { ArrowLeft, XCircle, Shield, CheckCircle2, Loader2 } from 'lucide-react'

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
    { icon: Shield, status: 'completed', title: 'Decrypting wallet' },
    {
      icon: Loader2,
      status: 'current',
      title: 'Synchronizing Bitcoin blockchain',
    },
    { icon: CheckCircle2, status: 'pending', title: 'Connecting to RGB proxy' },
    { icon: CheckCircle2, status: 'pending', title: 'Connecting to Lightning' },
  ]

  // Dynamically calculate active progress line width (for desktop view)
  let progressPosition = steps.findIndex((s) => s.status === 'current')
  if (progressPosition === -1) {
    // Fallback to last completed step
    const lastCompleted = Math.max(
      ...steps.map((s, i) => (s.status === 'completed' ? i : -1))
    )
    progressPosition = lastCompleted
  }
  const progressPercentage =
    progressPosition <= 0 ? 0 : (progressPosition / (steps.length - 1)) * 100

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-4 flex flex-col items-center justify-center space-y-5">
      {/* Main Progress Section */}
      <div className="relative w-full flex flex-col items-center">
        {/* Background Glow Effects */}
        <div className="absolute inset-0 -m-6">
          <div
            className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full blur-3xl opacity-15 ${
              errorMessage ? 'bg-red-500' : 'bg-blue-500'
            } animate-pulse`}
          ></div>
          <div
            className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full blur-2xl opacity-25 ${
              errorMessage ? 'bg-red-400' : 'bg-purple-500'
            } animate-pulse`}
            style={{ animationDelay: '1s' }}
          ></div>
        </div>

        {/* Enhanced Progress Ring */}
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-4">
          {/* Outer decorative rings */}
          <div
            className={`absolute inset-0 rounded-full border-2 ${
              errorMessage ? 'border-red-500/20' : 'border-blue-500/20'
            }`}
          />
          <div
            className={`absolute inset-1 rounded-full border border-dashed ${
              errorMessage ? 'border-red-400/30' : 'border-blue-400/30'
            } animate-[spin_8s_linear_infinite]`}
          />

          {/* Main spinning gradient ring */}
          <div
            className={`absolute inset-0 rounded-full border-4 border-transparent ${
              errorMessage
                ? 'border-t-red-400 border-r-red-500 border-b-red-600'
                : 'border-t-blue-400 border-r-blue-500 border-b-purple-500'
            } animate-[spin_2s_linear_infinite]`}
          />

          {/* Inner glowing circle */}
          <div className="absolute inset-0 m-auto w-16 h-16 sm:w-18 sm:h-18">
            <div
              className={`w-full h-full rounded-full relative overflow-hidden ${
                errorMessage
                  ? 'bg-gradient-to-br from-red-400 via-red-500 to-red-600 shadow-lg shadow-red-500/40'
                  : 'bg-gradient-to-br from-blue-400 via-blue-500 to-purple-600 shadow-lg shadow-blue-500/40'
              } animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] flex items-center justify-center`}
            >
              {!errorMessage && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite] -translate-x-full"></div>
              )}

              {errorMessage ? (
                <XCircle className="w-8 h-8 sm:w-9 sm:h-9 text-white relative z-10" />
              ) : (
                <Shield className="w-8 h-8 sm:w-9 sm:h-9 text-white relative z-10" />
              )}
            </div>
          </div>

          {/* Floating particles */}
          {!errorMessage && (
            <>
              <div className="absolute top-2 right-4 w-2 h-2 bg-blue-400 rounded-full opacity-60 animate-[float_3s_ease-in-out_infinite]"></div>
              <div
                className="absolute bottom-3 left-3 w-1.5 h-1.5 bg-purple-400 rounded-full opacity-40 animate-[float_3s_ease-in-out_infinite]"
                style={{ animationDelay: '1s' }}
              ></div>
              <div
                className="absolute top-4 left-2 w-1 h-1 bg-blue-300 rounded-full opacity-50 animate-[float_3s_ease-in-out_infinite]"
                style={{ animationDelay: '2s' }}
              ></div>
            </>
          )}
        </div>

        {/* Status Text */}
        <div className="text-center space-y-3">
          <h2
            className={`text-2xl sm:text-3xl font-bold ${
              errorMessage
                ? 'bg-gradient-to-r from-red-400 to-red-300 bg-clip-text text-transparent'
                : 'bg-gradient-to-r from-blue-400 via-blue-300 to-purple-400 bg-clip-text text-transparent'
            }`}
          >
            {errorMessage
              ? 'Unlock Failed'
              : isUnlocking
                ? 'Unlocking Wallet'
                : 'Preparing Wallet'}
          </h2>

          <p className="text-slate-300 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
            {errorMessage
              ? 'We encountered an issue while unlocking your wallet'
              : isUnlocking
                ? 'Please wait while we securely unlock and prepare your wallet'
                : 'Verifying your credentials and preparing the unlock process'}
          </p>
        </div>
      </div>

      {/* Error Message Display */}
      {errorMessage && (
        <div className="max-w-2xl mx-auto animate-[fadeIn_0.5s_ease-out]">
          <div className="p-4 rounded-xl bg-gradient-to-br from-red-900/40 to-red-800/30 backdrop-blur-sm border border-red-500/30 shadow-lg">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-red-500/20 rounded-lg mt-0.5">
                <XCircle className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="font-semibold text-red-200 mb-1">
                  Error Details
                </h4>
                <p className="text-red-300 text-sm leading-relaxed">
                  {errorMessage}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Steps */}
      {isUnlocking && !errorMessage && (
        <div className="space-y-5 animate-[fadeIn_0.5s_ease-out] max-w-full mx-auto">
          <h3 className="text-xl sm:text-2xl font-semibold text-slate-200 text-center">
            Processing Steps
          </h3>

          {/* Step indicators */}
          <div className="relative">
            {/* Connecting line (desktop only) */}
            <div className="hidden md:block absolute top-9 left-0 right-0 h-1 bg-slate-700/50 rounded-full"></div>
            {/* Active progress portion */}
            <div
              className="hidden md:block absolute top-9 left-0 h-1 bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-500 rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${progressPercentage}%` }}
            ></div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 place-items-center w-full">
              {steps.map((step, index) => {
                const Icon = step.icon
                const isCompleted = step.status === 'completed'
                const isCurrent = step.status === 'current'
                const isPending = step.status === 'pending'

                return (
                  <div
                    className="flex flex-col items-center space-y-2 w-28 sm:w-32 animate-[slideInUp_0.6s_ease-out]"
                    key={step.title}
                    style={{ animationDelay: `${index * 150}ms` }}
                  >
                    {/* Step circle */}
                    <div className="relative">
                      <div
                        className={`relative w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-500 ${
                          isCompleted
                            ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30 scale-110'
                            : isCurrent
                              ? 'bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30 animate-pulse'
                              : 'bg-gradient-to-br from-slate-700 to-slate-600 shadow-lg'
                        } border-2 ${
                          isCompleted || isCurrent
                            ? 'border-white/20'
                            : 'border-slate-500/30'
                        }`}
                      >
                        {/* Step number badge */}
                        <div
                          className={`absolute -top-1 -right-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                            isCompleted
                              ? 'bg-emerald-600 border-emerald-400'
                              : isCurrent
                                ? 'bg-blue-600 border-blue-400'
                                : 'bg-slate-800 border-slate-600'
                          }`}
                        >
                          <span className="text-xs font-bold text-white">
                            {index + 1}
                          </span>
                        </div>

                        {/* Icon */}
                        {isCompleted ? (
                          <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                        ) : (
                          <Icon
                            className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors ${
                              isCurrent
                                ? 'text-white animate-pulse'
                                : isPending
                                  ? 'text-slate-400'
                                  : 'text-white'
                            }`}
                          />
                        )}

                        {/* Loading spinner */}
                        {isCurrent && (
                          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white/60 animate-spin"></div>
                        )}
                      </div>
                    </div>

                    {/* Step content */}
                    <div className="text-center space-y-1">
                      <h4
                        className={`font-semibold text-xs sm:text-sm transition-colors leading-tight break-words ${
                          isCompleted
                            ? 'text-emerald-300'
                            : isCurrent
                              ? 'text-white'
                              : 'text-slate-400'
                        }`}
                      >
                        {step.title}
                      </h4>

                      <div className="flex flex-col items-center space-y-1">
                        {isCompleted && (
                          <div className="flex items-center space-x-1 text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            <span className="text-[10px] sm:text-xs font-medium">
                              Completed
                            </span>
                          </div>
                        )}
                        {isCurrent && (
                          <div className="flex flex-col items-center space-y-1">
                            <div className="flex items-center space-x-1 text-blue-400">
                              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
                              <span className="text-[10px] sm:text-xs font-medium">
                                In Progress
                              </span>
                            </div>
                            {/* Progress bar */}
                            <div className="w-20 h-1 bg-slate-700/50 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-blue-400 to-purple-500 rounded-full animate-[progressBar_2s_ease-in-out_infinite] shadow-sm shadow-blue-400/50"></div>
                            </div>
                          </div>
                        )}
                        {isPending && (
                          <div className="flex items-center space-x-1 text-slate-500">
                            <div className="w-1.5 h-1.5 bg-slate-500 rounded-full"></div>
                            <span className="text-[10px] sm:text-xs font-medium">
                              Pending
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Security Notice */}
          <div className="mt-5 p-3 rounded-xl bg-gradient-to-br from-blue-900/30 via-slate-800/40 to-purple-900/30 backdrop-blur-sm border border-blue-500/20 animate-[fadeIn_0.5s_ease-out] max-w-3xl mx-auto">
            <div className="flex items-center justify-center space-x-2 text-center">
              <Shield className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <p className="text-slate-300 text-sm">
                Keep the application open during the unlock process. Blockchain
                sync may take several minutes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {(onBack || onCancel) && (
        <div
          className="flex justify-center gap-3 animate-[fadeIn_0.5s_ease-out]"
          style={{ animationDelay: '1000ms' }}
        >
          {onBack && (
            <button
              className="group px-5 py-2.5 bg-gradient-to-r from-slate-700/80 to-slate-600/80 hover:from-slate-600/80 hover:to-slate-500/80 text-slate-300 hover:text-white border border-slate-500/50 hover:border-slate-400/60 rounded-lg transition-all duration-300 flex items-center space-x-2 backdrop-blur-sm shadow-lg hover:shadow-xl text-sm"
              onClick={onBack}
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-200" />
              <span className="font-medium">Back to Setup</span>
            </button>
          )}

          {onCancel && (
            <button
              className={`px-5 py-2.5 rounded-lg transition-all duration-300 flex items-center space-x-2 font-semibold shadow-lg hover:shadow-xl text-sm ${
                errorMessage
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white hover:shadow-blue-500/25'
                  : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white hover:shadow-red-500/25'
              }`}
              onClick={onCancel}
            >
              <XCircle className="w-4 h-4" />
              <span>{errorMessage ? 'Try Again' : 'Cancel Process'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
