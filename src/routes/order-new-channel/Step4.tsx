import {
  CheckCircle,
  XCircle,
  ArrowRight,
  RefreshCcw,
  Home,
  AlertCircle,
  Copy,
  Clock,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { CHANNELS_PATH } from '../../app/router/paths'

export const Step4 = ({
  paymentStatus,
  orderId,
}: {
  paymentStatus: 'success' | 'error' | 'expired' | null | string
  orderId?: string
}) => {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    if (orderId) {
      navigator.clipboard.writeText(orderId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const statusConfig = {
    error: {
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      buttonAction: () => navigate(CHANNELS_PATH),
      buttonText: 'Try Again',
      icon: <XCircle className="text-red-500 mb-6" size={80} />,
      message: 'There was an issue with your payment. Please try again.',
      title: 'Payment Failed',
    },
    expired: {
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30',
      buttonAction: () => navigate(CHANNELS_PATH),
      buttonText: 'Create New Order',
      icon: <Clock className="text-yellow-500 mb-6" size={80} />,
      message: 'The order has expired. Please create a new order to continue.',
      title: 'Order Expired',
    },
    pending: {
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      buttonAction: () => window.location.reload(),
      buttonText: 'Check Status',
      icon: <RefreshCcw className="text-blue-500 mb-6" size={80} />,
      message: 'Your payment is being processed. This may take a few moments.',
      title: 'Processing Payment',
    },
    success: {
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      buttonAction: () => navigate(CHANNELS_PATH),
      buttonText: 'Go to Channels Page',
      icon: <CheckCircle className="text-green-500 mb-6" size={80} />,
      message:
        'Your payment has been received and the channel is being opened.',
      title: 'Payment Completed!',
    },
  }

  const config = statusConfig[paymentStatus as keyof typeof statusConfig]

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-4">
      <div
        className={`${config.bgColor} border ${config.borderColor} rounded-xl shadow-2xl p-10 max-w-md w-full text-center`}
      >
        <div className="flex justify-center">{config.icon}</div>
        <h3 className="text-3xl font-bold mb-4">{config.title}</h3>
        <p className="text-lg text-gray-300 mb-6">{config.message}</p>

        {paymentStatus === 'success' && (
          <div className="flex items-center justify-center space-x-3 mb-8 p-3 bg-green-500/20 rounded-lg">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <p className="text-green-400 font-medium">
              Channel opening in progress
            </p>
          </div>
        )}

        {paymentStatus === 'error' && (
          <>
            <div className="mb-6 p-4 bg-amber-500/20 border border-amber-500/30 rounded-lg text-left">
              <div className="flex items-start">
                <AlertCircle
                  className="text-amber-500 mr-3 mt-1 flex-shrink-0"
                  size={20}
                />
                <div>
                  <p className="text-amber-200 font-medium mb-2">
                    About your payment:
                  </p>
                  <p className="text-gray-300 text-sm mb-2">
                    <strong>
                      An on-chain refund will be automatically processed
                    </strong>{' '}
                    and sent to your wallet soon.
                  </p>
                  <p className="text-gray-300 text-sm">
                    If you don't receive a refund within 24 hours, please
                    contact the LSP for support using your order ID below.
                  </p>
                </div>
              </div>
            </div>

            {/* Order ID Display - Only shown on failure */}
            {orderId && (
              <div className="mb-8 p-4 bg-gray-700/50 border border-gray-600 rounded-lg">
                <div className="flex flex-col items-center">
                  <p className="text-gray-300 text-sm mb-2">Your Order ID:</p>
                  <div className="flex items-center justify-center w-full bg-gray-800 p-3 rounded-md mb-2">
                    <code className="text-sm font-mono text-white break-all">
                      {orderId}
                    </code>
                    <button
                      className="ml-2 p-1 hover:bg-gray-700 rounded transition-colors"
                      onClick={copyToClipboard}
                      title="Copy to clipboard"
                    >
                      {copied ? (
                        <CheckCircle className="text-green-400" size={16} />
                      ) : (
                        <Copy
                          className="text-gray-400 hover:text-white"
                          size={16}
                        />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">
                    Copy this ID when contacting support about your refund
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {paymentStatus === 'expired' && (
          <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-left">
            <div className="flex items-start">
              <AlertCircle
                className="text-yellow-500 mr-3 mt-1 flex-shrink-0"
                size={20}
              />
              <div>
                <p className="text-yellow-200 font-medium mb-2">
                  Order Expired:
                </p>
                <p className="text-gray-300 text-sm">
                  The order has expired. Please create a new order to continue.
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          className={`px-6 py-4 rounded-lg text-lg font-bold ${
            paymentStatus === 'success'
              ? 'bg-green-600 hover:bg-green-700'
              : paymentStatus === 'error'
                ? 'bg-red-600 hover:bg-red-700'
                : paymentStatus === 'expired'
                  ? 'bg-yellow-600 hover:bg-yellow-700'
                  : 'bg-blue-600 hover:bg-blue-700'
          } transition-colors w-full flex items-center justify-center shadow-lg`}
          onClick={config.buttonAction}
        >
          {config.buttonText}
          {paymentStatus === 'success' ? (
            <ArrowRight className="ml-2" size={20} />
          ) : (
            <RefreshCcw className="ml-2" size={20} />
          )}
        </button>
      </div>

      <button
        className="mt-8 flex items-center gap-2 text-gray-400 hover:text-white transition-colors py-2 px-4 rounded-lg hover:bg-gray-800/50"
        onClick={() => navigate(CHANNELS_PATH)}
      >
        <Home size={18} />
        Return to Channels
      </button>
    </div>
  )
}
