import type { PrepareSendPaymentResponse } from '@breeztech/breez-sdk-spark'
import { Send, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'react-toastify'

import { useAppSelector } from '../../app/store/hooks'
import {
  usePrepareSendPaymentMutation,
  useSendPaymentMutation,
} from '../../slices/spark/sparkApi.slice'
import type { PreparedPayment } from '../../types/spark'
import { Button } from '../ui'

interface SparkSendTabProps {
  onClose: () => void
}

export const SparkSendTab = ({ onClose }: SparkSendTabProps) => {
  const sparkInfo = useAppSelector((state) => state.spark.info)
  const [paymentInput, setPaymentInput] = useState('')
  const [amount, setAmount] = useState('')
  const [useAllFunds, setUseAllFunds] = useState(false)
  const [preparedPayment, setPreparedPayment] =
    useState<PreparedPayment | null>(null)
  const [prepareResponse, setPrepareResponse] =
    useState<PrepareSendPaymentResponse | null>(null)
  const [confirmationSpeed, setConfirmationSpeed] = useState<
    'slow' | 'medium' | 'fast'
  >('fast')
  const [preferSpark, setPreferSpark] = useState(false)

  const [prepareSendPayment, { isLoading: isPreparing, error: prepareError }] =
    usePrepareSendPaymentMutation()
  const [sendPayment, { isLoading: isSending, error: sendError }] =
    useSendPaymentMutation()

  const handlePrepare = async () => {
    if (!paymentInput) {
      toast.error(
        'Please enter a payment request, Lightning address, or Bitcoin address'
      )
      return
    }

    try {
      const amountToSend =
        useAllFunds && sparkInfo
          ? sparkInfo.balanceSats
          : amount
            ? Number(amount)
            : undefined

      const result = await prepareSendPayment({
        amount: amountToSend,
        paymentRequest: paymentInput.trim(),
      }).unwrap()

      setPreparedPayment(result)
      setPrepareResponse(result as unknown as PrepareSendPaymentResponse)
      toast.success('Payment prepared')
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
    <div className="space-y-4">
      {prepareError || sendError ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
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

      {!preparedPayment ? (
        <>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-sm text-blue-400">
              <strong>Unified Send:</strong> Paste or scan any Lightning
              invoice, Lightning address, Bitcoin address, or LNURL
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Payment Destination
            </label>
            <textarea
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 font-mono"
              disabled={!!preparedPayment}
              onChange={(e) => setPaymentInput(e.target.value)}
              placeholder="BOLT11 invoice, Lightning address, Bitcoin address, or LNURL"
              rows={3}
              value={paymentInput}
            />
            <p className="text-xs text-slate-400 mt-1">
              Supports all payment types - paste anything
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Amount (sats)
            </label>
            <input
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
              disabled={useAllFunds}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={
                useAllFunds
                  ? 'Using all available funds'
                  : 'Optional for invoices with amount'
              }
              type="number"
              value={useAllFunds ? '' : amount}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              checked={useAllFunds}
              className="w-4 h-4 text-yellow-500 bg-slate-800 border-slate-700 rounded focus:ring-yellow-500"
              id="useAllFunds"
              onChange={(e) => setUseAllFunds(e.target.checked)}
              type="checkbox"
            />
            <label className="text-sm text-slate-300" htmlFor="useAllFunds">
              Use all funds ({sparkInfo?.balanceSats.toLocaleString() || 0}{' '}
              sats)
            </label>
          </div>

          <Button
            className="w-full"
            disabled={isPreparing || !paymentInput}
            onClick={handlePrepare}
          >
            {isPreparing ? 'Preparing...' : 'Prepare Payment'}
          </Button>
        </>
      ) : (
        <>
          <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400">Amount:</span>
              <span className="text-white font-medium">
                {preparedPayment.amount.toLocaleString()} sats
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Payment Type:</span>
              <span className="text-white font-medium capitalize">
                {paymentType}
              </span>
            </div>

            {/* Lightning Fees */}
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

            {/* On-chain Fees */}
            {paymentType === 'onchain' && preparedPayment.fees.onchain && (
              <div className="space-y-2 border-t border-slate-700 pt-3">
                <p className="text-sm text-slate-400">Network Fees:</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center">
                    <p className="text-slate-500 mb-1">Slow</p>
                    <p className="text-white font-medium">
                      {preparedPayment.fees.onchain.slow} sats
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500 mb-1">Medium</p>
                    <p className="text-white font-medium">
                      {preparedPayment.fees.onchain.medium} sats
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500 mb-1">Fast</p>
                    <p className="text-white font-medium">
                      {preparedPayment.fees.onchain.fast} sats
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Spark Fees */}
            {paymentType === 'spark' && (
              <div className="flex justify-between">
                <span className="text-slate-400">Spark Fee:</span>
                <span className="text-white font-medium">
                  {preparedPayment.fees.spark} sats
                </span>
              </div>
            )}

            {/* Total */}
            <div className="flex justify-between border-t border-slate-700 pt-3 text-lg">
              <span className="text-slate-300 font-medium">Total:</span>
              <span className="text-white font-bold">
                {(
                  preparedPayment.amount +
                  (preparedPayment.fees.lightning ||
                    preparedPayment.fees.spark ||
                    preparedPayment.fees.onchain?.[confirmationSpeed] ||
                    0)
                ).toLocaleString()}{' '}
                sats
              </span>
            </div>
          </div>

          {/* Options */}
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
                <label className="text-sm text-slate-300" htmlFor="preferSpark">
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
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                onChange={(e) =>
                  setConfirmationSpeed(
                    e.target.value as 'slow' | 'medium' | 'fast'
                  )
                }
                value={confirmationSpeed}
              >
                <option value="slow">Slow (~60 min)</option>
                <option value="medium">Medium (~30 min)</option>
                <option value="fast">Fast (~10 min)</option>
              </select>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => {
                setPreparedPayment(null)
                setPrepareResponse(null)
              }}
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
  )
}
