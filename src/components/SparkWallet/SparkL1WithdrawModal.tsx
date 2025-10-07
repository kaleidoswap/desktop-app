import { X, ArrowUpRight, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'react-toastify'

import { useWithdrawToL1Mutation } from '../../slices/spark/sparkApi.slice'
import { Button, Card } from '../ui'

interface SparkL1WithdrawModalProps {
  onClose: () => void
}

export const SparkL1WithdrawModal = ({
  onClose,
}: SparkL1WithdrawModalProps) => {
  const [address, setAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [speed, setSpeed] = useState<'slow' | 'medium' | 'fast'>('fast')
  const [withdrawToL1, { isLoading, error }] = useWithdrawToL1Mutation()

  const handleWithdraw = async () => {
    if (!address) {
      toast.error('Please enter a Bitcoin address')
      return
    }

    if (!amount || Number(amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    try {
      await withdrawToL1({
        address: address.trim(),
        amount: Number(amount),
        speed,
      }).unwrap()

      toast.success('Withdrawal to L1 initiated successfully')
      onClose()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to withdraw to L1'
      )
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Withdraw to L1</h2>
            <p className="text-sm text-slate-400 mt-1">
              Send funds from Spark back to Bitcoin mainchain
            </p>
          </div>
          <button className="text-slate-400 hover:text-white" onClick={onClose}>
            <X className="w-6 h-6" />
          </button>
        </div>

        {error ? (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-red-500 mb-1">
                  Withdrawal Error
                </h4>
                <p className="text-sm text-slate-300">
                  {typeof error === 'object' && 'error' in error
                    ? String(error.error)
                    : 'Failed to withdraw to L1'}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Bitcoin Address
            </label>
            <input
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
              onChange={(e) => setAddress(e.target.value)}
              placeholder="bc1q... or 1... or 3..."
              type="text"
              value={address}
            />
            <p className="text-xs text-slate-400 mt-1">
              Enter a valid Bitcoin mainchain address
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Amount (sats)
            </label>
            <input
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount to withdraw"
              type="number"
              value={amount}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Transaction Speed
            </label>
            <select
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              onChange={(e) =>
                setSpeed(e.target.value as 'slow' | 'medium' | 'fast')
              }
              value={speed}
            >
              <option value="slow">Slow (Lower fees, ~60 min)</option>
              <option value="medium">Medium (Moderate fees, ~30 min)</option>
              <option value="fast">Fast (Higher fees, ~10 min)</option>
            </select>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-yellow-500 mb-1">Important</h4>
                <p className="text-sm text-slate-300">
                  Withdrawing to L1 will move your funds from the Spark Layer 2
                  back to the Bitcoin mainchain. This process requires on-chain
                  confirmation and may take some time depending on the selected
                  speed.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={onClose} variant="outline">
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={isLoading || !address || !amount}
              icon={<ArrowUpRight className="w-4 h-4" />}
              onClick={handleWithdraw}
              variant="danger"
            >
              {isLoading ? 'Processing...' : 'Withdraw to L1'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
