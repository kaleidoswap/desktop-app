// KaleidoMind sidecar client (frontend).
//
// Talks to the Rust bridge (src-tauri/src/mind.rs): commands go out via the
// `mind_send` Tauri command, events arrive on the `mind-event` Tauri event.
// Mirrors apps/provider/src/protocol.ts. A single `mind-event` listener fans
// out to (a) request/response correlation by id and (b) event subscribers.

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

// ── Protocol types (mirror apps/provider/src/protocol.ts) ────────────────

export interface PeerInfo {
  shortKey: string
  label: string
  connectedAt: number
  lastActiveAt: number
}

export interface ProviderStatusEvent {
  type: 'status'
  on: boolean
  publicKey: string | null
  activeModelId: string | null
  activeModelName: string | null
  peers: PeerInfo[]
  tokensPerSecond: number | null
  startedAt: number | null
}

export interface InstalledModel {
  id: string
  family: string
  displayName: string
  sizeBytes: number
  path: string
  active: boolean
}

export interface CatalogModel {
  id: string
  family: string
  displayName: string
  quant: string
  sizeBytes: number
  hfRepo: string
  hfFile: string
  ramHintGb: number
  notes?: string
}

export interface DownloadProgress {
  modelId: string
  bytesDownloaded: number
  bytesTotal: number
  percentage: number
}

export type ProviderLoadingPhase =
  | 'loading_model'
  | 'model_loaded'
  | 'starting_p2p'
  | 'ready'
  | 'p2p_failed'
  | 'aborted'

export interface ProviderLoadingEvent {
  type: 'provider_loading'
  phase: ProviderLoadingPhase
  percentage?: number
  message?: string
}

/**
 * The agent wants to run a confirmation-gated tool (a spend). Show the call
 * and answer with confirmTool() within timeoutMs, or the sidecar declines it
 * (fail closed).
 */
export interface ToolConfirmRequestEvent {
  type: 'tool_confirm_request'
  confirmId: string
  call: { name: string; arguments: Record<string, unknown> }
  timeoutMs: number
}

export type MindEvent =
  | { type: 'ready'; version: string }
  | ProviderStatusEvent
  | ProviderLoadingEvent
  | ToolConfirmRequestEvent
  | { type: 'pubkey'; value: string }
  | { type: 'peer_connected'; peer: PeerInfo }
  | { type: 'peer_disconnected'; shortKey: string }
  | { type: 'download_progress'; progress: DownloadProgress }
  | { type: 'download_completed'; modelId: string }
  | { type: 'log'; level: 'debug' | 'info' | 'warn' | 'error'; message: string }
  | { type: 'response'; id: string; ok: true; data?: unknown }
  | { type: 'response'; id: string; ok: false; error: string }
  | { type: 'fatal'; error: string }

export interface ChatResult {
  text: string
  latencyMs: number
  tokensPerSecond: number
}

type EventHandler = (e: MindEvent) => void

// ── Client ───────────────────────────────────────────────────────────────

class MindClient {
  private listening: Promise<void> | null = null
  private handlers = new Set<EventHandler>()
  private pending = new Map<
    string,
    {
      resolve: (data: unknown) => void
      reject: (err: Error) => void
      timer: ReturnType<typeof setTimeout>
    }
  >()

  /** Ensure the single Tauri `mind-event` subscription is active. */
  private ensureListening(): Promise<void> {
    if (!this.listening) {
      // Lifetime singleton — the subscription lives for the app's duration.
      this.listening = listen<MindEvent>('mind-event', (event) => {
        this.dispatch(event.payload)
      }).then(() => undefined)
    }
    return this.listening
  }

  private dispatch(e: MindEvent) {
    if (e.type === 'response') {
      const p = this.pending.get(e.id)
      if (p) {
        clearTimeout(p.timer)
        this.pending.delete(e.id)
        if (e.ok) p.resolve(e.data)
        else p.reject(new Error(e.error))
      }
      return // responses aren't broadcast to event handlers
    }
    for (const h of this.handlers) {
      try {
        h(e)
      } catch {
        /* ignore handler errors */
      }
    }
  }

  /** Subscribe to sidecar events. Returns an unsubscribe fn. */
  on(handler: EventHandler): () => void {
    void this.ensureListening()
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  /** Spawn the sidecar (idempotent in Rust). */
  async start(): Promise<void> {
    await this.ensureListening()
    await invoke('mind_start')
  }

  async stop(): Promise<void> {
    try {
      await this.request({ cmd: 'shutdown' }, 3000)
    } catch {
      /* ignore — we kill the process anyway */
    }
    await invoke('mind_stop')
  }

  async isRunning(): Promise<boolean> {
    return invoke<boolean>('mind_is_running')
  }

  /** Fire-and-forget command (no response awaited). */
  async send(cmd: Record<string, unknown>): Promise<void> {
    await this.ensureListening()
    const id = crypto.randomUUID()
    await invoke('mind_send', { payload: { id, ...cmd } })
  }

  /** Send a command and await its `response` event (by id). */
  async request<T = unknown>(
    cmd: Record<string, unknown>,
    timeoutMs = 120_000
  ): Promise<T> {
    await this.ensureListening()
    await this.start() // make sure the sidecar is up before we await a reply
    const id = crypto.randomUUID()
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('KaleidoMind request timed out'))
      }, timeoutMs)
      this.pending.set(id, {
        reject,
        resolve: (data) => resolve(data as T),
        timer,
      })
      invoke('mind_send', { payload: { id, ...cmd } }).catch((err) => {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(err instanceof Error ? err : new Error(String(err)))
      })
    })
  }

  // ── Typed command helpers ───────────────────────────────────────────
  getStatus() {
    return this.request<ProviderStatusEvent>({ cmd: 'get_status' })
  }
  listCatalogModels() {
    return this.request<CatalogModel[]>({ cmd: 'list_catalog_models' })
  }
  listInstalledModels() {
    return this.request<InstalledModel[]>({ cmd: 'list_installed_models' })
  }
  downloadModel(modelId: string) {
    return this.send({ cmd: 'download_model', modelId })
  }
  cancelDownload(modelId: string) {
    return this.send({ cmd: 'cancel_download', modelId })
  }
  deleteModel(modelId: string) {
    return this.request({ cmd: 'delete_model', modelId })
  }
  startProvider(modelId: string) {
    // Loading + P2P bootstrap can take a while.
    return this.request<ProviderStatusEvent>({ cmd: 'start', modelId }, 180_000)
  }
  stopProvider() {
    return this.request<ProviderStatusEvent>({ cmd: 'stop' })
  }
  chat(prompt: string) {
    // Generous: an agentic run may pause up to 120s on a tool confirmation.
    return this.request<ChatResult>({ cmd: 'chat', prompt }, 300_000)
  }
  /** Answer a tool_confirm_request (approve/decline a pending spend). */
  confirmTool(confirmId: string, approved: boolean, reason?: string) {
    return this.send({ approved, cmd: 'tool_confirm', confirmId, reason })
  }
}

export const mindClient = new MindClient()
