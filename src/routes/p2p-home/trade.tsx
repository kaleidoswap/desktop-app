import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { P2pMarketPage } from '../trade/nostr-p2p'
import { SwapView } from '../trade/nostr-p2p/market/SwapView'

type View = 'swap' | 'book'

const VIEW_KEY = 'p2p-trade.view'

const savedView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'swap' ? 'swap' : 'book'
  } catch {
    return 'book'
  }
}

export const Component = () => {
  const { t } = useTranslation()
  const [view, setView] = useState<View>(savedView)
  const choose = (v: View) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      // The view preference is optional.
    }
  }

  if (view === 'book') {
    return <P2pMarketPage onSimpleSwap={() => choose('swap')} showNav={false} />
  }
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-content-primary">
          {t('p2pTrade.simpleSwap', { defaultValue: 'Simple swap' })}
        </h1>
        <button
          className="flex items-center gap-2 rounded-lg border border-divider/25 px-3 py-2 text-sm font-medium text-content-primary hover:bg-surface-raised"
          onClick={() => choose('book')}
          type="button"
        >
          <ArrowLeft aria-hidden size={16} />
          {t('p2pTrade.market', { defaultValue: 'P2P market' })}
        </button>
      </header>
      <SwapView />
    </div>
  )
}
