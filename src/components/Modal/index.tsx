import { X } from 'lucide-react'
import React, { useEffect } from 'react'

interface ModalProps {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export const Modal: React.FC<ModalProps> = ({
  title,
  message,
  onConfirm,
  onCancel,
}) => {
  // Prevent scrolling of the body when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [])

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn"
      onClick={onCancel}
    >
      <div
        className="bg-surface-elevated p-8 rounded-xl shadow-xl max-w-md w-full mx-4 border border-divider/20 animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <button
            aria-label="Close modal"
            className="absolute top-0 right-0 p-2 rounded-full hover:bg-surface-overlay text-content-secondary hover:text-white transition-colors"
            onClick={onCancel}
          >
            <X size={20} />
          </button>
          <h3 className="text-xl font-bold mb-4 text-white">{title}</h3>
          <p className="mb-6 text-content-secondary">{message}</p>
          <div className="flex justify-end space-x-4">
            <button
              className="px-4 py-2 rounded-lg border border-divider/20 hover:bg-surface-overlay transition-colors"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-cyan text-blue-darkest hover:bg-primary/90 transition-colors"
              onClick={onConfirm}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
