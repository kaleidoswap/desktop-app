import { RefreshCw, Wallet, Info } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import { useSettings } from '../../hooks/useSettings'
import { getAssetPrecision } from '../../helpers/number'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'

interface TakerSwapFormProps {
  assets: any[]
  formatAmount: (amount: number, asset: string) => string
  getDisplayAsset: (asset: string) => string
  getAssetPrecision: (asset: string) => number
}

interface FormValues {
  swapString: string
}

export const TakerSwapForm: React.FC<TakerSwapFormProps> = ({
  formatAmount,
  getAssetPrecision: propsGetAssetPrecision,
}) => {
  const { t } = useTranslation()
  const [swapDetails, setSwapDetails] = useState<any>(null)
  const [isWhitelisting, setIsWhitelisting] = useState(false)
  const [isDecoding, setIsDecoding] = useState(false)
  const [assetBalances, setAssetBalances] = useState<
    Record<string, { offChain: number; onChain: number }>
  >({})
  const [isLoadingBalances, setIsLoadingBalances] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [whitelistSuccess, setWhitelistSuccess] = useState(false)
  const [decodeError, setDecodeError] = useState<string | null>(null)
  const { data: assetsData } = nodeApi.endpoints.listAssets.useQuery()

  const { register, watch, reset } = useForm<FormValues>({
    defaultValues: {
      swapString: '',
    },
  })

  const swapString = watch('swapString')
  const { bitcoinUnit } = useSettings()

  const [assetBalance] = nodeApi.endpoints.assetBalance.useLazyQuery()
  const [executeTaker] = nodeApi.useTakerMutation()
  const { data: nodeInfoData } = nodeApi.endpoints.nodeInfo.useQuery()

  // Manual decode function for swap strings
  const decodeSwapString = (swapString: string) => {
    try {
      const swap_parts = swapString.split('/')
      if (swap_parts.length !== 6) {
        throw new Error('Invalid swap string format.')
      }

      const [
        swapFromAmount,
        swapFromAsset,
        swapToAmount,
        swapToAsset,
        timeout_sec,
        payment_hash,
      ] = swap_parts

      return {
        from_asset: swapFromAsset,
        payment_hash: payment_hash,
        qty_from: parseFloat(swapFromAmount),
        qty_to: parseFloat(swapToAmount),
        timeout_sec: parseInt(timeout_sec),
        to_asset: swapToAsset,
      }
    } catch (error) {
      console.error('Failed to decode swap string:', error)
      throw new Error('Invalid swap string format. Please check and try again.')
    }
  }

  // Fetch asset balances when swap details change
  const fetchAssetBalances = async () => {
    if (!swapDetails) return

    setIsLoadingBalances(true)
    setIsRefreshing(true)
    const newBalances: Record<string, { offChain: number; onChain: number }> = {
      ...assetBalances,
    }

    try {
      // Fetch from asset balance if needed
      if (swapDetails.from_asset) {
        const balance = await assetBalance({ asset_id: swapDetails.from_asset })
        newBalances[swapDetails.from_asset] = {
          offChain: balance.data?.offchain_outbound || 0,
          onChain: balance.data?.future || 0,
        }
      }

      // Fetch to asset balance if needed
      if (swapDetails.to_asset) {
        const balance = await assetBalance({ asset_id: swapDetails.to_asset })
        newBalances[swapDetails.to_asset] = {
          offChain: balance.data?.offchain_outbound || 0,
          onChain: balance.data?.future || 0,
        }
      }

      setAssetBalances(newBalances)
      toast.success(t('trade.taker.balancesUpdated'))
    } catch (error) {
      console.error('Failed to fetch asset balances:', error)
      toast.error(t('trade.taker.balancesFailed'))
    } finally {
      setIsLoadingBalances(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    if (swapDetails) {
      fetchAssetBalances()
    }
  }, [swapDetails])

  // Auto-decode on paste/change of swap string
  useEffect(() => {
    if (swapString && !isDecoding && !whitelistSuccess) {
      onDecodeSwap()
    }
  }, [swapString])

  const onDecodeSwap = async () => {
    if (!swapString) {
      setSwapDetails(null)
      setDecodeError(null)
      return
    }

    setIsDecoding(true)
    setDecodeError(null)

    try {
      // Use the manual decode function instead of API call
      const decodedSwap = decodeSwapString(swapString)
      setSwapDetails(decodedSwap)
    } catch (error: any) {
      console.error('Failed to decode swap:', error)
      setDecodeError(error.message || 'Failed to decode swap string')
      setSwapDetails(null)
    } finally {
      setIsDecoding(false)
    }
  }

  const onWhitelistMaker = async () => {
    if (!swapString) {
      toast.error(t('trade.taker.missingSwapString'))
      return
    }

    setIsWhitelisting(true)
    try {
      // Use the taker endpoint to whitelist the maker
      await executeTaker({
        swapstring: swapString,
      })

      toast.success(t('trade.taker.whitelistSuccess'))
      setWhitelistSuccess(true)
    } catch (error) {
      console.error('Failed to whitelist trade:', error)
      toast.error(t('trade.taker.whitelistFailed'))
    } finally {
      setIsWhitelisting(false)
    }
  }

  const resetForm = () => {
    reset()
    setSwapDetails(null)
    setWhitelistSuccess(false)
    setDecodeError(null)
  }

  // Format balance for display
  const formatBalanceDisplay = (asset: string, balance: number) => {
    if (!asset) return '0'
    const precision = getAssetPrecision(asset, bitcoinUnit, assetsData?.nia)
    const formattedBalance = balance / Math.pow(10, precision)
    return formattedBalance.toLocaleString(undefined, {
      maximumFractionDigits: precision,
      minimumFractionDigits: 0,
    })
  }

  // Get asset ticker for display
  const getAssetTicker = (assetId: string) => {
    if (assetId === 'BTC') return bitcoinUnit === 'SAT' ? 'SAT' : 'BTC'
    const asset = assetsData?.nia?.find((a) => a.asset_id === assetId)
    return asset ? asset.ticker || asset.name : assetId
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 mb-4">
        <h2 className="text-xl font-semibold text-white">
          {t('tradeManual.takerForm.title')}
        </h2>
        <p className="text-sm text-content-secondary">
          {t('tradeManual.takerForm.description')}
        </p>
      </div>

      <div className="bg-surface-overlay/50 rounded-lg p-4 mb-6 border border-border-default/50 swap-card">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-white step-indicator">
              1
            </div>
            <h3 className="text-md font-medium text-white">
              {t('tradeManual.takerForm.pasteTitle')}
            </h3>
          </div>
          <button
            className="p-2 rounded-lg hover:bg-surface-high transition-colors"
            disabled={isRefreshing || !swapDetails}
            onClick={fetchAssetBalances}
            title="Refresh balances"
          >
            <RefreshCw
              className={`w-4 h-4 text-content-secondary ${isRefreshing ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
        <p className="text-sm text-content-secondary ml-8 mb-4">
          {t('tradeManual.takerForm.info.pasteDescription')}
        </p>

        <div className="space-y-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-content-secondary">
              {t('tradeManual.takerForm.labels.swapString')}
            </label>
            <textarea
              className={`w-full px-4 py-3 bg-surface-overlay border ${decodeError ? 'border-red-500' : 'border-border-default'} rounded-lg text-white focus:outline-none focus:border-blue-500 input-animate h-24 font-mono text-xs`}
              placeholder={t(
                'tradeManual.takerForm.placeholders.pasteSwapString'
              )}
              {...register('swapString', { required: true })}
              disabled={whitelistSuccess}
            />
            {decodeError && (
              <p className="mt-1 text-xs text-red-400">{decodeError}</p>
            )}
            {isDecoding && (
              <p className="mt-1 text-xs text-blue-400">
                {t('tradeManual.takerForm.info.decoding')}
              </p>
            )}
          </div>
        </div>
      </div>

      {swapDetails && (
        <div className="bg-surface-overlay/50 rounded-lg p-4 border border-border-default/50 swap-card swap-initiated">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-white step-indicator">
              2
            </div>
            <h3 className="text-md font-medium text-white">
              {t('tradeManual.takerForm.review.title')}
            </h3>
          </div>
          <p className="text-sm text-content-secondary ml-8 mb-4">
            {t('tradeManual.takerForm.info.reviewDescription')}
          </p>

          <div className="bg-surface-base/50 p-4 rounded-lg mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-content-secondary mb-1">
                    {t('tradeManual.takerForm.review.youReceive')}
                  </h4>
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-semibold text-white">
                      {formatAmount(swapDetails.qty_to, swapDetails.to_asset)}
                    </div>
                    <div className="text-md text-content-secondary">
                      {getAssetTicker(swapDetails.to_asset)}
                    </div>
                  </div>
                  {assetBalances[swapDetails.to_asset] && (
                    <div className="flex items-center gap-1 text-xs text-content-secondary mt-1 asset-balance">
                      <Wallet className="w-3 h-3" />
                      <span>
                        {t('tradeManual.takerForm.review.currentBalance')}:{' '}
                      </span>
                      <span className="font-medium text-content-secondary">
                        {isLoadingBalances
                          ? t('tradeManual.takerForm.info.loading')
                          : `${formatBalanceDisplay(swapDetails.to_asset, assetBalances[swapDetails.to_asset].offChain)} ${getAssetTicker(swapDetails.to_asset)}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-content-secondary mb-1">
                    {t('tradeManual.takerForm.review.youSend')}
                  </h4>
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-semibold text-white">
                      {formatAmount(
                        swapDetails.qty_from,
                        swapDetails.from_asset
                      )}
                    </div>
                    <div className="text-md text-content-secondary">
                      {getAssetTicker(swapDetails.from_asset)}
                    </div>
                  </div>
                  {assetBalances[swapDetails.from_asset] && (
                    <div className="flex items-center gap-1 text-xs text-content-secondary mt-1 asset-balance">
                      <Wallet className="w-3 h-3" />
                      <span>
                        {t('tradeManual.takerForm.review.currentBalance')}:{' '}
                      </span>
                      <span className="font-medium text-content-secondary">
                        {isLoadingBalances
                          ? t('tradeManual.takerForm.info.loading')
                          : `${formatBalanceDisplay(swapDetails.from_asset, assetBalances[swapDetails.from_asset].offChain)} ${getAssetTicker(swapDetails.from_asset)}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-900/30 rounded-lg border border-blue-700/50 mb-4">
              <div className="flex items-center gap-2 text-xs text-blue-400">
                <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <p>
                  <strong>Important:</strong>{' '}
                  {t('tradeManual.takerForm.info.liquidityWarning')}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border-default">
              <h4 className="text-sm font-medium text-content-secondary mb-2">
                {t('tradeManual.takerForm.review.additionalDetails')}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-xs text-content-secondary">
                    {t('tradeManual.takerForm.review.timeout')}
                  </span>
                  <span className="text-sm text-white">
                    {swapDetails.timeout_sec}{' '}
                    {t('tradeManual.takerForm.review.seconds')}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-content-secondary">Payment Hash</span>
                  <span className="text-sm text-white font-mono truncate">
                    {swapDetails.payment_hash}
                  </span>
                </div>
              </div>
            </div>

            {assetBalances[swapDetails.from_asset] &&
              assetBalances[swapDetails.from_asset].offChain /
                Math.pow(10, propsGetAssetPrecision(swapDetails.from_asset)) <
                swapDetails.qty_from && (
                <div className="mt-4 p-3 bg-red-900/30 rounded-lg border border-red-700/50">
                  <div className="flex items-center gap-2 text-xs text-red-400">
                    <Info className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <p>
                      Warning:{' '}
                      {t(
                        'tradeManual.takerForm.info.insufficientBalanceWarning',
                        { asset: getAssetTicker(swapDetails.from_asset) }
                      )}
                    </p>
                  </div>
                </div>
              )}
          </div>

          <div className="flex items-center gap-2 text-xs text-content-secondary p-3 bg-surface-overlay/30 rounded-xl border border-border-default mb-4">
            <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <p>{t('tradeManual.takerForm.info.whitelistInfo')}</p>
          </div>

          <div className="flex gap-3">
            <button
              className="flex-1 px-4 py-3 bg-surface-high hover:bg-surface-elevated text-white rounded-lg transition-colors button-animate"
              disabled={isWhitelisting}
              onClick={resetForm}
              type="button"
            >
              {t('tradeManual.takerForm.buttons.reset')}
            </button>

            <button
              className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-emerald-600 button-animate"
              disabled={isWhitelisting || !swapString || whitelistSuccess}
              onClick={onWhitelistMaker}
              type="button"
            >
              {isWhitelisting ? (
                <div className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{t('tradeManual.takerForm.buttons.whitelisting')}</span>
                </div>
              ) : whitelistSuccess ? (
                t('tradeManual.takerForm.buttons.whitelistedSuccessfully')
              ) : (
                t('tradeManual.takerForm.buttons.whitelist')
              )}
            </button>
          </div>

          {whitelistSuccess && (
            <div className="mt-4 p-3 bg-emerald-900/30 rounded-lg border border-emerald-700/50">
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <Info className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <p>
                  <strong>
                    {t('tradeManual.takerForm.success.whitelisted')}
                  </strong>{' '}
                  {t('tradeManual.takerForm.success.whitelistedMessage')}
                </p>
              </div>

              {nodeInfoData?.pubkey && (
                <div className="mt-3 p-2 bg-surface-overlay/50 rounded border border-border-default/50">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-content-secondary">
                      {t('tradeManual.takerForm.success.yourNodePubkey')}
                    </span>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-emerald-300 font-mono bg-surface-base/50 p-1.5 rounded flex-1 overflow-x-auto">
                        {nodeInfoData.pubkey}
                      </code>
                      <button
                        className="p-1.5 rounded bg-surface-high hover:bg-surface-elevated transition-colors"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            nodeInfoData.pubkey ?? ''
                          )
                          toast.success(t('trade.taker.pubkeyCopied'))
                        }}
                        title="Copy to clipboard"
                      >
                        <svg
                          className="text-content-secondary"
                          fill="none"
                          height="14"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          width="14"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <rect
                            height="14"
                            rx="2"
                            ry="2"
                            width="14"
                            x="8"
                            y="8"
                          />
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
