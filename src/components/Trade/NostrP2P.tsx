import { openUrl } from '@tauri-apps/plugin-opener'
import { Users, Zap, Clock, Bell, ArrowRight, Globe } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

export const NostrP2P: React.FC = () => {
  const { t } = useTranslation()
  return (
    <div className="bg-gradient-to-b from-slate-900/80 to-slate-800/80 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6 shadow-lg">
      <div className="flex flex-col items-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
          <div className="relative p-4 bg-blue-600/20 rounded-full">
            <Users className="w-10 h-10 text-blue-400" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-3">
          {t('trade.nostrP2P.title')}
        </h2>
        <p className="text-slate-400 text-center mb-8">
          {t('trade.nostrP2P.description')}
        </p>

        <div className="space-y-4 w-full mb-8">
          <div className="bg-slate-800 rounded-lg p-5 flex items-center border border-slate-700/50 hover:border-blue-500/30 hover:bg-slate-800/80 transition-all">
            <Zap className="w-8 h-8 text-blue-400 mr-4 flex-shrink-0" />
            <div>
              <h3 className="text-white font-medium mb-1">
                {t('trade.nostrP2P.directSwaps')}
              </h3>
              <p className="text-sm text-slate-400">
                {t('trade.nostrP2P.directSwapsDesc')}
              </p>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-5 flex items-center border border-slate-700/50 hover:border-blue-500/30 hover:bg-slate-800/80 transition-all">
            <Clock className="w-8 h-8 text-blue-400 mr-4 flex-shrink-0" />
            <div>
              <h3 className="text-white font-medium mb-1">
                {t('trade.nostrP2P.limitOrders')}
              </h3>
              <p className="text-sm text-slate-400">
                {t('trade.nostrP2P.limitOrdersDesc')}
              </p>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-5 flex items-center border border-slate-700/50 hover:border-blue-500/30 hover:bg-slate-800/80 transition-all">
            <Bell className="w-8 h-8 text-blue-400 mr-4 flex-shrink-0" />
            <div>
              <h3 className="text-white font-medium mb-1">
                {t('trade.nostrP2P.notifications')}
              </h3>
              <p className="text-sm text-slate-400">
                {t('trade.nostrP2P.notificationsDesc')}
              </p>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-5 flex items-center border border-slate-700/50 hover:border-blue-500/30 hover:bg-slate-800/80 transition-all">
            <ArrowRight className="w-8 h-8 text-blue-400 mr-4 flex-shrink-0" />
            <div>
              <h3 className="text-white font-medium mb-1">
                {t('trade.nostrP2P.trustlessSwaps')}
              </h3>
              <p className="text-sm text-slate-400">
                {t('trade.nostrP2P.trustlessSwapsDesc')}
              </p>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-5 flex items-center border border-slate-700/50 hover:border-blue-500/30 hover:bg-slate-800/80 transition-all">
            <Globe className="w-8 h-8 text-blue-400 mr-4 flex-shrink-0" />
            <div>
              <h3 className="text-white font-medium mb-1">
                {t('trade.nostrP2P.globalMarketplace')}
              </h3>
              <p className="text-sm text-slate-400">
                {t('trade.nostrP2P.globalMarketplaceDesc')}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-600/10 border border-blue-500/20 rounded-lg p-4 w-full">
          <p className="text-blue-400 text-sm text-center">
            {t('trade.nostrP2P.notifyPrompt')}{' '}
            <button
              className="text-blue-400 underline hover:text-blue-300"
              onClick={() =>
                openUrl('https://github.com/BitSwap-BiFi/Kaleidoswap')
              }
            >
              {t('trade.nostrP2P.starGithub')}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
