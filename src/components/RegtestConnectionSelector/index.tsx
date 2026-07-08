import { Info, Server, Globe, Check, Container } from 'lucide-react'
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
  badgeVariant: 'info' | 'warning' | 'purple'
  details: string[]
  selectedColor: {
    border: string
    bg: string
    iconBg: string
    iconText: string
    checkBg: string
    titleText: string
    shadow: string
  }
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
    selectedColor: {
      bg: 'bg-primary/10',
      border: 'border-primary',
      checkBg: 'bg-primary',
      iconBg: 'bg-primary/20',
      iconText: 'text-primary',
      shadow: 'shadow-[0_0_10px_rgba(21,233,154,0.15)]',
      titleText: 'text-primary',
    },
    title: 'Remote (Bitfinex Regtest)',
    type: 'bitfinex',
  },
  {
    badge: 'Docker',
    badgeVariant: 'purple',
    description:
      'Connect to a node started by the kaleidoswap-maker Docker stack',
    details: [
      'Node on localhost:3001',
      'Backends via docker hostnames (bitcoind / esplora)',
      'Indexer http://esplora:3000',
      'Default wallet password prefilled',
    ],
    icon: <Container className="w-5 h-5" />,
    selectedColor: {
      bg: 'bg-purple-400/10',
      border: 'border-purple-400',
      checkBg: 'bg-purple-400',
      iconBg: 'bg-purple-400/20',
      iconText: 'text-purple-400',
      shadow: 'shadow-[0_0_10px_rgba(192,132,252,0.15)]',
      titleText: 'text-purple-400',
    },
    title: 'Local Docker Regtest',
    type: 'docker',
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
    selectedColor: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500',
      checkBg: 'bg-amber-500',
      iconBg: 'bg-amber-500/20',
      iconText: 'text-amber-500',
      shadow: 'shadow-[0_0_10px_rgba(245,158,11,0.15)]',
      titleText: 'text-amber-500',
    },
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
      <div className="grid gap-3">
        {connectionOptions.map((option) => {
          const isSelected = selectedType === option.type
          const isHovered = hoveredType === option.type

          return (
            <button
              className={`relative p-4 rounded-xl border transition-all duration-200 text-left group
                ${
                  isSelected
                    ? `${option.selectedColor.bg} ${option.selectedColor.border} ${option.selectedColor.shadow}`
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
                  <div
                    className={`w-6 h-6 ${option.selectedColor.checkBg} rounded-full flex items-center justify-center`}
                  >
                    <Check className="w-4 h-4 text-surface-base" />
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className={`p-2 rounded-lg transition-colors duration-200
                  ${
                    isSelected
                      ? `${option.selectedColor.iconBg} ${option.selectedColor.iconText}`
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
                      ${isSelected ? option.selectedColor.titleText : 'text-content-primary group-hover:text-white'}`}
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

      {/* Info banner */}
      <div className="mt-4 flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-300">
          Remote (Bitfinex Regtest) is ready to use immediately. Choose Local
          Regtest only if you're running your own regtest infrastructure.
        </p>
      </div>
    </div>
  )
}
