import { Button, PageHeader } from 'kaleido-ui'
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
      <PageHeader
        action={
          <Button
            onClick={() => choose('book')}
            size="sm"
            type="button"
            variant="surface"
          >
            <ArrowLeft aria-hidden size={16} />
            {t('p2pTrade.market', { defaultValue: 'P2P market' })}
          </Button>
        }
        title={t('p2pTrade.simpleSwap', { defaultValue: 'Simple swap' })}
        variant="page"
      />
      <SwapView />
    </div>
  )
}
