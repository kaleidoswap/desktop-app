import { invoke } from '@tauri-apps/api/core'
import {
  RefreshCw,
  Copy,
  Search,
  Loader as LoaderIcon,
  Zap,
  Settings,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'

import { Badge, IconButton, Card } from '../../../components/ui'
import { formatDate } from '../../../helpers/date'
import {
  makerApi,
  Lsps1CreateOrderResponse,
} from '../../../slices/makerApi/makerApi.slice'

interface ChannelOrder {
  id: number
  order_id: string
  payload: string
}

const AVAILABLE_COLUMNS = [
  { key: 'order_id', label: 'Order ID', type: 'default' },
  { key: 'created_at', label: 'Created At', type: 'default' },
  { key: 'amount_paid', label: 'Amount Paid', type: 'default' },
  { key: 'fees_paid', label: 'Fees Paid', type: 'default' },
  { key: 'status', label: 'Status', type: 'default' },
  {
    key: 'client_balance_sat',
    label: 'Client Balance (sats)',
    type: 'payload',
  },
  { key: 'lsp_balance_sat', label: 'LSP Balance (sats)', type: 'payload' },
  {
    key: 'channel_expiry_blocks',
    label: 'Channel Expiry (blocks)',
    type: 'payload',
  },
  {
    key: 'required_channel_confirmations',
    label: 'Required Confirmations',
    type: 'payload',
  },
  {
    key: 'funding_confirms_within_blocks',
    label: 'Funding Confirms Within',
    type: 'payload',
  },
  { key: 'announce_channel', label: 'Announce Channel', type: 'payload' },
  { key: 'asset_id', label: 'Asset ID', type: 'payload' },
  { key: 'lsp_asset_amount', label: 'LSP Asset Amount', type: 'payload' },
  { key: 'client_asset_amount', label: 'Client Asset Amount', type: 'payload' },
]

const DEFAULT_COLUMNS = [
  'order_id',
  'created_at',
  'amount_paid',
  'fees_paid',
  'status',
]

const ChannelOrderRow: React.FC<{
  order: ChannelOrder
  orderStatus: string
  orderData?: Lsps1CreateOrderResponse
  selectedColumns: string[]
}> = ({ order, orderStatus, orderData, selectedColumns }) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success('Order ID copied to clipboard')
      })
      .catch((err) => {
        console.error('Failed to copy:', err)
      })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <Badge size="sm" variant="success">
            Completed
          </Badge>
        )
      case 'FAILED':
        return (
          <Badge size="sm" variant="danger">
            Failed
          </Badge>
        )
      case 'CREATED':
        return (
          <Badge size="sm" variant="warning">
            Created
          </Badge>
        )
      default:
        return (
          <Badge size="sm" variant="default">
            Unknown
          </Badge>
        )
    }
  }

  const getAmountPaid = () => {
    if (!orderData?.payment) return 'N/A'

    const bolt11Amount = orderData.payment.bolt11?.order_total_sat
    const onchainAmount = orderData.payment.onchain?.order_total_sat

    const amount = bolt11Amount || onchainAmount
    return amount ? `${amount.toLocaleString()} sats` : 'N/A'
  }

  const getFeesPaid = () => {
    if (!orderData?.payment) return 'N/A'

    const bolt11Fee = orderData.payment.bolt11?.fee_total_sat
    const onchainFee = orderData.payment.onchain?.fee_total_sat

    const fee = bolt11Fee || onchainFee
    return fee ? `${fee.toLocaleString()} sats` : 'N/A'
  }

  const getCreatedAt = () => {
    if (orderData?.created_at) {
      return formatDate(new Date(orderData.created_at).getTime())
    }
    return 'N/A'
  }

  const getPayloadFieldValue = (fieldKey: string) => {
    try {
      const payload = JSON.parse(order.payload)
      const value = payload[fieldKey]

      if (value === undefined || value === null) return 'N/A'
      if (typeof value === 'boolean') return value ? 'Yes' : 'No'
      if (typeof value === 'number') return value.toLocaleString()
      if (typeof value === 'string' && value.length > 30) {
        return `${value.substring(0, 30)}...`
      }
      return String(value)
    } catch {
      return 'N/A'
    }
  }

  const getCellValue = (columnKey: string) => {
    switch (columnKey) {
      case 'order_id':
        return (
          <div className="flex items-center min-w-0">
            <span className="text-xs text-gray-400 truncate font-mono mr-2">
              {order.order_id}
            </span>
            <button
              className="flex-shrink-0 text-gray-400 hover:text-gray-200 transition-colors"
              onClick={() => copyToClipboard(order.order_id)}
              title="Copy order ID"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        )
      case 'amount_paid':
        return (
          <span className="font-semibold text-white">{getAmountPaid()}</span>
        )
      case 'fees_paid':
        return <span className="text-slate-300">{getFeesPaid()}</span>
      case 'created_at':
        return <span className="text-slate-300">{getCreatedAt()}</span>
      case 'status':
        return getStatusBadge(orderStatus)
      default:
        return (
          <span className="text-slate-300">
            {getPayloadFieldValue(columnKey)}
          </span>
        )
    }
  }

  return (
    <tr className="border-b border-gray-700/50 hover:bg-gray-700/20 text-sm">
      {selectedColumns.map((columnKey) => (
        <td
          className={`py-3 px-4 ${columnKey === 'order_id' ? 'min-w-0' : ''} ${columnKey === 'status' ? 'text-right' : ''}`}
          key={columnKey}
        >
          {getCellValue(columnKey)}
        </td>
      ))}
    </tr>
  )
}

export const Component = () => {
  const [orders, setOrders] = useState<ChannelOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orderStatuses, setOrderStatuses] = useState<Record<string, string>>({})
  const [orderData, setOrderData] = useState<
    Record<string, Lsps1CreateOrderResponse>
  >({})
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedColumns, setSelectedColumns] =
    useState<string[]>(DEFAULT_COLUMNS)
  const [showColumnSelector, setShowColumnSelector] = useState(false)

  const [getOrderRequest] = makerApi.endpoints.get_order.useLazyQuery()

  const fetchOrders = async () => {
    try {
      console.log('Fetching channel orders from database...')
      const result = await invoke<ChannelOrder[]>('get_channel_orders')
      console.log('Channel orders fetched:', result)
      setOrders(result)
      setError(null)
    } catch (err) {
      console.error('Error fetching channel orders:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  useEffect(() => {
    const loadOrders = async () => {
      setLoading(true)
      await fetchOrders()
      setLoading(false)
    }
    loadOrders()
  }, [])

  useEffect(() => {
    const fetchOrderStatuses = async () => {
      const statuses: Record<string, string> = {}
      const data: Record<string, Lsps1CreateOrderResponse> = {}

      for (const order of orders) {
        try {
          const response = await getOrderRequest({ order_id: order.order_id })
          if (response.data) {
            statuses[order.order_id] = response.data.order_state
            data[order.order_id] = response.data
          }
        } catch (err) {
          console.error(
            `Error fetching status for order ${order.order_id}:`,
            err
          )
        }
      }
      setOrderStatuses(statuses)
      setOrderData(data)
    }
    if (orders.length > 0) {
      fetchOrderStatuses()
    }
  }, [orders, getOrderRequest])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchOrders()
    setRefreshing(false)
  }

  const handleColumnToggle = (columnKey: string) => {
    setSelectedColumns((prev) => {
      if (prev.includes(columnKey)) {
        // Don't allow removing all columns
        if (prev.length === 1) return prev
        return prev.filter((col) => col !== columnKey)
      } else {
        return [...prev, columnKey]
      }
    })
  }

  const resetToDefaults = () => {
    setSelectedColumns(DEFAULT_COLUMNS)
  }

  const filteredOrders = orders.filter((order) =>
    order.order_id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-400">Loading channel orders...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <div className="text-red-400">Error: {error}</div>
        <button
          className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          onClick={handleRefresh}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <Card className="bg-gray-800/50 border border-gray-700/50">
      <div className="flex justify-between items-center flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10">
            <Zap className="h-6 w-6 text-blue-500" />
          </div>
          <h2 className="text-xl font-bold text-white">Channel Orders</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
            onClick={() => setShowColumnSelector(!showColumnSelector)}
          >
            <Settings className="w-4 h-4" />
            Columns
          </button>
          <IconButton
            aria-label="Refresh"
            disabled={refreshing}
            icon={
              refreshing ? (
                <LoaderIcon className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )
            }
            onClick={handleRefresh}
            variant="outline"
          />
        </div>
      </div>

      {/* Column Selector */}
      {showColumnSelector && (
        <div className="mb-6 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-white">Select Columns</h3>
            <button
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
              onClick={resetToDefaults}
            >
              Reset to Defaults
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {AVAILABLE_COLUMNS.map((column) => (
              <label
                className="flex items-center space-x-2 cursor-pointer"
                key={column.key}
              >
                <input
                  checked={selectedColumns.includes(column.key)}
                  className="form-checkbox h-4 w-4 text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                  onChange={() => handleColumnToggle(column.key)}
                  type="checkbox"
                />
                <span className="text-sm text-gray-300">{column.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            className="block w-full pl-9 pr-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Order ID..."
            type="text"
            value={searchTerm}
          />
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-8 text-slate-400 bg-slate-800/30 rounded-lg border border-slate-700">
          {orders.length === 0 ? (
            <p>No channel orders found.</p>
          ) : (
            <p>No orders found matching your search.</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto bg-slate-800/30 rounded-lg border border-slate-700">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="text-left text-sm text-gray-400 border-b border-gray-700">
                {selectedColumns.map((columnKey) => {
                  const column = AVAILABLE_COLUMNS.find(
                    (col) => col.key === columnKey
                  )
                  return (
                    <th
                      className={`py-3 px-4 ${columnKey === 'order_id' ? 'min-w-0' : ''} ${columnKey === 'status' ? 'text-right' : ''}`}
                      key={columnKey}
                    >
                      {column?.label || columnKey}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <ChannelOrderRow
                  key={order.id}
                  order={order}
                  orderData={orderData[order.order_id]}
                  orderStatus={orderStatuses[order.order_id] || 'Unknown'}
                  selectedColumns={selectedColumns}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
