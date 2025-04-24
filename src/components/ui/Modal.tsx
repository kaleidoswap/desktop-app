import { X } from 'lucide-react'
import React, { ReactNode, useEffect } from 'react'

export interface ModalProps {
  title?: string
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

/**
 * Modal component for displaying content in a overlay
 */
export const Modal: React.FC<ModalProps> = ({
  title,
  isOpen,
  onClose,
  children,
  size = 'md',
}) => {
  // Prevent scrolling of the body when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = 'auto'
      }
    }
  }, [isOpen])

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => {
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Size classes
  const sizeClasses = {
    lg: 'max-w-4xl',
    md: 'max-w-2xl',
    sm: 'max-w-md',
    xl: 'max-w-6xl',
  }

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className={`bg-blue-darkest rounded-xl border border-divider/20 shadow-xl ${sizeClasses[size]} w-full`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-divider/10">
            <h3 className="text-xl font-semibold text-white">{title}</h3>
            <button
              aria-label="Close modal"
              className="p-2 rounded-full hover:bg-blue-darker text-gray-400 hover:text-white transition-colors"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>
        )}

        <div className="max-h-[80vh] overflow-auto">{children}</div>
      </div>
    </div>
  )
}
