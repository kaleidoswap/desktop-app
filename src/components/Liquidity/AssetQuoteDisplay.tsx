import { Info, XCircle } from 'lucide-react'
import { ClipLoader } from 'react-spinners'
import { twJoin } from 'tailwind-merge'

import { formatNumberWithCommas } from '../../helpers/number'
import { QuoteResponse } from '../../slices/makerApi/makerApi.slice'
import { AssetInfo } from '../../utils/channelOrderUtils'
import {
  getQuoteFromAmount,
  getQuoteToAmount,
} from '../../hooks/useAssetChannelQuote'

interface AssetQuoteDisplayProps {
  quote: QuoteResponse | null
  quoteLoading: boolean
  quoteError: string | null
  assetInfo: AssetInfo | null
  compact?: boolean
}

export function AssetQuoteDisplay({
  quote,
  quoteLoading,
  quoteError,
  assetInfo,
  compact = false,
}: AssetQuoteDisplayProps) {
  if (quoteLoading) {
    return (
      <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/8 p-4">
        <div className="flex items-center gap-3">
          <ClipLoader color="#10b981" size={18} />
          <span className="text-sm text-emerald-200">Fetching quote...</span>
        </div>
      </div>
    )
  }

  if (quoteError) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/8 p-4">
        <div className="flex items-start gap-3">
          <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
          <div>
            <h4 className="text-sm font-semibold text-red-200">Quote Error</h4>
            <p className="mt-1 text-xs leading-relaxed text-red-200/80">
              {quoteError}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!quote || !assetInfo) {
    return null
  }

  const toAmount = getQuoteToAmount(quote)
  const fromAmount = getQuoteFromAmount(quote)

  return (
    <div
      className={twJoin(
        'rounded-xl border border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_45%),linear-gradient(180deg,rgba(16,185,129,0.08),rgba(6,95,70,0.02))]',
        compact ? 'p-3' : 'p-4'
      )}
    >
      <div className="flex items-center gap-2 text-emerald-200">
        <Info className="h-4 w-4" />
        <h3 className="text-sm font-semibold">Current Price Quote</h3>
      </div>

      <div className="mt-3 grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-content-secondary">Asset amount</span>
          <span className="text-right font-medium text-content-primary">
            {formatNumberWithCommas(
              (toAmount / Math.pow(10, assetInfo.precision)).toFixed(
                assetInfo.precision
              )
            )}{' '}
            {assetInfo.ticker}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-content-secondary">Price</span>
          <span className="text-right font-medium text-content-primary">
            {formatNumberWithCommas((fromAmount / 1000).toString())} sats
          </span>
        </div>
        {quote.expires_at && (
          <div className="mt-1 flex items-center justify-between gap-3 border-t border-emerald-400/15 pt-2 text-xs text-emerald-100/75">
            <span>Quote expires</span>
            <span>
              {new Date(quote.expires_at * 1000).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
