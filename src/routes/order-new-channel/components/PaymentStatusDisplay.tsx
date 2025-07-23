import { Clock } from 'lucide-react'
import React from 'react'

import { formatBitcoinAmount } from '../../../helpers/number'

interface PaymentStatusDisplayProps {
  status: 'success' | 'error' | 'expired'
  paymentMethod: 'lightning' | 'onchain'
  currentPayment: any
  bitcoinUnit: string
}

export const PaymentStatusDisplay: React.FC<PaymentStatusDisplayProps> = ({
  status,
  paymentMethod,
  currentPayment,
  bitcoinUnit,
}) => {
  if (status === 'success') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-2xl p-8 text-center">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M5 13l4 4L19 7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-white mb-4">
            Payment Successful!
          </h3>
          <p className="text-gray-400 mb-6">
            Your channel is being opened. This may take a few minutes to
            complete.
          </p>
          <div className="bg-gray-800/50 rounded-xl p-4 inline-block">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-400">Amount:</span>
              <span className="text-white font-medium">
                {formatBitcoinAmount(
                  currentPayment?.order_total_sat || 0,
                  bitcoinUnit
                )}{' '}
                {bitcoinUnit}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-400">Method:</span>
              <span className="text-white font-medium flex items-center gap-1">
                {paymentMethod === 'lightning' ? (
                  <>⚡ Lightning</>
                ) : (
                  <>₿ On-chain</>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="text-center">
          <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Payment Expired</h3>
          <p className="text-gray-400">
            Please go back and create a new order.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Payment Failed</h3>
          <p className="text-gray-400">
            Please try again or use a different payment method.
          </p>
        </div>
      </div>
    )
  }

  return null
}
