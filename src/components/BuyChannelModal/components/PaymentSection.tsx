import { Copy, Info, Clock } from 'lucide-react'
import QRCode from 'qrcode.react'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { toast } from 'react-toastify'

import { formatNumberWithCommas } from '../../../helpers/number'

interface PaymentSectionProps {
  paymentData: any
  paymentMethod: 'lightning' | 'onchain'
  onTabChange: (method: 'lightning' | 'onchain') => void
}

export const PaymentSection: React.FC<PaymentSectionProps> = ({
  paymentData,
  paymentMethod,
  onTabChange,
}) => {
  const currentPayment =
    paymentMethod === 'lightning' ? paymentData?.bolt11 : paymentData?.onchain

  const paymentValue =
    paymentMethod === 'lightning'
      ? currentPayment?.invoice
      : currentPayment?.address

  const totalAmount =
    paymentMethod === 'lightning'
      ? currentPayment?.order_total_sat
      : currentPayment?.order_total_sat

  return (
    <div className="space-y-4">
      {/* Total Amount */}
      <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-700/50 rounded-xl p-4 text-center">
        <p className="text-gray-300 text-sm mb-1">Total Payment</p>
        <p className="text-2xl font-bold text-white">
          {formatNumberWithCommas(totalAmount || 0)}{' '}
          <span className="text-lg text-gray-300">sats</span>
        </p>
        {currentPayment?.expires_at && (
          <div className="flex items-center justify-center gap-2 mt-2 text-yellow-300 text-xs">
            <Clock className="w-3 h-3" />
            <span>
              Expires:{' '}
              {new Date(currentPayment.expires_at).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {/* Payment Method Tabs */}
      <div className="flex gap-3">
        <button
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            paymentMethod === 'lightning'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
          onClick={() => onTabChange('lightning')}
        >
          ⚡ Lightning
        </button>
        <button
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            paymentMethod === 'onchain'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
          onClick={() => onTabChange('onchain')}
        >
          ⛓️ On-chain
        </button>
      </div>

      {/* Payment Instructions */}
      <div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-300">
            {paymentMethod === 'lightning'
              ? 'Scan the QR code or copy the invoice to pay with Lightning.'
              : `Send Bitcoin to the address below. Requires ${currentPayment?.min_onchain_payment_confirmations || 1} confirmation(s).`}
          </p>
        </div>
      </div>

      {/* QR Code and Copy */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
        <div className="flex justify-center mb-3">
          <div className="bg-white p-3 rounded-lg">
            <QRCode size={180} value={paymentValue || ''} />
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-2 mb-3 break-all font-mono text-xs text-gray-300">
          {paymentValue}
        </div>

        <CopyToClipboard
          onCopy={() => toast.success('Copied to clipboard!')}
          text={paymentValue || ''}
        >
          <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
            <Copy className="w-4 h-4" />
            Copy {paymentMethod === 'lightning' ? 'Invoice' : 'Address'}
          </button>
        </CopyToClipboard>
      </div>
    </div>
  )
}
