import { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { Globe, Link, Copy, ArrowRight, CheckCircle } from 'lucide-react'
import React, { useState, useEffect } from 'react'
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
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-blue-dark p-8 rounded-lg max-w-md w-full">
      <h3 className="text-2xl font-semibold mb-4">Connect to LSP</h3>
      {isAlreadyConnected ? (
        <>
          <div className="mb-6 flex items-center bg-green-800 text-white p-4 rounded-lg">
            <CheckCircle className="text-green-300 mr-3" size={24} />
            <p className="font-medium">
              You are already connected to this LSP.
            </p>
          </div>
        </>
      ) : (
        <p className="mb-6 text-gray-300">
          Do you want to connect to the LSP at this address?
        </p>
      )}
      <p className="mb-6 text-sm bg-gray-700 p-4 rounded-lg break-all">
        {connectionUrl}
      </p>
      <div className="flex justify-end space-x-4">
        {isAlreadyConnected ? (
          <button
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            onClick={onConfirm}
          >
            OK
          </button>
        ) : (
          <>
            <button
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors font-medium"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              onClick={onConfirm}
            >
              Connect
            </button>
          </>
        )}
      </div>
    </div>
  </div>
)

export const Step1: React.FC<Props> = ({ onNext }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [showConnectPopup, setShowConnectPopup] = useState(false)
  const [isAlreadyConnected, setIsAlreadyConnected] = useState(false)
  const [connectionUrl, setConnectionUrl] = useState('')
  const [getInfo] = makerApi.endpoints.get_info.useLazyQuery()
  const [connectPeer] = nodeApi.endpoints.connectPeer.useMutation()
  const [listPeers] = nodeApi.endpoints.listPeers.useLazyQuery()
  const [getNetworkInfo] = nodeApi.endpoints.networkInfo.useLazyQuery()

  const dispatch = useAppDispatch()
  const currentAccount = useAppSelector(
    (state: RootState) => state.nodeSettings.data
  )
  const lspUrl = currentAccount.default_lsp_url

  useEffect(() => {
    fetchLspInfo()
  }, [lspUrl, getInfo])

  const fetchLspInfo = async () => {
    if (lspUrl) {
      setIsLoading(true)
      try {
        const response = await getInfo().unwrap()
        if (response.lsp_connection_url) {
          setConnectionUrl(response.lsp_connection_url)
          checkPeerConnection(response.lsp_connection_url)
        } else {
          toast.error('Failed to get LSP connection URL')
        }
      } catch (error) {
        console.error('Error fetching LSP info:', error)
        toast.error('Failed to fetch LSP information')
      } finally {
        setIsLoading(false)
      }
    }
  }

  const checkPeerConnection = async (connectionUrl: string) => {
    try {
      const pubkey = connectionUrl.split('@')[0]
      const peersResponse = await listPeers().unwrap()
      if (peersResponse?.peers) {
        const isConnected = peersResponse.peers.some(
          (peer) => peer.pubkey === pubkey
        )
        setIsAlreadyConnected(isConnected)
      }
    } catch (error) {
      toast.error('Failed to check peer connection status')
    }
  }

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
      toast.success('Successfully connected to LSP')
      onNext({ connectionUrl, success: true })
    } catch (error) {
      toast.error(`${error}`)
      setShowConnectPopup(false)
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

      dispatch(
        nodeSettingsActions.setNodeSettings({
          ...currentAccount,
          default_lsp_url: defaultLspUrl,
        })
      )

      await fetchLspInfo()
    } catch (error) {
      toast.error(`Failed to select Kaleidoswap LSP`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDefaultLspUrlChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setIsLoading(true)
    try {
      dispatch(
        nodeSettingsActions.setNodeSettings({
          ...currentAccount,
          default_lsp_url: e.target.value,
        })
      )

      await fetchLspInfo()
    } catch (error) {
      toast.error('Failed to select Kaleidoswap LSP')
    } finally {
      setIsLoading(false)
    }
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
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            Buy a New Channel from LSP
          </h2>
          <p className="text-gray-400 mt-2">
            Complete these steps to open your channel
          </p>
        </div>

        <div className="flex justify-between mb-8">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
              1
            </div>
            <div className="ml-3">
              <p className="font-medium text-white">Connect LSP</p>
              <p className="text-sm text-gray-400">Current step</p>
            </div>
          </div>
          <div className="flex-1 mx-4 mt-5">
            <div className="h-1 bg-gray-700">
              <div className="h-1 bg-blue-500 w-0"></div>
            </div>
          </div>
          <div className="flex items-center opacity-50">
            <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white font-bold">
              2
            </div>
            <div className="ml-3">
              <p className="font-medium text-white">Configure</p>
              <p className="text-sm text-gray-400">Set parameters</p>
            </div>
          </div>
          <div className="flex-1 mx-4 mt-5">
            <div className="h-1 bg-gray-700"></div>
          </div>
          <div className="flex items-center opacity-50">
            <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white font-bold">
              3
            </div>
            <div className="ml-3">
              <p className="font-medium text-white">Payment</p>
              <p className="text-sm text-gray-400">Complete setup</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-900/50 border border-blue-700/50 p-6 rounded-xl mb-8">
          <h3 className="text-xl font-semibold text-white mb-4">
            How Channel Opening Works
          </h3>
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="w-6 h-6 bg-blue-800 rounded-full flex items-center justify-center text-sm font-bold text-white mr-3 mt-1">
                1
              </div>
              <p className="text-blue-100">
                Connect to a Lightning Service Provider (LSP) that will help
                establish your channel
              </p>
            </div>
            <div className="flex items-start">
              <div className="w-6 h-6 bg-blue-800 rounded-full flex items-center justify-center text-sm font-bold text-white mr-3 mt-1">
                2
              </div>
              <p className="text-blue-100">
                Configure your channel parameters including capacity and balance
                distribution
              </p>
            </div>
            <div className="flex items-start">
              <div className="w-6 h-6 bg-blue-800 rounded-full flex items-center justify-center text-sm font-bold text-white mr-3 mt-1">
                3
              </div>
              <p className="text-blue-100">
                Make a payment to cover the channel creation costs and initial
                balance
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg">
          <label className="block text-lg font-medium mb-2">
            Current LSP URL
          </label>
          <div className="flex items-center space-x-4">
            <div className="relative flex-grow">
              <Globe
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                className="w-full bg-gray-700 text-white pl-10 pr-3 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                onChange={handleDefaultLspUrlChange}
                value={lspUrl}
              />
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-400">
            You can modify the LSP URL here or click the Kaleidoswap button to
            use the default LSP.
          </p>
          <div className="flex flex-col items-center">
            <button
              className={`bg-gray-700 hover:bg-gray-600 p-3 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 flex flex-col items-center justify-center ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={isLoading}
              onClick={handleKaleidoswapSelect}
              title="Use default Kaleidoswap LSP"
            >
              <div className="flex flex-col items-center">
                <KaleidoswapBoxIcon />
              </div>
            </button>
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg mt-6">
          <label className="block text-lg font-medium mb-2">
            LSP Connection String
          </label>
          <div className="relative">
            <Link className="absolute left-3 top-3 text-gray-400" size={20} />
            <textarea
              className="w-full bg-gray-700 text-white pl-10 pr-12 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all h-24 resize-none"
              readOnly
              value={connectionUrl}
            />
            <CopyToClipboard
              onCopy={() =>
                toast.success('LSP connection string copied to clipboard')
              }
              text={connectionUrl}
            >
              <button className="absolute right-3 top-3" type="button">
                <Copy
                  className="text-gray-400 hover:text-white transition-colors"
                  size={20}
                />
              </button>
            </CopyToClipboard>
          </div>
          <p className="mt-2 text-sm text-gray-400">
            This is the unique connection URL for your LSP.
          </p>
        </div>

        <div className="flex justify-center mt-8">
          <button
            className={`
              px-8 py-4 text-white rounded-lg
              transition-all duration-300 ease-in-out transform hover:scale-105
              focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:outline-none 
              flex items-center justify-center space-x-2 text-lg font-semibold
              ${getButtonState().className}
            `}
            disabled={getButtonState().disabled}
            onClick={handleNext}
          >
            {isLoading ? (
              <>
                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
                {getButtonState().text}
              </>
            ) : (
              <>
                <span>{getButtonState().text}</span>
                <ArrowRight size={20} />
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
