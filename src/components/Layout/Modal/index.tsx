import { useRef } from 'react'

import { useAppDispatch, useAppSelector } from '../../../app/store/hooks'
import { useOnClickOutside } from '../../../hooks/useOnClickOutside'
import { uiSliceActions, uiSliceSeletors } from '../../../slices/ui/ui.slice'

import { Content } from './Content'

export const LayoutModal = () => {
  const dispatch = useAppDispatch()
  const modal = useAppSelector(uiSliceSeletors.modal)
  const modalRef = useRef(null)

  const handleCloseModal = () => {
    dispatch(uiSliceActions.setModal({ type: 'none' }))
  }

  useOnClickOutside(modalRef, handleCloseModal)

  if (modal.type === 'none') return null

  return (
    <div className="fixed inset-0 bg-surface-base/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="w-full max-w-5xl bg-surface-base rounded-3xl border border-border-subtle/50 
                   shadow-2xl shadow-black/20 overflow-hidden relative"
        ref={modalRef}
      >
        <button
          aria-label="Close modal"
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-surface-overlay transition-colors"
          onClick={handleCloseModal}
        >
          <svg
            fill="none"
            height="24"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M18 6L6 18"></path>
            <path d="M6 6l12 12"></path>
          </svg>
        </button>
        <div className="max-h-[85vh] overflow-y-auto px-8 py-10">
          <Content modal={modal} />
        </div>
      </div>
    </div>
  )
}
