import {
  Network,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react'
import React, { useState } from 'react'

import { MindCard, useMindContext } from './shared'

export const Component: React.FC = () => {
  const mind = useMindContext()
  const caps = mind.capabilities
  const [showAddMcp, setShowAddMcp] = useState(false)
  const [mcpName, setMcpName] = useState('')
  const [mcpUrl, setMcpUrl] = useState('')
  const [mcpError, setMcpError] = useState('')
  return (
    <div className="flex flex-col gap-6">
      <MindCard>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gray-300" />
          <h2 className="font-semibold text-white">Skills & tools</h2>
        </div>
        <p className="text-sm text-gray-500">
          {caps?.mcpConnected
            ? `Live registry: ${caps.skills.length} skills and ${caps.tools.length} tools.`
            : 'The skill registry is available, but the Kaleido MCP is not connected.'}
        </p>
      </MindCard>

      <MindCard>
        <div className="mb-3 flex items-center gap-2">
          <Wrench className="h-5 w-5 text-amber-300" />
          <h3 className="font-semibold text-white">Skills</h3>
        </div>
        <div className="space-y-2">
          {caps?.skills.map((skill) => (
            <div
              className="flex items-start gap-3 rounded-lg border border-gray-800 bg-gray-950/40 p-3"
              key={skill.name}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{skill.name}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {skill.description}
                </p>
                <p className="mt-1 truncate font-mono text-[10px] text-gray-600">
                  {skill.tools.join(' · ') || 'No scoped tools'}
                </p>
              </div>
              <button
                aria-pressed={skill.enabled}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  skill.enabled
                    ? 'bg-green-600/20 text-green-300'
                    : 'bg-gray-800 text-gray-400'
                }`}
                onClick={() =>
                  void mind.setSkillEnabled(skill.name, !skill.enabled)
                }
                type="button"
              >
                {skill.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          ))}
          {!caps?.skills.length && (
            <p className="text-sm text-gray-500">No skills loaded.</p>
          )}
        </div>
      </MindCard>

      <MindCard>
        <div className="mb-3 flex items-center gap-2">
          <Network className="h-5 w-5 text-violet-300" />
          <h3 className="font-semibold text-white">MCP servers &amp; tools</h3>
          <span className="ml-auto hidden text-xs text-gray-500 sm:inline">
            {caps?.tools.length ?? 0} connected
          </span>
          <button
            className="flex items-center gap-1 rounded-md border border-gray-700 px-2.5 py-1 text-xs text-gray-200 hover:bg-gray-800"
            onClick={() => setShowAddMcp((v) => !v)}
            type="button"
          >
            <Plus className="h-3.5 w-3.5" /> Add server
          </button>
        </div>
        {showAddMcp && (
          <form
            className="mb-4 grid gap-2 rounded-lg border border-violet-800/50 bg-violet-950/20 p-3"
            onSubmit={(event) => {
              event.preventDefault()
              setMcpError('')
              void mind
                .addMcpServer(mcpName, mcpUrl)
                .then(() => {
                  setMcpName('')
                  setMcpUrl('')
                  setShowAddMcp(false)
                })
                .catch((error) =>
                  setMcpError(
                    error instanceof Error ? error.message : String(error)
                  )
                )
            }}
          >
            <input
              className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
              onChange={(event) => setMcpName(event.target.value)}
              placeholder="Server name"
              value={mcpName}
            />
            <input
              className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
              onChange={(event) => setMcpUrl(event.target.value)}
              placeholder="https://example.com/mcp"
              type="url"
              value={mcpUrl}
            />
            {mcpError && <p className="text-xs text-red-400">{mcpError}</p>}
            <button
              className="rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              disabled={!mcpName.trim() || !mcpUrl.trim()}
              type="submit"
            >
              Connect server
            </button>
          </form>
        )}

        <div className="mb-4 space-y-2">
          {caps?.mcpServers.map((server) => (
            <div
              className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-950/40 p-3"
              key={server.id}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  server.connected ? 'bg-green-400' : 'bg-red-400'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{server.name}</p>
                <p className="truncate text-xs text-gray-500">{server.url}</p>
                <p
                  className={`text-[10px] ${
                    server.connected ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {server.connected
                    ? `${server.toolCount} tools`
                    : server.error || 'Disconnected'}
                </p>
              </div>
              <button
                className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-red-400"
                onClick={() => void mind.removeMcpServer(server.id)}
                title={`Remove ${server.name}`}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {caps?.tools.map((tool) => (
            <div
              className="rounded-lg border border-gray-800 bg-gray-950/40 p-3"
              key={tool.name}
            >
              <div className="flex items-center gap-2">
                <p className="truncate font-mono text-xs text-white">
                  {tool.name}
                </p>
                {tool.requiresConfirmation && (
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                {tool.description}
              </p>
            </div>
          ))}
        </div>
      </MindCard>
    </div>
  )
}
