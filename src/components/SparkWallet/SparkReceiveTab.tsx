import { Copy, Share2, Zap, Plus } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import { toast } from 'react-toastify'

import { useReceivePaymentMutation } from '../../slices/spark/sparkApi.slice'
import { Button } from '../ui'

export const SparkReceiveTab = () => {
  const [mode, setMode] = useState<'lnurl' | 'bolt11'>('lnurl')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [paymentRequest, setPaymentRequest] = useState('')
  const [fees, setFees] = useState(0)

  const [receivePayment, { isLoading }] = useReceivePaymentMutation()

  const handleGenerateBolt11 = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    try {
      const result = await receivePayment({
        amount: Number(amount),
        description: description || 'Payment request',
        type: 'lightning',
      }).unwrap()

      setPaymentRequest(result.invoice || '')
      setFees(result.fees)
      toast.success('Invoice generated')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to generate invoice'
      )
    }
  }

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied to clipboard`)
    } catch (error) {
      toast.error('Failed to copy to clipboard')
    }
  }

  const handleShare = async (text: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          text: text,
          title: 'Lightning Payment Request',
        })
      } catch (error) {
        // User cancelled or error
      }
    } else {
      handleCopy(text, 'Payment request')
    }
  }

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex gap-2 p-1 bg-slate-800 rounded-lg">
        <button
          className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
            mode === 'lnurl'
              ? 'bg-yellow-500/20 text-yellow-500'
              : 'text-slate-400 hover:text-slate-300'
          }`}
          onClick={() => setMode('lnurl')}
        >
          <div className="flex items-center justify-center gap-2">
            <Zap className="w-4 h-4" />
            Lightning Address
          </div>
        </button>
        <button
          className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
            mode === 'bolt11'
              ? 'bg-yellow-500/20 text-yellow-500'
              : 'text-slate-400 hover:text-slate-300'
          }`}
          onClick={() => setMode('bolt11')}
        >
          <div className="flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />
            One-time Invoice
          </div>
        </button>
      </div>

      {/* LNURL Mode (Default) */}
      {mode === 'lnurl' && (
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-slate-400 mb-4">
              Share your Lightning address to receive payments
            </p>

            {/* QR Code - This would need LNURL-Pay support from SDK */}
            <div className="flex justify-center mb-4">
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG size={200} value="lightning:spark@placeholder.com" />
              </div>
            </div>

            {/* Lightning Address */}
            <div className="mb-4">
              <div className="bg-slate-800 rounded-lg p-3 font-mono text-sm text-white break-all">
                spark@placeholder.com
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Lightning address (customizable soon)
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                className="flex-1"
                icon={<Copy className="w-4 h-4" />}
                onClick={() =>
                  handleCopy('spark@placeholder.com', 'Lightning address')
                }
                variant="secondary"
              >
                Copy
              </Button>
              <Button
                className="flex-1"
                icon={<Share2 className="w-4 h-4" />}
                onClick={() => handleShare('lightning:spark@placeholder.com')}
              >
                Share
              </Button>
            </div>

            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-xs text-blue-400">
                <strong>Note:</strong> LNURL-Pay support coming soon. For now,
                use one-time invoices.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* BOLT11 Mode */}
      {mode === 'bolt11' && (
        <div className="space-y-4">
          {!paymentRequest ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Amount (sats) <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount in satoshis"
                  type="number"
                  value={amount}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description (optional)
                </label>
                <input
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this payment for?"
                  type="text"
                  value={description}
                />
              </div>

              <Button
                className="w-full"
                disabled={isLoading || !amount}
                onClick={handleGenerateBolt11}
              >
                {isLoading ? 'Generating...' : 'Generate Invoice'}
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-lg">
                  <QRCodeSVG size={200} value={paymentRequest} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Lightning Invoice
                </label>
                <div className="bg-slate-800 rounded-lg p-3 font-mono text-xs text-white break-all">
                  {paymentRequest}
                </div>
              </div>

              {fees > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Receive Fee:</span>
                  <span className="text-white font-medium">{fees} sats</span>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  icon={<Copy className="w-4 h-4" />}
                  onClick={() => handleCopy(paymentRequest, 'Invoice')}
                  variant="secondary"
                >
                  Copy
                </Button>
                <Button
                  className="flex-1"
                  icon={<Share2 className="w-4 h-4" />}
                  onClick={() => handleShare(paymentRequest)}
                >
                  Share
                </Button>
              </div>

              <Button
                className="w-full"
                onClick={() => {
                  setPaymentRequest('')
                  setAmount('')
                  setDescription('')
                  setFees(0)
                }}
                variant="outline"
              >
                Create New Invoice
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
