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
    <div className="h-full rounded-[14px] border border-border-subtle bg-surface-base/60 px-3 py-2 flex flex-col justify-between">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-content-primary">
          {t('orderChannel.step3.paymentExpiresIn')}
        </h4>
        <span className="rounded-md bg-surface-overlay/80 px-1.5 py-0.5 font-mono text-sm text-content-primary">
          {formatCountdown(countdown)}
        </span>
      </div>

      <div className="mb-[10px] h-1.5 w-full rounded-full bg-[#9365FF]/20">
        <div
          className="h-1.5 rounded-full transition-all duration-1000 ease-linear"
          style={{
            backgroundColor: '#9365FF',
            width: `${(countdown / initialSecondsRef.current) * 100}%`,
          }}
        ></div>
      </div>
    </div>
  )
}
