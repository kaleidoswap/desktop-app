import { useState } from 'react'

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
  return <SwapView onShowOffers={() => choose('book')} />
}
