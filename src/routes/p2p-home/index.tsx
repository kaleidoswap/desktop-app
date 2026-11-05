import { ArrowLeft, Coins } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { WALLET_SETUP_PATH } from '../../app/router/paths'
import logoFull from '../../assets/logo-full.svg'
import { AppVersion } from '../../components/AppVersion'
import { Layout } from '../../components/Layout'
import { P2pMarketPage } from '../trade/nostr-p2p'

/**
 * The P2P market as an app of its own. It has a wallet of its own and needs no node, so it sits
 * outside the node's sections: a small sidebar, a way back to the welcome screen, and the market.
 */
export const Component = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <Layout>
      <div className="flex h-screen overflow-hidden">
        <div className="w-72 h-full bg-surface-base border-r border-divider/10 flex flex-col">
          <div className="flex items-center p-4 border-b border-divider/10">
            <img alt="KaleidoSwap" className="h-8" src={logoFull} />
          </div>
          <div className="flex-1 p-4 flex flex-col gap-4">
            <button
              className="self-start px-3 py-2 text-content-secondary hover:text-white transition-colors flex items-center gap-1.5 hover:bg-surface-overlay/50 rounded-lg text-sm"
              onClick={() => navigate(WALLET_SETUP_PATH)}
              type="button"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t('p2pHome.back', { defaultValue: 'Back to start' })}
            </button>
            <div className="rounded-xl bg-primary/10 p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-primary">
                <Coins className="w-4 h-4" />
                <strong className="text-sm">
                  {t('p2pHome.title', { defaultValue: 'P2P trading' })}
                </strong>
              </div>
              <p className="text-caption text-content-secondary">
                {t('p2pHome.body', {
                  defaultValue:
                    'Trade RGB assets directly with other people from this computer. Your wallet is separate from any node and is kept with a recovery phrase.',
                })}
              </p>
            </div>
          </div>
          <div className="p-4 border-t border-divider/10">
            <AppVersion className="relative" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <P2pMarketPage showNav={false} />
        </div>
      </div>
    </Layout>
  )
}
