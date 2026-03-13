import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Globe,
  Loader2,
  RefreshCw,
  Shield,
  XCircle,
  Zap,
} from 'lucide-react'

import { Button } from '../ui'

interface UnlockingProgressProps {
  infoMessage?: string
  isUnlocking: boolean
  errorMessage?: string
  onBack?: () => void
  onCancel?: () => void
}

export const UnlockingProgress = ({
  infoMessage,
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
    { icon: Globe, status: 'pending', title: 'Connecting to RGB proxy' },
    { icon: Zap, status: 'pending', title: 'Connecting to Lightning' },
  ]

  return (
    <div className="w-full max-w-md mx-auto flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Info */}
      <div className="flex flex-col items-center text-center space-y-3">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-2 shadow-lg ${
            errorMessage
              ? 'bg-status-danger/10 text-status-danger shadow-status-danger/20'
              : 'bg-primary/10 text-primary shadow-primary/20'
          }`}
        >
          {errorMessage ? (
            <XCircle className="w-8 h-8" />
          ) : (
            <Shield className="w-8 h-8 animate-pulse" />
          )}
        </div>
        <h2 className="text-2xl font-bold text-content-primary">
          {errorMessage
            ? 'Unlock Failed'
            : isUnlocking
              ? 'Unlocking Wallet'
              : 'Preparing Wallet'}
        </h2>
        <p className="text-content-secondary text-sm leading-relaxed max-w-sm">
          {errorMessage
            ? 'We encountered an issue while unlocking your wallet'
            : isUnlocking
              ? 'Please wait while we securely unlock and prepare your wallet'
              : 'Verifying your credentials and preparing the unlock process'}
        </p>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-status-danger/10 border border-status-danger/30 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-status-danger shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-status-danger text-sm mb-1">
              Error Details
            </h4>
            <p className="text-status-danger/80 text-xs leading-relaxed break-words">
              {errorMessage}
            </p>
          </div>
        </div>
      )}

      {infoMessage && !errorMessage && (
        <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-primary text-sm mb-1">
              Unlock is taking longer than usual
            </h4>
            <p className="text-content-secondary text-xs leading-relaxed break-words">
              {infoMessage}
            </p>
          </div>
        </div>
      )}

      {/* Progress Steps (Vertical) */}
      {isUnlocking && !errorMessage && (
        <div className="space-y-2">
          {steps.map((step, index) => {
            const Icon = step.icon
            const isCompleted = step.status === 'completed'
            const isCurrent = step.status === 'current'

            return (
              <div
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${
                  isCurrent
                    ? 'bg-surface-elevated/80 border-primary/30 shadow-sm shadow-primary/5'
                    : isCompleted
                      ? 'bg-surface-base border-border-subtle/50'
                      : 'bg-surface-base/30 border-border-subtle/20'
                }`}
                key={step.title}
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border transition-colors ${
                    isCompleted
                      ? 'bg-status-success/10 border-status-success/20 text-status-success'
                      : isCurrent
                        ? 'bg-primary/10 border-primary/20 text-primary'
                        : 'bg-surface-high/50 border-border-subtle/50 text-content-tertiary'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : isCurrent ? (
                    <Icon className="w-5 h-5 animate-spin" />
                  ) : (
                    <Icon className="w-5 h-5 opacity-40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4
                    className={`text-sm font-semibold truncate ${isCurrent ? 'text-content-primary' : isCompleted ? 'text-content-secondary' : 'text-content-tertiary'}`}
                  >
                    {step.title}
                  </h4>
                  <p className="text-xs text-content-tertiary mt-0.5">
                    {isCompleted
                      ? 'Completed'
                      : isCurrent
                        ? 'In progress...'
                        : 'Waiting'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Action Buttons */}
      {(onBack || onCancel) && (
        <div className="pt-4 flex flex-col gap-3">
          {onCancel && (
            <Button
              className="w-full"
              icon={
                errorMessage ? (
                  <RefreshCw className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )
              }
              onClick={onCancel}
              size="lg"
              variant={errorMessage ? 'primary' : 'outline'}
            >
              {errorMessage ? 'Try Again' : 'Cancel Process'}
            </Button>
          )}
          {onBack && (
            <Button
              className="w-full"
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={onBack}
              size="lg"
              variant="ghost"
            >
              Back to Setup
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
