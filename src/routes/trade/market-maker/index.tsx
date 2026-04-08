import { Store, Target } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { LimitOrdersView } from '../limit-orders/LimitOrdersView'
import { Component as MarketMakerTradingPage } from './MarketMakerTradingPage'

type TradeTab = 'trade' | 'limit-orders'

export const Component = () => {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab: TradeTab =
    searchParams.get('tab') === 'limit-orders' ? 'limit-orders' : 'trade'

  const handleTabChange = (nextTab: TradeTab) => {
    const nextParams = new URLSearchParams(searchParams)

    if (nextTab === 'limit-orders') {
      nextParams.set('tab', 'limit-orders')
    } else {
      nextParams.delete('tab')
    }

    setSearchParams(nextParams, { replace: true })
  }

  return (
    <div className="w-full min-h-full">
      <div className="mx-auto w-full max-w-screen-xl px-4 pt-2">
        <div className="mb-4 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-border-subtle bg-surface-raised/80 p-1.5 shadow-sm backdrop-blur-sm">
          <button
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'trade'
                ? 'bg-surface-elevated text-content-primary shadow-sm'
                : 'text-content-secondary hover:text-content-primary'
            }`}
            onClick={() => handleTabChange('trade')}
            type="button"
          >
            <Store className="h-4 w-4" />
            {t('navigation.marketMaker')}
          </button>
          <button
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'limit-orders'
                ? 'bg-surface-elevated text-content-primary shadow-sm'
                : 'text-content-secondary hover:text-content-primary'
            }`}
            onClick={() => handleTabChange('limit-orders')}
            type="button"
          >
            <Target className="h-4 w-4" />
            {t('navigation.limitOrders', 'Limit Orders')}
          </button>
        </div>
      </div>

      {activeTab === 'limit-orders' ? (
        <LimitOrdersView />
      ) : (
        <MarketMakerTradingPage />
      )}
    </div>
  )
}
