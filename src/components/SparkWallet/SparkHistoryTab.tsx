import { format } from 'date-fns'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useState } from 'react'

import { useListPaymentsQuery } from '../../slices/spark/sparkApi.slice'
import type { SparkPayment } from '../../types/spark'

export const SparkHistoryTab = () => {
  const { data: payments, isLoading, error } = useListPaymentsQuery()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'succeeded':
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-slate-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-500'
      case 'succeeded':
      case 'complete':
        return 'text-green-500'
      case 'failed':
        return 'text-red-500'
      default:
        return 'text-slate-500'
    }
  }

  const PaymentItem = ({ payment }: { payment: SparkPayment }) => {
    const isExpanded = expandedId === payment.id
    const isIncoming = payment.direction === 'incoming'

    return (
      <div className="bg-slate-800/50 rounded-lg overflow-hidden">
        <button
          className="w-full p-4 text-left hover:bg-slate-800/80 transition-colors"
          onClick={() => setExpandedId(isExpanded ? null : payment.id)}
        >
          <div className="flex items-start gap-3">
            {/* Direction Icon */}
            <div
              className={`p-2 rounded-lg ${isIncoming ? 'bg-green-500/10' : 'bg-blue-500/10'}`}
            >
              {isIncoming ? (
                <ArrowDownLeft className="w-4 h-4 text-green-500" />
              ) : (
                <ArrowUpRight className="w-4 h-4 text-blue-500" />
              )}
            </div>

            {/* Payment Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-white">
                  {isIncoming ? 'Received' : 'Sent'}
                </h4>
                <span
                  className={`text-xs capitalize ${getStatusColor(payment.status)}`}
                >
                  {payment.status}
                </span>
                {getStatusIcon(payment.status)}
              </div>

              {payment.description && (
                <p className="text-sm text-slate-400 truncate mb-1">
                  {payment.description}
                </p>
              )}

              <p className="text-xs text-slate-500">
                {format(
                  new Date(payment.timestamp * 1000),
                  'MMM dd, yyyy HH:mm'
                )}
              </p>
            </div>

            {/* Amount */}
            <div className="text-right">
              <div
                className={`text-lg font-bold ${isIncoming ? 'text-green-500' : 'text-white'}`}
              >
                {isIncoming ? '+' : '-'}
                {payment.amount.toLocaleString()}
              </div>
              <div className="text-xs text-slate-400">sats</div>
              <div className="text-xs text-slate-500 capitalize">
                {payment.type}
              </div>
            </div>

            {/* Expand Icon */}
            <div className="flex items-center">
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </div>
          </div>
        </button>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-2 border-t border-slate-700">
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">ID:</span>
                <span className="text-white font-mono text-xs truncate max-w-xs">
                  {payment.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Type:</span>
                <span className="text-white capitalize">{payment.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Direction:</span>
                <span className="text-white capitalize">
                  {payment.direction}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span
                  className={`capitalize ${getStatusColor(payment.status)}`}
                >
                  {payment.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Timestamp:</span>
                <span className="text-white">
                  {format(new Date(payment.timestamp * 1000), 'PPpp')}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Loading payments...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <p className="text-sm text-red-400">Failed to load payment history</p>
      </div>
    )
  }

  if (!payments || payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Clock className="w-12 h-12 text-slate-600 mb-4" />
        <p className="text-slate-400 text-center">
          No payments yet
          <br />
          <span className="text-sm text-slate-500">
            Your payment history will appear here
          </span>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {payments.map((payment) => (
        <PaymentItem key={payment.id} payment={payment} />
      ))}
    </div>
  )
}
