import { Info } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

// Countdown Timer Component
interface CountdownTimerProps {
  expiresAt: string
  onExpiry?: () => void
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  expiresAt,
  onExpiry,
}) => {
  const { t } = useTranslation()
  const expiryDate = new Date(expiresAt)
  const now = new Date()
  const initialSecondsRef = React.useRef(
    Math.max(0, Math.floor((expiryDate.getTime() - now.getTime()) / 1000))
  )
  const [countdown, setCountdown] = useState(initialSecondsRef.current)

  useEffect(() => {
    if (countdown <= 0) {
      onExpiry?.()
      return
    }

    const intervalId = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId)
          onExpiry?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalId)
  }, [countdown, onExpiry])

  const formatCountdown = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="rounded-[14px] border border-border-subtle bg-surface-base/60 px-3 py-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.26em] text-content-tertiary">
          {t('orderChannel.step3.paymentExpiresIn')}
        </h4>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin"></div>
          <span className="rounded-md bg-surface-overlay/80 px-1.5 py-0.5 font-mono text-sm text-content-primary">
            {formatCountdown(countdown)}
          </span>
        </div>
      </div>

      <div className="h-1.5 w-full rounded-full bg-surface-high/50">
        <div
          className="h-1.5 rounded-full transition-all duration-1000 ease-linear"
          style={{
            backgroundColor:
              countdown < 60
                ? '#EF4444'
                : countdown < 180
                  ? '#F59E0B'
                  : '#3B82F6',
            width: `${(countdown / initialSecondsRef.current) * 100}%`,
          }}
        ></div>
      </div>

      {countdown < 180 && (
        <div className="mt-2 flex items-start rounded-lg border border-yellow-500/15 bg-yellow-500/6 px-2 py-1">
          <div className="mr-1.5 shrink-0 text-yellow-400">
            <Info size={12} />
          </div>
          <p className="text-[11px] text-content-secondary">
            {countdown < 60
              ? t('orderChannel.step3.expiresVerySoon')
              : t('orderChannel.step3.expiresSoon')}
          </p>
        </div>
      )}
    </div>
  )
}
