// Models — browse the catalog, download/delete models, and start/stop the brain
// on a given model.

import { Cpu, Download, Play, Square, Trash2, X } from 'lucide-react'
import React, { useMemo } from 'react'

import { MindCard, gb, useMindContext } from './shared'

export const Component: React.FC = () => {
  const mind = useMindContext()
  const { status } = mind
  const providerOn = status?.on === true

  const installedIds = useMemo(
    () => new Set(mind.installed.map((m) => m.id)),
    [mind.installed]
  )

  return (
    <MindCard>
      <div className="mb-3 flex items-center gap-2">
        <Cpu className="h-5 w-5 text-gray-300" />
        <h2 className="font-semibold text-white">Models</h2>
      </div>
      <div className="flex flex-col gap-2">
        {mind.catalog.length === 0 && (
          <p className="text-sm text-gray-500">Loading catalog…</p>
        )}
        {mind.catalog.map((m) => {
          const isInstalled = installedIds.has(m.id)
          const isActive = status?.activeModelId === m.id && providerOn
          const dl = mind.downloads[m.id]
          const downloading = typeof dl === 'number'
          return (
            <div
              className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2"
              key={m.id}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-white">
                    {m.displayName}
                  </span>
                  {isActive && (
                    <span className="rounded-full bg-green-600/30 px-2 py-0.5 text-[10px] font-semibold text-green-300">
                      Running
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {m.quant} · {gb(m.sizeBytes)} · ~{m.ramHintGb} GB RAM
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {downloading ? (
                  <div className="flex items-center gap-2">
                    <span className="w-10 text-right text-xs text-violet-300">
                      {dl}%
                    </span>
                    <button
                      className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-red-400"
                      onClick={() => mind.cancelDownload(m.id)}
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : isInstalled ? (
                  <>
                    {isActive ? (
                      <button
                        className="flex items-center gap-1 rounded-md bg-red-600/80 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-600"
                        onClick={() => mind.stopProvider()}
                      >
                        <Square className="h-3.5 w-3.5" /> Stop
                      </button>
                    ) : (
                      <button
                        className="flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40"
                        disabled={providerOn}
                        onClick={() => mind.startProvider(m.id)}
                      >
                        <Play className="h-3.5 w-3.5" /> Start
                      </button>
                    )}
                    <button
                      className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-red-400 disabled:opacity-30"
                      disabled={isActive}
                      onClick={() => mind.deleteModel(m.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    className="flex items-center gap-1 rounded-md border border-gray-700 px-2.5 py-1 text-xs text-gray-200 hover:bg-gray-800"
                    onClick={() => mind.downloadModel(m.id)}
                  >
                    <Download className="h-3.5 w-3.5" /> Get
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </MindCard>
  )
}
