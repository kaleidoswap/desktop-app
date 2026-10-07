import { openUrl } from '@tauri-apps/plugin-opener'
import { relaunch } from '@tauri-apps/plugin-process'
import { Update } from '@tauri-apps/plugin-updater'
import {
  X,
  Download,
  CheckCircle2,
  RefreshCw,
  Calendar,
  Sparkles,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { logger } from '../../utils/logger'

interface UpdateModalProps {
  isOpen: boolean
  onClose: () => void
  update: Update
}

// A download that makes no progress for this long is reported as stalled.
const STALL_TIMEOUT_MS = 120_000
const RELAUNCH_DELAY_MS = 2000

// The release body starts with the build workflow's generic header; the
// changelog section follows it.
const cleanReleaseNotes = (body: string) =>
  body
    .replace(/^\s*Release v[\w.-]+\s*\n/i, '')
    .replace(
      /^\s*See the assets to download and install this version\.\s*\n/i,
      ''
    )
    .replace(/^\s*## \[Version [^\]]+\][^\n]*\n/, '')
    .trim()

const notesComponents: Components = {
  a: ({ children, href }) => (
    <a
      className="text-primary underline underline-offset-2 hover:text-primary-emphasis"
      href={href}
      onClick={(e) => {
        e.preventDefault()
        if (href) openUrl(href)
      }}
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <div className="my-3 rounded-xl border border-status-warning/30 bg-status-warning-subtle p-3 text-sm leading-relaxed text-content-primary [&_p]:my-0 [&_p]:text-content-primary">
      {children}
    </div>
  ),
  code: ({ children }) => (
    <code className="rounded bg-surface-overlay px-1 py-0.5 font-mono text-xs text-content-primary">
      {children}
    </code>
  ),
  h1: ({ children }) => (
    <h3 className="mb-2 mt-4 text-sm font-semibold text-content-primary first:mt-0">
      {children}
    </h3>
  ),
  h2: ({ children }) => (
    <h3 className="mb-2 mt-4 text-sm font-semibold text-content-primary first:mt-0">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-content-secondary first:mt-0">
      {children}
    </h4>
  ),
  li: ({ children }) => (
    <li className="pl-1 text-sm leading-relaxed text-content-secondary marker:text-content-tertiary">
      {children}
    </li>
  ),
  p: ({ children }) => (
    <p className="my-2 text-sm leading-relaxed text-content-secondary">
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-content-primary">{children}</strong>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1.5 pl-5">{children}</ul>
  ),
}

const Overlay = ({
  children,
  onBackdrop,
}: {
  children: React.ReactNode
  onBackdrop?: () => void
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm sm:p-6"
    onClick={(e) => {
      if (e.target === e.currentTarget) onBackdrop?.()
    }}
  >
    {children}
  </div>
)

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  update,
}) => {
  const { t, i18n } = useTranslation()
  const [isInstalling, setIsInstalling] = useState(false)
  const [contentLength, setContentLength] = useState<number>()
  const [downloaded, setDownloaded] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stallTimer = useRef<ReturnType<typeof setTimeout>>()

  const canClose = !isInstalling && !completed

  useEffect(() => {
    if (!isOpen || !canClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, canClose, onClose])

  useEffect(() => () => clearTimeout(stallTimer.current), [])

  if (!isOpen) return null

  const sizeUnits =
    (t('updaterModal.fileSizes', { returnObjects: true }) as string[]) || []

  const formatFileSize = (bytes: number) => {
    const sizes = sizeUnits.length > 0 ? sizeUnits : ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return t('updaterModal.fileSizeZero')
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(i18n.language || 'en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  const armStallTimer = () => {
    clearTimeout(stallTimer.current)
    stallTimer.current = setTimeout(() => {
      logger.warn('Update download stalled')
      setError(t('updaterModal.errors.timeout'))
      setIsInstalling(false)
    }, STALL_TIMEOUT_MS)
  }

  const handleInstall = async () => {
    setIsInstalling(true)
    setError(null)
    setDownloaded(0)
    setContentLength(undefined)
    setCompleted(false)
    armStallTimer()

    let received = 0
    try {
      logger.debug('Starting update installation', { version: update.version })
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            setContentLength(event.data.contentLength || undefined)
            armStallTimer()
            break
          case 'Progress':
            received += event.data.chunkLength
            setDownloaded(received)
            armStallTimer()
            break
          case 'Finished':
            // Installing can take a while with no progress events.
            clearTimeout(stallTimer.current)
            break
        }
      })
      // downloadAndInstall resolves once the update is installed.
      clearTimeout(stallTimer.current)
      setCompleted(true)
      setIsInstalling(false)
      setTimeout(() => relaunch(), RELAUNCH_DELAY_MS)
    } catch (err) {
      logger.error('Download/install error:', err)
      clearTimeout(stallTimer.current)
      const message = err instanceof Error ? err.message : String(err)
      setError(t('updaterModal.errors.installFailed', { message }))
      setIsInstalling(false)
    }
  }

  if (completed) {
    return (
      <Overlay>
        <div className="max-h-full w-full max-w-md overflow-y-auto rounded-3xl border border-border-default bg-surface-base p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-status-success-subtle">
            <CheckCircle2 className="h-7 w-7 text-status-success" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-content-primary">
            {t('updaterModal.completed.title')}
          </h2>
          <p className="mb-1 text-sm text-content-secondary">
            {t('updaterModal.completed.success', { version: update.version })}
          </p>
          <p className="mb-6 text-xs text-content-tertiary">
            {t('updaterModal.completed.restartNote')}
          </p>
          <div className="mb-5 flex items-center justify-center gap-2 text-sm text-content-secondary">
            <RefreshCw className="h-4 w-4 animate-spin text-status-success" />
            {t('updaterModal.completed.restarting')}
          </div>
          <p className="rounded-xl bg-surface-overlay/50 p-3 text-xs text-content-tertiary">
            {t('updaterModal.completed.manualRestart')}
          </p>
        </div>
      </Overlay>
    )
  }

  if (isInstalling) {
    const progress = contentLength
      ? Math.min(100, Math.round((downloaded / contentLength) * 100))
      : null

    return (
      <Overlay>
        <div className="max-h-full w-full max-w-md overflow-y-auto rounded-3xl border border-border-default bg-surface-base p-8 shadow-2xl">
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
              <Download className="h-7 w-7 text-primary" />
            </div>
            <h2 className="mb-1 text-xl font-bold text-content-primary">
              {t('updaterModal.installing.title')}
            </h2>
            <p className="mb-1 text-sm text-content-secondary">
              {t('updaterModal.installing.versionLabel', {
                version: update.version,
              })}
            </p>
            <p className="mb-6 text-xs text-content-tertiary">
              {t('updaterModal.installing.warning')}
            </p>
          </div>

          <div className="space-y-3 rounded-2xl border border-border-default bg-surface-overlay/40 p-5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-content-secondary">
                {progress === 100
                  ? t('updaterModal.installing.installing')
                  : t('updaterModal.installing.downloading')}
              </span>
              <span className="font-semibold tabular-nums text-content-primary">
                {progress != null ? `${progress}%` : ''}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-high">
              {progress != null ? (
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              ) : (
                <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
              )}
            </div>
            <div className="flex justify-between text-xs text-content-tertiary">
              <span>{t('updaterModal.installing.downloadedLabel')}</span>
              <span className="tabular-nums">
                {formatFileSize(downloaded)}
                {contentLength ? ` / ${formatFileSize(contentLength)}` : ''}
              </span>
            </div>
          </div>
        </div>
      </Overlay>
    )
  }

  if (error) {
    return (
      <Overlay onBackdrop={onClose}>
        <div className="max-h-full w-full max-w-md overflow-y-auto rounded-3xl border border-border-default bg-surface-base p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-status-danger-subtle">
            <AlertTriangle className="h-7 w-7 text-status-danger" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-content-primary">
            {t('updaterModal.error.title')}
          </h2>
          <p className="mb-6 break-words text-sm leading-relaxed text-content-secondary">
            {error}
          </p>
          <div className="flex gap-3">
            <button
              className="flex-1 rounded-xl border border-border-default px-4 py-2.5 text-sm font-medium text-content-primary transition-colors hover:bg-surface-overlay"
              onClick={onClose}
              type="button"
            >
              {t('common.close')}
            </button>
            <button
              className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-emphasis"
              onClick={handleInstall}
              type="button"
            >
              {t('updaterModal.error.retry')}
            </button>
          </div>
        </div>
      </Overlay>
    )
  }

  const notes = update.body ? cleanReleaseNotes(update.body) : ''

  return (
    <Overlay onBackdrop={onClose}>
      <div
        aria-modal="true"
        className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-border-default bg-surface-base shadow-2xl"
        role="dialog"
      >
        {/* Header — always visible */}
        <div className="flex flex-shrink-0 items-start gap-4 border-b border-divider/10 p-6">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/15">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-content-primary">
              {t('updaterModal.default.title')}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-content-secondary">
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-semibold text-primary">
                {t('updaterModal.default.versionLabel')} {update.version}
              </span>
              {update.date && (
                <span className="inline-flex items-center gap-1.5 text-xs text-content-tertiary">
                  <Calendar className="h-3.5 w-3.5" />
                  {t('updaterModal.default.releasedOn', {
                    date: formatDate(update.date),
                  })}
                </span>
              )}
            </div>
          </div>
          <button
            aria-label={t('common.close')}
            className="-mr-2 -mt-2 rounded-full p-2 text-content-secondary transition-colors hover:bg-surface-high hover:text-content-primary"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Release notes — the only scrolling region */}
        {notes && (
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-tertiary">
              {t('updaterModal.common.whatsNew')}
            </p>
            <ReactMarkdown
              components={notesComponents}
              remarkPlugins={[remarkGfm]}
            >
              {notes}
            </ReactMarkdown>
          </div>
        )}

        {/* Actions — always visible */}
        <div className="flex flex-shrink-0 flex-col gap-2 border-t border-divider/10 p-6 sm:flex-row-reverse">
          <button
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-emphasis disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isInstalling}
            onClick={handleInstall}
            type="button"
          >
            {isInstalling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t('updaterModal.default.installCta')}
          </button>
          <button
            className="rounded-xl px-5 py-3 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-overlay hover:text-content-primary sm:flex-1"
            onClick={onClose}
            type="button"
          >
            {t('updaterModal.default.remindLater')}
          </button>
        </div>
      </div>
    </Overlay>
  )
}
