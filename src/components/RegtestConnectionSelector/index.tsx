import { Server, Globe, Check } from 'lucide-react'
import { useState } from 'react'

import { RegtestConnectionType } from '../../constants'
import { Badge } from '../ui/Badge'

interface RegtestConnectionSelectorProps {
  selectedType: RegtestConnectionType
  onChange: (type: RegtestConnectionType) => void
  className?: string
}

interface ConnectionOption {
  type: RegtestConnectionType
  title: string
  description: string
  icon: React.ReactNode
  badge: string
  badgeVariant: 'info' | 'warning'
  details: string[]
}

const connectionOptions: ConnectionOption[] = [
  {
    badge: 'Recommended',
    badgeVariant: 'info',
    description:
      'Connect to the shared Bitfinex regtest infrastructure (Recommended)',
    details: [
      'Uses electrum.rgbtools.org:50041',
      'Connects to regtest-bitcoind.rgbtools.org:80',
      'Shared infrastructure, no setup required',
      'Ready to use out of the box',
    ],
    icon: <Globe className="w-5 h-5" />,
    title: 'Remote (Bitfinex Regtest)',
    type: 'bitfinex',
  },
  {
    badge: 'Local',
    badgeVariant: 'warning',
    description: 'Connect to your local regtest node for development',
    details: [
      'Uses localhost:50001',
      'Connects to local bitcoind:18443',
      'Requires local node setup',
      'For advanced developers only',
    ],
    icon: <Server className="w-5 h-5" />,
    title: 'Local Regtest',
    type: 'local',
  },
]

export const RegtestConnectionSelector = ({
  selectedType,
  onChange,
  className = '',
}: RegtestConnectionSelectorProps) => {
  const [hoveredType, setHoveredType] = useState<RegtestConnectionType | null>(
    null
  )

  return (
    <div className={className}>
      <label className="block text-sm font-medium mb-3 text-content-secondary">
        Regtest Connection Type
      </label>
      <p className="text-sm text-content-secondary mb-4">
        Choose between local development or remote Bitfinex regtest
        infrastructure
      </p>

      <div className="grid gap-3">
        {connectionOptions.map((option) => {
          const isSelected = selectedType === option.type
          const isHovered = hoveredType === option.type

          return (
            <button
              className={`relative p-4 rounded-xl border transition-all duration-200 text-left group
                ${
                  isSelected
                    ? 'bg-primary/10 border-cyan shadow-[0_0_10px_rgba(0,200,255,0.15)]'
                    : 'bg-surface-overlay/30 border-border-default/50 hover:bg-surface-overlay/50 hover:border-border-default/70'
                }`}
              key={option.type}
              onClick={() => onChange(option.type)}
              onMouseEnter={() => setHoveredType(option.type)}
              onMouseLeave={() => setHoveredType(null)}
              type="button"
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <div className="w-6 h-6 bg-cyan rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-blue-darker" />
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className={`p-2 rounded-lg transition-colors duration-200
                  ${
                    isSelected
                      ? 'bg-primary/20 text-primary'
                      : 'bg-surface-high/50 text-content-secondary group-hover:bg-surface-high/70 group-hover:text-content-secondary'
                  }`}
                >
                  {option.icon}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-2">
                    <h3
                      className={`font-semibold transition-colors duration-200
                      ${isSelected ? 'text-white' : 'text-content-primary group-hover:text-white'}`}
                    >
                      {option.title}
                    </h3>
                    <Badge size="sm" variant={option.badgeVariant}>
                      {option.badge}
                    </Badge>
                  </div>

                  {/* Description */}
                  <p
                    className={`text-sm mb-3 transition-colors duration-200
                    ${isSelected ? 'text-content-secondary' : 'text-content-secondary group-hover:text-content-secondary'}`}
                  >
                    {option.description}
                  </p>

                  {/* Details - show on hover or selection */}
                  <div
                    className={`space-y-1 transition-all duration-200 overflow-hidden
                    ${isSelected || isHovered ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}
                  >
                    {option.details.map((detail, index) => (
                      <div
                        className="flex items-center gap-2 text-xs text-content-secondary"
                        key={index}
                      >
                        <div className="w-1 h-1 bg-content-tertiary rounded-full flex-shrink-0" />
                        <span>{detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Help text */}
      <div className="mt-4 p-3 bg-surface-elevated/20 border border-blue-500/20 rounded-lg">
        <p className="text-xs text-content-secondary">
          <strong className="text-content-secondary">Recommended:</strong> Use Remote
          (Bitfinex Regtest) for most users - it's ready to use immediately.
          Choose Local Regtest only if you're running your own regtest
          infrastructure.
        </p>
      </div>
    </div>
  )
}
