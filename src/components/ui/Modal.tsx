import { X } from 'lucide-react'
import React, { ReactNode, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

import {
  getModalPortalTarget,
  getModalPositionClass,
} from '../../helpers/modalPortal'

export interface ModalProps {
  title?: string
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

/** Modal component for displaying content in a overlay */
export const Modal: React.FC<ModalProps> = ({
  title,
  isOpen,
  onClose,
  children,
  size = 'md',
}) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  // Move focus into the dialog, keep Tab inside it, and give it back to the
  // element that opened it on close.
  useEffect(() => {
    if (!isOpen) return
    const opener = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    const focusables = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      )
    if (dialog && !dialog.contains(document.activeElement)) {
      ;(focusables()[0] ?? dialog).focus()
    }
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', trap)
    return () => {
      document.removeEventListener('keydown', trap)
      opener?.focus?.()
    }
  }, [isOpen])

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

  const pos = getModalPositionClass()

  return createPortal(
    <div
      className={`${pos} inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4`}
      onClick={onClose}
    >
      <div
        aria-labelledby={title ? titleId : undefined}
        aria-modal="true"
        className={`bg-surface-base rounded-xl border border-divider/20 shadow-xl ${sizeClasses[size]} w-full outline-none`}
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-divider/10">
            <h3 className="text-xl font-semibold text-white" id={titleId}>
              {title}
            </h3>
            <button
              aria-label="Close modal"
              className="p-2 rounded-full hover:bg-surface-overlay text-content-secondary hover:text-white transition-colors"
              onClick={onClose}
              type="button"
            >
              <X size={20} />
            </button>
          </div>
        )}

        <div className="custom-scrollbar max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    getModalPortalTarget()
  )
}
