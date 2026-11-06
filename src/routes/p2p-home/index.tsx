import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { WALLET_SETUP_PATH } from '../../app/router/paths'
import logoFull from '../../assets/logo-full.svg'
import { AppVersion } from '../../components/AppVersion'
import { Layout } from '../../components/Layout'
import { P2pMarketPage } from '../trade/nostr-p2p'

/**
 * The P2P market as an app of its own. It has a wallet of its own and needs no node, so it sits
 * outside the node's sections. It has nothing to put in a sidebar, so it gets a slim bar on top
 * (the way back and where you are) and the whole width for the market.
 */
export const Component = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <Layout>
      <div className="flex h-screen flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-4 border-b border-divider/10 bg-surface-base px-4 py-2.5">
          <img alt="KaleidoSwap" className="h-7" src={logoFull} />
          <span aria-hidden className="h-5 w-px bg-divider/20" />
          <button
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-content-secondary transition-colors hover:bg-surface-overlay/50 hover:text-white"
            onClick={() => navigate(WALLET_SETUP_PATH)}
            type="button"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('p2pHome.back', { defaultValue: 'Back to start' })}
          </button>
          <h1 className="text-sm font-semibold text-content-primary">
            {t('p2pHome.title', { defaultValue: 'P2P trading' })}
          </h1>
          <AppVersion className="relative ml-auto" />
        </header>
        <main className="flex-1 overflow-y-auto">
          <P2pMarketPage showNav={false} />
        </main>
      </div>
    </Layout>
  )
}
