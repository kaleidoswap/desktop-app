import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, TrendingUp } from 'lucide-react'

import { useAppSelector } from '../../../app/store/hooks'
import { DcaOrderCard } from './components/DcaOrderCard'
import { CreateDcaForm } from './components/CreateDcaForm'
import { priceApi } from '../../../slices/priceApi/priceApi.slice'
import { nodeApi } from '../../../slices/nodeApi/nodeApi.slice'

type Tab = 'active' | 'history'

export const Component = () => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('active')
  const [showCreate, setShowCreate] = useState(false)

  const orders = useAppSelector((state) => state.dca.orders)
  const fiatCurrency = useAppSelector((state) => state.settings.fiatCurrency)
  const networkInfoQuery = nodeApi.endpoints.networkInfo.useQueryState()
  const isMainnet = (networkInfoQuery.data as any)?.network === 'Mainnet'

  const { data: priceData } = priceApi.endpoints.getBitcoinPrice.useQueryState(fiatCurrency, {
    skip: !isMainnet,
  })
  const currentBtcPrice = isMainnet ? (priceData as any)?.bitcoin?.usd : undefined

  const activeOrders = orders.filter(
    (o) => o.status === 'active' || o.status === 'paused'
  )
  const historyOrders = orders.filter(
    (o) => o.status === 'completed' || o.status === 'cancelled'
  )

  const displayedOrders = tab === 'active' ? activeOrders : historyOrders

  return (
    <div className="flex flex-col h-full space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Tab buttons */}
          <div className="flex gap-1 bg-surface-overlay/50 rounded-xl p-1">
            <button
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                tab === 'active'
                  ? 'bg-surface-elevated text-content-primary shadow-sm'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
              onClick={() => setTab('active')}
            >
              {t('dca.tabs.active', 'Active')} ({activeOrders.length})
            </button>
            <button
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                tab === 'history'
                  ? 'bg-surface-elevated text-content-primary shadow-sm'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
              onClick={() => setTab('history')}
            >
              {t('dca.tabs.history', 'History')} ({historyOrders.length})
            </button>
          </div>
        </div>

        <button
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/15 text-primary
                     border border-primary/30 hover:bg-primary/25 font-medium text-sm
                     transition-all duration-200 active:scale-[0.97]"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus className="w-4 h-4" />
          {t('dca.createOrder', 'New DCA Order')}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateDcaForm
          currentBtcPrice={currentBtcPrice}
          onCreated={() => setShowCreate(false)}
        />
      )}

      {/* Orders list */}
      {displayedOrders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-16 space-y-3">
          <div className="p-4 rounded-2xl bg-surface-overlay/50 text-content-tertiary">
            <TrendingUp className="w-8 h-8" />
          </div>
          <p className="text-content-secondary font-medium">
            {tab === 'active'
              ? t('dca.empty.active', 'No active DCA orders')
              : t('dca.empty.history', 'No order history yet')}
          </p>
          {tab === 'active' && (
            <p className="text-content-tertiary text-sm max-w-xs">
              {t(
                'dca.empty.hint',
                'Create a scheduled or price-target order to start automatically buying BTC with USDT.'
              )}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto">
          {displayedOrders.map((order) => (
            <DcaOrderCard
              currentBtcPrice={currentBtcPrice}
              key={order.id}
              order={order}
            />
          ))}
        </div>
      )}
    </div>
  )
}
