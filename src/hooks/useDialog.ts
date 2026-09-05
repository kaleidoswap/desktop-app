import { useEffect, useRef, type RefObject } from 'react'

interface UseDialogOptions {
  /** Whether the dialog is currently shown. Defaults to true for components
   *  that are only mounted while open. */
  isOpen?: boolean
  /** Called on Escape. Omit for dialogs that cannot be dismissed. */
  onClose?: () => void
  /** Set to false while an operation is running to ignore Escape. */
  dismissable?: boolean
  /** Accessible name for the dialog when there is no visible title to point at. */
  label?: string
}

export interface DialogProps {
  role: 'dialog'
  'aria-modal': true
  tabIndex: -1
  'aria-label'?: string
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** Dialogs currently open, innermost last. Only the innermost reacts to keys. */
const openDialogs: HTMLElement[] = []

// Layout-independent visibility check so it also works under jsdom.
const isVisible = (el: HTMLElement): boolean => {
  if (el.closest('[hidden]')) return false
  const style = window.getComputedStyle(el)
  return style.display !== 'none' && style.visibility !== 'hidden'
}

/** The dialog that should react to keys: the most recently opened one that
 *  does not itself wrap another open dialog. */
const innermostDialog = (): HTMLElement | undefined =>
  [...openDialogs]
    .reverse()
    .find((d) => !openDialogs.some((o) => o !== d && d.contains(o)))

const focusableIn = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    isVisible
  )

/**
 * Keyboard and focus behaviour shared by every modal:
 * - Escape closes the innermost open dialog (when dismissable).
 * - Tab / Shift+Tab cycle within the dialog instead of reaching the page.
 * - Focus moves into the dialog on open and back to the trigger on close.
 * - Supplies role="dialog", aria-modal and tabIndex for the container.
 *
 * Attach `dialogRef` and spread `dialogProps` on the dialog's card element.
 * Call the hook before any early `return null` so it runs on every render.
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>({
  isOpen = true,
  onClose,
  dismissable = true,
  label,
}: UseDialogOptions = {}): {
  dialogRef: RefObject<T>
  dialogProps: DialogProps
} {
  const dialogRef = useRef<T>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const dismissableRef = useRef(dismissable)
  dismissableRef.current = dismissable

  useEffect(() => {
    if (!isOpen) return
    const el = dialogRef.current
    if (!el) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    openDialogs.push(el)
    // The container is focused programmatically; never draw a ring on it.
    el.style.outline = 'none'

    // Focus the first control, or the container itself when there is none.
    const initial = focusableIn(el)[0] ?? el
    initial.focus({ preventScroll: true })

    const onKeyDown = (event: KeyboardEvent) => {
      if (innermostDialog() !== el) return

      if (event.key === 'Escape') {
        if (dismissableRef.current && onCloseRef.current) {
          event.stopPropagation()
          onCloseRef.current()
        }
        return
      }

      if (event.key !== 'Tab') return
      const focusables = focusableIn(el)
      if (focusables.length === 0) {
        event.preventDefault()
        el.focus({ preventScroll: true })
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      const outside = !el.contains(active)
      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      const index = openDialogs.lastIndexOf(el)
      if (index >= 0) openDialogs.splice(index, 1)
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true })
      }
    }
  }, [isOpen])

  const dialogProps: DialogProps = {
    'aria-modal': true,
    role: 'dialog',
    tabIndex: -1,
  }
  if (label) dialogProps['aria-label'] = label

  return { dialogProps, dialogRef }
}
