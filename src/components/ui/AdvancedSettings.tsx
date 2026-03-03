import { ChevronDown, Settings } from 'lucide-react'
import { ReactNode, useState } from 'react'

import { SetupSection } from './SetupLayout'

interface AdvancedSettingsProps {
  children: ReactNode
  title?: string
  icon?: ReactNode
  defaultOpen?: boolean
  className?: string
}

/**
 * A reusable component for displaying advanced settings in a collapsible section
 */
export const AdvancedSettings = ({
  children,
  title = 'Advanced Configuration',
  icon = <Settings className="w-4 h-4 text-primary" />,
  defaultOpen = false,
  className = '',
}: AdvancedSettingsProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={`${className}`}>
      <div
        className="flex items-center gap-2 cursor-pointer py-2.5 px-3 hover:bg-surface-overlay/20 rounded-md transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        {icon}
        <span className="font-medium text-white text-sm">
          Advanced Settings
        </span>
        <ChevronDown
          className={`w-4 h-4 text-primary transition-transform duration-200 ml-1 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </div>

      {isOpen && (
        <div className="mt-3 transition-all duration-200 ease-in-out">
          <SetupSection
            className="border-border-default/30"
            icon={icon}
            title={title}
          >
            {children}
          </SetupSection>
        </div>
      )}
    </div>
  )
}
