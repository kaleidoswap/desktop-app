import { Check } from 'lucide-react'
import React from 'react'

export interface WalletTypeCardProps {
  id: string
  name: string
  description: string
  features: string[]
  logo: React.ReactNode
  isRequired: boolean
  isSelected: boolean
  onToggle: (id: string) => void
  disabled?: boolean
}

export const WalletTypeCard: React.FC<WalletTypeCardProps> = ({
  id,
  name,
  description,
  features,
  logo,
  isRequired,
  isSelected,
  onToggle,
  disabled = false,
}) => {
  const handleClick = () => {
    if (!disabled && !isRequired) {
      onToggle(id)
    }
  }

  return (
    <div
      className={`
        relative p-6 rounded-2xl border-2 transition-all duration-300 cursor-pointer
        ${
          isSelected
            ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
            : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${isRequired ? 'cursor-default' : ''}
      `}
      onClick={handleClick}
    >
      {/* Selection Indicator */}
      <div className="absolute top-4 right-4">
        {isRequired ? (
          <div className="px-3 py-1 bg-amber-500/20 border border-amber-500 rounded-full text-xs font-semibold text-amber-400">
            Required
          </div>
        ) : (
          <div
            className={`
              w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
              ${
                isSelected
                  ? 'bg-blue-500 border-blue-500'
                  : 'border-slate-600 bg-slate-700'
              }
            `}
          >
            {isSelected && <Check className="w-4 h-4 text-white" />}
          </div>
        )}
      </div>

      {/* Logo */}
      <div className="mb-4 flex items-center justify-center h-16">{logo}</div>

      {/* Name */}
      <h3 className="text-xl font-bold text-white mb-2 text-center">{name}</h3>

      {/* Description */}
      <p className="text-slate-400 text-sm mb-4 text-center">{description}</p>

      {/* Features */}
      <div className="space-y-2">
        {features.map((feature, index) => (
          <div className="flex items-start" key={index}>
            <div className="mt-1 mr-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
            </div>
            <span className="text-xs text-slate-300">{feature}</span>
          </div>
        ))}
      </div>

      {isRequired && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          <p className="text-xs text-slate-500 text-center">
            This wallet is required and always active
          </p>
        </div>
      )}
    </div>
  )
}
