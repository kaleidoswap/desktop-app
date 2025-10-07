import { Zap, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { useState } from 'react'

import { useAppSelector } from '../../app/store/hooks'
import { useLazyGetWalletInfoQuery } from '../../slices/spark/sparkApi.slice'
import { Button, Card } from '../ui'

import { SparkOperationsModal } from './SparkOperationsModal'

export const SparkBalanceSection = () => {
  const sparkConnected = useAppSelector((state) => state.spark.connected)
  const sparkInfo = useAppSelector((state) => state.spark.info)
  const [showOperationsModal, setShowOperationsModal] = useState(false)
  const [defaultTab, setDefaultTab] = useState<'receive' | 'send' | 'history'>(
    'receive'
  )

  const [getWalletInfo] = useLazyGetWalletInfoQuery()

  if (!sparkConnected || !sparkInfo) {
    return null
  }

  const handleOpenModal = (tab: 'receive' | 'send' | 'history') => {
    setDefaultTab(tab)
    setShowOperationsModal(true)
    // Refresh balance when opening modal
    getWalletInfo({ ensureSynced: false })
  }

  return (
    <>
      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-500/10 rounded-lg">
              <Zap className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-400">
                Spark Balance
              </h3>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">
                  {sparkInfo.balanceSats.toLocaleString()}
                </span>
                <span className="text-sm text-slate-400">sats</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              icon={<ArrowDownLeft className="w-4 h-4" />}
              onClick={() => handleOpenModal('receive')}
              size="sm"
              variant="secondary"
            >
              Receive
            </Button>
            <Button
              icon={<ArrowUpRight className="w-4 h-4" />}
              onClick={() => handleOpenModal('send')}
              size="sm"
            >
              Send
            </Button>
          </div>
        </div>
      </Card>

      {showOperationsModal && (
        <SparkOperationsModal
          defaultTab={defaultTab}
          onClose={() => setShowOperationsModal(false)}
        />
      )}
    </>
  )
}
