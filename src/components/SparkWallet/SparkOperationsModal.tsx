import { X, ArrowDownLeft, ArrowUpRight, Clock } from 'lucide-react'
import { useState } from 'react'

import { Card } from '../ui'

import { SparkHistoryTab } from './SparkHistoryTab'
import { SparkReceiveTab } from './SparkReceiveTab'
import { SparkSendTab } from './SparkSendTab'

interface SparkOperationsModalProps {
  defaultTab?: 'receive' | 'send' | 'history'
  onClose: () => void
}

export const SparkOperationsModal = ({
  defaultTab = 'receive',
  onClose,
}: SparkOperationsModalProps) => {
  const [activeTab, setActiveTab] = useState<'receive' | 'send' | 'history'>(
    defaultTab
  )

  const tabs = [
    { icon: ArrowDownLeft, id: 'receive' as const, label: 'Receive' },
    { icon: ArrowUpRight, id: 'send' as const, label: 'Send' },
    { icon: Clock, id: 'history' as const, label: 'History' },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Spark Wallet</h2>
          <button
            className="text-slate-400 hover:text-white transition-colors"
            onClick={onClose}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-700">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'text-yellow-500 border-yellow-500'
                    : 'text-slate-400 border-transparent hover:text-slate-300'
                }`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'receive' && <SparkReceiveTab />}
          {activeTab === 'send' && <SparkSendTab onClose={onClose} />}
          {activeTab === 'history' && <SparkHistoryTab />}
        </div>
      </Card>
    </div>
  )
}
