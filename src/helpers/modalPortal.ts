import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

export function getModalPortalTarget(): Element {
  return document.body
}

export function getModalPositionClass(): 'fixed' {
  return 'fixed'
}

export function renderModalPortal(
  content: ReactNode
): ReturnType<typeof createPortal> {
  return createPortal(content, document.body)
}
