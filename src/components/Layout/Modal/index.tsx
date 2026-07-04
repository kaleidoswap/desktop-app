import { useRef } from 'react'
import { createPortal } from 'react-dom'

import { useAppDispatch, useAppSelector } from '../../../app/store/hooks'
import {
  getModalPortalTarget,
  getModalPositionClass,
} from '../../../helpers/modalPortal'
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

  const pos = getModalPositionClass()

  return createPortal(
    <div
      className={`${pos} inset-0 bg-surface-base/80 backdrop-blur-sm flex items-center justify-center z-50 p-4`}
    >
      <div
        className="w-full max-w-lg bg-surface-base rounded-3xl border border-border-subtle/50
                   shadow-2xl shadow-black/20 overflow-hidden relative"
        ref={modalRef}
      >
        <div className="max-h-[85vh] overflow-y-auto px-8 py-8">
          <Content modal={modal} onClose={handleCloseModal} />
        </div>
      </div>
    </div>,
    getModalPortalTarget()
  )
}
