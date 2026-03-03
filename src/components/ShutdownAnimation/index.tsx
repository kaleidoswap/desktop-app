import React, { useEffect, useState } from 'react'

import logo from '../../assets/logo.svg'

interface ShutdownAnimationProps {
  isVisible: boolean
  status?: string
}

export const ShutdownAnimation: React.FC<ShutdownAnimationProps> = ({
  isVisible,
  status = 'Shutting down',
}) => {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isVisible) {
      setShow(true)
    }
  }, [isVisible])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-base/95 backdrop-blur-sm animate-fadeIn">
      <div className="relative p-8 max-w-sm w-full mx-auto">
        <div className="absolute inset-0 rounded-2xl bg-surface-overlay/50" />
        <div className="relative text-center">
          <div className="absolute -inset-4 rounded-full bg-primary/5 animate-pulse" />
          <img
            alt="KaleidoSwap"
            className="h-16 w-auto mx-auto mb-6 relative animate-fadeInUp"
            src={logo}
          />
          <div
            className="space-y-3 animate-fadeInUp"
            style={{ animationDelay: '200ms' }}
          >
            <div className="text-white/90 text-lg font-medium">{status}</div>
            <div className="flex justify-center items-center gap-2">
              <div
                className="w-1.5 h-1.5 rounded-full bg-cyan animate-bounce"
                style={{ animationDelay: '0ms' }}
              />
              <div
                className="w-1.5 h-1.5 rounded-full bg-cyan animate-bounce"
                style={{ animationDelay: '200ms' }}
              />
              <div
                className="w-1.5 h-1.5 rounded-full bg-cyan animate-bounce"
                style={{ animationDelay: '400ms' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
