import { Clock, CheckCircle, ArrowRight } from 'lucide-react'
import React from 'react'

import { formatBitcoinAmount } from '../../../helpers/number'

interface OrderProcessingDisplayProps {
  paymentMethod: 'lightning' | 'onchain'
  currentPayment: any
  bitcoinUnit: string
  orderId?: string
}

export const OrderProcessingDisplay: React.FC<OrderProcessingDisplayProps> = ({
  paymentMethod,
  currentPayment,
  bitcoinUnit,
  orderId,
}) => {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-8 text-center">
        {/* Animated Icon */}
        <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
          <div className="absolute inset-0 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin"></div>
          <CheckCircle className="w-10 h-10 text-blue-500" />
        </div>

        {/* Title */}
        <h3 className="text-2xl font-bold text-white mb-4">
          Payment Received!
        </h3>

        {/* Subtitle */}
        <p className="text-gray-400 mb-6">
          We're processing your order and setting up your channel. This usually
          takes a few moments.
        </p>

        {/* Payment Details */}
        <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-center gap-4 text-sm mb-3">
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

          {orderId && (
            <div className="text-xs text-gray-500 font-mono">
              Order: {orderId.slice(0, 8)}...{orderId.slice(-8)}
            </div>
          )}
        </div>

        {/* Progress Steps */}
        <div className="mb-6">
          <div className="flex items-center justify-center space-x-4 mb-4">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="ml-2 text-sm text-green-400">
                Payment Received
              </span>
            </div>
            <ArrowRight className="text-gray-500" size={16} />
            <div className="flex items-center">
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-2 text-sm text-blue-400">
                Processing Order
              </span>
            </div>
            <ArrowRight className="text-gray-500" size={16} />
            <div className="flex items-center">
              <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
              <span className="ml-2 text-sm text-gray-500">Channel Ready</span>
            </div>
          </div>
        </div>

        {/* Status Message */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <div className="flex items-center justify-center gap-2 text-sm text-blue-400">
            <Clock className="w-4 h-4" />
            <span>
              Waiting for maker confirmation... This page will update
              automatically.
            </span>
          </div>
        </div>

        {/* Pulsing dots for visual feedback */}
        <div className="flex justify-center items-center mt-6 space-x-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <div
            className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
            style={{ animationDelay: '0.2s' }}
          ></div>
          <div
            className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
            style={{ animationDelay: '0.4s' }}
          ></div>
        </div>
      </div>
    </div>
  )
}
