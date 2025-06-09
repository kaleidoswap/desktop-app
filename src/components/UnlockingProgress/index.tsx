import { ArrowLeft, XCircle, Shield, CheckCircle2, Loader2 } from 'lucide-react'

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
    { icon: Shield, title: 'Decrypting wallet' },
    { icon: Loader2, title: 'Synchronizing Bitcoin blockchain' },
    { icon: CheckCircle2, title: 'Connecting to RGB proxy' },
    { icon: CheckCircle2, title: 'Connecting to Lightning' },
  ]

  return (
    <div className="flex items-center justify-center h-full w-full p-8">
      <div className="w-full max-w-4xl flex flex-col items-center">
        {/* Main Progress Section */}
        <div className="relative mb-12">
          {/* Background Glow Effects */}
          <div className="absolute inset-0 -m-8">
            <div
              className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl opacity-20 ${
                errorMessage ? 'bg-red-500' : 'bg-blue-500'
              } animate-pulse`}
            ></div>
            <div
              className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-2xl opacity-30 ${
                errorMessage ? 'bg-red-400' : 'bg-purple-500'
              } animate-pulse`}
              style={{ animationDelay: '1s' }}
            ></div>
          </div>

          {/* Enhanced Progress Ring */}
          <div className="relative w-40 h-40 mb-8">
            {/* Outer decorative rings */}
            <div
              className={`absolute inset-0 rounded-full border-2 ${
                errorMessage ? 'border-red-500/20' : 'border-blue-500/20'
              }`}
            />
            <div
              className={`absolute inset-2 rounded-full border border-dashed ${
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
            <div className="absolute inset-0 m-auto w-20 h-20">
              <div
                className={`w-full h-full rounded-full relative overflow-hidden ${
                  errorMessage
                    ? 'bg-gradient-to-br from-red-400 via-red-500 to-red-600 shadow-lg shadow-red-500/40'
                    : 'bg-gradient-to-br from-blue-400 via-blue-500 to-purple-600 shadow-lg shadow-blue-500/40'
                } animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] flex items-center justify-center`}
              >
                {/* Shimmer effect */}
                {!errorMessage && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite] -translate-x-full"></div>
                )}

                {errorMessage ? (
                  <XCircle className="w-10 h-10 text-white relative z-10" />
                ) : (
                  <Shield className="w-10 h-10 text-white relative z-10" />
                )}
              </div>
            </div>

            {/* Floating particles */}
            {!errorMessage && (
              <>
                <div className="absolute top-4 right-8 w-2 h-2 bg-blue-400 rounded-full opacity-60 animate-[float_3s_ease-in-out_infinite]"></div>
                <div
                  className="absolute bottom-6 left-6 w-1.5 h-1.5 bg-purple-400 rounded-full opacity-40 animate-[float_3s_ease-in-out_infinite]"
                  style={{ animationDelay: '1s' }}
                ></div>
                <div
                  className="absolute top-8 left-4 w-1 h-1 bg-blue-300 rounded-full opacity-50 animate-[float_3s_ease-in-out_infinite]"
                  style={{ animationDelay: '2s' }}
                ></div>
              </>
            )}
          </div>
        </div>

        {/* Status Text Section */}
        <div className="text-center space-y-8 w-full">
          <div className="space-y-4">
            <h2
              className={`text-4xl font-bold ${
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

            <p className="text-slate-400 text-lg max-w-md mx-auto leading-relaxed">
              {errorMessage
                ? 'We encountered an issue while unlocking your wallet'
                : isUnlocking
                  ? 'Please wait while we securely unlock and prepare your wallet'
                  : 'Verifying your credentials and preparing the unlock process'}
            </p>
          </div>

          {/* Error Message Display */}
          {errorMessage && (
            <div className="max-w-2xl mx-auto animate-[fadeIn_0.5s_ease-out]">
              <div className="p-6 rounded-2xl bg-gradient-to-br from-red-900/40 to-red-800/30 backdrop-blur-sm border border-red-500/30 shadow-lg">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-red-500/20 rounded-lg mt-1">
                    <XCircle className="w-5 h-5 text-red-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <h4 className="font-semibold text-red-200 mb-2">
                      Error Details
                    </h4>
                    <p className="text-red-300 leading-relaxed">
                      {errorMessage}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Progress Steps */}
          {isUnlocking && !errorMessage && (
            <div className="space-y-6 animate-[fadeIn_0.5s_ease-out] max-w-4xl mx-auto">
              <h3 className="text-xl font-semibold text-slate-300 mb-6">
                Processing Steps
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {steps.map((step, index) => {
                  const Icon = step.icon
                  return (
                    <div
                      className="group flex items-center space-x-4 p-5 rounded-xl bg-gradient-to-r from-slate-800/60 to-slate-700/40 backdrop-blur-sm border border-slate-600/30 hover:border-blue-500/30 transition-all duration-500 animate-[slideInUp_0.6s_ease-out]"
                      key={step.title}
                      style={{ animationDelay: `${index * 200}ms` }}
                    >
                      {/* Step Icon */}
                      <div className="relative">
                        <div className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl border border-blue-500/20 group-hover:border-blue-400/40 transition-all duration-300">
                          <Icon className="w-6 h-6 text-blue-400 group-hover:text-blue-300 transition-colors" />
                        </div>
                        {/* Active indicator */}
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-pulse border-2 border-slate-800"></div>
                      </div>

                      {/* Step Content */}
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-200 group-hover:text-white transition-colors">
                          {step.title}
                        </h4>
                        <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-400 to-purple-500 rounded-full animate-[progressBar_2s_ease-in-out_infinite]"></div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Enhanced Info Card */}
              <div
                className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-blue-900/30 via-slate-800/40 to-purple-900/30 backdrop-blur-sm border border-blue-500/20 animate-[fadeIn_0.5s_ease-out]"
                style={{ animationDelay: '800ms' }}
              >
                <div className="flex items-start space-x-4">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Shield className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <h4 className="font-semibold text-blue-200 mb-2">
                      Security Notice
                    </h4>
                    <p className="text-slate-300 mb-3 leading-relaxed">
                      Please keep the application open while we complete the
                      secure unlock process.
                    </p>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Note: If your node has been offline for some time,
                      blockchain synchronization may take several minutes to
                      complete.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {(onBack || onCancel) && (
            <div
              className="mt-12 flex justify-center gap-4 animate-[fadeIn_0.5s_ease-out]"
              style={{ animationDelay: '1000ms' }}
            >
              {onBack && (
                <Button
                  className="px-6 py-3 bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white border border-slate-600/50 hover:border-slate-500 rounded-xl transition-all duration-300 flex items-center space-x-2 backdrop-blur-sm"
                  onClick={onBack}
                  variant="outline"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Setup</span>
                </Button>
              )}

              {onCancel && (
                <button
                  className={`px-6 py-3 rounded-xl transition-all duration-300 flex items-center space-x-2 font-semibold ${
                    errorMessage
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg hover:shadow-xl'
                      : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-lg hover:shadow-xl hover:shadow-red-500/25'
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
      </div>
    </div>
  )
}
