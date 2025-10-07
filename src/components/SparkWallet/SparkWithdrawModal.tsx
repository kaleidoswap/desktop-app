import type { PrepareSendPaymentResponse } from '@breeztech/breez-sdk-spark'
import { X, Send, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'react-toastify'

import { useAppDispatch } from '../../app/store/hooks'
import { sparkSliceActions } from '../../slices/spark/spark.slice'
import {
  usePrepareSendPaymentMutation,
  useSendPaymentMutation,
} from '../../slices/spark/sparkApi.slice'
import type { PreparedPayment } from '../../types/spark'
import { Button, Card } from '../ui'

interface SparkWithdrawModalProps {
  onClose: () => void
}

export const SparkWithdrawModal = ({ onClose }: SparkWithdrawModalProps) => {
  const dispatch = useAppDispatch()
  const [paymentRequest, setPaymentRequest] = useState('')
  const [amount, setAmount] = useState('')
  const [preparedPayment, setPreparedPayment] =
    useState<PreparedPayment | null>(null)
  const [prepareResponse, setPrepareResponse] =
    useState<PrepareSendPaymentResponse | null>(null)
  const [preferSpark, setPreferSpark] = useState(false)
  const [confirmationSpeed, setConfirmationSpeed] = useState<
    'slow' | 'medium' | 'fast'
  >('fast')

  const [prepareSendPayment, { isLoading: isPreparing, error: prepareError }] =
    usePrepareSendPaymentMutation()
  const [sendPayment, { isLoading: isSending, error: sendError }] =
    useSendPaymentMutation()

  const handlePrepare = async () => {
    if (!paymentRequest) {
      toast.error('Please enter a payment request')
      return
    }

    try {
      const result = await prepareSendPayment({
        amount: amount ? Number(amount) : undefined,
        paymentRequest: paymentRequest.trim(),
      }).unwrap()

      setPreparedPayment(result)
      // Store the prepare response for sending
      setPrepareResponse(result as unknown as PrepareSendPaymentResponse)
      toast.success('Payment prepared successfully')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to prepare payment'
      )
    }
  }

  const handleSend = async () => {
    if (!prepareResponse) return

    try {
      await sendPayment({
        options: {
          confirmationSpeed,
          preferSpark,
        },
        prepareResponse,
      }).unwrap()

      toast.success('Payment sent successfully')
      dispatch(sparkSliceActions.clearError())
      onClose()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to send payment'
      )
    }
  }

  const getPaymentType = () => {
    if (!preparedPayment) return null
    if (preparedPayment.fees.lightning !== undefined) return 'lightning'
    if (preparedPayment.fees.onchain) return 'onchain'
    if (preparedPayment.fees.spark !== undefined) return 'spark'
    return null
  }

  const paymentType = getPaymentType()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Send Payment</h2>
          <button className="text-slate-400 hover:text-white" onClick={onClose}>
            <X className="w-6 h-6" />
          </button>
        </div>

        {prepareError || sendError ? (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-red-500 mb-1">Error</h4>
                <p className="text-sm text-slate-300">
                  {typeof prepareError === 'object' &&
                  prepareError &&
                  'error' in prepareError
                    ? String(prepareError.error)
                    : typeof sendError === 'object' &&
                        sendError &&
                        'error' in sendError
                      ? String(sendError.error)
                      : 'An error occurred'}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Payment Request
            </label>
            <textarea
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              disabled={!!preparedPayment}
              onChange={(e) => setPaymentRequest(e.target.value)}
              placeholder="Lightning invoice, Bitcoin address, or Spark address"
              rows={3}
              value={paymentRequest}
            />
            <p className="text-xs text-slate-400 mt-1">
              Supports BOLT11 invoices, BTC addresses, and Spark addresses
            </p>
          </div>

          {!preparedPayment && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Amount (sats) - Optional for invoices with amount
                </label>
                <input
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount in satoshis"
                  type="number"
                  value={amount}
                />
              </div>

              <Button
                className="w-full"
                disabled={isPreparing || !paymentRequest}
                onClick={handlePrepare}
              >
                {isPreparing ? 'Preparing...' : 'Prepare Payment'}
              </Button>
            </>
          )}

          {preparedPayment && (
            <>
              <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount:</span>
                  <span className="text-white font-medium">
                    {preparedPayment.amount} sats
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Type:</span>
                  <span className="text-white font-medium capitalize">
                    {paymentType}
                  </span>
                </div>

                {paymentType === 'lightning' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Lightning Fee:</span>
                      <span className="text-white font-medium">
                        {preparedPayment.fees.lightning} sats
                      </span>
                    </div>
                    {preparedPayment.fees.spark !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">
                          Spark Fee (if preferred):
                        </span>
                        <span className="text-white font-medium">
                          {preparedPayment.fees.spark} sats
                        </span>
                      </div>
                    )}
                  </>
                )}

                {paymentType === 'onchain' && preparedPayment.fees.onchain && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Slow Fee:</span>
                      <span className="text-white">
                        {preparedPayment.fees.onchain.slow} sats
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Medium Fee:</span>
                      <span className="text-white">
                        {preparedPayment.fees.onchain.medium} sats
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Fast Fee:</span>
                      <span className="text-white">
                        {preparedPayment.fees.onchain.fast} sats
                      </span>
                    </div>
                  </>
                )}

                {paymentType === 'spark' && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Spark Fee:</span>
                    <span className="text-white font-medium">
                      {preparedPayment.fees.spark} sats
                    </span>
                  </div>
                )}
              </div>

              {paymentType === 'lightning' &&
                preparedPayment.fees.spark !== undefined && (
                  <div className="flex items-center gap-2">
                    <input
                      checked={preferSpark}
                      className="w-4 h-4 text-yellow-500 bg-slate-800 border-slate-700 rounded focus:ring-yellow-500"
                      id="preferSpark"
                      onChange={(e) => setPreferSpark(e.target.checked)}
                      type="checkbox"
                    />
                    <label
                      className="text-sm text-slate-300"
                      htmlFor="preferSpark"
                    >
                      Prefer Spark transfer (faster and cheaper)
                    </label>
                  </div>
                )}

              {paymentType === 'onchain' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Confirmation Speed
                  </label>
                  <select
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onChange={(e) =>
                      setConfirmationSpeed(
                        e.target.value as 'slow' | 'medium' | 'fast'
                      )
                    }
                    value={confirmationSpeed}
                  >
                    <option value="slow">Slow</option>
                    <option value="medium">Medium</option>
                    <option value="fast">Fast</option>
                  </select>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => setPreparedPayment(null)}
                  variant="outline"
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={isSending}
                  icon={<Send className="w-4 h-4" />}
                  onClick={handleSend}
                >
                  {isSending ? 'Sending...' : 'Send Payment'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
