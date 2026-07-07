import { Info } from 'lucide-react'
import React from 'react'

import { Tooltip } from './Tooltip'

interface InfoHintProps {
  /** Explanatory text shown on hover. */
  content: React.ReactNode
  title?: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

/**
 * Small ⓘ trigger that reveals an explanatory tooltip on hover. Place it next
 * to a field label to give the user extra context without cluttering the form.
 */
export const InfoHint: React.FC<InfoHintProps> = ({
  content,
  title,
  position = 'top',
  className = '',
}) => (
  <Tooltip
    content={content}
    position={position}
    title={title}
    width="max-w-[16rem]"
  >
    <Info
      className={`h-3.5 w-3.5 cursor-help text-content-tertiary transition-colors hover:text-content-secondary ${className}`}
    />
  </Tooltip>
)
