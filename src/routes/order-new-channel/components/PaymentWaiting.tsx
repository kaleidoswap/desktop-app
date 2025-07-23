import { Info } from 'lucide-react'
import React from 'react'

import { Lsps1CreateOrderResponse } from '../../../slices/makerApi/makerApi.slice'

import { QRCodePayment } from './QRCodePayment'

// PaymentWaiting component
interface PaymentWaitingProps {
  paymentURI: string
  currentPayment: any
  bitcoinUnit: string
  paymentMethod: 'lightning' | 'onchain'
  order: Lsps1CreateOrderResponse | null
  handleCopy: () => void
}

export const PaymentWaiting: React.FC<PaymentWaitingProps> = ({
  paymentURI,
  currentPayment,
  bitcoinUnit,
  paymentMethod,
  order,
  handleCopy,
}) => {
  return (
    <div className="w-full space-y-6">
      {/* QR Code Section */}
      {order && (
        <QRCodePayment
          bitcoinUnit={bitcoinUnit}
          currentPayment={currentPayment}
          onCopy={handleCopy}
          order={order}
          paymentMethod={paymentMethod}
          paymentURI={paymentURI}
        />
      )}

      {/* Payment Status Section */}
      <div className="space-y-4">
        <div className="bg-gray-800/70 p-5 rounded-xl border border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <h4 className="text-sm text-gray-400">Payment Status</h4>
            <div className="flex items-center ml-auto">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
              <span className="text-blue-400 text-sm">Waiting for payment</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-start">
            <div className="text-blue-400 mr-3 mt-0.5">
              <Info size={18} />
            </div>
            <p className="text-gray-400 text-sm">
              Keep this window open. The QR code can be scanned to make payment.
              <br />
              This page will update automatically once payment is detected.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
