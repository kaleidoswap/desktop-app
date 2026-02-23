import { Plus, Loader, Zap, Wallet, Paintbrush } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { CREATEUTXOS_PATH } from '../../app/router/paths'
import { formatBitcoinAmount } from '../../helpers/number'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { getAssignmentAmount } from '../../utils/rgbUtils'

interface UTXOManagementModalProps {
  onClose: () => void
  bitcoinUnit: string
}

interface UTXOSummary {
  totalColorable: number
  totalColored: number
  totalNormal: number
  colorableCount: number
  coloredCount: number
  normalCount: number
}

export const UTXOManagementModal = ({
  onClose,
  bitcoinUnit,
}: UTXOManagementModalProps) => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [listUnspents, { data: unspentsData, isLoading }] =
    nodeApi.useLazyListUnspentsQuery()

  useEffect(() => {
    listUnspents()
    const intervalId = setInterval(
      () => listUnspents(),
      10000
    )
    return () => clearInterval(intervalId)
  }, [listUnspents])

  const { colorableUtxos, coloredUtxos, normalUtxos, summary } = useMemo(() => {
    if (!unspentsData?.unspents) {
      return {
        colorableUtxos: [],
        coloredUtxos: [],
        normalUtxos: [],
        summary: {
          colorableCount: 0,
          coloredCount: 0,
          normalCount: 0,
          totalColorable: 0,
          totalColored: 0,
          totalNormal: 0,
        },
      }
    }

    // Separate UTXOs into:
    // 1. Colorable (can be used for RGB assets but not yet allocated)
    // 2. Colored (already have RGB allocations)
    // 3. Normal (can't be used for RGB assets)

    const colored = unspentsData.unspents.filter(
      (u) =>
        u.utxo?.colorable &&
        Array.isArray(u.rgb_allocations) &&
        u.rgb_allocations.length > 0
    )
    const colorable = unspentsData.unspents.filter(
      (u) =>
        u.utxo?.colorable &&
        (!Array.isArray(u.rgb_allocations) || u.rgb_allocations.length <= 0)
    )
    const normal = unspentsData.unspents.filter((u) => !u.utxo?.colorable)

    const summary: UTXOSummary = {
      colorableCount: colorable.length,
      coloredCount: colored.length,
      normalCount: normal.length,
      totalColorable: colorable.reduce((sum, u) => sum + (u.utxo?.btc_amount || 0), 0),
      totalColored: colored.reduce((sum, u) => sum + (u.utxo?.btc_amount || 0), 0),
      totalNormal: normal.reduce((sum, u) => sum + (u.utxo?.btc_amount || 0), 0),
    }

    return {
      colorableUtxos: colorable,
      coloredUtxos: colored,
      normalUtxos: normal,
      summary,
    }
  }, [unspentsData])

  const handleCreateUTXOs = () => {
    onClose()
    navigate(CREATEUTXOS_PATH)
  }

  const getUtxoStatusLabel = (unspent: any) => {
    if (!unspent.utxo?.colorable) {
      return t('utxoManagement.status.normal')
    }
    if (unspent.rgb_allocations && unspent.rgb_allocations.length > 0) {
      return t('utxoManagement.status.colored')
    }
    return t('utxoManagement.status.colorable')
  }

  const getUtxoStatusStyle = (unspent: any) => {
    if (!unspent.utxo?.colorable) {
      return 'bg-blue-500/20 text-blue-400'
    }
    if (unspent.rgb_allocations && unspent.rgb_allocations.length > 0) {
      return 'bg-purple-500/20 text-purple-400'
    }
    return 'bg-green-500/20 text-green-400'
  }

  const UTXOCard = ({ unspent }: { unspent: any; index: number }) => (
    <div
      className="bg-slate-800/50 rounded-xl border border-slate-700 p-4"
      key={unspent.utxo.outpoint}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="text-sm font-medium text-slate-300">
          {unspent.utxo?.outpoint?.split(':')[0]}
        </div>
        <div
          className={`px-2 py-1 rounded-lg text-xs font-medium ${getUtxoStatusStyle(unspent)}`}
        >
          {getUtxoStatusLabel(unspent)}
        </div>
      </div>
      <div className="text-lg font-medium text-white">
        {formatBitcoinAmount(parseInt(unspent.utxo?.btc_amount || '0'), bitcoinUnit)}{' '}
        {bitcoinUnit}
      </div>
      {unspent.rgb_allocations && unspent.rgb_allocations.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-700">
          <div className="text-sm text-slate-400">
            {t('utxoManagement.card.rgbAllocations')}
          </div>
          {unspent.rgb_allocations.map((allocation: any, i: number) => (
            <div
              className="text-sm text-slate-300 flex justify-between"
              key={i}
            >
              <span className="truncate">{allocation.asset_id}</span>
              <span>{getAssignmentAmount(allocation.assignment)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const summaryCards = [
    {
      bullets: t('utxoManagement.summary.colorable.bullets', {
        returnObjects: true,
      }) as string[],
      count: summary.colorableCount,
      dotClass: 'bg-green-500',
      icon: <Zap className="w-5 h-5 text-green-500" />,
      key: 'colorable',
      title: t('utxoManagement.summary.colorable.title'),
      total: summary.totalColorable,
    },
    {
      bullets: t('utxoManagement.summary.colored.bullets', {
        returnObjects: true,
      }) as string[],
      count: summary.coloredCount,
      dotClass: 'bg-purple-500',
      icon: <Paintbrush className="w-5 h-5 text-purple-500" />,
      key: 'colored',
      title: t('utxoManagement.summary.colored.title'),
      total: summary.totalColored,
    },
    {
      bullets: t('utxoManagement.summary.normal.bullets', {
        returnObjects: true,
      }) as string[],
      count: summary.normalCount,
      dotClass: 'bg-blue-500',
      icon: <Wallet className="w-5 h-5 text-blue-500" />,
      key: 'normal',
      title: t('utxoManagement.summary.normal.title'),
      total: summary.totalNormal,
    },
  ]

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 pt-20"
      onClick={handleBackdropClick}
    >
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 max-w-2xl w-full m-4 max-h-[calc(100vh-120px)] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">
            {t('utxoManagement.title')}
          </h2>
          <button
            className="text-slate-400 hover:text-white transition-colors"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {summaryCards.map((card) => (
            <div
              className="bg-slate-800/50 rounded-xl border border-slate-700 p-4"
              key={card.key}
            >
              <div className="flex items-center gap-2 mb-2">
                {card.icon}
                <h3 className="text-lg font-medium text-white">{card.title}</h3>
              </div>
              <div className="flex flex-col gap-1.5">
                {card.bullets.map((bullet) => (
                  <div
                    className="flex items-center gap-2 text-sm text-slate-300"
                    key={bullet}
                  >
                    <div className={`w-2 h-2 rounded-full ${card.dotClass}`} />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
              <div className="text-2xl font-bold text-white mt-3">
                {formatBitcoinAmount(card.total, bitcoinUnit)} {bitcoinUnit}
              </div>
              <div className="text-sm text-slate-400 mt-1">
                {t('utxoManagement.summary.countLabel', { count: card.count })}
              </div>
            </div>
          ))}
        </div>

        <button
          className="w-full mb-6 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl 
                   font-medium transition-colors flex items-center justify-center gap-2"
          onClick={handleCreateUTXOs}
        >
          <Plus className="w-5 h-5" />
          {t('utxoManagement.actions.create')}
        </button>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : unspentsData?.unspents && unspentsData.unspents.length > 0 ? (
          <div className="space-y-6">
            {/* Colorable UTXOs Section */}
            {colorableUtxos.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-green-500" />
                  {t('utxoManagement.sections.colorable')}
                </h3>
                <div className="space-y-3">
                  {colorableUtxos.map((unspent, index) => (
                    <UTXOCard
                      index={index}
                      key={unspent.utxo?.outpoint || index}
                      unspent={unspent}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Colored UTXOs Section */}
            {coloredUtxos.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                  <Paintbrush className="w-5 h-5 text-purple-500" />
                  {t('utxoManagement.sections.colored')}
                </h3>
                <div className="space-y-3">
                  {coloredUtxos.map((unspent, index) => (
                    <UTXOCard
                      index={index}
                      key={unspent.utxo?.outpoint || index}
                      unspent={unspent}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Normal UTXOs Section */}
            {normalUtxos.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-blue-500" />
                  {t('utxoManagement.sections.normal')}
                </h3>
                <div className="space-y-3">
                  {normalUtxos.map((unspent, index) => (
                    <UTXOCard
                      index={index}
                      key={unspent.utxo?.outpoint || index}
                      unspent={unspent}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">
            {t('utxoManagement.empty')}
          </div>
        )}
      </div>
    </div>
  )
}
