import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { P2pMarketPage } from '../trade/nostr-p2p'
import { SwapView } from '../trade/nostr-p2p/market/SwapView'

type View = 'swap' | 'book'

const VIEW_KEY = 'p2p-trade.view'

const savedView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'book' ? 'book' : 'swap'
  } catch {
    return 'swap'
  }
}

/** Trading in the P2P app: a simple swap by default, the full order book for those who want it. */
export const Component = () => {
  const { t } = useTranslation()
  const [view, setView] = useState<View>(savedView)
  const choose = (v: View) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      // the choice is just not remembered
    }
  }
  const views: [View, string][] = [
    ['swap', t('p2pTrade.swap', { defaultValue: 'Swap' })],
    ['book', t('p2pTrade.book', { defaultValue: 'Order book' })],
  ]
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-content-primary">
          {t('p2pShell.trade', { defaultValue: 'Trade' })}
        </h1>
        <div
          className="flex gap-1 rounded-xl bg-surface-inset p-1"
          role="tablist"
        >
          {views.map(([id, label]) => (
            <button
              aria-selected={view === id}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                view === id
                  ? 'bg-surface-raised text-content-primary'
                  : 'text-content-tertiary hover:text-content-secondary'
              }`}
              key={id}
              onClick={() => choose(id)}
              role="tab"
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      {view === 'swap' ? <SwapView /> : <P2pMarketPage showNav={false} />}
    </div>
  )
}
