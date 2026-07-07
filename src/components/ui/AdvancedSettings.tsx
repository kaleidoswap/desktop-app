import { ChevronDown, Settings } from 'lucide-react'
import { ReactNode, useState } from 'react'

interface AdvancedSettingsProps {
  children: ReactNode
  title?: string
  icon?: ReactNode
  defaultOpen?: boolean
  className?: string
}

export const AdvancedSettings = ({
  children,
  icon = <Settings className="w-4 h-4 text-primary" />,
  defaultOpen = false,
  className = '',
}: AdvancedSettingsProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={`rounded-lg overflow-hidden ${className}`}>
      <button
        className={`w-full px-4 py-2.5 flex items-center justify-between text-left text-sm
          border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20
          ${isOpen
            ? 'border-primary bg-surface-elevated/60 shadow-[0_0_10px_rgba(21,233,154,0.15)] rounded-b-none'
            : 'border-border-default/50 bg-surface-overlay/30 hover:bg-surface-overlay/50 hover:border-border-default/70'
          }`}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-white">Advanced Settings</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-content-secondary transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="p-4 border border-t-0 border-primary/50 rounded-b-lg bg-surface-elevated/60 space-y-4">
          {children}
        </div>
      )}
    </div>
  )
}
