// Skills — overview of what the agent can do. Chat routes through skills and
// the connected MCP tools. There is no skills API in the sidecar yet, so this
// page is an overview/placeholder ready to be wired to a real registry.

import { Network, Sparkles, Wallet, Wrench } from 'lucide-react'
import React from 'react'

import { MindCard } from './shared'

const CAPABILITIES = [
  {
    desc: 'Inspect balances, channels, invoices and on-chain activity on the connected RGB Lightning node.',
    icon: <Wallet className="h-5 w-5 text-cyan-300" />,
    title: 'Node & wallet',
  },
  {
    desc: 'Reach external tools and data sources exposed over the Model Context Protocol.',
    icon: <Network className="h-5 w-5 text-violet-300" />,
    title: 'Connected MCP tools',
  },
  {
    desc: 'Task-specific skills the agent can invoke while answering. Management UI is coming soon.',
    icon: <Wrench className="h-5 w-5 text-amber-300" />,
    title: 'Skills',
  },
]

export const Component: React.FC = () => {
  return (
    <div className="flex flex-col gap-6">
      <MindCard>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gray-300" />
          <h2 className="font-semibold text-white">Skills & tools</h2>
        </div>
        <p className="text-sm text-gray-500">
          When you chat, the agent routes your request through its skills and
          the connected MCP tools, picking the right capability for the task.
        </p>
      </MindCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CAPABILITIES.map((c) => (
          <MindCard key={c.title}>
            <div className="mb-2 flex items-center gap-2">
              {c.icon}
              <h3 className="font-semibold text-white">{c.title}</h3>
            </div>
            <p className="text-xs leading-relaxed text-gray-500">{c.desc}</p>
          </MindCard>
        ))}
      </div>

      <p className="text-center text-xs text-gray-600">
        Per-skill configuration and a live tool registry will appear here in a
        future update.
      </p>
    </div>
  )
}
