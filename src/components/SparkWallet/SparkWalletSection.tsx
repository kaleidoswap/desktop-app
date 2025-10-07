import { Zap, Plus } from 'lucide-react'
import { useState } from 'react'

import { useAppSelector } from '../../app/store/hooks'
import { Button, Card } from '../ui'

import { SparkBalanceCard } from './SparkBalanceCard'
import { SparkWalletSetupModal } from './SparkWalletSetup'

export const SparkWalletSection = () => {
  const sparkConnected = useAppSelector((state) => state.spark.connected)
  const [showSetupModal, setShowSetupModal] = useState(false)

  if (sparkConnected) {
    return <SparkBalanceCard />
  }

  return (
    <>
      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-500/10 rounded-lg">
              <Zap className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Spark Wallet</h3>
              <p className="text-sm text-slate-400">
                Fast, self-custodial Bitcoin Layer 2 payments
              </p>
            </div>
          </div>
          <Button
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setShowSetupModal(true)}
          >
            Create Spark Wallet
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium text-slate-300">
                Lightning Payments
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Send and receive via Lightning Network and LNURL
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium text-slate-300">
                Spark Transfers
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Instant P2P payments between Spark users
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium text-slate-300">
                On-chain Interop
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Deposit from and withdraw to Bitcoin L1
            </p>
          </div>
        </div>
      </Card>

      {showSetupModal && (
        <SparkWalletSetupModal onClose={() => setShowSetupModal(false)} />
      )}
    </>
  )
}
