import { Activity } from '../market/Activity'
import { OrderBook } from '../market/OrderBook'
import { PairHeader } from '../market/PairHeader'
import { TakeSheet } from '../market/TakeSheet'
import { TradeTicket } from '../market/TradeTicket'

import {
  demoBalance,
  demoInfo,
  demoOrder,
  demoOrders,
  demoTrades,
  DEMO,
} from './fixtures'

const banner = `Demo fixture, not a wallet. Price ${DEMO.price.toLocaleString('en-US')} sats, platform fee ${DEMO.platform.toLocaleString('en-US')}, network fee ${DEMO.network.toLocaleString('en-US')}, RGB output ${DEMO.rgb.toLocaleString('en-US')}.`

export function CostPreview({ view }: { view: string }) {
  const info = demoInfo()
  const balance = demoBalance()
  const sell = demoOrder('sell')
  const buy = demoOrder('buy')

  if (view === 'take') {
    return (
      <TakeSheet
        info={info}
        onChanged={() => undefined}
        onClose={() => undefined}
        orders={[sell]}
        trades={[]}
      />
    )
  }

  if (view === 'take-sell') {
    return (
      <TakeSheet
        info={info}
        onChanged={() => undefined}
        onClose={() => undefined}
        orders={[buy]}
        trades={[]}
      />
    )
  }

  if (view === 'orders') {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4">
        <p className="rounded-xl bg-status-warning-subtle px-3 py-2 text-caption text-content-primary">
          {banner} Open orders are this wallet as maker: a sell reserves
          nothing, a buy reserves the price and the RGB output.
        </p>
        <Activity
          balance={balance}
          initialTab="orders"
          onChanged={() => undefined}
          orders={demoOrders()}
          trades={[]}
        />
      </div>
    )
  }

  if (view === 'history') {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4">
        <p className="rounded-xl bg-status-warning-subtle px-3 py-2 text-caption text-content-primary">
          {banner} The third trade is an older record: platform fee only.
        </p>
        <Activity
          balance={balance}
          initialTab="trades"
          knownPrecision={[
            { asset_id: sell.asset_id, precision: sell.precision },
          ]}
          onChanged={() => undefined}
          orders={demoOrders()}
          trades={demoTrades()}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-screen-xl flex-col gap-3 p-4">
      <p className="rounded-xl bg-status-warning-subtle px-3 py-2 text-caption text-content-primary">
        {banner} This is the market components with that offer prefilled.
      </p>
      <PairHeader
        bestAsk={sell.unit_price}
        info={info}
        markets={[
          {
            asset_id: sell.asset_id,
            impersonates: null,
            orders: 1,
            precision: 0,
            ticker: 'DEMO',
            verified: true,
          },
        ]}
        onSelect={() => undefined}
        open={1}
        selected={sell.asset_id}
        walletLabel="Demo wallet"
      />
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <OrderBook onPick={() => undefined} orders={[sell]} ticker="DEMO" />
        <TradeTicket
          asset={{
            asset_id: sell.asset_id,
            precision: 0,
            ticker: 'DEMO',
          }}
          balance={balance}
          info={info}
          initialAmount="100"
          initialMode="market"
          initialSide="buy"
          onPlaced={() => undefined}
          onReview={() => undefined}
          orders={[sell]}
        />
      </div>
    </div>
  )
}
