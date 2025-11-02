import { CheckCircle, XCircle, Loader2, Zap } from 'lucide-react'
import React from 'react'

import { useAppSelector } from '../../app/store/hooks'
import sparkLogo from '../../assets/spark-logo.svg'

export const WalletStatusIndicator: React.FC = () => {
  const rlnConnected = useAppSelector((state) => state.node.isRunning)
  const sparkConnected = useAppSelector((state) => state.spark.connected)
  const sparkConnecting = useAppSelector((state) => state.spark.connecting)
  const sparkWallets = useAppSelector((state) => state.spark.wallets)

  const getSparkStatus = () => {
    if (sparkConnecting) return 'connecting'
    if (sparkConnected) return 'connected'
    if (Object.keys(sparkWallets).length > 0) {
      // Check if any wallet is connected
      const hasConnected = Object.values(sparkWallets).some(
        (w) => w.status === 'connected'
      )
      if (hasConnected) return 'connected'

      const hasConnecting = Object.values(sparkWallets).some(
        (w) => w.status === 'connecting' || w.status === 'syncing'
      )
      if (hasConnecting) return 'connecting'
    }
    return 'disconnected'
  }

  const sparkStatus = getSparkStatus()

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'connecting':
        return <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
      case 'disconnected':
        return <XCircle className="w-4 h-4 text-slate-500" />
      default:
        return <XCircle className="w-4 h-4 text-red-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-400'
      case 'connecting':
        return 'text-yellow-400'
      case 'disconnected':
        return 'text-slate-500'
      default:
        return 'text-red-400'
    }
  }

  return (
    <div className="flex items-center gap-4">
      {/* RLN Status */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg">
        <div className="p-1.5 bg-purple-500/20 rounded-md">
          <Zap className="w-4 h-4 text-purple-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-slate-400">RLN</span>
          <div className="flex items-center gap-1.5">
            {getStatusIcon(rlnConnected ? 'connected' : 'disconnected')}
            <span
              className={`text-xs font-medium ${getStatusColor(rlnConnected ? 'connected' : 'disconnected')}`}
            >
              {rlnConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Spark Status */}
      {(sparkConnected ||
        sparkConnecting ||
        Object.keys(sparkWallets).length > 0) && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg">
          <div className="p-1.5 bg-blue-500/20 rounded-md">
            <img alt="Spark" className="w-4 h-4" src={sparkLogo} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-400">Spark</span>
            <div className="flex items-center gap-1.5">
              {getStatusIcon(sparkStatus)}
              <span
                className={`text-xs font-medium ${getStatusColor(sparkStatus)}`}
              >
                {sparkStatus === 'connected' && 'Connected'}
                {sparkStatus === 'connecting' && 'Connecting...'}
                {sparkStatus === 'disconnected' && 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
