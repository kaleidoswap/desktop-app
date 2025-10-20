import { Info, XCircle } from 'lucide-react'
import { ClipLoader } from 'react-spinners'

import { formatNumberWithCommas } from '../../../helpers/number'
import { QuoteResponse } from '../../../slices/makerApi/makerApi.slice'
import { AssetInfo } from '../../../utils/channelOrderUtils'

interface QuoteDisplayProps {
  quote: QuoteResponse | null
  quoteLoading: boolean
  quoteError: string | null
  assetInfo: AssetInfo | null
  compact?: boolean
}

export const QuoteDisplay: React.FC<QuoteDisplayProps> = ({
  quote,
  quoteLoading,
  quoteError,
  assetInfo,
  compact = false,
}) => {
  if (quoteLoading) {
    return (
      <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <ClipLoader color="#10b981" size={20} />
          <span className="text-emerald-300 text-sm">Fetching quote...</span>
        </div>
      </div>
    )
  }

  if (quoteError) {
    return (
      <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-red-300 mb-1">
              Quote Error
            </h4>
            <p className="text-xs text-red-200/80">{quoteError}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!quote || !assetInfo) return null

  return (
    <div
      className={`bg-gradient-to-br from-emerald-900/30 to-green-900/30 border border-emerald-700/50 rounded-xl ${compact ? 'p-3' : 'p-4'}`}
    >
      {!compact && (
        <h3 className="text-lg font-semibold text-emerald-200 mb-3 flex items-center gap-2">
          <Info className="w-5 h-5" />
          Current Price Quote
        </h3>
      )}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-300">Asset Amount</span>
          <span className="text-white font-medium">
            {formatNumberWithCommas(
              (quote.to_amount / Math.pow(10, assetInfo.precision)).toFixed(
                assetInfo.precision
              )
            )}{' '}
            {assetInfo.ticker}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-300">Price</span>
          <span className="text-white font-medium">
            {formatNumberWithCommas((quote.from_amount / 1000).toString())} sats
          </span>
        </div>
        {quote.expires_at && (
          <div className="flex justify-between text-xs pt-2 border-t border-emerald-700/30">
            <span className="text-emerald-200/70">Quote Expires</span>
            <span className="text-emerald-200/70">
              {new Date(quote.expires_at * 1000).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
