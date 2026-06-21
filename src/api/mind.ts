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
  inferenceDevice?: 'gpu' | 'cpu' | 'mock' | null
}

export interface CapabilityInfo {
  skills: Array<{
    name: string
    description: string
    enabled: boolean
    tools: string[]
  }>
  tools: Array<{
    name: string
    description: string
    requiresConfirmation: boolean
  }>
  mcpConnected: boolean
  mcpServers: Array<{
    id: string
    name: string
    url: string
    connected: boolean
    toolCount: number
    error?: string
  }>
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
 * Progress of the on-demand agent-runtime download (the ~1.7 GB provider/mcp/
 * node tree, fetched the first time KaleidoMind is enabled). Emitted on the
 * `mind-runtime` Tauri event, separate from the sidecar `mind-event` stream.
 */
export interface RuntimeProgress {
  phase: 'downloading' | 'verifying' | 'extracting' | 'done' | 'error'
  downloaded: number
  total: number
  message: string | null
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

// ── Autonomy types (mirror apps/provider/src/protocol.ts) ────────────────

export interface TaskAllocation {
  btcSat: number
  usdt: number
  xaut: number
}

export interface AgentTask {
  id: string
  name: string
  description: string
  skill: string
  scheduleSec: number
  runOnStartup: boolean
  allocation: TaskAllocation
  enabled: boolean
  createdAt: number
  lastRunAt: number | null
}

export interface RiskLimits {
  dryRun: boolean
  minBtcReserveSat: number
  stopLossBtcSat: number
  maxSpendUsd: number
  autoApproveUnderUsd: number
  maxOpenOrders?: number
}

export interface PortfolioTargets {
  btcPct: number
  usdtPct: number
  xautPct: number
  driftThresholdPct: number
}

export interface TaskRunCost {
  usd: number
  inputTokens: number
  outputTokens: number
}

export interface TaskStats {
  runs: number
  errors: number
  lastRunAt: number | null
  lastDurationMs: number | null
  lastToolCalls: number | null
  lastError: string | null
  lastText: string | null
}

export interface TaskRunRecord {
  taskId: string
  taskName: string
  startedAt: number
  durationMs: number
  toolCalls: number
  ok: boolean
  error: string | null
  text: string
  cost: TaskRunCost
}

export interface AgentState {
  schedulerRunning: boolean
  risk: RiskLimits
  targets: PortfolioTargets
  /** Generation token caps (0 ⇒ uncapped). */
  generation: { maxThinkingTokens: number; maxOutputTokens: number }
  recent: TaskRunRecord[]
  stats: Record<string, TaskStats>
  cumulative: TaskRunCost
}

export interface SuggestedAction {
  id: string
  /** 'wallet' | 'node' | 'portfolio' | 'trade' — mapped to an icon by the UI. */
  icon: string
  title: string
  subtitle: string
  prompt: string
}

export interface NewTaskInput {
  name: string
  description: string
  skill: string
  scheduleSec: number
  enabled: boolean
  runOnStartup?: boolean
  allocation?: TaskAllocation
  id?: string
}

export interface TaskPatchInput {
  name?: string
  description?: string
  skill?: string
  scheduleSec?: number
  runOnStartup?: boolean
  allocation?: TaskAllocation
  enabled?: boolean
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
  | { type: 'chat_thinking_delta'; chatId: string; delta: string }
  | { type: 'chat_content_delta'; chatId: string; delta: string }
  | {
      type: 'chat_tool_call'
      chatId: string
      id: string
      name: string
      arguments: Record<string, unknown>
      requiresConfirmation?: boolean
    }
  | {
      type: 'chat_tool_result'
      chatId: string
      id: string
      name: string
      arguments: Record<string, unknown>
      ok: boolean
      result: unknown
    }
  | { type: 'capabilities_changed'; capabilities: CapabilityInfo }
  | { type: 'tasks_changed'; tasks: AgentTask[] }
  | { type: 'task_run_started'; taskId: string; taskName: string; at: number }
  | { type: 'task_run_finished'; record: TaskRunRecord }
  | { type: 'agent_state'; state: AgentState }
  | {
      type: 'agent_message'
      text: string
      taskId?: string
      taskName?: string
      at: number
    }
  | { type: 'log'; level: 'debug' | 'info' | 'warn' | 'error'; message: string }
  | { type: 'response'; id: string; ok: true; data?: unknown }
  | { type: 'response'; id: string; ok: false; error: string }
  | { type: 'fatal'; error: string }

export interface ChatResult {
  text: string
  /** The model's `<think>` reasoning for this turn, if any (shown collapsed in chat). */
  thinking?: string
  latencyMs: number
  tokensPerSecond: number
  /** Total tokens this turn (prompt + completion), from QVAC stats. */
  tokens?: number
  promptTokens?: number
  /** The backend that actually ran this response. */
  device?: 'gpu' | 'cpu' | null
  /** Contextual next-step cards the agent proposes after this reply. */
  followups?: SuggestedAction[]
}

/** A tool the agent invoked mid-turn (drives the live "running" pill). */
export interface ChatToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
  requiresConfirmation?: boolean
}

/** A tool's result (drives the typed result card). */
export interface ChatToolResult {
  id: string
  name: string
  arguments: Record<string, unknown>
  ok: boolean
  result: unknown
}

export interface ChatHandlers {
  onThinking?: (delta: string) => void
  onToken?: (delta: string) => void
  /** The agent started a tool call (before it executes). */
  onToolCall?: (call: ChatToolCall) => void
  /** A tool returned (after it executes). */
  onToolResult?: (result: ChatToolResult) => void
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

  // ── Agent runtime (on-demand download) ──────────────────────────────
  /** Whether the agent runtime (provider/mcp/node) is downloaded + installed. */
  async runtimeInstalled(): Promise<boolean> {
    return invoke<boolean>('mind_runtime_installed')
  }

  /** Start downloading the agent runtime; progress arrives via onRuntimeProgress. */
  async installRuntime(): Promise<void> {
    await invoke('mind_runtime_install')
  }

  /** Subscribe to runtime download/extract progress. Returns an unsubscribe fn. */
  onRuntimeProgress(handler: (p: RuntimeProgress) => void): () => void {
    let unlisten: (() => void) | undefined
    let cancelled = false
    void listen<RuntimeProgress>('mind-runtime', (e) =>
      handler(e.payload)
    ).then((u) => {
      if (cancelled) u()
      else unlisten = u
    })
    return () => {
      cancelled = true
      unlisten?.()
    }
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
  addHuggingFaceModel(url: string, displayName?: string) {
    return this.request<CatalogModel>({
      cmd: 'add_huggingface_model',
      displayName,
      url,
    })
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
  /** Stop an in-flight chat turn (the stop button). Fire-and-forget — the
   *  matching `chat()` promise then resolves with whatever was produced so far. */
  cancelChat(chatId: string) {
    return this.send({ chatId, cmd: 'cancel_chat' })
  }
  chat(
    prompt: string,
    handlers?: ChatHandlers,
    chatId: string = crypto.randomUUID()
  ) {
    // Generous: an agentic run may pause up to 120s on a tool confirmation.
    const off = this.on((event) => {
      if (event.type === 'chat_thinking_delta' && event.chatId === chatId) {
        handlers?.onThinking?.(event.delta)
      } else if (
        event.type === 'chat_content_delta' &&
        event.chatId === chatId
      ) {
        handlers?.onToken?.(event.delta)
      } else if (event.type === 'chat_tool_call' && event.chatId === chatId) {
        handlers?.onToolCall?.({
          arguments: event.arguments,
          id: event.id,
          name: event.name,
          requiresConfirmation: event.requiresConfirmation,
        })
      } else if (event.type === 'chat_tool_result' && event.chatId === chatId) {
        handlers?.onToolResult?.({
          arguments: event.arguments,
          id: event.id,
          name: event.name,
          ok: event.ok,
          result: event.result,
        })
      }
    })
    return this.request<ChatResult>(
      { chatId, cmd: 'chat', prompt },
      300_000
    ).finally(off)
  }
  listCapabilities() {
    return this.request<CapabilityInfo>({ cmd: 'list_capabilities' })
  }
  setSkillEnabled(name: string, enabled: boolean) {
    return this.request<CapabilityInfo>({
      cmd: 'set_skill_enabled',
      enabled,
      name,
    })
  }
  addSkill(
    name: string,
    description: string,
    instructions: string,
    tools?: string[]
  ) {
    return this.request<CapabilityInfo>({
      cmd: 'add_skill',
      description,
      instructions,
      name,
      tools,
    })
  }
  deleteSkill(name: string) {
    return this.request<CapabilityInfo>({ cmd: 'delete_skill', name })
  }
  addMcpServer(name: string, url: string) {
    return this.request<CapabilityInfo>({
      cmd: 'add_mcp_server',
      name,
      url,
    })
  }
  removeMcpServer(id: string) {
    return this.request<CapabilityInfo>({
      cmd: 'remove_mcp_server',
      serverId: id,
    })
  }
  /** Answer a tool_confirm_request (approve/decline a pending spend). */
  confirmTool(confirmId: string, approved: boolean, reason?: string) {
    return this.send({ approved, cmd: 'tool_confirm', confirmId, reason })
  }

  // ── Autonomy (the agent's task brain) ──────────────────────────────
  listTasks() {
    return this.request<AgentTask[]>({ cmd: 'list_tasks' })
  }
  createTask(task: NewTaskInput) {
    return this.request<AgentTask>({ cmd: 'create_task', task })
  }
  updateTask(taskId: string, patch: TaskPatchInput) {
    return this.request<AgentTask | null>({ cmd: 'update_task', patch, taskId })
  }
  deleteTask(taskId: string) {
    return this.request<{ removed: boolean }>({ cmd: 'delete_task', taskId })
  }
  /** Force-run a task now (regardless of schedule). Resolves with its outcome. */
  runTask(taskId: string) {
    return this.request<{
      ok: boolean
      text?: string
      toolCalls?: number
      error?: string
    } | null>({ cmd: 'run_task', taskId }, 300_000)
  }
  setScheduler(running: boolean) {
    return this.request<AgentState>({ cmd: 'set_scheduler', running })
  }
  getAgentState() {
    return this.request<AgentState>({ cmd: 'get_agent_state' })
  }
  setRiskLimits(limits: Partial<RiskLimits>) {
    return this.request<AgentState>({ cmd: 'set_risk_limits', limits })
  }
  setPortfolioTargets(targets: Partial<PortfolioTargets>) {
    return this.request<AgentState>({ cmd: 'set_portfolio_targets', targets })
  }
  setGenerationLimits(limits: {
    maxThinkingTokens?: number
    maxOutputTokens?: number
  }) {
    return this.request<AgentState>({ cmd: 'set_generation_limits', ...limits })
  }
  getSuggestedActions() {
    return this.request<SuggestedAction[]>({ cmd: 'get_suggested_actions' })
  }
}

export const mindClient = new MindClient()
