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
}> = ({ onClose, onConfirm, connectionUrl, isAlreadyConnected }) => (
  <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-2xl border border-gray-700/50 max-w-lg w-full mx-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
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
          {isAlreadyConnected ? 'Continue with LSP?' : 'Connect to LSP?'}
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
                  Already Connected
                </p>
                <p className="text-sm text-green-200/80">
                  You are already connected to this LSP. Would you like to
                  proceed with buying a channel?
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="mb-6 text-gray-300 text-lg">
          Establish a connection with the Lightning Service Provider to
          continue.
        </p>
      )}

      <div className="mb-6 p-4 bg-gray-900/50 rounded-xl border border-gray-700/50">
        <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">
          LSP Connection String
        </p>
        <p className="text-sm text-gray-300 break-all font-mono">
          {connectionUrl}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all duration-200 font-semibold transform active:scale-95"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className={`flex-1 px-6 py-3 text-white rounded-lg font-semibold transition-all duration-200 transform active:scale-95 ${
            isAlreadyConnected
              ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 shadow-lg shadow-green-900/30'
              : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-900/30'
          }`}
          onClick={onConfirm}
        >
          {isAlreadyConnected ? 'Continue' : 'Connect'}
        </button>
      </div>
    </div>
  </div>
)

export const Step1: React.FC<Props> = ({ onNext }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [showConnectPopup, setShowConnectPopup] = useState(false)
  const [isAlreadyConnected, setIsAlreadyConnected] = useState(false)
  const [connectionUrl, setConnectionUrl] = useState('')
  const [tempLspUrl, setTempLspUrl] = useState('')
  const [getInfo] = makerApi.endpoints.get_info.useLazyQuery()
  const [connectPeer] = nodeApi.endpoints.connectPeer.useMutation()
  const [listPeers] = nodeApi.endpoints.listPeers.useLazyQuery()
  const [getNetworkInfo] = nodeApi.endpoints.networkInfo.useLazyQuery()

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
        toast.error('Failed to check peer connection status')
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
        toast.success('LSP information fetched successfully')
      } else {
        toast.error('Failed to get LSP connection URL')
      }
    } catch (error) {
      console.error('Error fetching LSP info:', error)
      toast.error('Failed to fetch LSP information')
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
        } catch (error) {
          console.error('Error during initialization:', error)
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
      toast.error('Please wait for LSP connection URL to be fetched')
    }
  }

  const handleConnect = async () => {
    setShowConnectPopup(false)
    if (isAlreadyConnected) {
      toast.info('Already connected to LSP', {
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
      toast.success('Successfully connected to LSP')
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
      const networkInfo = await getNetworkInfo().unwrap()

      if (!networkInfo?.network) {
        throw new Error('Network information not available')
      }

      const network = networkInfo.network
        .toLowerCase()
        .replace(/^\w/, (c) => c.toUpperCase())

      if (!NETWORK_DEFAULTS[network]) {
        throw new Error(`Unsupported network: ${networkInfo.network}`)
      }

      const defaultLspUrl = NETWORK_DEFAULTS[network].default_lsp_url
      if (!defaultLspUrl) {
        throw new Error(
          `No default LSP URL configured for network: ${networkInfo.network}`
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
        toast.success('Kaleidoswap LSP information fetched successfully')
      } else {
        toast.error('Failed to get LSP connection URL')
      }
    } catch (error) {
      toast.error(`Failed to select Kaleidoswap LSP`)
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
        text: 'Connecting...',
      }
    }
    if (!connectionUrl) {
      return {
        className:
          'opacity-50 cursor-not-allowed bg-gradient-to-r from-gray-500 to-gray-600',
        disabled: true,
        text: 'Waiting for LSP URL...',
      }
    }
    if (isAlreadyConnected) {
      return {
        className:
          'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
        disabled: false,
        text: 'Continue with Connected LSP',
      }
    }
    return {
      className:
        'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
      disabled: false,
      text: 'Connect to LSP',
    }
  }

  return (
    <div className="w-full relative">
      {/* Initial Loading Overlay */}
      {isInitializing && (
        <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-2xl">
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-blue-400 animate-spin mx-auto mb-4" />
            <p className="text-white text-lg font-semibold">
              Checking LSP Connection...
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Please wait while we verify your connection
            </p>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 mb-3">
            Buy a New Channel from LSP
          </h2>
          <p className="text-gray-400 text-lg">
            Connect to a Lightning Service Provider to get started
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-between items-center mb-8 px-4">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/50">
              1
            </div>
            <div className="ml-3">
              <p className="font-semibold text-white">Connect LSP</p>
              <p className="text-xs text-blue-400">Current step</p>
            </div>
          </div>
          <div className="flex-1 mx-4 mt-2">
            <div className="h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 w-0 transition-all duration-500"></div>
            </div>
          </div>
          <div className="flex items-center opacity-40">
            <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white font-bold">
              2
            </div>
            <div className="ml-3">
              <p className="font-semibold text-white">Configure</p>
              <p className="text-xs text-gray-400">Set parameters</p>
            </div>
          </div>
          <div className="flex-1 mx-4 mt-2">
            <div className="h-1.5 bg-gray-700/50 rounded-full"></div>
          </div>
          <div className="flex items-center opacity-40">
            <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white font-bold">
              3
            </div>
            <div className="ml-3">
              <p className="font-semibold text-white">Payment</p>
              <p className="text-xs text-gray-400">Complete setup</p>
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
                    ? '✓ Already Connected to this LSP'
                    : 'LSP Ready to Connect'}
                </h3>
                <p
                  className={`text-sm mt-1 ${
                    isAlreadyConnected
                      ? 'text-green-200/80'
                      : 'text-blue-200/80'
                  }`}
                >
                  {isAlreadyConnected
                    ? 'You are already connected to this LSP. Click below to proceed or fetch a different LSP to connect to it instead.'
                    : 'LSP connection details loaded. Click below to connect and continue'}
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
                How Channel Opening Works
              </h3>
              <div className="space-y-2 text-blue-100/90">
                <p className="flex items-start gap-2">
                  <span className="text-blue-400 font-bold mt-0.5">1.</span>
                  <span>
                    Connect to a Lightning Service Provider (LSP) that will help
                    establish your channel
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-blue-400 font-bold mt-0.5">2.</span>
                  <span>
                    Configure your channel parameters including capacity and
                    balance distribution
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-blue-400 font-bold mt-0.5">3.</span>
                  <span>
                    Make a payment to cover the channel creation costs and
                    initial balance
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* LSP URL Configuration */}
          <div className="bg-gray-800/80 backdrop-blur-sm p-6 rounded-xl border border-gray-700/50 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <label className="text-lg font-semibold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-400" />
                LSP Server URL
              </label>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <input
                  className="w-full bg-gray-900/50 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 focus:outline-none transition-all"
                  onChange={(e) => handleDefaultLspUrlChange(e)}
                  placeholder="Enter LSP URL (e.g., http://localhost:8000)"
                  value={tempLspUrl}
                />
              </div>

              <button
                className={`w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
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
                    <span>Fetching...</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4" />
                    <span>Fetch LSP Info</span>
                  </>
                )}
              </button>

              <p className="text-sm text-gray-400">
                Enter your LSP server URL or use the default Kaleidoswap LSP
                below
              </p>
            </div>

            {/* Kaleidoswap LSP Button */}
            <div className="mt-4 pt-4 border-t border-gray-700/50">
              <button
                className={`w-full bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 p-4 rounded-lg transition-all duration-300 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={isLoading}
                onClick={handleKaleidoswapSelect}
                title="Use default Kaleidoswap LSP"
              >
                <div className="flex flex-col items-center gap-2">
                  <KaleidoswapBoxIcon />
                  <span className="text-sm font-medium text-gray-300">
                    Use Default Kaleidoswap LSP
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* LSP Connection String */}
          <div className="bg-gray-800/80 backdrop-blur-sm p-6 rounded-xl border border-gray-700/50 shadow-xl">
            <label className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Link className="w-5 h-5 text-purple-400" />
              LSP Connection String
            </label>
            <div className="relative">
              <textarea
                className="w-full bg-gray-900/50 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 focus:outline-none transition-all h-32 resize-none font-mono text-sm"
                placeholder="Connection string will appear here..."
                readOnly
                value={connectionUrl || 'Waiting for LSP connection details...'}
              />
              {connectionUrl && (
                <CopyToClipboard
                  onCopy={() =>
                    toast.success('Connection string copied!', {
                      autoClose: 2000,
                      position: 'bottom-right',
                    })
                  }
                  text={connectionUrl}
                >
                  <button
                    className="absolute right-3 top-3 p-2 bg-gray-700/80 hover:bg-gray-600 rounded-lg transition-colors group"
                    title="Copy to clipboard"
                    type="button"
                  >
                    <Copy className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                  </button>
                </CopyToClipboard>
              )}
            </div>
            <p className="mt-3 text-sm text-gray-400">
              This unique connection URL identifies your LSP peer
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-center">
          <button
            className={`
              group px-10 py-4 text-white rounded-xl text-lg font-bold
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
        />
      )}
    </div>
  )
}
