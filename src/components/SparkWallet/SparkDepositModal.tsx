import { Copy, X, Zap, Wallet } from 'lucide-react'
import QRCode from 'qrcode.react'
import { useState } from 'react'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { toast } from 'react-toastify'

import { useAppSelector } from '../../app/store/hooks'
import { useReceivePaymentMutation } from '../../slices/spark/sparkApi.slice'
import { Button, Card } from '../ui'

interface SparkDepositModalProps {
  onClose: () => void
}

export const SparkDepositModal = ({ onClose }: SparkDepositModalProps) => {
  const sparkInfo = useAppSelector((state) => state.spark.info)
  const [selectedType, setSelectedType] = useState<
    'lightning' | 'onchain' | 'spark'
  >('spark')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [receivePayment, { isLoading }] = useReceivePaymentMutation()
  const [generatedInvoice, setGeneratedInvoice] = useState<string | null>(null)

  const handleGenerateInvoice = async () => {
    if (selectedType === 'lightning' && !amount) {
      toast.error('Please enter an amount for Lightning invoice')
      return
    }

    try {
      const result = await receivePayment({
        amount: Number(amount),
        description,
        type: selectedType,
      }).unwrap()

      if (result.invoice) {
        setGeneratedInvoice(result.invoice)
      }
      toast.success('Receive address/invoice ready')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to generate invoice'
      )
    }
  }

  const getDisplayAddress = () => {
    if (selectedType === 'lightning' && generatedInvoice) {
      return generatedInvoice
    }
    if (selectedType === 'onchain') {
      return sparkInfo?.bitcoinAddress || ''
    }
    if (selectedType === 'spark') {
      return sparkInfo?.sparkAddress || ''
    }
    return ''
  }

  const displayAddress = getDisplayAddress()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">
            Deposit to Spark Wallet
          </h2>
          <button className="text-slate-400 hover:text-white" onClick={onClose}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Deposit Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                className={`p-3 rounded-lg border transition-all ${
                  selectedType === 'spark'
                    ? 'border-yellow-500 bg-yellow-500/10 text-yellow-500'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                }`}
                onClick={() => setSelectedType('spark')}
              >
                <Zap className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs">Spark</span>
              </button>
              <button
                className={`p-3 rounded-lg border transition-all ${
                  selectedType === 'lightning'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                }`}
                onClick={() => setSelectedType('lightning')}
              >
                <Zap className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs">Lightning</span>
              </button>
              <button
                className={`p-3 rounded-lg border transition-all ${
                  selectedType === 'onchain'
                    ? 'border-orange-500 bg-orange-500/10 text-orange-500'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                }`}
                onClick={() => setSelectedType('onchain')}
              >
                <Wallet className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs">On-chain</span>
              </button>
            </div>
          </div>

          {selectedType === 'lightning' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Amount (sats)
                </label>
                <input
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  type="number"
                  value={amount}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description (optional)
                </label>
                <input
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Payment description"
                  type="text"
                  value={description}
                />
              </div>
              <Button
                className="w-full"
                disabled={isLoading || !amount}
                onClick={handleGenerateInvoice}
              >
                {isLoading ? 'Generating...' : 'Generate Invoice'}
              </Button>
            </>
          )}

          {displayAddress && (
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex justify-center mb-4">
                <div className="bg-white p-3 rounded-lg">
                  <QRCode size={200} value={displayAddress} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">
                  {selectedType === 'lightning'
                    ? 'Invoice'
                    : selectedType === 'spark'
                      ? 'Spark Address'
                      : 'Bitcoin Address'}
                </label>
                <div className="flex gap-2">
                  <input
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-mono"
                    readOnly
                    value={displayAddress}
                  />
                  <CopyToClipboard
                    onCopy={() => toast.success('Copied to clipboard')}
                    text={displayAddress}
                  >
                    <Button
                      icon={<Copy className="w-4 h-4" />}
                      size="sm"
                      variant="outline"
                    >
                      Copy
                    </Button>
                  </CopyToClipboard>
                </div>
              </div>

              {selectedType === 'onchain' && (
                <p className="text-xs text-slate-400 mt-2">
                  Funds sent to this address will be automatically claimed by
                  the SDK
                </p>
              )}
            </div>
          )}

          <Button className="w-full" onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </Card>
    </div>
  )
}
