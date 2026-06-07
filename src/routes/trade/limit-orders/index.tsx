import { TradeNav } from '../../../components/Trade'

import { LimitOrdersView } from './LimitOrdersView'

export const Component = () => (
  <div className="w-full min-h-full">
    <div className="mx-auto w-full max-w-screen-xl px-4 pt-2">
      <TradeNav />
    </div>
    <LimitOrdersView />
  </div>
)
