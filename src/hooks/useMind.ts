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
  type InstalledModel,
  type MindEvent,
  type ProviderLoadingEvent,
  type ProviderStatusEvent,
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
  /** A spend awaiting the user's approval (null when none). */
  pendingConfirm: ToolConfirmRequestEvent | null
  capabilities: CapabilityInfo | null
  // actions
  refresh: () => Promise<void>
  startProvider: (modelId: string) => Promise<void>
  stopProvider: () => Promise<void>
  downloadModel: (modelId: string) => Promise<void>
  cancelDownload: (modelId: string) => Promise<void>
  deleteModel: (modelId: string) => Promise<void>
  addHuggingFaceModel: (
    repo: string,
    file: string,
    displayName?: string
  ) => Promise<void>
  setSkillEnabled: (name: string, enabled: boolean) => Promise<void>
  addMcpServer: (name: string, url: string) => Promise<void>
  removeMcpServer: (id: string) => Promise<void>
  chat: (prompt: string) => Promise<{ text: string; thinking?: string }>
  /** Approve or decline the pending spend. */
  respondConfirm: (approved: boolean, reason?: string) => Promise<void>
}

const MAX_LOGS = 100

export function useMind(): UseMindResult {
  const [status, setStatus] = useState<ProviderStatusEvent | null>(null)
  const [catalog, setCatalog] = useState<CatalogModel[]>([])
  const [installed, setInstalled] = useState<InstalledModel[]>([])
  const [downloads, setDownloads] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState<ProviderLoadingEvent | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [pendingConfirm, setPendingConfirm] =
    useState<ToolConfirmRequestEvent | null>(null)
  const [capabilities, setCapabilities] = useState<CapabilityInfo | null>(null)
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
    } catch {
      /* sidecar may still be booting */
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
    void refresh()
    return off
  }, [refresh])

  const startProvider = useCallback(async (modelId: string) => {
    const st = await mindClient.startProvider(modelId)
    setStatus(st)
    setCapabilities(await mindClient.listCapabilities())
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
    async (repo: string, file: string, displayName?: string) => {
      const model = await mindClient.addHuggingFaceModel(
        repo,
        file,
        displayName
      )
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

  const addMcpServer = useCallback(async (name: string, url: string) => {
    setCapabilities(await mindClient.addMcpServer(name, url))
  }, [])

  const removeMcpServer = useCallback(async (id: string) => {
    setCapabilities(await mindClient.removeMcpServer(id))
  }, [])

  const chat = useCallback(async (prompt: string) => {
    const res = await mindClient.chat(prompt)
    return { text: res.text, thinking: res.thinking }
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
    cancelDownload,
    capabilities,
    catalog,
    chat,
    deleteModel,
    downloadModel,
    downloads,
    installed,
    loading,
    logs,
    pendingConfirm,
    ready: status?.on === true && !loading,
    refresh,
    removeMcpServer,
    respondConfirm,
    setSkillEnabled,
    startProvider,
    status,
    stopProvider,
  }
}
