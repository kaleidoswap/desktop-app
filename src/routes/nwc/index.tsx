import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'

import { Alert, Badge, Button, Card, Input, Modal } from '../../components/ui'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { logger } from '../../utils/logger'

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

/** All methods the Rust service implements. */
const ALL_METHODS: { id: string; label: string; payment: boolean }[] = [
  { id: 'get_info', label: 'Get node info', payment: false },
  { id: 'get_balance', label: 'Get balance', payment: false },
  { id: 'make_invoice', label: 'Create invoices', payment: false },
  { id: 'lookup_invoice', label: 'Look up invoices', payment: false },
  { id: 'list_transactions', label: 'List transactions', payment: false },
  { id: 'pay_invoice', label: 'Pay invoices', payment: true },
  { id: 'pay_keysend', label: 'Send keysend', payment: true },
]

const DEFAULT_METHODS = [
  'get_info',
  'get_balance',
  'make_invoice',
  'lookup_invoice',
  'list_transactions',
  'pay_invoice',
]

const SATS_PER_BTC = 100_000_000

function formatSats(msat: number): string {
  return Math.floor(msat / 1000).toLocaleString()
}

function parseMethods(json: string): string[] {
  try {
    const v = JSON.parse(json)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export const Component = () => {
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
  const [methods, setMethods] = useState<string[]>(DEFAULT_METHODS)
  const [budgetSats, setBudgetSats] = useState('')
  const [creating, setCreating] = useState(false)

  // Result (connection URI) modal state
  const [newUri, setNewUri] = useState<string | null>(null)
  const { copied, copy } = useCopyToClipboard()

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
        typeof err === 'string' ? err : 'Failed to start the NWC service'
      )
    } finally {
      setStarting(false)
    }
  }, [refresh])

  // Auto-start once when the page loads and the service isn't running yet
  // (the node is unlocked if we're rendering this page).
  useEffect(() => {
    if (!loading && !running && !autoStartedRef.current) {
      autoStartedRef.current = true
      handleStart()
    }
  }, [loading, running, handleStart])

  const toggleMethod = (id: string) => {
    setMethods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  const resetAddForm = () => {
    setName('')
    setMethods(DEFAULT_METHODS)
    setBudgetSats('')
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Please enter a name for this connection')
      return
    }
    if (methods.length === 0) {
      toast.error('Select at least one permission')
      return
    }
    setCreating(true)
    try {
      const budgetMsat =
        budgetSats.trim() !== '' && Number(budgetSats) > 0
          ? Math.round(Number(budgetSats) * 1000)
          : null
      const uri = await invoke<string>('nwc_create_connection', {
        budgetMsat,
        methods,
        name: name.trim(),
      })
      setShowAdd(false)
      resetAddForm()
      setNewUri(uri)
      await refresh()
    } catch (err) {
      logger.error('NWC: create connection failed', err)
      toast.error(typeof err === 'string' ? err : 'Failed to create connection')
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
      toast.error('Failed to update connection')
    }
  }

  const handleRevoke = async (conn: NwcConnection) => {
    if (
      !window.confirm(
        `Revoke "${conn.name}"? The connected app will lose access immediately.`
      )
    ) {
      return
    }
    try {
      await invoke('nwc_revoke_connection', { id: conn.id })
      await refresh()
      toast.success('Connection revoked')
    } catch (err) {
      logger.error('NWC: revoke failed', err)
      toast.error('Failed to revoke connection')
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-content-primary">
          App Connections (NWC)
        </h1>
        <p className="text-content-secondary mt-1">
          Connect external apps to this wallet over Nostr Wallet Connect
          (NIP-47). Your node stays on this machine — apps talk to it through
          relays using the connection string you share with them.
        </p>
      </div>

      {!running && !loading && (
        <Card title="Service not running">
          <div className="space-y-3">
            <p className="text-content-secondary text-sm">
              The NWC service starts automatically when your wallet is unlocked.
              If it isn’t running, start it here.
            </p>
            {startError && (
              <Alert title="Could not start" variant="error">
                {startError}
              </Alert>
            )}
            <Button
              isLoading={starting}
              onClick={handleStart}
              variant="primary"
            >
              Start service
            </Button>
          </div>
        </Card>
      )}

      <Card
        action={
          <Badge variant={running ? 'success' : 'default'}>
            {running ? 'Running' : 'Stopped'}
          </Badge>
        }
        title="Service status"
      >
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-content-secondary">
              Wallet service identity
            </span>
            <span className="font-mono text-content-primary break-all text-right">
              {npub ?? '—'}
            </span>
          </div>
          <p className="text-content-tertiary">
            Scope: Bitcoin Lightning only. RGB-asset support over NWC is not yet
            available.
          </p>
        </div>
      </Card>

      <Card
        action={
          <Button
            disabled={!running}
            onClick={() => setShowAdd(true)}
            size="sm"
            variant="primary"
          >
            Add connection
          </Button>
        }
        title="Connections"
      >
        {connections.length === 0 ? (
          <p className="text-content-secondary text-sm py-4 text-center">
            No app connections yet.
            {running
              ? ' Click “Add connection” to create one.'
              : ' Unlock your wallet to add one.'}
          </p>
        ) : (
          <ul className="divide-y divide-divider">
            {connections.map((conn) => {
              const connMethods = parseMethods(conn.methods_json)
              return (
                <li
                  className="py-4 flex items-start justify-between gap-4"
                  key={conn.id}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-content-primary">
                        {conn.name}
                      </span>
                      <Badge
                        size="sm"
                        variant={conn.enabled ? 'success' : 'default'}
                      >
                        {conn.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {connMethods.map((m) => (
                        <Badge key={m} size="sm" variant="info">
                          {m}
                        </Badge>
                      ))}
                    </div>
                    {conn.budget_msat != null && (
                      <p className="text-xs text-content-secondary mt-2">
                        Budget: {formatSats(conn.spent_msat)} /{' '}
                        {formatSats(conn.budget_msat)} sats spent
                      </p>
                    )}
                    {conn.last_used_at != null && (
                      <p className="text-xs text-content-tertiary mt-1">
                        Last used:{' '}
                        {new Date(conn.last_used_at * 1000).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Button
                      onClick={() => handleToggleEnabled(conn)}
                      size="sm"
                      variant="ghost"
                    >
                      {conn.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      onClick={() => handleRevoke(conn)}
                      size="sm"
                      variant="danger"
                    >
                      Revoke
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {activity.length > 0 && (
        <Card title="Recent activity">
          <ul className="divide-y divide-divider text-sm">
            {activity.map((a, i) => (
              <li className="py-2 flex justify-between gap-4" key={i}>
                <span className="text-content-primary">
                  {a.connection_name} ·{' '}
                  <span className="font-mono">{a.method}</span>
                </span>
                <span className="flex items-center gap-2 text-content-tertiary">
                  {new Date(a.timestamp * 1000).toLocaleTimeString()}
                  <Badge size="sm" variant={a.ok ? 'success' : 'danger'}>
                    {a.ok ? 'ok' : 'error'}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Add-connection modal */}
      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        size="md"
        title="New app connection"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">
              Name
            </label>
            <Input
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rate mobile, Browser extension"
              value={name}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-content-secondary mb-2">
              Permissions
            </label>
            <div className="space-y-2">
              {ALL_METHODS.map((m) => (
                <label
                  className="flex items-center gap-2 text-sm text-content-primary cursor-pointer"
                  key={m.id}
                >
                  <input
                    checked={methods.includes(m.id)}
                    onChange={() => toggleMethod(m.id)}
                    type="checkbox"
                  />
                  <span>{m.label}</span>
                  {m.payment && (
                    <Badge size="sm" variant="warning">
                      spends funds
                    </Badge>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">
              Spending budget (sats, optional)
            </label>
            <Input
              onChange={(e) => setBudgetSats(e.target.value)}
              placeholder="Leave empty for unlimited"
              type="number"
              value={budgetSats}
            />
            <p className="text-xs text-content-tertiary mt-1">
              Caps total outgoing payments for this connection
              {budgetSats && Number(budgetSats) > 0
                ? ` (${(Number(budgetSats) / SATS_PER_BTC).toFixed(8)} BTC)`
                : ''}
              .
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setShowAdd(false)} variant="ghost">
              Cancel
            </Button>
            <Button
              isLoading={creating}
              onClick={handleCreate}
              variant="primary"
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>

      {/* Connection-string result modal */}
      <Modal
        isOpen={newUri !== null}
        onClose={() => setNewUri(null)}
        size="md"
        title="Connect your app"
      >
        <div className="space-y-4">
          <Alert title="Save this now" variant="warning">
            This connection string grants the configured permissions to your
            wallet. It is shown once — copy it or scan the QR into your app now.
          </Alert>

          {newUri && (
            <div className="flex justify-center bg-white p-4 rounded-xl">
              <QRCodeSVG includeMargin size={232} value={newUri} />
            </div>
          )}

          <div className="bg-surface-overlay rounded-lg p-3">
            <p className="font-mono text-xs break-all text-content-primary">
              {newUri}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button onClick={() => newUri && copy(newUri)} variant="secondary">
              {copied ? 'Copied!' : 'Copy connection string'}
            </Button>
            <Button onClick={() => setNewUri(null)} variant="primary">
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
