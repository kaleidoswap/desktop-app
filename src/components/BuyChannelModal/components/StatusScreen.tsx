import { CheckCircle, XCircle, Clock, Info } from 'lucide-react'

interface StatusScreenProps {
  status: 'success' | 'error' | 'expired'
  orderId?: string | null
  onClose: () => void
  onRetry: () => void
}

export const StatusScreen: React.FC<StatusScreenProps> = ({
  status,
  orderId,
  onClose,
  onRetry,
}) => {
  const config = {
    error: {
      actions: (
        <div className="flex gap-3">
          <button
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
            onClick={onClose}
          >
            Close
          </button>
          <button
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
            onClick={onRetry}
          >
            Try Again
          </button>
        </div>
      ),
      bgColor: 'bg-red-500/20',
      details: (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-200/80">
              <p>
                If payment was made, no funds were deducted. Please try again or
                contact support if the issue persists.
              </p>
            </div>
          </div>
        </div>
      ),
      icon: <XCircle className="w-12 h-12 text-red-400" />,
      message: 'There was an issue processing your channel order.',
      title: 'Order Failed',
    },
    expired: {
      actions: (
        <div className="flex gap-3">
          <button
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
            onClick={onClose}
          >
            Close
          </button>
          <button
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
            onClick={onRetry}
          >
            Create New Order
          </button>
        </div>
      ),
      bgColor: 'bg-yellow-500/20',
      details: (
        <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-200/80">
              <p>No funds were deducted. Create a new order to try again.</p>
            </div>
          </div>
        </div>
      ),
      icon: <Clock className="w-12 h-12 text-yellow-400" />,
      message: 'The payment window has expired without receiving payment.',
      title: 'Payment Expired',
    },
    success: {
      actions: (
        <button
          className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors"
          onClick={onClose}
        >
          Got it, thanks!
        </button>
      ),
      bgColor: 'bg-green-500/20',
      details: (
        <div className="bg-blue-900/30 border border-blue-700/40 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <Clock className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-200/80">
              <p className="font-semibold text-blue-200 mb-1">
                Channel Confirmation in Progress
              </p>
              <p>
                Your channel requires ~6 confirmations (about 1 hour). The asset
                is locked at today's rate and will be ready to trade once
                confirmed.
              </p>
            </div>
          </div>
        </div>
      ),
      icon: <CheckCircle className="w-12 h-12 text-green-400" />,
      message: 'Your channel order has been created successfully.',
      title: 'Payment Successful!',
    },
  }

  const current = config[status]

  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-6">
      <div
        className={`w-20 h-20 ${current.bgColor} rounded-full flex items-center justify-center ${status === 'success' ? 'animate-pulse' : ''}`}
      >
        {current.icon}
      </div>

      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold text-white">{current.title}</h3>
        <p className="text-gray-300 max-w-md">{current.message}</p>
      </div>

      {current.details}

      {orderId && (
        <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/30">
          <p className="text-xs text-gray-400 text-center">
            Order ID: <span className="text-gray-300 font-mono">{orderId}</span>
          </p>
        </div>
      )}

      {current.actions}
    </div>
  )
}
