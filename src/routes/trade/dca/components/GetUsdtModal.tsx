import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  X,
  ArrowDownRight,
  Plus,
  PlusCircle,
  ShoppingCart,
  Upload,
  Trash2,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'

import {
  getModalPortalTarget,
  getModalPositionClass,
} from '../../../../helpers/modalPortal'
import { Spinner } from '../../../../components/Spinner'
import kaleidoswapPictogram from '../../../../assets/logo.svg'
import { makerApi } from '../../../../slices/makerApi/makerApi.slice'
import { nodeApi } from '../../../../slices/nodeApi/nodeApi.slice'
import { uiSliceActions } from '../../../../slices/ui/ui.slice'
import { useAppDispatch } from '../../../../app/store/hooks'
import {
  CREATE_NEW_CHANNEL_PATH,
  ORDER_CHANNEL_PATH,
  TRADE_DCA_PATH,
} from '../../../../app/router/paths'

interface GetUsdtModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function GetUsdtModal({ isOpen, onClose }: GetUsdtModalProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const [kaleidoConnectionUrl, setKaleidoConnectionUrl] = useState('')
  const [isLoadingLsp, setIsLoadingLsp] = useState(false)
  const [lspError, setLspError] = useState<string | null>(null)

  const [getInfo] = makerApi.endpoints.get_info.useLazyQuery()

  const { data: assetsData } = nodeApi.endpoints.listAssets.useQuery(
    undefined,
    { skip: !isOpen }
  )
  const usdtAsset = (assetsData?.nia ?? []).find(
    (a: any) => a.ticker === 'USDT'
  )

  const { data: balanceData } = nodeApi.endpoints.assetBalance.useQuery(
    { asset_id: usdtAsset?.asset_id ?? '' },
    { skip: !isOpen || !usdtAsset?.asset_id }
  )

  const precision = usdtAsset?.precision ?? 6
  const spendableRaw = balanceData?.spendable ?? 0
  const spendableUsdt = spendableRaw / Math.pow(10, precision)
  const hasOnChain = spendableRaw > 0

  useEffect(() => {
    if (!isOpen) return
    setLspError(null)
    setIsLoadingLsp(true)

    getInfo().then((res) => {
      setIsLoadingLsp(false)
      if (res.data?.lsp_connection_url) {
        setKaleidoConnectionUrl(res.data.lsp_connection_url)
      } else {
        setLspError(t('dca.getUsdt.errorLspInfo', 'Failed to load LSP info'))
      }
    })
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleCreateChannel() {
    if (!usdtAsset?.asset_id) return
    onClose()
    navigate(CREATE_NEW_CHANNEL_PATH, {
      state: {
        preselectedAssetId: usdtAsset.asset_id,
        returnTo: TRADE_DCA_PATH,
      },
    })
  }

  function handleBuyUsdt() {
    onClose()
    navigate(ORDER_CHANNEL_PATH, {
      state: {
        preselectedAssetId: usdtAsset?.asset_id,
        returnTo: TRADE_DCA_PATH,
      },
    })
  }

  function handleAddNewLsp() {
    onClose()
    navigate(ORDER_CHANNEL_PATH)
  }

  function handleDepositUsdt() {
    if (!usdtAsset?.asset_id) return
    onClose()
    dispatch(
      uiSliceActions.setModal({ assetId: usdtAsset.asset_id, type: 'deposit' })
    )
  }

  if (!isOpen) return null

  const pos = getModalPositionClass()

  return createPortal(
    <div
      className={`${pos} inset-0 z-50 flex items-center justify-center p-4 bg-surface-base/70 backdrop-blur-sm`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl bg-surface-base border border-border-subtle rounded-2xl shadow-2xl shadow-black/30 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ArrowDownRight className="w-5 h-5 text-emerald-400" />
            {t('dca.getUsdt.title', 'Receive USDT')}
          </h2>
          <button
            className="p-1.5 rounded-md text-content-secondary hover:text-content-primary hover:bg-surface-overlay transition-colors"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — 2-column grid */}
        <div className="p-5 grid grid-cols-2 gap-4">
          {/* ── LEFT: Create Channel ── */}
          <div className="bg-surface-overlay/80 backdrop-blur-sm rounded-xl border border-border-default/50 p-4 flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-primary flex-shrink-0" />
              {t('dca.getUsdt.createChannelTitle', 'Create Channel')}
            </h4>
            <p className="text-xs text-content-secondary leading-relaxed">
              {t(
                'dca.getUsdt.createChannelDesc',
                'Create a RGB Lightning Channel with your own USDT on-chain balance.'
              )}
            </p>

            <div className="border-t border-border-default/40 mt-1" />

            {/* On-chain balance */}
            <div className="rounded-lg bg-surface-high/60 border border-border-default/40 px-3 py-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-content-secondary uppercase tracking-wider">
                {t('dca.getUsdt.onChainBalance', 'On-chain USDT')}
              </span>
              <span
                className={`text-xs font-bold tabular-nums ${hasOnChain ? 'text-emerald-400' : 'text-content-tertiary'}`}
              >
                {hasOnChain
                  ? `${spendableUsdt.toLocaleString('en-US', { maximumFractionDigits: 2 })} USDT`
                  : t('dca.getUsdt.noBalance', 'No balance')}
              </span>
            </div>

            <div className="flex flex-col gap-2 mt-auto">
              <button
                className="w-full inline-flex h-10 items-center justify-between gap-2 rounded-xl bg-[#15E99A] hover:bg-[#12C97E] px-4 text-sm font-semibold text-gray-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!hasOnChain}
                onClick={handleCreateChannel}
              >
                <span>
                  {t('dca.getUsdt.createChannelBtn', 'Create USDT Channel')}
                </span>
                <Plus className="w-4 h-4 flex-shrink-0" />
              </button>

              <button
                className="w-full inline-flex h-9 items-center justify-between gap-2 rounded-xl px-4 text-xs font-semibold text-content-secondary hover:text-content-primary transition-colors"
                onClick={handleDepositUsdt}
              >
                <span className="flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  {t('dca.getUsdt.depositBtn', 'Deposit USDT')}
                </span>
                <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              </button>
            </div>
          </div>

          {/* ── RIGHT: Buy from LSP ── */}
          <div className="bg-surface-overlay/80 backdrop-blur-sm rounded-xl border border-border-default/50 p-4 flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-primary flex-shrink-0" />
              {t('dca.getUsdt.buyFromLspTitle', 'Buy Channel from LSP')}
            </h4>
            <p className="text-xs text-content-secondary leading-relaxed">
              {t(
                'dca.getUsdt.buyFromLspDesc',
                'Receive USDT from a Lightning Service Provider on an existing RGB Lightning channel.'
              )}
            </p>

            {/* Connected LSP section */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-semibold text-content-tertiary uppercase tracking-widest">
                {t('dca.getUsdt.connectedLsp', 'Connected LSP')}
              </span>

              {isLoadingLsp ? (
                <div className="flex items-center justify-center py-4">
                  <Spinner color="#15E99A" overlay={false} size={22} />
                </div>
              ) : lspError ? (
                <p className="text-xs text-red-400">{lspError}</p>
              ) : (
                <div className="rounded-lg border border-primary/60 bg-primary/10 p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <img
                      alt="KaleidoSwap"
                      className="w-6 h-6 flex-shrink-0"
                      src={kaleidoswapPictogram}
                    />
                    <span className="text-xs font-medium text-white flex-1">
                      KaleidoSwap LSP
                    </span>
                    <div className="relative group/disc flex-shrink-0">
                      <button
                        className="rounded-lg p-1.5 text-content-secondary transition-colors hover:bg-status-danger/15 hover:text-status-danger"
                        onClick={handleAddNewLsp}
                        type="button"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute bottom-full mb-1.5 right-0 bg-surface-high text-content-primary text-[10px] rounded-md py-0.5 px-1.5 opacity-0 group-hover/disc:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border-default/40 shadow-lg z-20">
                        Change LSP
                      </div>
                    </div>
                  </div>
                  {kaleidoConnectionUrl && (
                    <div className="p-2 rounded-md border border-border-default bg-surface-high/50">
                      <p className="text-[10px] text-content-secondary font-mono break-all leading-relaxed">
                        {kaleidoConnectionUrl}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 mt-auto">
              <button
                className="w-full inline-flex h-10 items-center justify-between gap-2 rounded-xl bg-[#15E99A] hover:bg-[#12C97E] px-4 text-sm font-semibold text-gray-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={isLoadingLsp || !!lspError}
                onClick={handleBuyUsdt}
              >
                <span>{t('dca.getUsdt.buyUsdtBtn', 'Buy USDT Channel')}</span>
                <Plus className="w-4 h-4 flex-shrink-0" />
              </button>

              <button
                className="w-full inline-flex h-9 items-center justify-between gap-2 rounded-xl px-4 text-xs font-semibold text-content-secondary hover:text-content-primary transition-colors"
                onClick={handleAddNewLsp}
              >
                <span>{t('dca.getUsdt.addLspBtn', 'Add new LSP')}</span>
                <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    getModalPortalTarget()
  )
}
