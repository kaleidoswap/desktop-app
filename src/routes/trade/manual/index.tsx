import {
  ArrowRight,
  Lock,
  Unlock,
  Zap,
  ChevronDown,
  ChevronUp,
  User,
  RefreshCw,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import { useSettings } from '../../../hooks/useSettings'
import { Loader } from '../../../components/Loader'
// import { StatusToast } from '../../../components/StatusToast'
import { NoChannelsMessage, ManualSwapForm } from '../../../components/Trade'
import { TakerSwapForm } from '../../../components/Trade/TakerSwapForm'
import {
  nodeApi,
  Channel,
  NiaAsset,
} from '../../../slices/nodeApi/nodeApi.slice'
import { logger } from '../../../utils/logger'
import './index.css'

export const Component = () => {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [assets, setAssets] = useState<NiaAsset[]>([])
  const [hasValidChannelsForTrading, setHasValidChannelsForTrading] =
    useState(false)
  const [hasEnoughBalance, setHasEnoughBalance] = useState(true)
  const [isExplanationExpanded, setIsExplanationExpanded] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeRole, setActiveRole] = useState<'maker' | 'taker'>('maker')

  // API hooks
  const [listChannels] = nodeApi.endpoints.listChannels.useLazyQuery()
  const [btcBalance] = nodeApi.endpoints.btcBalance.useLazyQuery()

  const { data: assetsData } = nodeApi.endpoints.listAssets.useQuery(
    undefined,
    {
      pollingInterval: 30000,
      refetchOnFocus: false,
      refetchOnMountOrArgChange: true,
      refetchOnReconnect: false,
    }
  )

  const { bitcoinUnit } = useSettings()
  const { t } = useTranslation()

  // Utility functions
  const getDisplayAsset = (asset: string) => {
    return asset === 'BTC' && bitcoinUnit === 'SAT' ? 'SAT' : asset
  }

  const getAssetPrecision = (asset: string) => {
    if (asset === 'BTC') {
      return bitcoinUnit === 'BTC' ? 8 : 0
    }
    const assetInfo = assets.find(
      (a) => a.asset_id === asset || a.ticker === asset
    )
    return assetInfo ? assetInfo.precision : 8
  }

  const formatAmount = (amount: number, asset: string) => {
    const precision = getAssetPrecision(asset)
    const divisor = Math.pow(10, precision)
    const formattedAmount = (amount / divisor).toFixed(precision)
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: precision,
      minimumFractionDigits: 0,
      useGrouping: true,
    }).format(parseFloat(formattedAmount))
  }

  const toggleExplanation = () => {
    setIsExplanationExpanded(!isExplanationExpanded)
  }

  const handleRoleChange = (role: 'maker' | 'taker') => {
    setActiveRole(role)
  }

  // Fetch initial data
  useEffect(() => {
    const setup = async () => {
      setIsLoading(true)
      try {
        const [listChannelsResponse, balanceResponse] = await Promise.all([
          listChannels(),
          btcBalance(),
        ])

        if ('data' in listChannelsResponse && listChannelsResponse.data) {
          const channelsList = listChannelsResponse.data.channels

          // Check if there's at least one channel with an asset that is ready and usable
          const hasValidChannels = channelsList?.some(
            (channel: Channel) =>
              channel.asset_id !== null &&
              channel.ready &&
              ((channel.outbound_balance_msat ?? 0) > 0 ||
                (channel.inbound_balance_msat ?? 0) > 0)
          )
          setHasValidChannelsForTrading(hasValidChannels ?? false)
        }

        // Check if there's enough balance to open a channel
        if ('data' in balanceResponse && balanceResponse.data) {
          const vanilla = balanceResponse.data?.vanilla
          // Assuming minimum balance needed is 20000 sats (adjust as needed)
          if (vanilla) {
            setHasEnoughBalance((vanilla?.spendable ?? 0) >= 20000)
          }
        }

        if (assetsData && assetsData.nia) {
          setAssets(assetsData.nia)
        }

        logger.info('Initial data fetched successfully')
      } catch (error) {
        logger.error('Error during setup:', error)
        toast.error(t('tradeManual.errors.initializationFailed'))
      } finally {
        setIsLoading(false)
      }
    }

    setup()
  }, [listChannels, btcBalance, assetsData])

  const refreshData = async () => {
    setIsLoading(true)
    setIsRefreshing(true)
    try {
      const listChannelsResponse = await listChannels()

      if ('data' in listChannelsResponse && listChannelsResponse.data) {
        const channelsList = listChannelsResponse.data.channels

        // Check if there's at least one channel with an asset that is ready and usable
        const hasValidChannels = channelsList?.some(
          (channel) =>
            channel.asset_id !== null &&
            channel.ready &&
            ((channel.outbound_balance_msat ?? 0) > 0 ||
              (channel.inbound_balance_msat ?? 0) > 0)
        )
        setHasValidChannelsForTrading(hasValidChannels ?? false)
      }

      if (assetsData && assetsData.nia) {
        setAssets(assetsData.nia)
      }

      logger.info('Data refreshed successfully')
      toast.success(t('tradeManual.toast.refreshSuccess'))
    } catch (error) {
      logger.error('Error refreshing data:', error)
      toast.error(t('tradeManual.toast.refreshError'))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const renderNoChannelsMessage = () => (
    <NoChannelsMessage
      hasEnoughBalance={hasEnoughBalance}
      onMakerChange={refreshData}
      onNavigate={navigate}
    />
  )

  const renderRoleSelector = () => (
    <div className="bg-surface-base/80 backdrop-blur-sm rounded-xl border border-border-default/50 p-4 shadow-lg mb-6 role-selector">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-blue-400" />
          <h3 className="text-md font-medium text-white">
            {t('tradeManual.roleSelector.title')}
          </h3>
        </div>
        <button
          className="p-2 rounded-lg hover:bg-surface-overlay transition-colors"
          disabled={isRefreshing}
          onClick={refreshData}
          title={t('tradeManual.roleSelector.refresh')}
        >
          <RefreshCw
            className={`w-4 h-4 text-content-secondary ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          className={`flex-1 px-4 py-3 ${activeRole === 'maker' ? 'bg-primary text-primary-foreground' : 'bg-surface-high hover:bg-surface-elevated text-white'} rounded-lg transition-colors button-animate`}
          disabled={activeRole === 'maker'}
          onClick={() => handleRoleChange('maker')}
        >
          {t('tradeManual.roles.maker')}
        </button>
        <button
          className={`flex-1 px-4 py-3 ${activeRole === 'taker' ? 'bg-emerald-600' : 'bg-surface-high hover:bg-surface-elevated'} text-white rounded-lg transition-colors button-animate`}
          disabled={activeRole === 'taker'}
          onClick={() => handleRoleChange('taker')}
        >
          {t('tradeManual.roles.taker')}
        </button>
      </div>

      <p className="mt-3 text-xs text-content-secondary">
        <Trans
          components={{
            maker: <span className="font-semibold text-blue-400" />,
            taker: <span className="font-semibold text-emerald-400" />,
          }}
          i18nKey={
            activeRole === 'maker'
              ? 'tradeManual.roleSelector.makerDescription'
              : 'tradeManual.roleSelector.takerDescription'
          }
        />
      </p>
    </div>
  )

  const renderSwapExplanation = () => (
    <div className="bg-surface-base/80 backdrop-blur-sm rounded-xl border border-border-default/50 p-6 shadow-lg mb-6 explanation-card">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={toggleExplanation}
      >
        <h2 className="text-xl font-semibold text-white">
          {t('tradeManual.swapExplanation.title')}
        </h2>
        <button className="p-1 rounded-full hover:bg-surface-overlay transition-colors">
          {isExplanationExpanded ? (
            <ChevronUp className="w-5 h-5 text-content-secondary" />
          ) : (
            <ChevronDown className="w-5 h-5 text-content-secondary" />
          )}
        </button>
      </div>

      {isExplanationExpanded && (
        <div className="mt-4 explanation-content">
          {(() => {
            const swapInfoCards = [
              {
                description: t(
                  'tradeManual.swapExplanation.cards.trustless.description'
                ),
                icon: <Zap className="w-6 h-6" />,
                key: 'trustless',
                title: t('tradeManual.swapExplanation.cards.trustless.title'),
                wrapperClass: 'bg-blue-500/20 text-blue-400',
              },
              {
                description: t(
                  'tradeManual.swapExplanation.cards.locks.description'
                ),
                icon: <Lock className="w-6 h-6" />,
                key: 'locks',
                title: t('tradeManual.swapExplanation.cards.locks.title'),
                wrapperClass: 'bg-purple-500/20 text-purple-400',
              },
              {
                description: t(
                  'tradeManual.swapExplanation.cards.guarantee.description'
                ),
                icon: <Unlock className="w-6 h-6" />,
                key: 'guarantee',
                title: t('tradeManual.swapExplanation.cards.guarantee.title'),
                wrapperClass: 'bg-emerald-500/20 text-emerald-400',
              },
            ]

            const processSteps = [
              {
                description: t(
                  'tradeManual.swapExplanation.process.makerInitiates.description'
                ),
                title: t(
                  'tradeManual.swapExplanation.process.makerInitiates.title'
                ),
              },
              {
                description: t(
                  'tradeManual.swapExplanation.process.takerWhitelists.description'
                ),
                title: t(
                  'tradeManual.swapExplanation.process.takerWhitelists.title'
                ),
              },
              {
                description: t(
                  'tradeManual.swapExplanation.process.makerExecutes.description'
                ),
                title: t(
                  'tradeManual.swapExplanation.process.makerExecutes.title'
                ),
              },
            ]

            const makerRoleItems = t(
              'tradeManual.swapExplanation.makerRole.items',
              { returnObjects: true }
            ) as string[]

            const takerRoleItems = t(
              'tradeManual.swapExplanation.takerRole.items',
              { returnObjects: true }
            ) as string[]

            const liquidityItems = t(
              'tradeManual.swapExplanation.liquidity.items',
              { returnObjects: true }
            ) as string[]

            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  {swapInfoCards.map((card) => (
                    <div
                      className="bg-surface-overlay/50 rounded-lg p-4 border border-border-default/50 swap-step-card"
                      key={card.key}
                    >
                      <div className="flex items-center justify-center mb-4">
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center ${card.wrapperClass}`}
                        >
                          {card.icon}
                        </div>
                      </div>
                      <h3 className="text-md font-medium text-white text-center mb-2">
                        {card.title}
                      </h3>
                      <p className="text-sm text-content-secondary text-center">
                        {card.description}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="bg-surface-overlay/50 rounded-lg p-5 border border-border-default/50 mb-6">
                  <h3 className="text-lg font-medium text-white mb-3">
                    {t('tradeManual.swapExplanation.process.title')}
                  </h3>
                  <ol className="space-y-4 ml-6 relative before:absolute before:left-0 before:top-2 before:h-[calc(100%-16px)] before:w-[2px] before:bg-surface-high">
                    {processSteps.map((step) => (
                      <li
                        className="pl-8 relative before:absolute before:left-0 before:top-2 before:h-4 before:w-4 before:rounded-full before:border-2 before:border-blue-500 before:bg-surface-base"
                        key={step.title}
                      >
                        <h4 className="text-md font-medium text-white">
                          {step.title}
                        </h4>
                        <p className="text-sm text-content-secondary">
                          {step.description}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1 bg-surface-overlay/50 rounded-lg p-4 border border-border-default/50 role-card">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                        M
                      </div>
                      <h3 className="text-md font-medium text-white">
                        {t('tradeManual.swapExplanation.makerRole.title')}
                      </h3>
                    </div>
                    <p className="text-sm text-content-secondary ml-8 mb-2">
                      {t('tradeManual.swapExplanation.makerRole.intro')}
                    </p>
                    <ul className="list-disc list-inside text-sm text-content-secondary ml-8 space-y-1">
                      {makerRoleItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="hidden md:flex items-center justify-center">
                    <ArrowRight className="w-6 h-6 text-content-tertiary" />
                  </div>

                  <div className="flex-1 bg-surface-overlay/50 rounded-lg p-4 border border-border-default/50 role-card">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-white">
                        T
                      </div>
                      <h3 className="text-md font-medium text-white">
                        {t('tradeManual.swapExplanation.takerRole.title')}
                      </h3>
                    </div>
                    <p className="text-sm text-content-secondary ml-8 mb-2">
                      {t('tradeManual.swapExplanation.takerRole.intro')}
                    </p>
                    <ul className="list-disc list-inside text-sm text-content-secondary ml-8 space-y-1">
                      {takerRoleItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 bg-surface-overlay/50 rounded-lg p-4 border border-border-default/50">
                  <h3 className="text-md font-medium text-white mb-2">
                    {t('tradeManual.swapExplanation.liquidity.title')}
                  </h3>
                  <p className="text-sm text-content-secondary mb-2">
                    {t('tradeManual.swapExplanation.liquidity.intro')}
                  </p>
                  <ul className="list-disc list-inside text-sm text-content-secondary space-y-1 ml-2">
                    {liquidityItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p className="text-sm text-content-secondary mt-2">
                    {t('tradeManual.swapExplanation.liquidity.note')}
                  </p>
                </div>
              </>
            )
          })()}
        </div>
      )}

      {!isExplanationExpanded && (
        <p className="mt-2 text-sm text-content-secondary">
          {t('tradeManual.swapExplanation.collapsedHint')}
        </p>
      )}
    </div>
  )

  const renderSwapForm = () => (
    <div className="swap-form-container w-full max-w-4xl">
      {renderRoleSelector()}
      {renderSwapExplanation()}
      <div className="bg-gradient-to-b from-surface-base/80 to-surface-overlay/80 backdrop-blur-sm rounded-xl border border-border-default/50 p-6 shadow-lg w-full swap-form">
        {activeRole === 'maker' ? (
          <ManualSwapForm
            assets={assets}
            formatAmount={formatAmount}
            getAssetPrecision={getAssetPrecision}
            getDisplayAsset={getDisplayAsset}
          />
        ) : (
          <TakerSwapForm
            assets={assets}
            formatAmount={formatAmount}
            getAssetPrecision={getAssetPrecision}
            getDisplayAsset={getDisplayAsset}
          />
        )}
      </div>
    </div>
  )

  return (
    <div className="container mx-auto w-full flex flex-col items-center justify-center py-6">
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader />
        </div>
      ) : !hasValidChannelsForTrading ? (
        renderNoChannelsMessage()
      ) : (
        renderSwapForm()
      )}

      {/* {!isLoading && assets.length > 0 && <StatusToast assets={assets} />} */}
    </div>
  )
}
