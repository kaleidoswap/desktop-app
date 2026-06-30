import { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { Globe, Link, Copy, ArrowRight, Loader2, Plus } from 'lucide-react'
import React, { useState, useEffect, useCallback } from 'react'
import CopyToClipboard from 'react-copy-to-clipboard'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import { RootState } from '../../app/store'
import { useAppDispatch, useAppSelector } from '../../app/store/hooks'
import { Spinner } from '../../components/Spinner'
import { Button } from '../../components/ui'
import { NETWORK_DEFAULTS } from '../../constants/networks'
import kaleidoswapPictogram from '../../assets/logo.svg'
import { makerApi } from '../../slices/makerApi/makerApi.slice'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { nodeSettingsActions } from '../../slices/nodeSettings/nodeSettings.slice'

interface Props {
  onNext: (data: { connectionUrl: string; success: boolean }) => void
}

export const Step1: React.FC<Props> = ({ onNext }) => {
  const { t } = useTranslation()

  // Left card: manual fetch
  const [tempLspUrl, setTempLspUrl] = useState('')
  const [manualConnectionUrl, setManualConnectionUrl] = useState('')
  const [isLoadingManual, setIsLoadingManual] = useState(false)

  // Right card: KaleidoSwap default
  const [kaleidoApiUrl, setKaleidoApiUrl] = useState('')
  const [kaleidoConnectionUrl, setKaleidoConnectionUrl] = useState('')
  const [isLoadingKaleido, setIsLoadingKaleido] = useState(false)
  const [kaleidoError, setKaleidoError] = useState<string | null>(null)
  const [selectedLspConnectionUrl, setSelectedLspConnectionUrl] = useState('')

  const [isConnecting, setIsConnecting] = useState(false)

  const [getInfo] = makerApi.endpoints.get_info.useLazyQuery()
  const [connectPeer] = nodeApi.endpoints.connectPeer.useMutation()
  const [listPeers] = nodeApi.endpoints.listPeers.useLazyQuery()
  const [getNetworkInfo] = nodeApi.endpoints.networkInfo.useLazyQuery()

  const dispatch = useAppDispatch()
  const currentAccount = useAppSelector(
    (state: RootState) => state.nodeSettings.data
  )
  const lspUrl =
    currentAccount.default_maker_url || currentAccount.default_lsp_url

  // Auto-load KaleidoSwap LSP on mount
  useEffect(() => {
    const initKaleido = async () => {
      setIsLoadingKaleido(true)
      setKaleidoError(null)
      try {
        const networkInfo = (await getNetworkInfo().unwrap()) as any
        if (!networkInfo?.network) {
          throw new Error(t('orderChannel.step1.networkInfoNotAvailable'))
        }

        const network = Object.keys(NETWORK_DEFAULTS).find(
          (key) =>
            key.toLowerCase() === String(networkInfo.network).toLowerCase()
        )
        if (!network) {
          throw new Error(
            t('orderChannel.step1.unsupportedNetwork', {
              network: networkInfo.network,
            })
          )
        }

        const defaultLspUrl = NETWORK_DEFAULTS[network].default_lsp_url
        if (!defaultLspUrl) {
          throw new Error(
            t('orderChannel.step1.noDefaultLspUrl', {
              network: networkInfo.network,
            })
          )
        }

        setKaleidoApiUrl(defaultLspUrl)

        dispatch(
          nodeSettingsActions.setNodeSettings({
            ...currentAccount,
            default_lsp_url: defaultLspUrl,
            default_maker_url: defaultLspUrl,
          })
        )
        await new Promise((resolve) => setTimeout(resolve, 100))

        const response = await getInfo().unwrap()
        if (response.lsp_connection_url) {
          setKaleidoConnectionUrl(response.lsp_connection_url)
        } else {
          throw new Error(t('orderChannel.step1.lspUrlMissing'))
        }
      } catch (error: any) {
        const msg =
          error instanceof Error
            ? error.message
            : t('orderChannel.step1.kaleidoLspFailed')
        setKaleidoError(msg)
      } finally {
        setIsLoadingKaleido(false)
      }
    }

    initKaleido()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchManualLspInfo = useCallback(async () => {
    if (!tempLspUrl.trim()) return

    setIsLoadingManual(true)
    setManualConnectionUrl('')

    try {
      if (tempLspUrl !== lspUrl) {
        dispatch(
          nodeSettingsActions.setNodeSettings({
            ...currentAccount,
            default_lsp_url: tempLspUrl,
            default_maker_url: tempLspUrl,
          })
        )
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      const response = await getInfo().unwrap()
      if (response.lsp_connection_url) {
        setManualConnectionUrl(response.lsp_connection_url)
        toast.success(t('orderChannel.step1.lspFetchSuccess'))
      } else {
        toast.error(t('orderChannel.step1.lspUrlMissing'))
        // Revert Redux
        dispatch(
          nodeSettingsActions.setNodeSettings({
            ...currentAccount,
            default_lsp_url: lspUrl,
            default_maker_url: lspUrl,
          })
        )
      }
    } catch (error: any) {
      let errorMessage = t('orderChannel.step1.lspFetchFailed')
      if (
        error?.status === 'TIMEOUT_ERROR' ||
        (error?.error &&
          typeof error.error === 'string' &&
          error.error.includes('timeout'))
      ) {
        errorMessage = t('orderChannel.step1.timeout')
      } else if (error?.status === 'FETCH_ERROR') {
        errorMessage = t('orderChannel.step1.networkError')
      } else if (error instanceof Error) {
        errorMessage = error.message
      }
      toast.error(errorMessage)
      // Revert Redux
      dispatch(
        nodeSettingsActions.setNodeSettings({
          ...currentAccount,
          default_lsp_url: lspUrl,
          default_maker_url: lspUrl,
        })
      )
    } finally {
      setIsLoadingManual(false)
    }
  }, [tempLspUrl, lspUrl, getInfo, dispatch, currentAccount, t])

  const connectAndProceed = useCallback(
    async (connectionUrl: string) => {
      setIsConnecting(true)
      try {
        const pubkey = connectionUrl.split('@')[0]
        const peersResp = await listPeers().unwrap()
        const isConnected = peersResp?.peers?.some(
          (p: any) => p.pubkey === pubkey
        )
        if (!isConnected) {
          const result = await connectPeer({
            peer_pubkey_and_addr: connectionUrl,
          })
          if ('error' in result) {
            const error = result.error as FetchBaseQueryError
            const msg =
              error.data &&
              typeof error.data === 'object' &&
              'error' in error.data
                ? String(error.data.error)
                : t('orderChannel.step1.failedToConnectPeer')
            throw new Error(msg)
          }
          toast.success(t('orderChannel.step1.connectedSuccess'))
        }
        onNext({ connectionUrl, success: true })
      } catch (error) {
        toast.error(`${error}`)
      } finally {
        setIsConnecting(false)
      }
    },
    [connectPeer, listPeers, onNext, t]
  )

  const handleManualContinue = () => {
    if (!manualConnectionUrl) return
    connectAndProceed(manualConnectionUrl)
  }

  const handleKaleidoContinue = () => {
    if (!selectedLspConnectionUrl) return
    if (kaleidoApiUrl) {
      dispatch(
        nodeSettingsActions.setNodeSettings({
          ...currentAccount,
          default_lsp_url: kaleidoApiUrl,
          default_maker_url: kaleidoApiUrl,
        })
      )
    }
    connectAndProceed(selectedLspConnectionUrl)
  }

  const ContinueButton = ({
    enabled,
    onClick,
    className = '',
  }: {
    enabled: boolean
    onClick: () => void
    className?: string
  }) => (
    <button
      className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all duration-200 text-sm ${className} ${
        enabled
          ? 'bg-primary hover:bg-primary-emphasis text-[#12131C] active:scale-95'
          : 'bg-primary/30 text-[#12131C]/50 cursor-not-allowed'
      }`}
      disabled={!enabled}
      onClick={onClick}
      type="button"
    >
      {t('orderChannel.step1.continueButton')}
      <ArrowRight className="w-4 h-4" />
    </button>
  )

  return (
    <div className="w-full relative">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mt-4 mb-8">
          <h3 className="text-3xl font-bold text-white">
            {t('orderChannel.step1.title')}
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left card: Connect New LSP */}
          <div className="bg-surface-overlay/80 backdrop-blur-sm p-6 rounded-xl border border-border-default/50 shadow-xl flex flex-col gap-4">
            <h4 className="text-lg font-semibold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Connect New LSP
            </h4>

            <div className="flex flex-col flex-1 gap-3">
              <div className="text-sm text-content-secondary">
                LSP server URL
              </div>
              <input
                className="w-full bg-surface-overlay/50 text-white px-3 py-2 rounded-xl border border-border-default focus:border-primary focus:outline-none transition-colors text-sm placeholder:text-content-tertiary"
                onChange={(e) => {
                  setTempLspUrl(e.target.value)
                  setManualConnectionUrl('')
                }}
                placeholder="https://..."
                value={tempLspUrl}
              />

              <Button
                className="border-white/30 hover:border-white/50"
                disabled={isLoadingManual || !tempLspUrl.trim()}
                fullWidth
                icon={
                  isLoadingManual ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Globe className="w-4 h-4" />
                  )
                }
                onClick={fetchManualLspInfo}
                size="sm"
                type="button"
                variant="outline"
              >
                {isLoadingManual
                  ? t('orderChannel.step1.fetching')
                  : t('orderChannel.step1.fetchLspInfo')}
              </Button>

              {manualConnectionUrl && (
                <>
                  <div className="border-t border-border-default/50" />
                  <div className="relative">
                    <textarea
                      className="w-full bg-surface-base/50 text-white px-3 py-2 pr-10 rounded-xl border border-border-default focus:border-primary focus:outline-none transition-colors h-24 resize-none font-mono text-xs placeholder:text-content-tertiary"
                      readOnly
                      value={manualConnectionUrl}
                    />
                    <CopyToClipboard
                      onCopy={() =>
                        toast.success(t('orderChannel.orderCopy'), {
                          autoClose: 2000,
                          position: 'bottom-right',
                        })
                      }
                      text={manualConnectionUrl}
                    >
                      <button
                        className="absolute right-2 top-2 p-1.5 bg-surface-high/80 hover:bg-surface-elevated rounded-lg transition-colors group"
                        title={t('orderChannel.step1.copyToClipboard')}
                        type="button"
                      >
                        <Copy className="w-3.5 h-3.5 text-content-secondary group-hover:text-white transition-colors" />
                      </button>
                    </CopyToClipboard>
                  </div>
                </>
              )}

              <ContinueButton
                className="mt-auto"
                enabled={!!manualConnectionUrl}
                onClick={handleManualContinue}
              />
            </div>
          </div>

          {/* Right card: Connected LSP */}
          <div className="bg-surface-overlay/80 backdrop-blur-sm p-6 rounded-xl border border-border-default/50 shadow-xl flex flex-col gap-4">
            <h4 className="text-lg font-semibold text-white flex items-center gap-2">
              <Link className="w-5 h-5 text-primary" />
              Connected LSP
            </h4>

            {isLoadingKaleido ? (
              <div className="flex-1 flex items-center justify-center h-40">
                <Spinner color="#15E99A" overlay={false} size={32} />
              </div>
            ) : kaleidoError ? (
              <div className="flex-1 flex flex-col gap-4">
                <p className="text-sm text-red-400">{kaleidoError}</p>
                <ContinueButton enabled={false} onClick={() => {}} />
              </div>
            ) : (
              <div className="flex flex-col flex-1 gap-3">
                <div className="border-t border-border-default/40" />
                <div
                  className={`rounded-lg border p-3 flex flex-col gap-3 cursor-pointer transition-all duration-200 ${
                    selectedLspConnectionUrl === kaleidoConnectionUrl
                      ? 'border-primary bg-primary/10'
                      : 'border-border-default hover:border-primary/50'
                  }`}
                  onClick={() =>
                    setSelectedLspConnectionUrl(
                      selectedLspConnectionUrl === kaleidoConnectionUrl
                        ? ''
                        : kaleidoConnectionUrl
                    )
                  }
                >
                  <div className="flex items-center gap-3">
                    <img
                      alt="KaleidoSwap"
                      className="w-8 h-8 flex-shrink-0"
                      src={kaleidoswapPictogram}
                    />
                    <span className="text-sm font-medium text-white">
                      KaleidoSwap LSP
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-border-default bg-surface-high/50">
                    <div className="text-xs text-content-secondary font-mono break-all">
                      {kaleidoApiUrl}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-border-default bg-surface-high/50">
                    <div className="text-xs text-content-secondary font-mono break-all">
                      {kaleidoConnectionUrl}
                    </div>
                  </div>
                </div>
                <div className="border-t border-border-default/40" />

                <ContinueButton
                  className="mt-auto"
                  enabled={!!selectedLspConnectionUrl}
                  onClick={handleKaleidoContinue}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {isConnecting && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
          <Spinner color="#15E99A" overlay={false} size={48} />
        </div>
      )}
    </div>
  )
}
