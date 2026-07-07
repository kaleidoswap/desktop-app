import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

export function getModalPortalTarget(): Element {
  return document.getElementById('modal-portal') ?? document.body
}

export function getModalPositionClass(): 'absolute' | 'fixed' {
  return document.getElementById('modal-portal') ? 'absolute' : 'fixed'
}

export function renderModalPortal(
  content: ReactNode
): ReturnType<typeof createPortal> {
  return createPortal(content, document.body)
}
