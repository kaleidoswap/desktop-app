import { ArrowDownUp, Clock, Copy, Wallet } from 'lucide-react'
import type { ChangeEvent } from 'react'
import type { SubmitHandler, UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import {
  ExchangeRateSection,
  FeeSection,
  MakerSelector,
  SwapButton,
  SwapInputField,
} from '../../../../components/Trade'
import type {
  QuoteResponse,
  TradingPair,
} from '../../../../slices/makerApi/makerApi.slice'

import { getUnconfirmedAssets, mapAssetIdToTicker } from '../assetUtils'
import { hasTradableChannels } from '../channelUtils'
import type { Channel, Fields, NiaAsset } from '../types'

type AssetOption = {
  assetId?: string
  ticker: string
  value: string
}

type MissingChannelAsset = {
  asset: string
  assetId: string
  isFromAsset: boolean
}

interface MarketMakerFormPanelProps {
  assets: NiaAsset[]
  bitcoinUnit: string
  channels: Channel[]
  currentPrice: number | null
  displayAsset: (asset: string) => string
  errorMessage: string | null
  fees: {
    baseFee: number
    feeRate: number
    totalFee: number
    variableFee: number
  }
  form: UseFormReturn<Fields>
  formatAmount: (amount: number, asset: string) => string
  fromAssetOptions: AssetOption[]
  fromAssetUnconfirmed: boolean
  getAssetPrecision: (asset: string) => number
  hasChannels: boolean
  hasTradablePairs: boolean
  hasValidQuote: boolean
  isPriceLoading: boolean
  isQuoteLoading: boolean
  isSwapInProgress: boolean
  isToAmountLoading: boolean
  isUsingOnchainBalance: boolean
  maxFromAmount: number
  maxOutboundHtlcSat: number
  maxToAmount: number
  minFromAmount: number
  missingChannelAsset: MissingChannelAsset | null
  onAssetChange: (field: 'fromAsset' | 'toAsset', value: string) => void
  onCopyError: (text: string) => void
  onFromAmountChange: (event: ChangeEvent<HTMLInputElement>) => void
  onMakerChange: () => Promise<void>
  onReconnectToMaker: () => void
  onRefreshExchangeRate: () => void
  onSizeClick: (size: number) => unknown
  onSubmit: SubmitHandler<Fields>
  onSwapAssets: () => unknown
  onToAmountChange: (event: ChangeEvent<HTMLInputElement>) => void
  quoteResponse: QuoteResponse | null
  selectedPair: TradingPair | null
  selectedSize: number | undefined
  showConfirmation: boolean
  toAssetOptions: AssetOption[]
  toAssetUnconfirmed: boolean
  tradablePairs: TradingPair[]
  warningMessage: string | null
  wsConnected: boolean
}

export const MarketMakerFormPanel = ({
  assets,
  bitcoinUnit,
  channels,
  currentPrice,
  displayAsset,
  errorMessage,
  fees,
  form,
  formatAmount,
  fromAssetOptions,
  fromAssetUnconfirmed,
  getAssetPrecision,
  hasChannels,
  hasTradablePairs,
  hasValidQuote,
  isPriceLoading,
  isQuoteLoading,
  isSwapInProgress,
  isToAmountLoading,
  isUsingOnchainBalance,
  maxFromAmount,
  maxOutboundHtlcSat,
  maxToAmount,
  minFromAmount,
  missingChannelAsset,
  onAssetChange,
  onCopyError,
  onFromAmountChange,
  onMakerChange,
  onReconnectToMaker,
  onRefreshExchangeRate,
  onSizeClick,
  onSubmit,
  onSwapAssets,
  onToAmountChange,
  quoteResponse,
  selectedPair,
  selectedSize,
  showConfirmation,
  toAssetOptions,
  toAssetUnconfirmed,
  tradablePairs,
  warningMessage,
  wsConnected,
}: MarketMakerFormPanelProps) => {
  const { t } = useTranslation()
  const currentFromAsset = form.getValues().fromAsset
  const currentToAsset = form.getValues().toAsset

  const unconfirmedBanner = (() => {
    if (fromAssetUnconfirmed || toAssetUnconfirmed) {
      const unconfirmedAssets = []

      if (fromAssetUnconfirmed) {
        unconfirmedAssets.push(currentFromAsset)
      }

      if (toAssetUnconfirmed) {
        unconfirmedAssets.push(currentToAsset)
      }

      const assetText = unconfirmedAssets.join(' and ')
      const channelText =
        unconfirmedAssets.length > 1 ? 'channels are' : 'channel is'
      const confirmText =
        unconfirmedAssets.length > 1 ? 'both channels are' : 'the channel is'

      return (
        <div className="mb-2 p-2 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl backdrop-blur-sm">
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5">
              <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Clock className="w-3 h-3 text-yellow-400" />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-yellow-300 text-sm font-medium">
                {unconfirmedAssets.length > 1
                  ? t('tradeMarketMaker.banners.channelsNotReady', {
                      assets: assetText,
                    })
                  : t('tradeMarketMaker.banners.channelNotReady', {
                      asset: assetText,
                    })}
              </p>
              <p className="text-yellow-200/80 text-xs mt-1">
                {unconfirmedAssets.length > 1
                  ? t('tradeMarketMaker.banners.channelsAwaiting', {
                      assets: assetText,
                      channelText,
                      confirmText,
                    })
                  : t('tradeMarketMaker.banners.channelAwaiting', {
                      asset: assetText,
                    })}
              </p>
            </div>
          </div>
        </div>
      )
    }

    const unconfirmedAssetIds = getUnconfirmedAssets(channels, assets)

    if (unconfirmedAssetIds.length > 0 && hasTradableChannels(channels)) {
      const unconfirmedTickers = unconfirmedAssetIds
        .map((assetId) => mapAssetIdToTicker(assetId, assets, tradablePairs))
        .filter(
          (ticker) =>
            ticker !== 'BTC' &&
            ticker !== currentFromAsset &&
            ticker !== currentToAsset
        )

      if (unconfirmedTickers.length > 0) {
        return (
          <div className="mb-2 p-2 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-xl backdrop-blur-sm">
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Clock className="w-3 h-3 text-blue-400" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-blue-300 text-sm font-medium">
                  {t('tradeMarketMaker.banners.additionalChannelsPending')}
                </p>
                <p className="text-blue-200/80 text-xs mt-1">
                  {t('tradeMarketMaker.banners.channelPendingConfirmation', {
                    asset: unconfirmedTickers[0],
                    assets: unconfirmedTickers.slice(0, 3).join(', '),
                    count: unconfirmedTickers.length,
                  })}
                </p>
              </div>
            </div>
          </div>
        )
      }
    }

    return null
  })()

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="relative overflow-hidden bg-surface-overlay rounded-2xl border border-border-default/50 shadow-xl flex flex-col">
        <div className="relative border-b border-border-default/40 px-4 py-2 flex-shrink-0 bg-surface-high/40">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  wsConnected
                    ? hasTradablePairs
                      ? 'bg-emerald-400'
                      : 'bg-amber-400 animate-pulse'
                    : 'bg-red-400 animate-pulse'
                }`}
              ></div>
              <h2 className="text-sm font-semibold text-content-primary">
                {t('tradeMarketMaker.header.liveTrading')}
              </h2>
            </div>

            <div className="flex items-center space-x-2">
              <MakerSelector onMakerChange={onMakerChange} />

              {!wsConnected && (
                <button
                  className="px-2.5 py-1 rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-all border border-primary/40 hover:border-primary/60 font-medium text-xs"
                  onClick={onReconnectToMaker}
                  type="button"
                >
                  {t('tradeMarketMaker.header.reconnect')}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="relative flex-1 p-4 flex flex-col overflow-y-auto">
          <form
            className="flex-1 flex flex-col gap-3"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            {isUsingOnchainBalance && !hasTradableChannels(channels) && (
              <div className="mb-2 p-2 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-xl backdrop-blur-sm">
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <span className="text-blue-400 text-xs">ℹ️</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-blue-300 text-sm font-medium">
                      {t('tradeMarketMaker.banners.tradingOnchain')}
                    </p>
                    <p className="text-blue-200/80 text-xs mt-1">
                      {t('tradeMarketMaker.banners.noChannelsYet')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {unconfirmedBanner}

            <div className="flex flex-col">
              <div className="relative z-0">
                <SwapInputField
                  asset={currentFromAsset}
                  assetOptions={fromAssetOptions}
                  availableAmount={`${formatAmount(maxFromAmount, currentFromAsset)} ${displayAsset(currentFromAsset)}`}
                  availableAmountLabel={
                    isUsingOnchainBalance
                      ? t('tradeMarketMaker.form.onchainAvailable')
                      : t('tradeMarketMaker.form.available')
                  }
                  disabled={
                    !hasChannels ||
                    !hasTradablePairs ||
                    isSwapInProgress ||
                    showConfirmation
                  }
                  formatAmount={formatAmount}
                  getDisplayAsset={displayAsset}
                  label={t('tradeMarketMaker.form.youSend')}
                  maxAmount={maxFromAmount}
                  maxHtlcAmount={maxOutboundHtlcSat}
                  minAmount={minFromAmount}
                  onAmountChange={onFromAmountChange}
                  onAssetChange={(value) => onAssetChange('fromAsset', value)}
                  onRefresh={onMakerChange}
                  onSizeClick={onSizeClick}
                  selectedSize={selectedSize}
                  showMaxAmount={!!missingChannelAsset}
                  showMaxHtlc={!missingChannelAsset}
                  showMinAmount
                  showSizeButtons
                  useEnhancedSelector={true}
                  value={form.getValues().from}
                />
              </div>

              <div className="flex justify-center my-2 relative z-10">
                <button
                  className={`p-2 rounded-xl border transition-all duration-300 shadow-sm bg-surface-overlay ${
                    hasChannels && hasTradablePairs && !isSwapInProgress
                      ? 'border-border-default/60 hover:bg-surface-high hover:border-primary/50 hover:scale-110 cursor-pointer'
                      : 'border-border-default/20 opacity-30 cursor-not-allowed'
                  }`}
                  onClick={() =>
                    hasChannels &&
                    hasTradablePairs &&
                    !isSwapInProgress &&
                    onSwapAssets()
                  }
                  type="button"
                >
                  <ArrowDownUp className="w-5 h-5 text-content-secondary" />
                </button>
              </div>

              <div className="relative z-0">
                <SwapInputField
                  asset={currentToAsset}
                  assetOptions={toAssetOptions}
                  availableAmount={
                    missingChannelAsset
                      ? t('tradeMarketMaker.form.channelNeeded')
                      : `${formatAmount(maxToAmount, currentToAsset)} ${displayAsset(currentToAsset)}`
                  }
                  availableAmountLabel={
                    missingChannelAsset
                      ? t('tradeMarketMaker.form.status')
                      : t('tradeMarketMaker.form.canReceiveUpTo')
                  }
                  disabled={
                    !hasChannels || !hasTradablePairs || isSwapInProgress
                  }
                  formatAmount={formatAmount}
                  getDisplayAsset={displayAsset}
                  isLoading={isToAmountLoading}
                  label={t('tradeMarketMaker.form.youReceive')}
                  maxAmount={maxToAmount}
                  onAmountChange={onToAmountChange}
                  onAssetChange={(value) => onAssetChange('toAsset', value)}
                  onRefresh={onMakerChange}
                  readOnly={true}
                  useEnhancedSelector={true}
                  value={form.getValues().to || ''}
                />
              </div>

              {missingChannelAsset && (
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500/20 via-cyan-500/15 to-blue-500/20 border border-blue-500/40 backdrop-blur-xl shadow-xl">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-cyan-500/8 to-blue-500/10"></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
                  <div className="relative p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-r from-blue-500/30 to-cyan-500/30 border border-blue-500/50 flex items-center justify-center mt-0.5">
                        <Wallet className="w-3.5 h-3.5 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-blue-300 font-semibold text-sm mb-1">
                          {t('tradeMarketMaker.channelWarning.title', {
                            asset: missingChannelAsset.asset,
                          })}
                        </h4>
                        <p className="text-blue-200/90 text-sm leading-relaxed">
                          {missingChannelAsset.isFromAsset
                            ? t('tradeMarketMaker.channelWarning.sendMessage', {
                                asset: missingChannelAsset.asset,
                              })
                            : t(
                                'tradeMarketMaker.channelWarning.receiveMessage',
                                { asset: missingChannelAsset.asset }
                              )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {warningMessage && (
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/20 border border-amber-500/40 backdrop-blur-xl shadow-xl">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-yellow-500/8 to-amber-500/10"></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
                  <div className="relative p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-r from-amber-500/30 to-yellow-500/30 border border-amber-500/50 flex items-center justify-center mt-0.5">
                        <div className="w-2 h-2 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-amber-300 font-semibold text-sm mb-1">
                          {t('tradeMarketMaker.error.maxLimitExceeded')}
                        </h4>
                        <p className="text-amber-400/90 text-sm leading-relaxed">
                          {warningMessage}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {errorMessage &&
                !errorMessage.includes('awaiting confirmation') && (
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-500/20 via-orange-500/15 to-red-500/20 border border-red-500/40 backdrop-blur-xl shadow-xl">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-orange-500/8 to-red-500/10"></div>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
                    <div className="relative p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-r from-red-500/30 to-orange-500/30 border border-red-500/50 flex items-center justify-center mt-0.5">
                          <div className="w-2 h-2 rounded-full bg-gradient-to-r from-red-400 to-orange-400"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-red-300 font-semibold text-sm mb-1">
                            {t('tradeMarketMaker.error.title')}
                          </h4>
                          <p className="text-red-400/90 text-sm leading-relaxed">
                            {errorMessage}
                          </p>
                        </div>
                        <button
                          className="flex-shrink-0 p-2 hover:bg-red-500/20 rounded-xl transition-colors border border-red-500/30 hover:border-red-500/50 backdrop-blur-sm"
                          onClick={() => onCopyError(errorMessage)}
                          title={t('tradeMarketMaker.error.copyErrorMessage')}
                          type="button"
                        >
                          <Copy className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
            </div>

            {selectedPair && (
              <div className="mt-1 border-t border-border-default/15 pt-3 px-2">
                <ExchangeRateSection
                  assets={assets}
                  bitcoinUnit={bitcoinUnit}
                  formatAmount={formatAmount}
                  fromAsset={currentFromAsset}
                  getAssetPrecision={getAssetPrecision}
                  isPriceLoading={isPriceLoading}
                  onRefresh={onRefreshExchangeRate}
                  price={currentPrice}
                  selectedPair={selectedPair}
                  toAsset={currentToAsset}
                />
              </div>
            )}

            <div className="mt-2">
              <FeeSection
                assets={assets}
                bitcoinUnit={bitcoinUnit}
                displayAsset={displayAsset}
                fees={fees}
                quoteResponse={quoteResponse}
                toAsset={currentToAsset}
                tradablePairs={tradablePairs}
              />
            </div>

            <div className="mt-2 pb-3 flex-shrink-0">
              <SwapButton
                errorMessage={errorMessage}
                hasChannels={hasChannels}
                hasTradablePairs={hasTradablePairs}
                hasValidQuote={hasValidQuote}
                isPriceLoading={isPriceLoading}
                isQuoteLoading={isQuoteLoading}
                isSwapInProgress={isSwapInProgress}
                isToAmountLoading={isToAmountLoading}
                missingChannelAsset={missingChannelAsset}
                warningMessage={warningMessage}
                wsConnected={wsConnected}
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
