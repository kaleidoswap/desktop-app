import { Info } from 'lucide-react'
import React, { useState, useEffect } from 'react'

// Countdown Timer Component
interface CountdownTimerProps {
  expiresAt: string
  onExpiry?: () => void
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  expiresAt,
  onExpiry,
}) => {
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
    <div className="bg-gray-800/70 p-4 rounded-xl border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm text-gray-400">Payment Expires In</h4>
        <div className="flex items-center">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
          <span className="text-white font-mono bg-gray-700/70 px-3 py-1 rounded-lg text-lg">
            {formatCountdown(countdown)}
          </span>
        </div>
      </div>

      <div className="w-full bg-gray-700/50 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all duration-1000 ease-linear"
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
        <div className="mt-3 flex items-start">
          <div className="text-yellow-400 mr-2 mt-0.5">
            <Info size={16} />
          </div>
          <p className="text-gray-400 text-xs">
            {countdown < 60
              ? 'Payment expires soon!'
              : 'Payment expiring soon.'}
          </p>
        </div>
      )}
    </div>
  )
}
