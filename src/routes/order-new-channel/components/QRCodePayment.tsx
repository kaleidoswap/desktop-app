import QRCode from 'qrcode.react'
import React from 'react'
import { CopyToClipboard } from 'react-copy-to-clipboard'

import { formatBitcoinAmount } from '../../../helpers/number'
import { Lsps1CreateOrderResponse } from '../../../slices/makerApi/makerApi.slice'

interface QRCodePaymentProps {
  paymentURI: string
  paymentMethod: 'lightning' | 'onchain'
  currentPayment: any
  bitcoinUnit: string
  order: Lsps1CreateOrderResponse
  onCopy: () => void
}

export const QRCodePayment: React.FC<QRCodePaymentProps> = ({
  paymentURI,
  paymentMethod,
  currentPayment,
  bitcoinUnit,
  order,
  onCopy,
}) => {
  const getPaymentTextToCopy = (): string => {
    if (paymentMethod === 'lightning' && order?.payment?.bolt11?.invoice) {
      return order.payment.bolt11.invoice
    } else if (order?.payment?.onchain?.address) {
      return order.payment.onchain.address
    }
    return ''
  }

  return (
    <div className="w-full space-y-6">
      {/* QR Code Container - Centered */}
      <div className="flex justify-center">
        <div className="bg-white p-6 rounded-2xl shadow-lg">
          <QRCode size={240} value={paymentURI} />
        </div>
      </div>

      {/* Payment Details */}
      <div className="space-y-4">
        <div className="bg-gray-900/50 p-4 rounded-xl text-center">
          <h4 className="text-sm text-gray-400 mb-2">Amount to Pay</h4>
          <p className="text-2xl font-bold text-white">
            {formatBitcoinAmount(
              currentPayment?.order_total_sat || 0,
              bitcoinUnit
            )}{' '}
            {bitcoinUnit}
          </p>
        </div>

        <CopyToClipboard onCopy={onCopy} text={getPaymentTextToCopy()}>
          <button className="w-full px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all duration-200 font-medium">
            Copy {paymentMethod === 'lightning' ? 'Invoice' : 'Address'}
          </button>
        </CopyToClipboard>
      </div>
    </div>
  )
}
