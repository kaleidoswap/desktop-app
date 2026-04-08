import { invoke } from '@tauri-apps/api/core'
import {
  RefreshCw,
  Search,
  Loader as LoaderIcon,
  Settings,
  Trash2,
  AlertTriangle,
  X,
  Zap,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Hash,
  Coins,
  Activity,
  Info,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import { IconButton, Card } from '../../../components/ui'
import {
  Table,
  renderCopyableField,
  renderDateField,
  renderStatusBadge,
  renderEmptyField,
} from '../../../components/ui/Table'
import {
  makerApi,
  Lsps1CreateOrderResponse,
} from '../../../slices/makerApi/makerApi.slice'

interface ChannelOrder {
  id: number
  order_id: string
  payload: string
}

type OrderDeliveryMetadata = {
  asset_delivery_error?: string | null
  asset_delivery_status?: string | null
}

const getOrderDeliveryMetadata = (
  orderData?: Lsps1CreateOrderResponse
): OrderDeliveryMetadata =>
  (orderData as
    | (Lsps1CreateOrderResponse & OrderDeliveryMetadata)
    | undefined) || {}

const getAvailableColumns = (t: any) => [
  {
    key: 'order_id',
    label: t('components.walletHistory.channelOrders.columnHeaders.orderId'),
    type: 'default',
  },
  {
    key: 'created_at',
    label: t('components.walletHistory.channelOrders.columnHeaders.createdAt'),
    type: 'default',
  },
  {
    key: 'amount_paid',
    label: t('components.walletHistory.channelOrders.columnHeaders.amountPaid'),
    type: 'default',
  },
  {
    key: 'fees_paid',
    label: t('components.walletHistory.channelOrders.columnHeaders.feesPaid'),
    type: 'default',
  },
  {
    key: 'status',
    label: t('components.walletHistory.channelOrders.columnHeaders.status'),
    type: 'default',
  },
  {
    key: 'client_balance_sat',
    label: t(
      'components.walletHistory.channelOrders.columnHeaders.clientBalance'
    ),
    type: 'payload',
  },
  {
    key: 'lsp_balance_sat',
    label: t('components.walletHistory.channelOrders.columnHeaders.lspBalance'),
    type: 'payload',
  },
  {
    key: 'channel_expiry_blocks',
    label: t(
      'components.walletHistory.channelOrders.columnHeaders.channelExpiry'
    ),
    type: 'payload',
  },
  {
    key: 'required_channel_confirmations',
    label: t(
      'components.walletHistory.channelOrders.columnHeaders.requiredConfirmations'
    ),
    type: 'payload',
  },
  {
    key: 'funding_confirms_within_blocks',
    label: t(
      'components.walletHistory.channelOrders.columnHeaders.fundingConfirmsWithin'
    ),
    type: 'payload',
  },
  {
    key: 'announce_channel',
    label: t(
      'components.walletHistory.channelOrders.columnHeaders.announceChannel'
    ),
    type: 'payload',
  },
  {
    key: 'asset_id',
    label: t('components.walletHistory.channelOrders.columnHeaders.assetId'),
    type: 'payload',
  },
  {
    key: 'lsp_asset_amount',
    label: t(
      'components.walletHistory.channelOrders.columnHeaders.lspAssetAmount'
    ),
    type: 'payload',
  },
  {
    key: 'client_asset_amount',
    label: t(
      'components.walletHistory.channelOrders.columnHeaders.clientAssetAmount'
    ),
    type: 'payload',
  },
  {
    key: 'asset_delivery_status',
    label: t(
      'components.walletHistory.channelOrders.columnHeaders.assetDeliveryStatus'
    ),
    type: 'default',
  },
  {
    key: 'actions',
    label: t('components.walletHistory.channelOrders.columnHeaders.actions'),
    type: 'default',
  },
]

const DEFAULT_COLUMNS = [
  'order_id',
  'created_at',
  'amount_paid',
  'fees_paid',
  'status',
  'actions',
]

// Order Detail Card Modal Component
const OrderDetailCard: React.FC<{
  isOpen: boolean
  onClose: () => void
  order: ChannelOrder
  orderData: Lsps1CreateOrderResponse | undefined
  orderStatus: string
  onDelete: () => void
}> = ({ isOpen, onClose, order, orderData, orderStatus, onDelete }) => {
  const { t } = useTranslation()
  if (!isOpen) return null

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'FAILED':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'CREATED':
        return <Clock className="w-5 h-5 text-yellow-500" />
      default:
        return <AlertCircle className="w-5 h-5 text-content-tertiary" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500/10 border-green-500/30 text-green-400'
      case 'FAILED':
        return 'bg-red-500/10 border-red-500/30 text-red-400'
      case 'CREATED':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
      default:
        return 'bg-surface-high/10 border-border-default/30 text-content-secondary'
    }
  }

  const payload = (() => {
    try {
      return JSON.parse(order.payload)
    } catch {
      return {}
    }
  })()

  const bolt11Amount = (orderData?.payment as any)?.bolt11?.order_total_sat
  const onchainAmount = (orderData?.payment as any)?.onchain?.order_total_sat
  const amountPaid = bolt11Amount || onchainAmount

  const bolt11Fee = (orderData?.payment as any)?.bolt11?.fee_total_sat
  const onchainFee = (orderData?.payment as any)?.onchain?.fee_total_sat
  const feePaid = bolt11Fee || onchainFee
  const delivery = getOrderDeliveryMetadata(orderData)

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-surface-base rounded-xl border border-border-default/70 shadow-2xl max-w-3xl w-full my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-default/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10">
              <Info className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">
                {t('components.walletHistory.channelOrders.detailsModal.title')}
              </h3>
              <p className="text-sm text-content-secondary mt-0.5">
                {t(
                  'components.walletHistory.channelOrders.detailsModal.subtitle'
                )}
              </p>
            </div>
          </div>
          <button
            aria-label="Close modal"
            className="p-2 rounded-full hover:bg-surface-overlay text-content-secondary hover:text-white transition-colors"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Status Section */}
          <div
            className={`rounded-lg border p-4 ${getStatusColor(orderStatus)}`}
          >
            <div className="flex items-center gap-3">
              {getStatusIcon(orderStatus)}
              <div>
                <div className="text-sm font-medium uppercase tracking-wide">
                  {t(
                    'components.walletHistory.channelOrders.sections.orderStatus'
                  )}
                </div>
                <div className="text-lg font-bold mt-0.5">{orderStatus}</div>
              </div>
            </div>
          </div>

          {/* Order ID Section */}
          <div className="bg-surface-overlay/50 rounded-lg p-4 border border-border-default">
            <div className="flex items-start gap-3">
              <Hash className="w-5 h-5 text-content-secondary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-content-secondary mb-1">
                  {t('components.walletHistory.channelOrders.sections.orderId')}
                </div>
                <div className="font-mono text-white text-sm break-all">
                  {order.order_id}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div className="bg-surface-overlay/50 rounded-lg p-4 border border-border-default">
            <div className="flex items-center gap-2 mb-4">
              <Coins className="w-5 h-5 text-blue-400" />
              <h4 className="text-lg font-semibold text-white">
                {t(
                  'components.walletHistory.channelOrders.sections.paymentInformation'
                )}
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-content-secondary mb-1">
                  {t(
                    'components.walletHistory.channelOrders.fields.amountPaid'
                  )}
                </div>
                <div className="text-xl font-bold text-white">
                  {amountPaid
                    ? `${amountPaid.toLocaleString()} ${t('components.walletHistory.channelOrders.units.sats')}`
                    : t('components.walletHistory.channelOrders.units.na')}
                </div>
              </div>
              <div>
                <div className="text-sm text-content-secondary mb-1">
                  {t('components.walletHistory.channelOrders.fields.feesPaid')}
                </div>
                <div className="text-xl font-bold text-content-secondary">
                  {feePaid
                    ? `${feePaid.toLocaleString()} ${t('components.walletHistory.channelOrders.units.sats')}`
                    : t('components.walletHistory.channelOrders.units.na')}
                </div>
              </div>
            </div>
          </div>

          {/* Channel Configuration */}
          <div className="bg-surface-overlay/50 rounded-lg p-4 border border-border-default">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-purple-400" />
              <h4 className="text-lg font-semibold text-white">
                {t(
                  'components.walletHistory.channelOrders.sections.channelConfiguration'
                )}
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-content-secondary mb-1">
                  {t(
                    'components.walletHistory.channelOrders.fields.clientBalance'
                  )}
                </div>
                <div className="text-base font-semibold text-white">
                  {payload.client_balance_sat
                    ? `${payload.client_balance_sat.toLocaleString()} ${t('components.walletHistory.channelOrders.units.sats')}`
                    : t('components.walletHistory.channelOrders.units.na')}
                </div>
              </div>
              <div>
                <div className="text-sm text-content-secondary mb-1">
                  {t(
                    'components.walletHistory.channelOrders.fields.lspBalance'
                  )}
                </div>
                <div className="text-base font-semibold text-white">
                  {payload.lsp_balance_sat
                    ? `${payload.lsp_balance_sat.toLocaleString()} ${t('components.walletHistory.channelOrders.units.sats')}`
                    : t('components.walletHistory.channelOrders.units.na')}
                </div>
              </div>
              <div>
                <div className="text-sm text-content-secondary mb-1">
                  {t(
                    'components.walletHistory.channelOrders.fields.channelExpiry'
                  )}
                </div>
                <div className="text-base font-semibold text-white">
                  {payload.channel_expiry_blocks
                    ? `${payload.channel_expiry_blocks} ${t('components.walletHistory.channelOrders.units.blocks')}`
                    : t('components.walletHistory.channelOrders.units.na')}
                </div>
              </div>
              <div>
                <div className="text-sm text-content-secondary mb-1">
                  {t(
                    'components.walletHistory.channelOrders.fields.requiredConfirmations'
                  )}
                </div>
                <div className="text-base font-semibold text-white">
                  {payload.required_channel_confirmations ??
                    t('components.walletHistory.channelOrders.units.na')}
                </div>
              </div>
              <div>
                <div className="text-sm text-content-secondary mb-1">
                  {t(
                    'components.walletHistory.channelOrders.fields.fundingConfirmsWithin'
                  )}
                </div>
                <div className="text-base font-semibold text-white">
                  {payload.funding_confirms_within_blocks
                    ? `${payload.funding_confirms_within_blocks} ${t('components.walletHistory.channelOrders.units.blocks')}`
                    : t('components.walletHistory.channelOrders.units.na')}
                </div>
              </div>
              <div>
                <div className="text-sm text-content-secondary mb-1">
                  {t(
                    'components.walletHistory.channelOrders.fields.announceChannel'
                  )}
                </div>
                <div className="text-base font-semibold text-white">
                  {payload.announce_channel !== undefined
                    ? payload.announce_channel
                      ? t('common.yes')
                      : t('common.no')
                    : t('components.walletHistory.channelOrders.units.na')}
                </div>
              </div>
            </div>
          </div>

          {/* Asset Information (if available) */}
          {(payload.asset_id ||
            payload.lsp_asset_amount ||
            payload.client_asset_amount) && (
            <div className="bg-surface-overlay/50 rounded-lg p-4 border border-border-default">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-orange-400" />
                <h4 className="text-lg font-semibold text-white">
                  {t(
                    'components.walletHistory.channelOrders.sections.assetInformation'
                  )}
                </h4>
              </div>
              <div className="space-y-3">
                {payload.asset_id && (
                  <div>
                    <div className="text-sm text-content-secondary mb-1">
                      {t(
                        'components.walletHistory.channelOrders.fields.assetId'
                      )}
                    </div>
                    <div className="font-mono text-sm text-white break-all">
                      {payload.asset_id}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {payload.client_asset_amount && (
                    <div>
                      <div className="text-sm text-content-secondary mb-1">
                        {t(
                          'components.walletHistory.channelOrders.fields.clientAssetAmount'
                        )}
                      </div>
                      <div className="text-base font-semibold text-white">
                        {payload.client_asset_amount.toLocaleString()}
                      </div>
                    </div>
                  )}
                  {payload.lsp_asset_amount && (
                    <div>
                      <div className="text-sm text-content-secondary mb-1">
                        {t(
                          'components.walletHistory.channelOrders.fields.lspAssetAmount'
                        )}
                      </div>
                      <div className="text-base font-semibold text-white">
                        {payload.lsp_asset_amount.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Asset Delivery Status */}
                {delivery.asset_delivery_status &&
                  delivery.asset_delivery_status !== 'NOT_REQUIRED' && (
                    <div className="mt-4 pt-4 border-t border-border-default">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-content-secondary mb-1">
                            {t(
                              'components.walletHistory.channelOrders.fields.deliveryStatus'
                            )}
                          </div>
                          <div className="text-base font-semibold text-white">
                            {delivery.asset_delivery_status}
                          </div>
                          {delivery.asset_delivery_error && (
                            <div className="text-xs text-red-400 mt-1">
                              {t('common.error')}:{' '}
                              {delivery.asset_delivery_error}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* Timeline */}
          {orderData?.created_at && (
            <div className="bg-surface-overlay/50 rounded-lg p-4 border border-border-default">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-green-400" />
                <h4 className="text-lg font-semibold text-white">
                  {t(
                    'components.walletHistory.channelOrders.sections.timeline'
                  )}
                </h4>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-content-secondary" />
                <div>
                  <div className="text-sm text-content-secondary">
                    {t(
                      'components.walletHistory.channelOrders.fields.createdAt'
                    )}
                  </div>
                  <div className="text-base font-medium text-white">
                    {new Date(orderData.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border-default/70">
          <button
            className="px-4 py-2 text-content-secondary hover:text-white hover:bg-surface-overlay rounded-lg transition-colors"
            onClick={onClose}
          >
            {t('components.walletHistory.channelOrders.detailsModal.close')}
          </button>
          <button
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2"
            onClick={() => {
              onDelete()
              onClose()
            }}
          >
            <Trash2 className="w-4 h-4" />
            {t(
              'components.walletHistory.channelOrders.detailsModal.deleteOrder'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// Confirmation Modal Component
const DeleteConfirmationModal: React.FC<{
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  orderId: string
}> = ({ isOpen, onClose, onConfirm, orderId }) => {
  const { t } = useTranslation()
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface-base rounded-xl border border-border-default/70 shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-default/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-white">
              {t('components.walletHistory.channelOrders.deleteModal.title')}
            </h3>
          </div>
          <button
            aria-label="Close modal"
            className="p-2 rounded-full hover:bg-surface-overlay text-content-secondary hover:text-white transition-colors"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-content-secondary mb-4">
            {t('components.walletHistory.channelOrders.deleteModal.message')}
          </p>
          <div className="bg-surface-overlay/50 rounded-lg p-3 border border-border-default">
            <div className="flex items-center gap-2">
              <span className="text-sm text-content-secondary">
                {t(
                  'components.walletHistory.channelOrders.deleteModal.orderId'
                )}
              </span>
              <span className="text-sm font-mono text-white break-all">
                {orderId}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border-default/70">
          <button
            className="px-4 py-2 text-content-secondary hover:text-white hover:bg-surface-overlay rounded-lg transition-colors"
            onClick={onClose}
          >
            {t('components.walletHistory.channelOrders.deleteModal.cancel')}
          </button>
          <button
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2"
            onClick={onConfirm}
          >
            <Trash2 className="w-4 h-4" />
            {t('components.walletHistory.channelOrders.deleteModal.delete')}
          </button>
        </div>
      </div>
    </div>
  )
}

export const Component = () => {
  const { t } = useTranslation()
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
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null)
  const [showDetailCard, setShowDetailCard] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<ChannelOrder | null>(null)

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
          const payload = JSON.parse(order.payload || '{}')
          const accessToken = payload.access_token || payload.token
          if (!accessToken) {
            continue
          }

          const response = await getOrderRequest({
            access_token: accessToken,
            order_id: order.order_id,
          })
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

  const handleDelete = async (orderId: string) => {
    setOrderToDelete(orderId)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!orderToDelete) return

    try {
      await invoke('delete_channel_order', { orderId: orderToDelete })
      toast.success(
        t('components.walletHistory.channelOrders.messages.deleteSuccess')
      )
      await fetchOrders() // Refresh the list
      setShowDeleteModal(false)
      setOrderToDelete(null)
    } catch (err) {
      console.error('Error deleting channel order:', err)
      toast.error(
        err instanceof Error
          ? err.message
          : t('components.walletHistory.channelOrders.messages.deleteFailed')
      )
      setShowDeleteModal(false)
      setOrderToDelete(null)
    }
  }

  const cancelDelete = () => {
    setShowDeleteModal(false)
    setOrderToDelete(null)
  }

  const handleViewDetails = (order: ChannelOrder) => {
    setSelectedOrder(order)
    setShowDetailCard(true)
  }

  const closeDetailCard = () => {
    setShowDetailCard(false)
    setSelectedOrder(null)
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
        <div className="text-content-secondary">
          {t('components.walletHistory.channelOrders.loading')}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <div className="text-red-400">
          {t('components.walletHistory.channelOrders.messages.error', {
            error,
          })}
        </div>
        <button
          className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          onClick={handleRefresh}
        >
          {t('components.walletHistory.channelOrders.messages.retry')}
        </button>
      </div>
    )
  }

  return (
    <Card className="bg-surface-overlay/50 border border-border-default/50">
      <div className="flex justify-between items-center flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10">
            <Zap className="h-6 w-6 text-blue-500" />
          </div>
          <h2 className="text-xl font-bold text-white">
            {t('components.walletHistory.channelOrders.title')}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 px-3 py-2 bg-surface-high hover:bg-surface-elevated text-white rounded-lg transition-colors text-sm"
            onClick={() => setShowColumnSelector(!showColumnSelector)}
          >
            <Settings className="w-4 h-4" />
            {t('components.walletHistory.channelOrders.columns')}
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
        <div className="mb-6 p-4 bg-surface-high/50 rounded-lg border border-border-default">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-white">
              {t('components.walletHistory.channelOrders.selectColumns')}
            </h3>
            <button
              className="px-3 py-1 bg-primary hover:bg-primary-emphasis text-primary-foreground rounded text-sm transition-colors"
              onClick={resetToDefaults}
            >
              {t('components.walletHistory.channelOrders.resetToDefaults')}
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {getAvailableColumns(t).map((column) => (
              <label
                className="flex items-center space-x-2 cursor-pointer"
                key={column.key}
              >
                <input
                  checked={selectedColumns.includes(column.key)}
                  className="form-checkbox h-4 w-4 text-blue-500 bg-surface-high border-border-default rounded focus:ring-blue-500 focus:ring-2"
                  onChange={() => handleColumnToggle(column.key)}
                  type="checkbox"
                />
                <span className="text-sm text-content-secondary">
                  {column.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-content-secondary" />
          </div>
          <input
            className="block w-full pl-9 pr-3 py-2 border border-border-default rounded-lg bg-surface-overlay text-white placeholder-content-secondary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t(
              'components.walletHistory.channelOrders.searchPlaceholder'
            )}
            type="text"
            value={searchTerm}
          />
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-8 text-content-secondary bg-surface-overlay/30 rounded-lg border border-border-default">
          {orders.length === 0 ? (
            <p>{t('components.walletHistory.channelOrders.noOrders')}</p>
          ) : (
            <p>{t('components.walletHistory.channelOrders.noOrdersSearch')}</p>
          )}
        </div>
      ) : (
        <Table
          columns={selectedColumns.map((columnKey) => {
            const column = getAvailableColumns(t).find(
              (col) => col.key === columnKey
            )
            return {
              accessor: (order: ChannelOrder) => {
                const currentOrderData = orderData[order.order_id]
                const delivery = getOrderDeliveryMetadata(currentOrderData)
                const orderStatus = orderStatuses[order.order_id] || 'Unknown'

                const getStatusBadge = (status: string) => {
                  switch (status) {
                    case 'COMPLETED':
                      return renderStatusBadge(
                        t(
                          'components.walletHistory.channelOrders.status.completed'
                        ),
                        'success'
                      )
                    case 'FAILED':
                      return renderStatusBadge(
                        t(
                          'components.walletHistory.channelOrders.status.failed'
                        ),
                        'danger'
                      )
                    case 'CREATED':
                      return renderStatusBadge(
                        t(
                          'components.walletHistory.channelOrders.status.created'
                        ),
                        'warning'
                      )
                    default:
                      return renderStatusBadge(
                        t(
                          'components.walletHistory.channelOrders.status.unknown'
                        ),
                        'default'
                      )
                  }
                }

                switch (columnKey) {
                  case 'order_id':
                    return renderCopyableField(
                      order.order_id,
                      true,
                      4,
                      'Order ID'
                    )
                  case 'amount_paid': {
                    if (!currentOrderData?.payment) return renderEmptyField()
                    const bolt11Amount = (currentOrderData.payment as any)
                      ?.bolt11?.order_total_sat
                    const onchainAmount = (currentOrderData.payment as any)
                      ?.onchain?.order_total_sat
                    const amount = bolt11Amount || onchainAmount
                    return (
                      <span className="font-semibold text-white">
                        {amount
                          ? `${amount.toLocaleString()} ${t('components.walletHistory.channelOrders.units.sats')}`
                          : renderEmptyField()}
                      </span>
                    )
                  }
                  case 'fees_paid': {
                    if (!currentOrderData?.payment) return renderEmptyField()
                    const bolt11Fee = (currentOrderData.payment as any)?.bolt11
                      ?.fee_total_sat
                    const onchainFee = (currentOrderData.payment as any)
                      ?.onchain?.fee_total_sat
                    const fee = bolt11Fee || onchainFee
                    return (
                      <span className="text-content-secondary">
                        {fee
                          ? `${fee.toLocaleString()} ${t('components.walletHistory.channelOrders.units.sats')}`
                          : renderEmptyField()}
                      </span>
                    )
                  }
                  case 'created_at':
                    return renderDateField(
                      currentOrderData?.created_at
                        ? new Date(currentOrderData.created_at).getTime()
                        : null
                    )
                  case 'status':
                    return getStatusBadge(orderStatus)
                  case 'asset_delivery_status': {
                    const deliveryStatus = delivery.asset_delivery_status
                    if (!deliveryStatus || deliveryStatus === 'NOT_REQUIRED') {
                      return renderEmptyField()
                    }

                    const getDeliveryStatusBadge = (status: string) => {
                      switch (status) {
                        case 'COMPLETED':
                          return renderStatusBadge(
                            t(
                              'components.walletHistory.channelOrders.deliveryStatus.delivered'
                            ),
                            'success'
                          )
                        case 'PENDING':
                          return renderStatusBadge(
                            t(
                              'components.walletHistory.channelOrders.deliveryStatus.pending'
                            ),
                            'warning'
                          )
                        case 'IN_PROGRESS':
                          return renderStatusBadge(
                            t(
                              'components.walletHistory.channelOrders.deliveryStatus.inProgress'
                            ),
                            'info'
                          )
                        case 'FAILED':
                          return renderStatusBadge(
                            t(
                              'components.walletHistory.channelOrders.deliveryStatus.failed'
                            ),
                            'danger'
                          )
                        case 'RATE_CHANGED':
                          return renderStatusBadge(
                            t(
                              'components.walletHistory.channelOrders.deliveryStatus.rateChanged'
                            ),
                            'warning'
                          )
                        default:
                          return renderStatusBadge(status, 'default')
                      }
                    }

                    return getDeliveryStatusBadge(deliveryStatus)
                  }
                  case 'actions': {
                    return (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          className="flex items-center justify-center w-8 h-8 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleViewDetails(order)
                          }}
                          title={t(
                            'components.walletHistory.channelOrders.actions.viewDetails'
                          )}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          className="flex items-center justify-center w-8 h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(order.order_id)
                          }}
                          title={t(
                            'components.walletHistory.channelOrders.actions.deleteOrder'
                          )}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  }
                  default: {
                    try {
                      const payload = JSON.parse(order.payload)
                      const value = payload[columnKey]
                      if (value === undefined || value === null)
                        return renderEmptyField()
                      if (typeof value === 'boolean')
                        return value ? t('common.yes') : t('common.no')
                      if (typeof value === 'number')
                        return value.toLocaleString()
                      if (typeof value === 'string' && value.length > 30) {
                        return `${value.substring(0, 30)}...`
                      }
                      return String(value)
                    } catch {
                      return renderEmptyField()
                    }
                  }
                }
              },
              className:
                columnKey === 'actions'
                  ? 'col-span-1 text-center'
                  : 'col-span-1',
              header:
                columnKey === 'actions'
                  ? t(
                      'components.walletHistory.channelOrders.columnHeaders.actions'
                    )
                  : column?.label || columnKey,
              headerClassName: columnKey === 'actions' ? 'text-center' : '',
            }
          })}
          data={filteredOrders}
          emptyState={
            <div className="text-center py-8 text-content-secondary bg-surface-overlay/30 rounded-lg border border-border-default">
              {orders.length === 0 ? (
                <p>{t('components.walletHistory.channelOrders.noOrders')}</p>
              ) : (
                <p>
                  {t('components.walletHistory.channelOrders.noOrdersSearch')}
                </p>
              )}
            </div>
          }
          gridClassName={`grid-cols-${selectedColumns.length}`}
        />
      )}

      {/* Order Detail Card */}
      {selectedOrder && (
        <OrderDetailCard
          isOpen={showDetailCard}
          onClose={closeDetailCard}
          onDelete={() => handleDelete(selectedOrder.order_id)}
          order={selectedOrder}
          orderData={orderData[selectedOrder.order_id]}
          orderStatus={orderStatuses[selectedOrder.order_id] || 'Unknown'}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        orderId={orderToDelete || ''}
      />
    </Card>
  )
}
