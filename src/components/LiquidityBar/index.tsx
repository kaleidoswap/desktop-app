import React from 'react'

interface LiquidityBarProps {
  localAmount: number
  remoteAmount: number
  type: 'bitcoin' | 'asset'
}

export const LiquidityBar: React.FC<LiquidityBarProps> = ({
  localAmount,
  remoteAmount,
  type,
}) => {
  const total = localAmount + remoteAmount
  const localPercentage = total === 0 ? 0 : (localAmount / total) * 100
  const remotePercentage = total === 0 ? 0 : (remoteAmount / total) * 100

  // Get colors based on type
  const getColors = () => {
    if (type === 'bitcoin') {
      return {
        background: 'bg-surface-overlay',
        local: 'bg-yellow-500',
        remote: 'bg-blue-500',
      }
    } else {
      return {
        background: 'bg-surface-overlay',
        local: 'bg-blue-500',
        remote: 'bg-indigo-500',
      }
    }
  }

  const colors = getColors()

  return (
    <div className="relative">
      <div
        className={`relative w-full ${colors.background} rounded-full h-2.5 overflow-hidden`}
      >
        {/* Local amount (left side) */}
        <div
          className={`${colors.local} h-full absolute left-0 top-0 rounded-l-full`}
          style={{ width: `${localPercentage}%` }}
        ></div>

        {/* Remote amount (right side) */}
        <div
          className={`${colors.remote} h-full absolute right-0 top-0 rounded-r-full`}
          style={{ width: `${remotePercentage}%` }}
        ></div>

        {/* Center divider */}
        <div className="absolute top-0 bottom-0 left-1/2 transform -translate-x-1/2 w-0.5 bg-surface-high"></div>
      </div>
    </div>
  )
}
