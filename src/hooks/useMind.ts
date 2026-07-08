// useMind — React state for the KaleidoMind sidecar.
//
// Subscribes to sidecar events (via mindClient) and exposes the provider
// status, model catalog/installed list, download progress, and actions. All
// protocol logic lives in mindClient / the sidecar; this is just React glue.

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  mindClient,
  type CatalogModel,
  type CapabilityInfo,
  type ChatHandlers,
  type ChatResult,
  type InstalledModel,
  type MindEvent,
  type ProviderLoadingEvent,
  type ProviderStatusEvent,
  type RuntimeProgress,
  type ToolConfirmRequestEvent,
} from '../api/mind'

export interface UseMindResult {
  status: ProviderStatusEvent | null
  catalog: CatalogModel[]
  installed: InstalledModel[]
  downloads: Record<string, number> // modelId -> percentage
  loading: ProviderLoadingEvent | null
  logs: string[]
  ready: boolean
  /** True while the catalog/installed lists are being (re)fetched. */
  catalogLoading: boolean
  /** Last catalog fetch error, so the UI can offer a retry (null when ok). */
  catalogError: string | null
  /** A spend awaiting the user's approval (null when none). */
  pendingConfirm: ToolConfirmRequestEvent | null
  capabilities: CapabilityInfo | null
  /** Whether the agent runtime is downloaded (null while still checking). */
  runtimeInstalled: boolean | null
  /** Live progress of the runtime download (null when not downloading). */
  runtimeProgress: RuntimeProgress | null
  /**
   * True for the whole duration of a startProvider() call, regardless of
   * which page triggered it. `loading` only becomes non-null once the sidecar
   * emits its first `provider_loading` event, which lags the request by a
   * beat — without this flag, anything gated on "brain is off and not
   * loading" (e.g. the offline-nudge modal) can flash open during that gap.
   */
  starting: boolean
  // actions
  refresh: () => Promise<void>
  /** Download + install the agent runtime on demand. */
  installRuntime: () => Promise<void>
  startProvider: (modelId: string) => Promise<void>
  stopProvider: () => Promise<void>
  downloadModel: (modelId: string) => Promise<void>
  cancelDownload: (modelId: string) => Promise<void>
  deleteModel: (modelId: string) => Promise<void>
  addHuggingFaceModel: (url: string, displayName?: string) => Promise<void>
  setSkillEnabled: (name: string, enabled: boolean) => Promise<void>
  addSkill: (
    name: string,
    description: string,
    instructions: string,
    tools?: string[]
  ) => Promise<void>
  deleteSkill: (name: string) => Promise<void>
  addMcpServer: (name: string, url: string) => Promise<void>
  removeMcpServer: (id: string) => Promise<void>
  chat: (
    prompt: string,
    handlers?: ChatHandlers,
    chatId?: string
  ) => Promise<ChatResult>
  /** Stop the in-flight chat turn (the stop button). */
  cancelChat: (chatId: string) => Promise<void>
  /** Approve or decline the pending spend. */
  respondConfirm: (approved: boolean, reason?: string) => Promise<void>
}

const MAX_LOGS = 100

export function useMind(): UseMindResult {
  const [status, setStatus] = useState<ProviderStatusEvent | null>(null)
  const [catalog, setCatalog] = useState<CatalogModel[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [installed, setInstalled] = useState<InstalledModel[]>([])
  const [downloads, setDownloads] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState<ProviderLoadingEvent | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [pendingConfirm, setPendingConfirm] =
    useState<ToolConfirmRequestEvent | null>(null)
  const [capabilities, setCapabilities] = useState<CapabilityInfo | null>(null)
  const [runtimeInstalled, setRuntimeInstalled] = useState<boolean | null>(null)
  const [runtimeProgress, setRuntimeProgress] =
    useState<RuntimeProgress | null>(null)
  const [starting, setStarting] = useState(false)
  // Auto-clear the confirm card when the sidecar's timeout declines it.
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshInstalled = useCallback(async () => {
    try {
      setInstalled(await mindClient.listInstalledModels())
    } catch {
      /* ignore */
    }
  }, [])

  const refresh = useCallback(async () => {
    setCatalogLoading(true)
    setCatalogError(null)
    try {
      await mindClient.start()
      const [cat, inst, st, caps] = await Promise.all([
        mindClient.listCatalogModels(),
        mindClient.listInstalledModels(),
        mindClient.getStatus(),
        mindClient.listCapabilities(),
      ])
      setCatalog(cat)
      setInstalled(inst)
      setStatus(st)
      setCapabilities(caps)
    } catch (e) {
      // Surface the failure so the Models UI can offer a retry instead of
      // spinning on "Loading catalog…" forever. The common case is a fresh
      // install: the sidecar can't be resolved until the runtime download has
      // finished, so the mount-time fetch fails and must be retried.
      setCatalogError(e instanceof Error ? e.message : String(e))
    } finally {
      setCatalogLoading(false)
    }
  }, [])

  // Subscribe to events once.
  const refreshInstalledRef = useRef(refreshInstalled)
  refreshInstalledRef.current = refreshInstalled
  useEffect(() => {
    const off = mindClient.on((e: MindEvent) => {
      switch (e.type) {
        case 'status':
          setStatus(e)
          break
        case 'provider_loading':
          setLoading(e)
          if (
            e.phase === 'ready' ||
            e.phase === 'p2p_failed' ||
            e.phase === 'aborted'
          ) {
            // Clear the loading banner shortly after a terminal phase.
            setTimeout(() => setLoading(null), 1500)
          }
          break
        case 'pubkey':
          setStatus((s) => (s ? { ...s, publicKey: e.value } : s))
          break
        case 'download_progress':
          setDownloads((d) => ({
            ...d,
            [e.progress.modelId]: e.progress.percentage,
          }))
          break
        case 'download_completed':
          setDownloads((d) => {
            const next = { ...d }
            delete next[e.modelId]
            return next
          })
          void refreshInstalledRef.current()
          break
        case 'capabilities_changed':
          setCapabilities(e.capabilities)
          break
        case 'tool_confirm_request':
          setPendingConfirm(e)
          if (confirmTimer.current) clearTimeout(confirmTimer.current)
          confirmTimer.current = setTimeout(
            () => setPendingConfirm(null),
            e.timeoutMs
          )
          break
        case 'peer_connected':
        case 'peer_disconnected':
          // status event usually follows; nothing to do here
          break
        case 'log':
          setLogs((l) => [
            ...l.slice(-(MAX_LOGS - 1)),
            `[${e.level}] ${e.message}`,
          ])
          break
        default:
          break
      }
    })
    return off
  }, [])

  // Agent runtime: check if it's installed and stream download progress. The
  // sidecar can only resolve a provider once the runtime is installed, so the
  // catalog/installed lists are fetched the moment it becomes available — the
  // initial check resolving true or the on-demand download finishing. Without
  // this a fresh install leaves the catalog stuck empty on "Loading catalog…",
  // since nothing else re-fetches it after the gate opens.
  useEffect(() => {
    let alive = true
    void mindClient
      .runtimeInstalled()
      .then((v) => {
        if (!alive) return
        setRuntimeInstalled(v)
        if (v) void refresh()
      })
      .catch(() => alive && setRuntimeInstalled(false))
    const off = mindClient.onRuntimeProgress((p) => {
      if (!alive) return
      if (p.phase === 'done') {
        setRuntimeProgress(null)
        setRuntimeInstalled(true)
        void refresh()
      } else {
        setRuntimeProgress(p) // keeps the error phase visible too
      }
    })
    return () => {
      alive = false
      off()
    }
  }, [refresh])

  const installRuntime = useCallback(async () => {
    setRuntimeProgress({
      downloaded: 0,
      message: null,
      phase: 'downloading',
      total: 0,
    })
    await mindClient.installRuntime()
  }, [])

  const startProvider = useCallback(async (modelId: string) => {
    setStarting(true)
    try {
      const st = await mindClient.startProvider(modelId)
      setStatus(st)
      setCapabilities(await mindClient.listCapabilities())
    } finally {
      setStarting(false)
    }
  }, [])

  const stopProvider = useCallback(async () => {
    const st = await mindClient.stopProvider()
    setStatus(st)
  }, [])

  const downloadModel = useCallback(async (modelId: string) => {
    setDownloads((d) => ({ ...d, [modelId]: 0 }))
    await mindClient.downloadModel(modelId)
  }, [])

  const cancelDownload = useCallback(async (modelId: string) => {
    await mindClient.cancelDownload(modelId)
    setDownloads((d) => {
      const next = { ...d }
      delete next[modelId]
      return next
    })
  }, [])

  const deleteModel = useCallback(
    async (modelId: string) => {
      await mindClient.deleteModel(modelId)
      await refreshInstalled()
    },
    [refreshInstalled]
  )

  const addHuggingFaceModel = useCallback(
    async (url: string, displayName?: string) => {
      const model = await mindClient.addHuggingFaceModel(url, displayName)
      setCatalog(await mindClient.listCatalogModels())
      setDownloads((d) => ({ ...d, [model.id]: 0 }))
    },
    []
  )

  const setSkillEnabled = useCallback(
    async (name: string, enabled: boolean) => {
      setCapabilities(await mindClient.setSkillEnabled(name, enabled))
    },
    []
  )

  const addSkill = useCallback(
    async (
      name: string,
      description: string,
      instructions: string,
      tools?: string[]
    ) => {
      setCapabilities(
        await mindClient.addSkill(name, description, instructions, tools)
      )
    },
    []
  )

  const deleteSkill = useCallback(async (name: string) => {
    setCapabilities(await mindClient.deleteSkill(name))
  }, [])

  const addMcpServer = useCallback(async (name: string, url: string) => {
    setCapabilities(await mindClient.addMcpServer(name, url))
  }, [])

  const removeMcpServer = useCallback(async (id: string) => {
    setCapabilities(await mindClient.removeMcpServer(id))
  }, [])

  const chat = useCallback(
    async (prompt: string, handlers?: ChatHandlers, chatId?: string) => {
      return mindClient.chat(prompt, handlers, chatId)
    },
    []
  )

  const cancelChat = useCallback(async (chatId: string) => {
    await mindClient.cancelChat(chatId)
  }, [])

  const respondConfirm = useCallback(
    async (approved: boolean, reason?: string) => {
      const pending = pendingConfirm
      setPendingConfirm(null)
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
      if (pending) {
        await mindClient.confirmTool(pending.confirmId, approved, reason)
      }
    },
    [pendingConfirm]
  )

  return {
    addHuggingFaceModel,
    addMcpServer,
    addSkill,
    cancelChat,
    cancelDownload,
    capabilities,
    catalog,
    catalogError,
    catalogLoading,
    chat,
    deleteModel,
    deleteSkill,
    downloadModel,
    downloads,
    installRuntime,
    installed,
    loading,
    logs,
    pendingConfirm,
    ready: status?.on === true && !loading,
    refresh,
    removeMcpServer,
    respondConfirm,
    runtimeInstalled,
    runtimeProgress,
    setSkillEnabled,
    startProvider,
    starting,
    status,
    stopProvider,
  }
}
