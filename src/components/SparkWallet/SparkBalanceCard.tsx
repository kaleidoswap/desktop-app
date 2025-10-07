import {
  Zap,
  Wallet,
  RefreshCw,
  ArrowDownRight,
  ArrowUpRight,
  ArrowUp,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { useAppDispatch, useAppSelector } from '../../app/store/hooks'
import { formatBitcoinAmount } from '../../helpers/number'
import { sparkSliceActions } from '../../slices/spark/spark.slice'
import { useLazyGetWalletInfoQuery } from '../../slices/spark/sparkApi.slice'
import { uiSliceActions } from '../../slices/ui/ui.slice'
import { Button, Card, LoadingPlaceholder } from '../ui'

export const SparkBalanceCard = () => {
  const dispatch = useAppDispatch()
  const sparkConnected = useAppSelector((state) => state.spark.connected)
  const sparkInfo = useAppSelector((state) => state.spark.info)
  const bitcoinUnit = useAppSelector((state) => state.settings.bitcoinUnit)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [getWalletInfo, walletInfoResponse] = useLazyGetWalletInfoQuery()

  const refreshData = useCallback(async () => {
    if (!sparkConnected) return
    setIsRefreshing(true)
    try {
      const result = await getWalletInfo({ ensureSynced: false })
      if (result.data) {
        dispatch(sparkSliceActions.setWalletInfo(result.data))
      }
    } finally {
      setIsRefreshing(false)
    }
  }, [sparkConnected, getWalletInfo, dispatch])

  useEffect(() => {
    if (sparkConnected) {
      refreshData()
      const intervalId = setInterval(refreshData, 10000)
      return () => clearInterval(intervalId)
    }
  }, [sparkConnected, refreshData])

  if (!sparkConnected) {
    return null
  }

  const balance = sparkInfo?.balanceSats || 0
  const isLoading = walletInfoResponse.isLoading

  return (
    <Card className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-yellow-500" />
          <div>
            <h2 className="text-sm font-medium text-slate-400">
              Spark Wallet Balance
            </h2>
            <div className="text-lg font-bold text-white">
              {isLoading ? (
                <LoadingPlaceholder width="w-32" />
              ) : (
                `${formatBitcoinAmount(balance, bitcoinUnit)} ${bitcoinUnit}`
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            disabled={isRefreshing}
            icon={
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              />
            }
            onClick={refreshData}
            size="sm"
            variant="outline"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button
            icon={<ArrowDownRight className="w-3.5 h-3.5" />}
            onClick={() =>
              dispatch(
                uiSliceActions.setModal({
                  type: 'spark-deposit',
                })
              )
            }
            size="sm"
            variant="success"
          >
            Deposit
          </Button>
          <Button
            icon={<ArrowUpRight className="w-3.5 h-3.5" />}
            onClick={() =>
              dispatch(
                uiSliceActions.setModal({
                  type: 'spark-withdraw',
                })
              )
            }
            size="sm"
            variant="danger"
          >
            Withdraw
          </Button>
          <Button
            icon={<ArrowUp className="w-3.5 h-3.5" />}
            onClick={() =>
              dispatch(
                uiSliceActions.setModal({
                  type: 'spark-l1-withdraw',
                })
              )
            }
            size="sm"
            variant="secondary"
          >
            L1 Withdraw
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="bg-slate-900/50 rounded-lg p-2.5">
          <span className="text-sm text-slate-400 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            Spark Address
          </span>
          <div className="text-xs text-white font-mono mt-1 truncate">
            {sparkInfo?.sparkAddress || '...'}
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-2.5">
          <span className="text-sm text-slate-400 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-orange-500" />
            Bitcoin Address
          </span>
          <div className="text-xs text-white font-mono mt-1 truncate">
            {sparkInfo?.bitcoinAddress || '...'}
          </div>
        </div>
      </div>
    </Card>
  )
}
