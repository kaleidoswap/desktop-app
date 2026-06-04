import { TradeNav } from '../../../components/Trade'

import { Component as MarketMakerTradingPage } from './MarketMakerTradingPage'

export const Component = () => {
  return (
    <div className="w-full min-h-full">
      <div className="mx-auto w-full max-w-screen-xl px-4 pt-2">
        <TradeNav />
      </div>
      <MarketMakerTradingPage />
    </div>
  )
}
