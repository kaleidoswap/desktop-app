import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Eye,
  Link as LinkIcon,
  Loader2,
  Plus,
  Send,
  Download,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Wallet,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import { Modal } from '../../components/ui'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { logger } from '../../utils/logger'

import {
  ALL_METHODS,
  METHOD_BY_ID,
  PRESETS,
  capabilitiesOf,
  type PresetId,
} from './permissions'

/** Mirrors the Rust `db::NwcConnection` (serde, snake_case). */
interface NwcConnection {
  id: number
  account_id: number
  name: string
  client_pubkey: string
  client_secret: string
  relays_json: string
  methods_json: string
  budget_msat: number | null
  spent_msat: number
  budget_renews_at: number | null
  enabled: boolean
  created_at: number
  last_used_at: number | null
}

interface NwcActivity {
  connection_id: number
  connection_name: string
  method: string
  ok: boolean
  timestamp: number
}

const BUDGET_CHOICES = [10_000, 100_000, 1_000_000]

const formatSats = (msat: number) => Math.floor(msat / 1000).toLocaleString()

function parseMethods(json: string): string[] {
  try {
    const v = JSON.parse(json)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

const useRelativeTime = () => {
  const { i18n } = useTranslation()
  return (unixSeconds: number) => {
    const diff = unixSeconds - Date.now() / 1000
    const rtf = new Intl.RelativeTimeFormat(i18n.language || 'en', {
      numeric: 'auto',
    })
    const abs = Math.abs(diff)
    if (abs < 60) return rtf.format(Math.round(diff), 'second')
    if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
    return rtf.format(Math.round(diff / 86400), 'day')
  }
}

const Switch = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) => (
  <button
    aria-checked={checked}
    aria-label={label}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
      checked ? 'bg-primary' : 'bg-surface-elevated'
    }`}
    onClick={onChange}
    role="switch"
    title={label}
    type="button"
  >
    <span
      className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
)

const Section = ({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) => (
  <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-overlay">
    <div className="flex items-center justify-between gap-3 border-b border-divider/10 px-5 py-4">
      <h2 className="text-base font-bold text-white">{title}</h2>
      {action}
    </div>
    {children}
  </section>
)

export const Component = () => {
  const { t } = useTranslation()
  const relativeTime = useRelativeTime()
  const [running, setRunning] = useState(false)
  const [npub, setNpub] = useState<string | null>(null)
  const [connections, setConnections] = useState<NwcConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [activity, setActivity] = useState<NwcActivity[]>([])

  // Manual start (needed when the node was already unlocked at app launch, so
  // the unlock screen — the usual auto-start trigger — was bypassed).
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const autoStartedRef = useRef(false)

  // Add-connection modal state
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [preset, setPreset] = useState<PresetId>('full')
  const [methods, setMethods] = useState<string[]>(PRESETS.full)
  const [budgetSats, setBudgetSats] = useState('')
  const [creating, setCreating] = useState(false)

  const [newUri, setNewUri] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<NwcConnection | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const uriCopy = useCopyToClipboard()
  const npubCopy = useCopyToClipboard(1500)

  const methodLabel = (id: string) =>
    t(`nwc.methods.${id}`, METHOD_BY_ID[id]?.label ?? id)

  const refresh = useCallback(async () => {
    try {
      const [status, pk, conns] = await Promise.all([
        invoke<boolean>('nwc_get_status'),
        invoke<string | null>('nwc_service_npub'),
        invoke<NwcConnection[]>('nwc_list_connections'),
      ])
      setRunning(status)
      setNpub(pk)
      setConnections(conns)
    } catch (err) {
      logger.error('NWC: refresh failed', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 10_000)
    return () => clearInterval(interval)
  }, [refresh])

  useEffect(() => {
    const unlistenPromise = listen<NwcActivity>('nwc:activity', (event) => {
      setActivity((prev) => [event.payload, ...prev].slice(0, 20))
    })
    return () => {
      unlistenPromise.then((unlisten) => unlisten())
    }
  }, [])

  const handleStart = useCallback(async () => {
    setStarting(true)
    setStartError(null)
    try {
      await invoke('nwc_start_service')
      await refresh()
    } catch (err) {
      setStartError(
        typeof err === 'string'
          ? err
          : t('nwc.errors.start', 'Failed to start the service')
      )
    } finally {
      setStarting(false)
    }
  }, [refresh, t])

  // Auto-start once when the page loads and the service isn't running yet
  // (the node is unlocked if we're rendering this page).
  useEffect(() => {
    if (!loading && !running && !autoStartedRef.current) {
      autoStartedRef.current = true
      handleStart()
    }
  }, [loading, running, handleStart])

  const choosePreset = (id: PresetId) => {
    setPreset(id)
    if (id !== 'custom') setMethods(PRESETS[id])
  }

  const toggleMethod = (id: string) => {
    setPreset('custom')
    setMethods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  // Next free "App connection N" so the user can create without typing.
  const generateName = () => {
    const taken = new Set(connections.map((c) => c.name.trim()))
    let n = connections.length + 1
    let candidate = t('nwc.new.defaultName', {
      defaultValue: 'App connection {{n}}',
      n,
    })
    while (taken.has(candidate)) {
      n += 1
      candidate = t('nwc.new.defaultName', {
        defaultValue: 'App connection {{n}}',
        n,
      })
    }
    return candidate
  }

  const openAdd = () => {
    setName(generateName())
    setPreset('full')
    setMethods(PRESETS.full)
    setBudgetSats('')
    setShowAdd(true)
  }

  const handleCreate = async () => {
    if (methods.length === 0) {
      toast.error(t('nwc.errors.permissions', 'Select at least one permission'))
      return
    }
    setCreating(true)
    try {
      const budgetMsat =
        canSpend && budgetSats.trim() !== '' && Number(budgetSats) > 0
          ? Math.round(Number(budgetSats) * 1000)
          : null
      const uri = await invoke<string>('nwc_create_connection', {
        budgetMsat,
        methods,
        name: name.trim() || generateName(),
      })
      setShowAdd(false)
      setNewUri(uri)
      await refresh()
    } catch (err) {
      logger.error('NWC: create connection failed', err)
      toast.error(
        typeof err === 'string'
          ? err
          : t('nwc.errors.create', 'Failed to create the connection')
      )
    } finally {
      setCreating(false)
    }
  }

  const handleToggleEnabled = async (conn: NwcConnection) => {
    try {
      await invoke('nwc_set_connection_enabled', {
        enabled: !conn.enabled,
        id: conn.id,
      })
      await refresh()
    } catch (err) {
      logger.error('NWC: toggle enabled failed', err)
      toast.error(t('nwc.errors.update', 'Failed to update the connection'))
    }
  }

  const handleRevoke = async () => {
    if (!revokeTarget) return
    try {
      await invoke('nwc_revoke_connection', { id: revokeTarget.id })
      await refresh()
      toast.success(t('nwc.revoked', 'Connection revoked'))
    } catch (err) {
      logger.error('NWC: revoke failed', err)
      toast.error(t('nwc.errors.revoke', 'Failed to revoke the connection'))
    } finally {
      setRevokeTarget(null)
    }
  }

  const canSpend = capabilitiesOf(methods).spend

  const presetCards: {
    id: PresetId
    icon: React.ReactNode
    title: string
    description: string
  }[] = [
    {
      description: t(
        'nwc.presets.fullDesc',
        'Lightning and RGB: view, receive and send. Recommended for KaleidoSwap wallets.'
      ),
      icon: <Wallet className="h-4 w-4" />,
      id: 'full',
      title: t('nwc.presets.full', 'Full wallet'),
    },
    {
      description: t(
        'nwc.presets.receiveDesc',
        'View balances and create invoices. Cannot spend.'
      ),
      icon: <Download className="h-4 w-4" />,
      id: 'receive',
      title: t('nwc.presets.receive', 'View & receive'),
    },
    {
      description: t(
        'nwc.presets.viewDesc',
        'Balances, assets and history only.'
      ),
      icon: <Eye className="h-4 w-4" />,
      id: 'view',
      title: t('nwc.presets.view', 'View only'),
    },
    {
      description: t('nwc.presets.customDesc', 'Pick each permission.'),
      icon: <SlidersHorizontal className="h-4 w-4" />,
      id: 'custom',
      title: t('nwc.presets.custom', 'Custom'),
    },
  ]

  const capabilityChips = (connMethods: string[]) => {
    const caps = capabilitiesOf(connMethods)
    return (
      <div className="flex flex-wrap gap-1.5">
        {caps.view && (
          <span className="inline-flex items-center gap-1 rounded-md bg-surface-high px-2 py-0.5 text-xs text-content-secondary">
            <Eye className="h-3 w-3" />
            {t('nwc.caps.view', 'View')}
          </span>
        )}
        {caps.receive && (
          <span className="inline-flex items-center gap-1 rounded-md bg-surface-high px-2 py-0.5 text-xs text-content-secondary">
            <Download className="h-3 w-3" />
            {t('nwc.caps.receive', 'Receive')}
          </span>
        )}
        {caps.spend && (
          <span className="inline-flex items-center gap-1 rounded-md bg-status-warning-subtle px-2 py-0.5 text-xs text-status-warning">
            <Send className="h-3 w-3" />
            {t('nwc.caps.spend', 'Can spend')}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-border-subtle bg-surface-overlay px-5 py-4">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <LinkIcon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-white">
            {t('nwc.title', 'App Connections')}
          </h1>
          <p className="text-sm text-content-secondary">
            {t(
              'nwc.subtitle',
              'Let other apps use this wallet through Nostr Wallet Connect. Your node stays on this computer.'
            )}
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-emphasis disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!running}
          onClick={openAdd}
          type="button"
        >
          <Plus className="h-4 w-4" />
          {t('nwc.add', 'New connection')}
        </button>
      </header>

      {/* Service */}
      <section className="rounded-2xl border border-border-subtle bg-surface-overlay p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              running
                ? 'bg-status-success-subtle text-status-success'
                : 'bg-surface-high text-content-tertiary'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                running
                  ? 'animate-pulse bg-status-success'
                  : 'bg-content-tertiary'
              }`}
            />
            {running
              ? t('nwc.service.running', 'Service running')
              : t('nwc.service.stopped', 'Service stopped')}
          </span>
          <span className="text-xs text-content-tertiary">
            {t(
              'nwc.service.scope',
              'Lightning payments and RGB assets (KaleidoSwap extensions)'
            )}
          </span>
          {!running && !loading && (
            <button
              className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg border border-border-default px-3 text-sm font-medium text-white transition-colors hover:bg-surface-high disabled:opacity-50"
              disabled={starting}
              onClick={handleStart}
              type="button"
            >
              {starting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('nwc.service.start', 'Start service')}
            </button>
          )}
        </div>

        {startError && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-status-danger-subtle p-3 text-xs text-status-danger">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            {startError}
          </p>
        )}

        <div className="mt-4">
          <p className="mb-1.5 text-xs text-content-tertiary">
            {t('nwc.service.identity', 'Wallet service identity')}
          </p>
          <button
            className="group flex w-full items-center gap-3 rounded-lg border border-border-default bg-surface-base/50 px-3 py-2 text-left transition-colors hover:border-primary/40 disabled:cursor-default"
            disabled={!npub}
            onClick={() => npub && npubCopy.copy(npub)}
            type="button"
          >
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-content-primary">
              {npub ?? '—'}
            </span>
            {npubCopy.copied ? (
              <Check className="h-3.5 w-3.5 flex-shrink-0 text-status-success" />
            ) : (
              <Copy className="h-3.5 w-3.5 flex-shrink-0 text-content-tertiary group-hover:text-primary" />
            )}
          </button>
        </div>
      </section>

      {/* Connections */}
      <Section
        title={`${t('nwc.connections', 'Connections')}${
          connections.length ? ` · ${connections.length}` : ''
        }`}
      >
        {connections.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <LinkIcon className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-semibold text-white">
              {t('nwc.empty.title', 'No apps connected yet')}
            </p>
            <p className="mt-1 max-w-sm text-sm text-content-secondary">
              {running
                ? t(
                    'nwc.empty.body',
                    'Create a connection and scan its QR code from the app you want to link, such as the KaleidoSwap mobile wallet.'
                  )
                : t(
                    'nwc.empty.stopped',
                    'Start the service to add a connection.'
                  )}
            </p>
            {running && (
              <button
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-emphasis"
                onClick={openAdd}
                type="button"
              >
                <Plus className="h-4 w-4" />
                {t('nwc.add', 'New connection')}
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-divider/10">
            {connections.map((conn) => {
              const connMethods = parseMethods(conn.methods_json)
              const spends = capabilitiesOf(connMethods).spend
              const budgetPct =
                conn.budget_msat && conn.budget_msat > 0
                  ? Math.min(100, (conn.spent_msat / conn.budget_msat) * 100)
                  : 0
              const isOpen = expanded === conn.id
              return (
                <li className="px-5 py-4" key={conn.id}>
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                        conn.enabled
                          ? 'bg-primary/15 text-primary'
                          : 'bg-surface-high text-content-tertiary'
                      }`}
                    >
                      {conn.name.trim().charAt(0).toUpperCase() || '?'}
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span
                          className={`truncate font-semibold ${
                            conn.enabled
                              ? 'text-white'
                              : 'text-content-secondary'
                          }`}
                        >
                          {conn.name}
                        </span>
                        {!conn.enabled && (
                          <span className="rounded-md bg-surface-high px-1.5 py-0.5 text-[11px] font-medium text-content-tertiary">
                            {t('nwc.paused', 'Paused')}
                          </span>
                        )}
                        <span className="text-xs text-content-tertiary">
                          {conn.last_used_at != null
                            ? t('nwc.lastUsed', {
                                defaultValue: 'Used {{when}}',
                                when: relativeTime(conn.last_used_at),
                              })
                            : t('nwc.neverUsed', 'Never used')}
                        </span>
                      </div>

                      {capabilityChips(connMethods)}

                      {spends &&
                        (conn.budget_msat != null ? (
                          <div className="max-w-sm space-y-1">
                            <div className="h-1.5 overflow-hidden rounded-full bg-surface-high">
                              <div
                                className={`h-full rounded-full ${
                                  budgetPct > 90
                                    ? 'bg-status-danger'
                                    : 'bg-primary'
                                }`}
                                style={{ width: `${budgetPct}%` }}
                              />
                            </div>
                            <p className="text-xs text-content-tertiary">
                              {t('nwc.budgetUsed', {
                                budget: formatSats(conn.budget_msat),
                                defaultValue:
                                  '{{spent}} of {{budget}} sats spent',
                                spent: formatSats(conn.spent_msat),
                              })}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-content-tertiary">
                            {t('nwc.noBudget', 'No spending limit')}
                          </p>
                        ))}

                      <button
                        className="inline-flex items-center gap-1 text-xs font-medium text-content-secondary hover:text-white"
                        onClick={() => setExpanded(isOpen ? null : conn.id)}
                        type="button"
                      >
                        {t('nwc.permissionsCount', {
                          count: connMethods.length,
                          defaultValue: '{{count}} permissions',
                        })}
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {isOpen && (
                        <div className="flex flex-wrap gap-1.5">
                          {connMethods.map((m) => (
                            <span
                              className="rounded-md border border-border-default px-2 py-0.5 text-xs text-content-secondary"
                              key={m}
                              title={m}
                            >
                              {methodLabel(m)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-2">
                      <Switch
                        checked={conn.enabled}
                        label={
                          conn.enabled
                            ? t('nwc.pause', 'Pause')
                            : t('nwc.resume', 'Resume')
                        }
                        onChange={() => handleToggleEnabled(conn)}
                      />
                      <button
                        className="rounded-lg p-2 text-content-tertiary transition-colors hover:bg-status-danger/15 hover:text-status-danger"
                        onClick={() => setRevokeTarget(conn)}
                        title={t('nwc.revoke', 'Revoke')}
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      {activity.length > 0 && (
        <Section title={t('nwc.activity', 'Recent activity')}>
          <ul className="divide-y divide-divider/10">
            {activity.map((a, i) => (
              <li
                className="flex items-center gap-3 px-5 py-2.5 text-sm"
                key={i}
              >
                <span
                  className={`h-2 w-2 flex-shrink-0 rounded-full ${
                    a.ok ? 'bg-status-success' : 'bg-status-danger'
                  }`}
                />
                <span className="min-w-0 flex-1 truncate text-content-primary">
                  {a.connection_name}
                  <span className="text-content-tertiary">
                    {' '}
                    · {methodLabel(a.method)}
                  </span>
                </span>
                <span className="flex-shrink-0 text-xs tabular-nums text-content-tertiary">
                  {new Date(a.timestamp * 1000).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* New connection */}
      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        size="lg"
        title={t('nwc.new.title', 'New app connection')}
      >
        <div className="space-y-5 p-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-white">
              {t('nwc.new.name', 'Name')}
            </label>
            <input
              autoFocus
              onFocus={(e) => e.target.select()}
              className="w-full rounded-lg border border-border-default bg-surface-base/60 px-3.5 py-2.5 text-sm text-white placeholder:text-content-tertiary focus:border-primary focus:outline-none"
              onChange={(e) => setName(e.target.value)}
              placeholder={t(
                'nwc.new.namePlaceholder',
                'e.g. Rate mobile, Browser extension'
              )}
              value={name}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-white">
              {t('nwc.new.access', 'Access')}
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {presetCards.map((p) => (
                <button
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                    preset === p.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border-default hover:border-primary/40'
                  }`}
                  key={p.id}
                  onClick={() => choosePreset(p.id)}
                  type="button"
                >
                  <span
                    className={`mt-0.5 rounded-lg p-1.5 ${
                      preset === p.id
                        ? 'bg-primary/20 text-primary'
                        : 'bg-surface-high text-content-secondary'
                    }`}
                  >
                    {p.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">
                      {p.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-content-tertiary">
                      {p.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {preset === 'custom' && (
            <div className="grid gap-4 rounded-xl border border-border-default bg-surface-base/40 p-4 sm:grid-cols-2">
              {(['lightning', 'rgb'] as const).map((group) => (
                <div className="space-y-2" key={group}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
                    {group === 'lightning'
                      ? t('nwc.new.groupLightning', 'Lightning')
                      : t('nwc.new.groupRgb', 'RGB assets')}
                  </p>
                  {ALL_METHODS.filter((m) => m.group === group).map((m) => (
                    <label
                      className="flex cursor-pointer items-center gap-2.5 text-sm text-content-primary"
                      key={m.id}
                    >
                      <input
                        checked={methods.includes(m.id)}
                        className="h-4 w-4 accent-primary"
                        onChange={() => toggleMethod(m.id)}
                        type="checkbox"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {methodLabel(m.id)}
                      </span>
                      {m.capability === 'spend' && (
                        <Send className="h-3.5 w-3.5 flex-shrink-0 text-status-warning" />
                      )}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}

          {canSpend && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white">
                {t('nwc.new.budget', 'Spending limit')}
              </label>
              <div className="flex flex-wrap gap-2">
                {BUDGET_CHOICES.map((b) => (
                  <button
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      budgetSats === String(b)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border-default text-content-secondary hover:text-white'
                    }`}
                    key={b}
                    onClick={() => setBudgetSats(String(b))}
                    type="button"
                  >
                    {b.toLocaleString()} sats
                  </button>
                ))}
                <button
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    budgetSats === ''
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border-default text-content-secondary hover:text-white'
                  }`}
                  onClick={() => setBudgetSats('')}
                  type="button"
                >
                  {t('nwc.new.noLimit', 'No limit')}
                </button>
              </div>
              <input
                className="w-full rounded-lg border border-border-default bg-surface-base/60 px-3.5 py-2.5 text-sm text-white placeholder:text-content-tertiary focus:border-primary focus:outline-none"
                min={0}
                onChange={(e) => setBudgetSats(e.target.value)}
                placeholder={t('nwc.new.customBudget', 'Custom amount in sats')}
                type="number"
                value={budgetSats}
              />
              <p className="text-xs text-content-tertiary">
                {t(
                  'nwc.new.budgetHint',
                  'Caps the total this app can send. Leave empty for no limit.'
                )}
              </p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-divider/10 bg-surface-base px-5 py-4">
          <button
            className="h-10 rounded-lg px-4 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-overlay hover:text-white"
            onClick={() => setShowAdd(false)}
            type="button"
          >
            {t('nwc.cancel', 'Cancel')}
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-emphasis disabled:opacity-50"
            disabled={creating}
            onClick={handleCreate}
            type="button"
          >
            {creating && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('nwc.new.create', 'Create connection')}
          </button>
        </div>
      </Modal>

      {/* Connection string */}
      <Modal
        isOpen={newUri !== null}
        onClose={() => setNewUri(null)}
        size="md"
        title={t('nwc.connect.title', 'Connect your app')}
      >
        <div className="space-y-4 p-5">
          <p className="flex items-start gap-2 rounded-xl border border-status-warning/30 bg-status-warning-subtle p-3 text-xs leading-relaxed text-content-primary">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-status-warning" />
            {t(
              'nwc.connect.warning',
              'This code gives the app the permissions you chose. It is shown only once: scan it or copy it now, and do not share it.'
            )}
          </p>
          {newUri && (
            <div className="mx-auto w-fit rounded-2xl bg-white p-3">
              <QRCodeSVG level="M" size={220} value={newUri} />
            </div>
          )}
          <button
            className="group flex w-full items-center gap-3 rounded-lg border border-border-default bg-surface-base/50 px-3 py-2.5 text-left hover:border-primary/40"
            onClick={() => newUri && uriCopy.copy(newUri)}
            type="button"
          >
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-content-secondary">
              {newUri}
            </span>
            {uriCopy.copied ? (
              <Check className="h-4 w-4 flex-shrink-0 text-status-success" />
            ) : (
              <Copy className="h-4 w-4 flex-shrink-0 text-content-tertiary group-hover:text-primary" />
            )}
          </button>
          <button
            className="h-10 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-emphasis"
            onClick={() => setNewUri(null)}
            type="button"
          >
            {t('nwc.done', 'Done')}
          </button>
        </div>
      </Modal>

      {/* Revoke confirmation */}
      <Modal
        isOpen={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        size="sm"
        title={t('nwc.revokeTitle', 'Revoke connection')}
      >
        <div className="space-y-5 p-5">
          <p className="text-sm leading-relaxed text-content-secondary">
            {t('nwc.revokeBody', {
              defaultValue:
                '“{{name}}” will lose access to this wallet immediately. To reconnect it you will need a new connection.',
              name: revokeTarget?.name ?? '',
            })}
          </p>
          <div className="flex gap-2">
            <button
              className="h-10 flex-1 rounded-lg border border-border-default text-sm font-medium text-white hover:bg-surface-high"
              onClick={() => setRevokeTarget(null)}
              type="button"
            >
              {t('nwc.cancel', 'Cancel')}
            </button>
            <button
              className="h-10 flex-1 rounded-lg bg-status-danger text-sm font-semibold text-white hover:opacity-90"
              onClick={handleRevoke}
              type="button"
            >
              {t('nwc.revoke', 'Revoke')}
            </button>
          </div>
        </div>
      </Modal>

      {activity.length === 0 && connections.length > 0 && (
        <p className="flex items-center justify-center gap-2 text-xs text-content-tertiary">
          <Activity className="h-3.5 w-3.5" />
          {t(
            'nwc.activityHint',
            'Requests from connected apps will appear here while this page is open.'
          )}
        </p>
      )}
    </div>
  )
}
