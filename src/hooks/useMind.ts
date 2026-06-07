// useMind — React state for the KaleidoMind sidecar.
//
// Subscribes to sidecar events (via mindClient) and exposes the provider
// status, model catalog/installed list, download progress, and actions. All
// protocol logic lives in mindClient / the sidecar; this is just React glue.

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  mindClient,
  type CatalogModel,
  type InstalledModel,
  type MindEvent,
  type ProviderLoadingEvent,
  type ProviderStatusEvent,
} from '../api/mind'

export interface UseMindResult {
  status: ProviderStatusEvent | null
  catalog: CatalogModel[]
  installed: InstalledModel[]
  downloads: Record<string, number> // modelId -> percentage
  loading: ProviderLoadingEvent | null
  logs: string[]
  ready: boolean
  // actions
  refresh: () => Promise<void>
  startProvider: (modelId: string) => Promise<void>
  stopProvider: () => Promise<void>
  downloadModel: (modelId: string) => Promise<void>
  cancelDownload: (modelId: string) => Promise<void>
  deleteModel: (modelId: string) => Promise<void>
  chat: (prompt: string) => Promise<string>
}

const MAX_LOGS = 100

export function useMind(): UseMindResult {
  const [status, setStatus] = useState<ProviderStatusEvent | null>(null)
  const [catalog, setCatalog] = useState<CatalogModel[]>([])
  const [installed, setInstalled] = useState<InstalledModel[]>([])
  const [downloads, setDownloads] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState<ProviderLoadingEvent | null>(null)
  const [logs, setLogs] = useState<string[]>([])

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
      const [cat, inst, st] = await Promise.all([
        mindClient.listCatalogModels(),
        mindClient.listInstalledModels(),
        mindClient.getStatus(),
      ])
      setCatalog(cat)
      setInstalled(inst)
      setStatus(st)
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

  const chat = useCallback(async (prompt: string) => {
    const res = await mindClient.chat(prompt)
    return res.text
  }, [])

  return {
    cancelDownload,
    catalog,
    chat,
    deleteModel,
    downloadModel,
    downloads,
    installed,
    loading,
    logs,
    ready: status?.on === true && !loading,
    refresh,
    startProvider,
    status,
    stopProvider,
  }
}
