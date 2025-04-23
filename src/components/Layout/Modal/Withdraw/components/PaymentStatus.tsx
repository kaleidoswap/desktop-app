import { AlertTriangle, CheckCircle } from 'lucide-react'
import React from 'react'

import { PaymentStatusProps } from '../types'

// PaymentStatus component for displaying the current status of a payment
const PaymentStatus: React.FC<PaymentStatusProps> = ({
  paymentStatus,
  isPollingStatus,
}) => {
  if (!paymentStatus || !isPollingStatus) return null

  return (
    <div
      className={`p-3 rounded-xl border ${
        paymentStatus === 'Pending'
          ? 'bg-blue-500/10 border-blue-500/20'
          : paymentStatus === 'Succeeded'
            ? 'bg-green-500/10 border-green-500/20'
            : 'bg-red-500/10 border-red-500/20'
      }`}
    >
      <div className="flex items-center gap-2">
        {paymentStatus === 'Pending' && (
          <>
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span className="text-blue-400 text-sm">
              Payment in progress...
            </span>
          </>
        )}
        {paymentStatus === 'Succeeded' && (
          <>
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-green-400 text-sm">Payment successful!</span>
          </>
        )}
        {(paymentStatus === 'Failed' || paymentStatus === 'Expired') && (
          <>
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-red-400 text-sm">
              Payment {paymentStatus.toLowerCase()}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

export { PaymentStatus }
