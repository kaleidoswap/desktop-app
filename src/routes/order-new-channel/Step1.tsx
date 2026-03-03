import { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import {
  Globe,
  Link,
  Copy,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import React, { useState, useEffect, useCallback } from 'react'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import { RootState } from '../../app/store'
import { useAppDispatch, useAppSelector } from '../../app/store/hooks'
import { NETWORK_DEFAULTS } from '../../constants/networks'
import { KaleidoswapBoxIcon } from '../../icons/KaleidoswapBox'
import { makerApi } from '../../slices/makerApi/makerApi.slice'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { nodeSettingsActions } from '../../slices/nodeSettings/nodeSettings.slice'

interface Props {
  onNext: (data: { connectionUrl: string; success: boolean }) => void
}

const ConnectPopup: React.FC<{
  onClose: () => void
  onConfirm: () => void
  connectionUrl: string
  isAlreadyConnected: boolean
  t: any
}> = ({ onClose, onConfirm, connectionUrl, isAlreadyConnected, t }) => (
  <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-2xl border border-border-default/50 max-w-lg w-full mx-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-4 mb-6">
        {isAlreadyConnected ? (
          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
            <CheckCircle className="text-green-400" size={28} />
          </div>
        ) : (
          <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Link className="text-blue-400" size={28} />
          </div>
        )}
        <h3 className="text-2xl font-bold text-white">
          {isAlreadyConnected
            ? t('orderChannel.step1.alreadyConnected')
            : t('orderChannel.step1.modalTitle')}
        </h3>
      </div>

      {isAlreadyConnected ? (
        <>
          <div className="mb-6 p-4 bg-green-900/20 border border-green-700/50 rounded-xl">
            <div className="flex items-start gap-3">
              <CheckCircle
                className="text-green-400 flex-shrink-0 mt-0.5"
                size={20}
              />
              <div>
                <p className="font-semibold text-green-300 mb-1">
                  {t('orderChannel.step1.alreadyConnectedMessage')}
                </p>
                <p className="text-sm text-green-200/80">
                  {t('orderChannel.step1.alreadyConnectedPopup')}
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="mb-6 text-content-secondary text-lg">
          {t('orderChannel.step1.establishConnection')}
        </p>
      )}

      <div className="mb-6 p-4 bg-surface-base/50 rounded-xl border border-border-default/50">
        <p className="text-xs text-content-secondary mb-2 font-semibold uppercase tracking-wide">
          {t('orderChannel.step1.lspConnectionLabel')}
        </p>
        <p className="text-sm text-content-secondary break-all font-mono">
          {connectionUrl}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          className="flex-1 px-6 py-3 bg-surface-high hover:bg-surface-elevated text-white rounded-lg transition-all duration-200 font-semibold transform active:scale-95"
          onClick={onClose}
        >
          {t('orderChannel.step1.cancelButton')}
        </button>
        <button
          className="flex-1 px-6 py-3 bg-primary hover:bg-primary-emphasis text-primary-foreground rounded-lg font-semibold transition-all duration-200 transform active:scale-95 shadow-lg shadow-primary/20"
          onClick={onConfirm}
        >
          {isAlreadyConnected
            ? t('orderChannel.step1.continueButton')
            : t('orderChannel.step1.connectButton')}
        </button>
      </div>
    </div>
  </div>
)

export const Step1: React.FC<Props> = ({ onNext }) => {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [showConnectPopup, setShowConnectPopup] = useState(false)
  const [isAlreadyConnected, setIsAlreadyConnected] = useState(false)
  const [connectionUrl, setConnectionUrl] = useState('')
  const [tempLspUrl, setTempLspUrl] = useState('')
  const [getInfo] = makerApi.endpoints.get_info.useLazyQuery()
  const [connectPeer] = nodeApi.endpoints.connectPeer.useMutation()
  const [listPeers] = nodeApi.endpoints.listPeers.useLazyQuery()
  const [getNetworkInfo] = nodeApi.useLazyNodeInfoQuery()

  const dispatch = useAppDispatch()
  const currentAccount = useAppSelector(
    (state: RootState) => state.nodeSettings.data
  )
  // Use maker URL as source of truth since that's what the API uses
  const lspUrl =
    currentAccount.default_maker_url || currentAccount.default_lsp_url

  const checkPeerConnection = useCallback(
    async (connectionUrl: string): Promise<boolean> => {
      try {
        const pubkey = connectionUrl.split('@')[0]
        const peersResponse = await listPeers().unwrap()
        if (peersResponse?.peers) {
          const isConnected = peersResponse.peers.some(
            (peer) => peer.pubkey === pubkey
          )
          setIsAlreadyConnected(isConnected)
          return isConnected
        }
        return false
      } catch (error) {
        toast.error(t('orderChannel.step1.checkPeerFailed'))
        console.error('Failed to check peer connection status:', error)
        return false
      }
    },
    [listPeers]
  )

  const fetchLspInfo = useCallback(async () => {
    if (!tempLspUrl || !tempLspUrl.trim()) {
      return
    }

    setIsLoading(true)
    setConnectionUrl('')
    setIsAlreadyConnected(false)
    setShowConnectPopup(false)

    try {
      // Update Redux store with the new LSP URL first so getInfo uses it
      if (tempLspUrl !== lspUrl) {
        dispatch(
          nodeSettingsActions.setNodeSettings({
            ...currentAccount,
            default_lsp_url: tempLspUrl,
            default_maker_url: tempLspUrl, // Also update maker URL for API calls
          })
        )
        // Wait a bit for the Redux update to propagate
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      const response = await getInfo().unwrap()
      if (response.lsp_connection_url) {
        setConnectionUrl(response.lsp_connection_url)
        // Just check connection status silently, don't show popup
        await checkPeerConnection(response.lsp_connection_url)
        toast.success(t('orderChannel.step1.lspFetchSuccess'))
      } else {
        toast.error(t('orderChannel.step1.lspUrlMissing'))
      }
    } catch (error: any) {
      console.error('Error fetching LSP info:', error)

      // Check if it's a timeout error
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
      }

      toast.error(errorMessage)

      // Revert to previous LSP URL on error
      if (tempLspUrl !== lspUrl) {
        dispatch(
          nodeSettingsActions.setNodeSettings({
            ...currentAccount,
            default_lsp_url: lspUrl,
            default_maker_url: lspUrl, // Also revert maker URL
          })
        )
      }
    } finally {
      setIsLoading(false)
    }
  }, [
    tempLspUrl,
    lspUrl,
    getInfo,
    checkPeerConnection,
    dispatch,
    currentAccount,
  ])

  // Initial check on mount
  useEffect(() => {
    const initializeComponent = async () => {
      setIsInitializing(true)
      setTempLspUrl(lspUrl)

      // If we have a default LSP URL, check connection
      if (lspUrl && lspUrl.trim()) {
        try {
          const response = await getInfo().unwrap()
          if (response.lsp_connection_url) {
            setConnectionUrl(response.lsp_connection_url)
            const isConnected = await checkPeerConnection(
              response.lsp_connection_url
            )

            // If already connected, show popup asking if user wants to proceed
            if (isConnected) {
              setShowConnectPopup(true)
            }
          }
        } catch (error: any) {
          console.error('Error during initialization:', error)
          // Don't show a toast on initialization error - user can try again manually
        }
      }

      setIsInitializing(false)
    }

    initializeComponent()
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleNext = async () => {
    if (connectionUrl) {
      setShowConnectPopup(true)
    } else {
      toast.error(t('orderChannel.step1.waitForConnectionUrl'))
    }
  }

  const handleConnect = async () => {
    setShowConnectPopup(false)
    if (isAlreadyConnected) {
      toast.info(t('orderChannel.step1.alreadyConnectedToast'), {
        autoClose: 2000,
      })
      onNext({ connectionUrl, success: true })
      return
    }
    setIsLoading(true)
    try {
      const response = await connectPeer({
        peer_pubkey_and_addr: connectionUrl,
      })
      if ('error' in response) {
        const error = response.error as FetchBaseQueryError
        const errorMessage =
          error.data && typeof error.data === 'object' && 'error' in error.data
            ? String(error.data.error)
            : 'Failed to connect to peer'
        throw new Error(errorMessage)
      }

      // LSP URL was already updated when fetching info, connection succeeded
      toast.success(t('orderChannel.step1.connectedSuccess'))
      onNext({ connectionUrl, success: true })
    } catch (error) {
      toast.error(`${error}`)
      setShowConnectPopup(false)
      // Keep the URL even on connection failure - user might want to retry
    } finally {
      setIsLoading(false)
    }
  }

  const handleKaleidoswapSelect = async () => {
    setIsLoading(true)
    try {
      const networkInfo = (await getNetworkInfo().unwrap()) as any

      if (!networkInfo?.network) {
        throw new Error(t('orderChannel.step1.networkInfoNotAvailable'))
      }

      const network = networkInfo.network
        .toLowerCase()
        .replace(/^\w/, (c: string) => c.toUpperCase())

      if (!NETWORK_DEFAULTS[network]) {
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

      setTempLspUrl(defaultLspUrl)

      // Reset connection state
      setConnectionUrl('')
      setIsAlreadyConnected(false)
      setShowConnectPopup(false)

      // Update Redux store with the new LSP URL
      dispatch(
        nodeSettingsActions.setNodeSettings({
          ...currentAccount,
          default_lsp_url: defaultLspUrl,
          default_maker_url: defaultLspUrl, // Also update maker URL for API calls
        })
      )
      // Wait a bit for the Redux update to propagate
      await new Promise((resolve) => setTimeout(resolve, 100))

      const response = await getInfo().unwrap()
      if (response.lsp_connection_url) {
        setConnectionUrl(response.lsp_connection_url)
        // Just check connection status silently, don't show popup
        await checkPeerConnection(response.lsp_connection_url)
        toast.success(t('orderChannel.step1.kaleidoLspFetched'))
      } else {
        toast.error(t('orderChannel.step1.lspUrlMissing'))
      }
    } catch (error: any) {
      // Check if it's a timeout error
      let errorMessage = t('orderChannel.step1.kaleidoLspFailed')
      if (
        error?.status === 'TIMEOUT_ERROR' ||
        (error?.error &&
          typeof error.error === 'string' &&
          error.error.includes('timeout'))
      ) {
        errorMessage = t('orderChannel.step1.timeout')
      } else if (error?.status === 'FETCH_ERROR') {
        errorMessage = t('orderChannel.step1.networkError')
      }

      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDefaultLspUrlChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    // Just update the temp URL
    setTempLspUrl(e.target.value)
    // Reset connection state when URL changes
    setConnectionUrl('')
    setIsAlreadyConnected(false)
  }

  const handleFetchLspInfo = async () => {
    await fetchLspInfo()
  }

  const getButtonState = () => {
    if (isLoading) {
      return {
        className: 'opacity-50 cursor-not-allowed',
        disabled: true,
        text: t('orderChannel.step1.connecting'),
      }
    }
    if (!connectionUrl) {
      return {
        className:
          'opacity-50 cursor-not-allowed bg-gradient-to-r from-gray-500 to-gray-600',
        disabled: true,
        text: t('orderChannel.step1.waitingForLspUrl'),
      }
    }
    if (isAlreadyConnected) {
      return {
        className: 'bg-primary hover:bg-primary-emphasis text-primary-foreground',
        disabled: false,
        text: t('orderChannel.step1.continueWithConnectedLsp'),
      }
    }
    return {
      className: 'bg-primary hover:bg-primary-emphasis text-primary-foreground',
      disabled: false,
      text: t('orderChannel.step1.connectButton'),
    }
  }

  return (
    <div className="w-full relative">
      {/* Initial Loading Overlay */}
      {isInitializing && (
        <div className="absolute inset-0 bg-surface-base/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-2xl">
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-blue-400 animate-spin mx-auto mb-4" />
            <p className="text-white text-lg font-semibold">
              {t('orderChannel.step1.checkingConnection')}
            </p>
            <p className="text-content-secondary text-sm mt-2">
              {t('orderChannel.step1.verifyingConnection')}
            </p>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 mb-3">
            {t('orderChannel.step1.title')}
          </h2>
          <p className="text-content-secondary text-lg">
            {t('orderChannel.step1.subtitle')}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-between items-center mb-8 px-4">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/50">
              1
            </div>
            <div className="ml-3">
              <p className="font-semibold text-white">
                {t('orderChannel.step1.connectLsp')}
              </p>
              <p className="text-xs text-blue-400">
                {t('orderChannel.step1.currentStep')}
              </p>
            </div>
          </div>
          <div className="flex-1 mx-4 mt-2">
            <div className="h-1.5 bg-surface-high/50 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 w-0 transition-all duration-500"></div>
            </div>
          </div>
          <div className="flex items-center opacity-40">
            <div className="w-10 h-10 bg-surface-high rounded-full flex items-center justify-center text-white font-bold">
              2
            </div>
            <div className="ml-3">
              <p className="font-semibold text-white">
                {t('orderChannel.step2.step2Label')}
              </p>
              <p className="text-xs text-content-secondary">
                {t('orderChannel.step1.setParameters')}
              </p>
            </div>
          </div>
          <div className="flex-1 mx-4 mt-2">
            <div className="h-1.5 bg-surface-high/50 rounded-full"></div>
          </div>
          <div className="flex items-center opacity-40">
            <div className="w-10 h-10 bg-surface-high rounded-full flex items-center justify-center text-white font-bold">
              3
            </div>
            <div className="ml-3">
              <p className="font-semibold text-white">
                {t('orderChannel.step3.step3Label')}
              </p>
              <p className="text-xs text-content-secondary">
                {t('orderChannel.step1.completeSetup')}
              </p>
            </div>
          </div>
        </div>

        {/* Connection Status Banner */}
        {connectionUrl && (
          <div
            className={`mb-6 p-5 rounded-xl border-2 transition-all duration-300 ${
              isAlreadyConnected
                ? 'bg-green-900/20 border-green-600/50 shadow-lg shadow-green-900/20'
                : 'bg-blue-900/20 border-blue-600/50 shadow-lg shadow-blue-900/20'
            }`}
          >
            <div className="flex items-center gap-4">
              {isAlreadyConnected ? (
                <CheckCircle className="w-8 h-8 text-green-400 flex-shrink-0" />
              ) : isLoading ? (
                <Loader2 className="w-8 h-8 text-blue-400 flex-shrink-0 animate-spin" />
              ) : (
                <AlertCircle className="w-8 h-8 text-blue-400 flex-shrink-0" />
              )}
              <div className="flex-1">
                <h3
                  className={`text-lg font-semibold ${
                    isAlreadyConnected ? 'text-green-300' : 'text-blue-300'
                  }`}
                >
                  {isAlreadyConnected
                    ? `✓ ${t('orderChannel.step1.alreadyConnectedMessage')}`
                    : t('orderChannel.step1.lspReadyConnect')}
                </h3>
                <p
                  className={`text-sm mt-1 ${
                    isAlreadyConnected
                      ? 'text-green-200/80'
                      : 'text-blue-200/80'
                  }`}
                >
                  {isAlreadyConnected
                    ? t('orderChannel.step1.alreadyConnectedInfo')
                    : t('orderChannel.step1.lspReadyInfo')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-700/30 p-6 rounded-xl mb-6 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">
                {t('orderChannel.step1.howItWorks')}
              </h3>
              <div className="space-y-2 text-blue-100/90">
                <p className="flex items-start gap-2">
                  <span className="text-blue-400 font-bold mt-0.5">1.</span>
                  <span>{t('orderChannel.step1.step1Description')}</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-blue-400 font-bold mt-0.5">2.</span>
                  <span>{t('orderChannel.step1.step2Description')}</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-blue-400 font-bold mt-0.5">3.</span>
                  <span>{t('orderChannel.step1.step3Description')}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* LSP URL Configuration */}
          <div className="bg-surface-overlay/80 backdrop-blur-sm p-6 rounded-xl border border-border-default/50 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <label className="text-lg font-semibold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-400" />
                {t('orderChannel.step1.lspServerUrl')}
              </label>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <input
                  className="w-full bg-surface-base/50 text-white px-4 py-3 rounded-lg border border-border-default focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 focus:outline-none transition-all"
                  onChange={(e) => handleDefaultLspUrlChange(e)}
                  placeholder={t('orderChannel.step1.lspUrlPlaceholder')}
                  value={tempLspUrl}
                />
              </div>

              <button
                className={`w-full bg-primary hover:bg-primary-emphasis text-primary-foreground px-4 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                  isLoading || !tempLspUrl.trim()
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
                disabled={isLoading || !tempLspUrl.trim()}
                onClick={handleFetchLspInfo}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('orderChannel.step1.fetching')}</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4" />
                    <span>{t('orderChannel.step1.fetchLspInfo')}</span>
                  </>
                )}
              </button>

              <p className="text-sm text-content-secondary">
                {t('orderChannel.step1.enterLspInstructions')}
              </p>
            </div>

            {/* Kaleidoswap LSP Button */}
            <div className="mt-4 pt-4 border-t border-border-default/50">
              <button
                className={`w-full bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 p-4 rounded-lg transition-all duration-300 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={isLoading}
                onClick={handleKaleidoswapSelect}
                title={t('orderChannel.step1.useDefaultKaleidoLsp')}
              >
                <div className="flex flex-col items-center gap-2">
                  <KaleidoswapBoxIcon />
                  <span className="text-sm font-medium text-content-secondary">
                    {t('orderChannel.step1.useDefaultKaleidoLsp')}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* LSP Connection String */}
          <div className="bg-surface-overlay/80 backdrop-blur-sm p-6 rounded-xl border border-border-default/50 shadow-xl">
            <label className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Link className="w-5 h-5 text-purple-400" />
              {t('orderChannel.step1.connectionStringLabel')}
            </label>
            <div className="relative">
              <textarea
                className="w-full bg-surface-base/50 text-white px-4 py-3 rounded-lg border border-border-default focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all h-32 resize-none font-mono text-sm"
                placeholder={t(
                  'orderChannel.step1.connectionStringPlaceholder'
                )}
                readOnly
                value={
                  connectionUrl ||
                  t('orderChannel.step1.connectionStringWaiting')
                }
              />
              {connectionUrl && (
                <CopyToClipboard
                  onCopy={() =>
                    toast.success(t('orderChannel.orderCopy'), {
                      autoClose: 2000,
                      position: 'bottom-right',
                    })
                  }
                  text={connectionUrl}
                >
                  <button
                    className="absolute right-3 top-3 p-2 bg-surface-high/80 hover:bg-surface-elevated rounded-lg transition-colors group"
                    title={t('orderChannel.step1.copyToClipboard')}
                    type="button"
                  >
                    <Copy className="w-4 h-4 text-content-secondary group-hover:text-white transition-colors" />
                  </button>
                </CopyToClipboard>
              )}
            </div>
            <p className="mt-3 text-sm text-content-secondary">
              {t('orderChannel.step1.connectionStringInfo')}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-center">
          <button
            className={`
              group px-10 py-4 text-primary-foreground rounded-xl text-lg font-bold
              transition-all duration-300 transform
              focus:ring-4 focus:ring-offset-2 focus:ring-offset-gray-900 focus:outline-none 
              flex items-center justify-center gap-3 min-w-[280px]
              ${getButtonState().disabled ? 'cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
              ${getButtonState().className}
              ${!getButtonState().disabled && !isLoading ? 'shadow-lg hover:shadow-xl' : ''}
            `}
            disabled={getButtonState().disabled}
            onClick={handleNext}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{getButtonState().text}</span>
              </>
            ) : (
              <>
                <span>{getButtonState().text}</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
      </div>

      {showConnectPopup && (
        <ConnectPopup
          connectionUrl={connectionUrl}
          isAlreadyConnected={isAlreadyConnected}
          onClose={() => setShowConnectPopup(false)}
          onConfirm={handleConnect}
          t={t}
        />
      )}
    </div>
  )
}
