import { formatBitcoinAmount } from '../../helpers/number'
import { HoverCard, OverlayTooltip, LoadingPlaceholder } from '../ui'

export const LiquidityCard = ({
  title,
  amount,
  bitcoinUnit,
  icon,
  tooltipDescription,
  isLoading,
  totalCapacity,
  type,
}: {
  title: string
  amount: number
  bitcoinUnit: string
  icon: React.ReactNode
  tooltipDescription: string
  isLoading?: boolean
  totalCapacity?: number
  type: 'inbound' | 'outbound'
}) => {
  // Calculate percentage of liquidity relative to total capacity
  const percentage =
    totalCapacity && totalCapacity > 0
      ? Math.min(100, Math.round((amount / totalCapacity) * 100))
      : 0

  // Determine color based on percentage and type - using more subtle colors
  const getStatusColor = () => {
    if (percentage < 20) {
      return 'bg-red-500/60'
    } else if (percentage < 40) {
      return 'bg-amber-500/60'
    } else {
      return type === 'inbound' ? 'bg-blue-500/60' : 'bg-amber-500/60'
    }
  }

  const statusColor = getStatusColor()
  const iconColor = type === 'inbound' ? 'text-blue-400' : 'text-amber-400'

  return (
    <OverlayTooltip content={tooltipDescription} title={title}>
      <HoverCard className="border border-border-default/30 hover:border-border-default/50 transition-all duration-200 p-2.5">
        <div className="flex justify-between items-center mb-1.5">
          <h2 className="text-xs font-medium text-content-secondary">{title}</h2>
          <div className={iconColor}>{icon}</div>
        </div>
        <div className="text-base font-bold text-white mb-1.5">
          {isLoading ? (
            <LoadingPlaceholder width="w-20" />
          ) : amount === 0 ? (
            <span className="text-content-tertiary">No liquidity</span>
          ) : (
            `${formatBitcoinAmount(amount, bitcoinUnit)} ${bitcoinUnit}`
          )}
        </div>

        {!isLoading && (
          <div className="mt-1">
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-xs text-content-secondary">
                {totalCapacity && totalCapacity > 0
                  ? `${percentage}% of capacity`
                  : 'No channels open'}
              </span>
              {totalCapacity && totalCapacity > 0 && percentage < 20 && (
                <span className="text-xs text-red-300">Low</span>
              )}
            </div>
            <div className="w-full bg-surface-overlay/80 rounded-full h-1 overflow-hidden shadow-inner">
              <div
                className={`${statusColor} h-full rounded-full transition-all duration-300`}
                style={{
                  width:
                    totalCapacity && totalCapacity > 0
                      ? `${percentage}%`
                      : '0%',
                }}
              ></div>
            </div>
          </div>
        )}
      </HoverCard>
    </OverlayTooltip>
  )
}
