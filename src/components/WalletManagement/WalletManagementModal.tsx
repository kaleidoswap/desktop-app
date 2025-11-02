import { Check, Trash2, Zap, X } from 'lucide-react'
import React from 'react'

import { useAppDispatch, useAppSelector } from '../../app/store/hooks'
import sparkLogo from '../../assets/spark-logo.svg'
import { sparkSliceActions } from '../../slices/spark/spark.slice'
import { uiSliceActions } from '../../slices/ui/ui.slice'
import { Button, Card } from '../ui'

export interface WalletManagementModalProps {
  isOpen: boolean
  onClose: () => void
}

export const WalletManagementModal: React.FC<WalletManagementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const dispatch = useAppDispatch()
  const sparkWallets = useAppSelector((state) => state.spark.wallets)
  const activeWalletId = useAppSelector((state) => state.spark.activeWalletId)
  const rlnConnected = useAppSelector((state) => state.node.isRunning)

  if (!isOpen) return null

  const handleRemoveWallet = (walletId: string) => {
    if (
      window.confirm(
        'Are you sure you want to remove this wallet? This action cannot be undone.'
      )
    ) {
      dispatch(sparkSliceActions.removeWallet(walletId))
    }
  }

  const handleSetActive = (walletId: string) => {
    dispatch(sparkSliceActions.setActiveWallet(walletId))
  }

  const handleAddWallet = () => {
    dispatch(
      uiSliceActions.setModal({
        context: 'dashboard',
        type: 'wallet-type-selection',
      })
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-400'
      case 'connecting':
      case 'syncing':
        return 'text-yellow-400'
      case 'error':
        return 'text-red-400'
      default:
        return 'text-slate-400'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Connected'
      case 'connecting':
        return 'Connecting...'
      case 'syncing':
        return 'Syncing...'
      case 'error':
        return 'Error'
      case 'disconnected':
      default:
        return 'Disconnected'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-8 border-b border-slate-700 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">
              Manage Wallets
            </h2>
            <p className="text-slate-400">
              View and manage your connected wallets
            </p>
          </div>
          <button
            className="p-2 rounded-full hover:bg-slate-800 transition-colors"
            onClick={onClose}
          >
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Wallets List */}
        <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* RLN Wallet */}
          <Card className="p-6 bg-slate-800/50 border border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/20 rounded-xl">
                  <Zap className="w-8 h-8 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">
                    RGB Lightning Node
                  </h3>
                  <p className="text-sm text-slate-400">
                    Primary wallet (Always active)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className={`flex items-center gap-2 ${rlnConnected ? 'text-green-400' : 'text-slate-400'}`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${rlnConnected ? 'bg-green-400 animate-pulse' : 'bg-slate-400'}`}
                  ></div>
                  <span className="text-sm font-medium">
                    {rlnConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div className="px-3 py-1 bg-amber-500/20 border border-amber-500 rounded-full text-xs font-semibold text-amber-400">
                  Required
                </div>
              </div>
            </div>
          </Card>

          {/* Spark Wallets */}
          {Object.values(sparkWallets).map((wallet) => (
            <Card
              className="p-6 bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition-all"
              key={wallet.id}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/20 rounded-xl">
                    <img alt="Spark" className="w-8 h-8" src={sparkLogo} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">
                      {wallet.label}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {wallet.config.network === 'mainnet'
                        ? 'Mainnet'
                        : 'Regtest'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className={`flex items-center gap-2 ${getStatusColor(wallet.status)}`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${wallet.status === 'connected' ? 'bg-green-400 animate-pulse' : 'bg-slate-400'}`}
                    ></div>
                    <span className="text-sm font-medium">
                      {getStatusText(wallet.status)}
                    </span>
                  </div>
                  {activeWalletId === wallet.id && (
                    <div className="px-3 py-1 bg-blue-500/20 border border-blue-500 rounded-full text-xs font-semibold text-blue-400 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Active
                    </div>
                  )}
                  {activeWalletId !== wallet.id && (
                    <Button
                      className="px-3 py-1 text-xs"
                      onClick={() => handleSetActive(wallet.id)}
                      variant="outline"
                    >
                      Set Active
                    </Button>
                  )}
                  <button
                    className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                    onClick={() => handleRemoveWallet(wallet.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {wallet.error && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400">{wallet.error}</p>
                </div>
              )}
            </Card>
          ))}

          {Object.keys(sparkWallets).length === 0 && (
            <div className="text-center py-12">
              <div className="mb-4">
                <Zap className="w-16 h-16 text-slate-600 mx-auto" />
              </div>
              <p className="text-slate-400 mb-4">
                No additional wallets configured
              </p>
              <Button
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-semibold"
                onClick={handleAddWallet}
              >
                Add Your First Spark Wallet
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 bg-slate-900/50 border-t border-slate-700 flex justify-between items-center">
          <p className="text-sm text-slate-400">
            {Object.keys(sparkWallets).length + 1} wallet(s) configured
          </p>
          <div className="flex gap-3">
            {Object.keys(sparkWallets).length > 0 && (
              <Button
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-semibold"
                onClick={handleAddWallet}
              >
                Add Wallet
              </Button>
            )}
            <Button
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl"
              onClick={onClose}
              variant="outline"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
