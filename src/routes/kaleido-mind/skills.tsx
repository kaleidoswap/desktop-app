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

export const SkillsManager: React.FC = () => {
  const mind = useMindContext()
  const caps = mind.capabilities
  const [showAddMcp, setShowAddMcp] = useState(false)
  const [showAddSkill, setShowAddSkill] = useState(false)
  const [skillName, setSkillName] = useState('')
  const [skillDescription, setSkillDescription] = useState('')
  const [skillInstructions, setSkillInstructions] = useState('')
  const [skillTools, setSkillTools] = useState('')
  const [skillError, setSkillError] = useState('')
  const [mcpName, setMcpName] = useState('')
  const [mcpUrl, setMcpUrl] = useState('')
  const [mcpError, setMcpError] = useState('')
  return (
    <div className="flex flex-col gap-6">
      <MindCard>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-content-secondary" />
          <h2 className="font-semibold text-content-primary">Skills & tools</h2>
        </div>
        <p className="text-sm text-content-tertiary">
          {caps?.mcpConnected
            ? `Live registry: ${caps.skills.length} skills and ${caps.tools.length} tools.`
            : 'The skill registry is available, but the Kaleido MCP is not connected.'}
        </p>
      </MindCard>

      <MindCard>
        <div className="mb-3 flex items-center gap-2">
          <Wrench className="h-5 w-5 text-status-warning" />
          <h3 className="font-semibold text-content-primary">Skills</h3>
          <button
            className="ml-auto flex items-center gap-1 rounded-md border border-border-default px-2.5 py-1 text-xs text-content-secondary hover:bg-surface-overlay"
            onClick={() => setShowAddSkill((value) => !value)}
            type="button"
          >
            <Plus className="h-3.5 w-3.5" /> Add skill
          </button>
        </div>
        {showAddSkill && (
          <form
            className="mb-4 grid gap-2 rounded-lg border border-status-warning/40 bg-status-warning/10 p-3"
            onSubmit={(event) => {
              event.preventDefault()
              setSkillError('')
              void mind
                .addSkill(
                  skillName,
                  skillDescription,
                  skillInstructions,
                  skillTools
                    .split(',')
                    .map((tool) => tool.trim())
                    .filter(Boolean)
                )
                .then(() => {
                  setSkillName('')
                  setSkillDescription('')
                  setSkillInstructions('')
                  setSkillTools('')
                  setShowAddSkill(false)
                })
                .catch((error) =>
                  setSkillError(
                    error instanceof Error ? error.message : String(error)
                  )
                )
            }}
          >
            <input
              className="rounded-md border border-border-default bg-surface-overlay px-3 py-2 text-sm text-content-primary"
              onChange={(event) => setSkillName(event.target.value)}
              placeholder="Skill name"
              value={skillName}
            />
            <input
              className="rounded-md border border-border-default bg-surface-overlay px-3 py-2 text-sm text-content-primary"
              onChange={(event) => setSkillDescription(event.target.value)}
              placeholder="When should the model use this skill?"
              value={skillDescription}
            />
            <textarea
              className="min-h-32 rounded-md border border-border-default bg-surface-overlay px-3 py-2 text-sm text-content-primary"
              onChange={(event) => setSkillInstructions(event.target.value)}
              placeholder="Instructions for the model…"
              value={skillInstructions}
            />
            <input
              className="rounded-md border border-border-default bg-surface-overlay px-3 py-2 text-sm text-content-primary"
              onChange={(event) => setSkillTools(event.target.value)}
              placeholder="Optional tools, comma separated"
              value={skillTools}
            />
            {skillError && (
              <p className="text-xs text-status-danger">{skillError}</p>
            )}
            <button
              className="rounded-md bg-status-warning px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              disabled={
                !skillName.trim() ||
                !skillDescription.trim() ||
                !skillInstructions.trim()
              }
              type="submit"
            >
              Save skill
            </button>
          </form>
        )}
        <div className="space-y-2">
          {caps?.skills.map((skill) => (
            <div
              className="flex items-start gap-3 rounded-lg border border-border-default bg-surface-overlay/40 p-3"
              key={skill.name}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-content-primary">
                  {skill.name}
                </p>
                <p className="mt-0.5 text-xs text-content-tertiary">
                  {skill.description}
                </p>
                <p className="mt-1 truncate font-mono text-[10px] text-content-tertiary">
                  {skill.tools.join(' · ') || 'No scoped tools'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  aria-pressed={skill.enabled}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    skill.enabled
                      ? 'bg-status-success/15 text-status-success'
                      : 'bg-surface-overlay text-content-tertiary'
                  }`}
                  onClick={() => {
                    setSkillError('')
                    void mind
                      .setSkillEnabled(skill.name, !skill.enabled)
                      .catch((error) =>
                        setSkillError(
                          error instanceof Error ? error.message : String(error)
                        )
                      )
                  }}
                  type="button"
                >
                  {skill.enabled ? 'Enabled' : 'Disabled'}
                </button>
                <button
                  className="rounded p-1 text-content-tertiary hover:bg-surface-overlay hover:text-status-danger"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete "${skill.name}"? Built-in skills can be restored by reinstalling or re-adding them.`
                      )
                    ) {
                      void mind.deleteSkill(skill.name)
                    }
                  }}
                  title={`Delete ${skill.name}`}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {skillError && !showAddSkill && (
            <p className="text-xs text-status-danger">{skillError}</p>
          )}
          {!caps?.skills.length && (
            <p className="text-sm text-content-tertiary">No skills loaded.</p>
          )}
        </div>
      </MindCard>

      <MindCard>
        <div className="mb-3 flex items-center gap-2">
          <Network className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-content-primary">
            MCP servers &amp; tools
          </h3>
          <span className="ml-auto hidden text-xs text-content-tertiary sm:inline">
            {caps?.tools.length ?? 0} connected
          </span>
          <button
            className="flex items-center gap-1 rounded-md border border-border-default px-2.5 py-1 text-xs text-content-secondary hover:bg-surface-overlay"
            onClick={() => setShowAddMcp((v) => !v)}
            type="button"
          >
            <Plus className="h-3.5 w-3.5" /> Add server
          </button>
        </div>
        {showAddMcp && (
          <form
            className="mb-4 grid gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3"
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
              className="rounded-md border border-border-default bg-surface-overlay px-3 py-2 text-sm text-content-primary"
              onChange={(event) => setMcpName(event.target.value)}
              placeholder="Server name"
              value={mcpName}
            />
            <input
              className="rounded-md border border-border-default bg-surface-overlay px-3 py-2 text-sm text-content-primary"
              onChange={(event) => setMcpUrl(event.target.value)}
              placeholder="https://example.com/mcp"
              type="url"
              value={mcpUrl}
            />
            {mcpError && (
              <p className="text-xs text-status-danger">{mcpError}</p>
            )}
            <button
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-surface-base disabled:opacity-40"
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
              className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-overlay/40 p-3"
              key={server.id}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  server.connected ? 'bg-status-success' : 'bg-status-danger'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-content-primary">
                  {server.name}
                </p>
                <p className="truncate text-xs text-content-tertiary">
                  {server.url}
                </p>
                <p
                  className={`text-[10px] ${
                    server.connected
                      ? 'text-status-success'
                      : 'text-status-danger'
                  }`}
                >
                  {server.connected
                    ? `${server.toolCount} tools`
                    : server.error || 'Disconnected'}
                </p>
              </div>
              <button
                className="rounded p-1 text-content-tertiary hover:bg-surface-overlay hover:text-status-danger"
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
              className="rounded-lg border border-border-default bg-surface-overlay/40 p-3"
              key={tool.name}
            >
              <div className="flex items-center gap-2">
                <p className="truncate font-mono text-xs text-content-primary">
                  {tool.name}
                </p>
                {tool.requiresConfirmation && (
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-status-warning" />
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-content-tertiary">
                {tool.description}
              </p>
            </div>
          ))}
        </div>
      </MindCard>
    </div>
  )
}

// The standalone /kaleido-mind/skills route renders the same manager that the
// Brain page embeds as a section.
export const Component = SkillsManager
