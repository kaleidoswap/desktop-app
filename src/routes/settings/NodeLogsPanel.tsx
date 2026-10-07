import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import {
  Activity,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Pause,
  Play,
  RefreshCw,
  Search,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { logger } from '../../utils/logger'

import { TerminalLogDisplay } from './TerminalLogDisplay'

const POLL_MS = 3000
const MAX_FAILURES = 3
const PAGE_SIZES = [100, 200, 500, 1000]

interface NodeLogsResponse {
  logs: string[]
  total: number
}

const iconButton =
  'p-2 rounded-lg border border-border-default text-content-secondary hover:text-white hover:bg-surface-high/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

export const NodeLogsPanel = () => {
  const { t } = useTranslation()
  const { copied, copy } = useCopyToClipboard(1500)

  const [logs, setLogs] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  // Page 1 is the newest lines (the node command paginates newest-first).
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(200)
  const [paused, setPaused] = useState(false)
  const [filter, setFilter] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [failures, setFailures] = useState(0)
  // Scrolled up to read: hold the view still until the user returns.
  const [reading, setReading] = useState(false)
  const [jumpSignal, setJumpSignal] = useState(0)

  const inFlight = useRef(false)

  const fetchLogs = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setRefreshing(true)
    try {
      const result = await invoke<NodeLogsResponse>('get_node_logs', {
        page,
        pageSize,
      })
      setLogs(result.logs)
      setTotal(result.total)
      setFailures(0)
    } catch (error) {
      logger.error('Failed to fetch node logs:', error)
      setFailures((n) => n + 1)
    } finally {
      inFlight.current = false
      setRefreshing(false)
      setLoaded(true)
    }
  }, [page, pageSize])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Only the newest page is live; older pages stay put while being read.
  const live = page === 1 && !paused && !reading && failures < MAX_FAILURES
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchLogs()
    }, POLL_MS)
    return () => clearInterval(id)
  }, [live, fetchLogs])

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return q ? logs.filter((l) => l.toLowerCase().includes(q)) : logs
  }, [logs, filter])

  const pages = Math.max(1, Math.ceil(total / pageSize))

  const handleExport = async () => {
    try {
      const filePath = await save({
        defaultPath: `node-logs-${new Date().toISOString().split('T')[0]}.txt`,
        filters: [{ extensions: ['txt'], name: 'Log Files' }],
      })
      if (filePath) {
        await invoke('save_logs_to_file', { filePath })
        toast.success(t('settings.logs.exported', 'Logs exported'))
      }
    } catch {
      toast.error(t('settings.logs.exportFailed', 'Failed to export logs'))
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-overlay">
      {/* Title + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-divider/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 flex-shrink-0 text-primary" />
          <h2 className="text-base font-bold text-white">
            {t('settings.nodeLogs')}
          </h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
              live
                ? 'bg-status-success-subtle text-status-success'
                : 'bg-surface-high text-content-tertiary'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                live ? 'animate-pulse bg-status-success' : 'bg-content-tertiary'
              }`}
            />
            {live
              ? t('settings.logs.live', 'Live')
              : t('settings.logs.paused', 'Paused')}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            className={iconButton}
            disabled={page !== 1}
            onClick={() => {
              setPaused((p) => !p)
              setFailures(0)
            }}
            title={
              paused
                ? t('settings.logs.resume', 'Resume live updates')
                : t('settings.logs.pause', 'Pause live updates')
            }
            type="button"
          >
            {paused ? (
              <Play className="h-4 w-4" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
          </button>
          <button
            className={iconButton}
            disabled={refreshing}
            onClick={() => {
              setFailures(0)
              fetchLogs()
            }}
            title={t('settings.refreshLogs')}
            type="button"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            className={iconButton}
            disabled={visible.length === 0}
            onClick={() => copy(visible.join('\n'))}
            title={t('settings.logs.copy', 'Copy visible lines')}
            type="button"
          >
            {copied ? (
              <Check className="h-4 w-4 text-status-success" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
          <button
            className={iconButton}
            disabled={total === 0}
            onClick={handleExport}
            title={t('settings.exportLogs')}
            type="button"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filter + paging */}
      <div className="flex flex-wrap items-center gap-3 border-b border-divider/10 bg-surface-base/50 px-5 py-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-content-tertiary" />
          <input
            className="w-full rounded-lg border border-border-default bg-surface-base/60 py-1.5 pl-9 pr-3 text-sm text-white placeholder:text-content-tertiary focus:border-primary focus:outline-none"
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('settings.logs.filter', 'Filter lines…')}
            type="text"
            value={filter}
          />
        </div>
        <select
          className="rounded-lg border border-border-default bg-surface-base/60 px-2 py-1.5 text-sm text-white focus:outline-none"
          onChange={(e) => {
            setPageSize(Number(e.target.value))
            setPage(1)
          }}
          title={t('settings.show')}
          value={pageSize}
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n} {t('settings.entries')}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
          <button
            className={iconButton}
            disabled={page >= pages}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            title={t('settings.logs.older', 'Older')}
            type="button"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="tabular-nums">
            {t('settings.page')} {page} {t('settings.of')} {pages}
          </span>
          <button
            className={iconButton}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            title={t('settings.logs.newer', 'Newer')}
            type="button"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {failures >= MAX_FAILURES && (
        <div className="flex items-center justify-between gap-3 border-b border-divider/10 bg-status-danger-subtle px-5 py-2 text-xs text-status-danger">
          {t(
            'settings.logs.fetchError',
            'Could not read the node logs. Live updates are stopped.'
          )}
          <button
            className="font-semibold underline underline-offset-2"
            onClick={() => {
              setFailures(0)
              fetchLogs()
            }}
            type="button"
          >
            {t('settings.refreshLogs')}
          </button>
        </div>
      )}

      <div className="relative h-[520px] bg-surface-base/95">
        {reading && page === 1 && (
          <button
            className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border-default bg-surface-high px-4 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-surface-elevated"
            onClick={() => {
              setReading(false)
              setJumpSignal((n) => n + 1)
              fetchLogs()
            }}
            type="button"
          >
            {t('settings.logs.jumpToLatest', 'Back to latest')}
          </button>
        )}
        {!loaded ? (
          <div className="flex h-full items-center justify-center gap-3 text-sm text-content-secondary">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            {t('settings.loadingLogs')}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-content-tertiary">
            <Activity className="h-4 w-4" />
            {logs.length === 0
              ? t('settings.noLogsAvailable')
              : t('settings.logs.noMatches', 'No lines match the filter')}
          </div>
        ) : (
          <TerminalLogDisplay
            follow={page === 1}
            logs={visible}
            onAtBottomChange={(atBottom) => setReading(!atBottom)}
            scrollToBottomSignal={jumpSignal}
          />
        )}
      </div>

      <div className="flex justify-between border-t border-divider/10 px-5 py-2 text-xs text-content-tertiary">
        <span>
          {filter.trim()
            ? t('settings.logs.matching', {
                count: visible.length,
                defaultValue: '{{count}} matching lines',
              })
            : null}
        </span>
        <span className="tabular-nums">
          {total} {t('settings.totalEntries')}
        </span>
      </div>
    </section>
  )
}
