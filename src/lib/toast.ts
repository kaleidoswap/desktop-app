import type * as React from 'react'
import { toast as sonner, type ExternalToast } from 'sonner'

/**
 * Thin compatibility shim over sonner that preserves the react-toastify
 * subset used across this codebase (toast.warn, toast.update with render/type/
 * isLoading/autoClose, toastId option, etc.). New code should prefer calling
 * sonner directly via `import { toast } from 'sonner'`.
 */

type LegacyType = 'success' | 'error' | 'warning' | 'info' | 'default'

interface LegacyOptions {
  autoClose?: number | false
  toastId?: string | number
  closeOnClick?: boolean
  hideProgressBar?: boolean
  pauseOnHover?: boolean
  pauseOnFocusLoss?: boolean
  draggable?: boolean
  position?: string
  icon?: React.ReactNode | (() => React.ReactNode)
  onClose?: () => void
  onOpen?: () => void
  onClick?: (e: unknown) => void
  closeButton?: boolean
  isLoading?: boolean
  /** react-toastify-only styling props — accepted and ignored. */
  progressStyle?: Record<string, unknown>
  style?: Record<string, unknown>
  className?: string
  bodyStyle?: Record<string, unknown>
  bodyClassName?: string
}

interface UpdateOptions extends LegacyOptions {
  render?: string
  type?: LegacyType
  isLoading?: boolean
}

const toSonnerOpts = (opts?: LegacyOptions): ExternalToast | undefined => {
  if (!opts) return undefined
  const out: ExternalToast = {}
  if (opts.toastId !== undefined) out.id = opts.toastId
  if (opts.autoClose === false) out.duration = Infinity
  else if (typeof opts.autoClose === 'number') out.duration = opts.autoClose
  if (opts.icon !== undefined) {
    out.icon =
      typeof opts.icon === 'function'
        ? (opts.icon as () => React.ReactNode)()
        : opts.icon
  }
  if (opts.onClose) out.onDismiss = opts.onClose
  if (opts.closeButton !== undefined) out.closeButton = opts.closeButton
  return out
}

const base = (msg: string, opts?: LegacyOptions) =>
  sonner(msg, toSonnerOpts(opts))

export const toast = Object.assign(base, {
  dismiss: (id?: string | number) => sonner.dismiss(id),
  error: (msg: string, opts?: LegacyOptions) =>
    sonner.error(msg, toSonnerOpts(opts)),
  info: (msg: string, opts?: LegacyOptions) =>
    sonner.info(msg, toSonnerOpts(opts)),
  loading: (msg: string, opts?: LegacyOptions) =>
    sonner.loading(msg, toSonnerOpts(opts)),
  success: (msg: string, opts?: LegacyOptions) =>
    sonner.success(msg, toSonnerOpts(opts)),
  update: (id: string | number, options: UpdateOptions) => {
    const { render = '', type = 'default', isLoading, ...rest } = options
    const sonnerOpts: ExternalToast = { id, ...toSonnerOpts(rest) }
    if (isLoading) return sonner.loading(render, sonnerOpts)
    switch (type) {
      case 'success':
        return sonner.success(render, sonnerOpts)
      case 'error':
        return sonner.error(render, sonnerOpts)
      case 'warning':
        return sonner.warning(render, sonnerOpts)
      case 'info':
        return sonner.info(render, sonnerOpts)
      default:
        return sonner(render, sonnerOpts)
    }
  },
  warn: (msg: string, opts?: LegacyOptions) =>
    sonner.warning(msg, toSonnerOpts(opts)),
  warning: (msg: string, opts?: LegacyOptions) =>
    sonner.warning(msg, toSonnerOpts(opts)),
})
