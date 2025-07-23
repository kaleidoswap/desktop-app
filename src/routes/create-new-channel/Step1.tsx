import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { Users, CheckCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Controller, SubmitHandler, useForm } from 'react-hook-form'

import { Spinner } from '../../components/Spinner'
import { Button } from '../../components/ui'
import { NETWORK_DEFAULTS } from '../../constants/networks'
import { isValidPubkeyAndAddress } from '../../helpers/address'
import { KaleidoswapBoxIcon } from '../../icons/KaleidoswapBox'
import {
  NewChannelFormSchema,
  TNewChannelForm,
} from '../../slices/channel/channel.slice'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'

interface Props {
  onNext: VoidFunction
  formData: TNewChannelForm
  onFormUpdate: (updates: Partial<TNewChannelForm>) => void
}

interface FormFields {
  pubKeyAndAddress: string
}

export const Step1 = ({ onNext, formData, onFormUpdate }: Props) => {
  const [isLoading, setIsLoading] = useState(false)
  const [localError, setLocalError] = useState('')
  const [showConnectionDialog, setShowConnectionDialog] = useState(false)
  const [selectedPeerInfo, setSelectedPeerInfo] = useState<string>('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectedPeers, setConnectedPeers] = useState<
    Array<{ pubkey: string }>
  >([])
  const [loadingPeers, setLoadingPeers] = useState(true)
  const [selectedFromConnected, setSelectedFromConnected] = useState<string>('')

  const [getNetworkInfo] = nodeApi.endpoints.networkInfo.useLazyQuery()
  const [connectPeer] = nodeApi.endpoints.connectPeer.useMutation()
  const [listPeers] = nodeApi.endpoints.listPeers.useLazyQuery()

  const { handleSubmit, control, formState, clearErrors, setValue } =
    useForm<FormFields>({
      defaultValues: {
        pubKeyAndAddress: formData.pubKeyAndAddress || '',
      },
      mode: 'onChange',
      resolver: zodResolver(
        NewChannelFormSchema.pick({ pubKeyAndAddress: true }).refine(
          (data) => {
            // Allow pubkey-only for connected peers or full address format
            const isPubkeyOnly =
              data.pubKeyAndAddress.length === 66 &&
              /^[0-9a-f]+$/i.test(data.pubKeyAndAddress)
            return (
              isPubkeyOnly || isValidPubkeyAndAddress(data.pubKeyAndAddress)
            )
          },
          {
            message:
              'Invalid peer format. Expected: <66-char-hex-pubkey>@hostname:port or valid pubkey',
            path: ['pubKeyAndAddress'],
          }
        )
      ),
    })

  // Load connected peers on component mount
  useEffect(() => {
    const loadConnectedPeers = async () => {
      setLoadingPeers(true)
      try {
        const peers = await listPeers().unwrap()
        setConnectedPeers(peers.peers || [])
      } catch (error) {
        console.error('Failed to load connected peers:', error)
      } finally {
        setLoadingPeers(false)
      }
    }

    loadConnectedPeers()
  }, [listPeers])

  const onSubmit: SubmitHandler<FormFields> = async (data) => {
    // Clear any previous errors
    setLocalError('')

    const isPubkeyOnly =
      data.pubKeyAndAddress.length === 66 &&
      /^[0-9a-f]+$/i.test(data.pubKeyAndAddress)

    if (!isPubkeyOnly && !isValidPubkeyAndAddress(data.pubKeyAndAddress)) {
      setLocalError(
        'Invalid peer format. Expected format: <66-char-hex-pubkey>@hostname:port or valid pubkey'
      )
      return
    }

    // First update the form data
    onFormUpdate({
      pubKeyAndAddress: data.pubKeyAndAddress,
    })

    // If it's a pubkey-only (from connected peers), we can proceed directly
    if (isPubkeyOnly) {
      onNext()
      return
    }

    // For full address format, check connection
    const isConnected = await checkPeerConnection(data.pubKeyAndAddress)

    if (!isConnected) {
      setSelectedPeerInfo(data.pubKeyAndAddress)
      setShowConnectionDialog(true)
      return
    }

    // If already connected, proceed to next step
    onNext()
  }

  const handleSelectConnectedPeer = (pubkey: string) => {
    setSelectedFromConnected(pubkey)
    // For connected peers, we only have the pubkey, so we use it as the peer info
    // This will work for existing connections but won't include address info
    const peerInfo = pubkey
    setValue('pubKeyAndAddress', peerInfo)
    onFormUpdate({
      pubKeyAndAddress: peerInfo,
    })

    // Since the peer is already connected, we can proceed directly
    onNext()
  }

  const fetchLspInfo = async () => {
    setIsLoading(true)
    setLocalError('')
    try {
      const networkInfo = await getNetworkInfo().unwrap()

      if (!networkInfo?.network) {
        throw new Error('Network information not available')
      }

      // Normalize network name to match NETWORK_DEFAULTS keys
      const network = networkInfo.network
        .toLowerCase()
        .replace(/^\w/, (c) => c.toUpperCase())

      if (!NETWORK_DEFAULTS[network]) {
        throw new Error(`Unsupported network: ${networkInfo.network}`)
      }

      const apiUrl = NETWORK_DEFAULTS[network].default_lsp_url
      if (!apiUrl) {
        throw new Error(`No default LSP URL configured for network: ${network}`)
      }

      const response = await axios.get(`${apiUrl}api/v1/lsps1/get_info`)
      const connectionUrl = response.data.lsp_connection_url

      // Update both form state and form data
      setValue('pubKeyAndAddress', connectionUrl)
      onFormUpdate({
        pubKeyAndAddress: connectionUrl,
      })

      // Check if we need to connect
      const isConnected = await checkPeerConnection(connectionUrl)
      if (!isConnected) {
        setSelectedPeerInfo(connectionUrl)
        setShowConnectionDialog(true)
      } else {
        onNext()
      }
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : 'Failed to fetch LSP connection information'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const checkPeerConnection = async (peerInfo: string) => {
    try {
      const peers = await listPeers().unwrap()
      // Handle both pubkey-only and pubkey@host:port formats
      const pubkey = peerInfo.includes('@') ? peerInfo.split('@')[0] : peerInfo
      return peers.peers.some((peer) => peer.pubkey === pubkey)
    } catch (error) {
      return false
    }
  }

  const handleConnect = async () => {
    if (!selectedPeerInfo || !isValidPubkeyAndAddress(selectedPeerInfo)) {
      setLocalError('Invalid peer connection string')
      return
    }

    setIsConnecting(true)
    try {
      await connectPeer({ peer_pubkey_and_addr: selectedPeerInfo }).unwrap()

      // Update form data and proceed
      onFormUpdate({
        pubKeyAndAddress: selectedPeerInfo,
      })
      setValue('pubKeyAndAddress', selectedPeerInfo)
      setShowConnectionDialog(false)
      onNext()
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : 'Failed to connect to peer. Please try again.'
      )
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="text-center mb-10">
        <h3 className="text-3xl font-bold text-white mb-4">
          Peer Connection - Step 1
        </h3>
        <p className="text-gray-400">
          Select from connected peers or enter new connection details.
        </p>
      </div>

      {/* Connected Peers Section */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-blue-500" />
          <h4 className="text-lg font-semibold text-white">Connected Peers</h4>
        </div>

        {loadingPeers ? (
          <div className="flex items-center justify-center py-4">
            <Spinner color="#3B82F6" size={24} />
            <span className="ml-2 text-gray-400">
              Loading connected peers...
            </span>
          </div>
        ) : connectedPeers.length > 0 ? (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {connectedPeers.map((peer) => (
              <div
                className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                  selectedFromConnected === peer.pubkey
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-600 bg-gray-700/50 hover:border-blue-400 hover:bg-blue-500/5'
                }`}
                key={peer.pubkey}
                onClick={() => handleSelectConnectedPeer(peer.pubkey)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono text-gray-300 truncate">
                      {peer.pubkey}
                    </div>
                  </div>
                  {selectedFromConnected === peer.pubkey && (
                    <CheckCircle className="w-5 h-5 text-blue-500 ml-2" />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-400">
            No peers currently connected. You can connect to a new peer below.
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="text-center py-4 font-medium text-gray-400">or</div>

      {/* Manual Peer Connection Section */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-8">
        <h4 className="text-lg font-semibold text-white mb-4">
          Connect to New Peer
        </h4>

        <Controller
          control={control}
          name="pubKeyAndAddress"
          render={({ field, fieldState }) => (
            <div className="space-y-2">
              <textarea
                className={`w-full px-4 py-3 bg-gray-700 text-white rounded-lg border 
                  ${
                    fieldState.error || localError
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-gray-600 focus:border-blue-500'
                  } 
                  focus:ring-1 focus:ring-blue-500 font-mono text-sm min-h-[6rem] resize-none`}
                placeholder="Example: 039257e0669aa5dea5df7c971048699a39f9023333d550a90800b9412f231ee8e7@lsp.signet.kaleidoswap.com:9735"
                {...field}
                onChange={(e) => {
                  field.onChange(e)
                  if (formState.errors.pubKeyAndAddress) {
                    clearErrors('pubKeyAndAddress')
                  }
                  if (localError) {
                    setLocalError('')
                  }
                  // Clear selected from connected when manually typing
                  if (selectedFromConnected) {
                    setSelectedFromConnected('')
                  }
                  // Update form data as user types
                  onFormUpdate({
                    pubKeyAndAddress: e.target.value,
                  })
                }}
              />
              {(fieldState.error || localError) && (
                <p className="text-red-500 text-sm">
                  {localError || fieldState.error?.message}
                </p>
              )}
              <p className="text-gray-400 text-xs">
                The connection string should be a 66-character hex public key,
                followed by @ symbol, then the host address, and port number
                (e.g. :9735)
              </p>
            </div>
          )}
        />

        <div className="text-center py-6 font-medium text-gray-400">or</div>

        <div className="mb-6 text-center font-medium text-white">
          Select from Suggested Nodes
        </div>

        <div className="flex justify-center space-x-6">
          <button
            className="flex items-center space-x-2 p-4 rounded-lg border border-gray-700 hover:border-blue-500 transition-colors"
            disabled={isLoading}
            onClick={fetchLspInfo}
            type="button"
          >
            <KaleidoswapBoxIcon />
          </button>
        </div>

        {isLoading && (
          <div className="flex justify-center items-center mt-4">
            <Spinner color="#3B82F6" size={24} />
            <span className="ml-2 text-gray-400">
              Loading LSP information...
            </span>
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-between">
        <div></div>
        <Button
          disabled={!formData.pubKeyAndAddress && !selectedFromConnected}
          isLoading={isLoading}
          size="md"
          type="submit"
          variant="primary"
        >
          Continue
        </Button>
      </div>

      {/* Connection Dialog */}
      {showConnectionDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold text-white mb-4">
              Connect to Peer
            </h3>
            <p className="text-gray-400 mb-6">
              Would you like to connect to this peer before opening a channel?
            </p>

            {isConnecting && (
              <div className="flex items-center justify-center mb-4">
                <Spinner color="#3B82F6" size={24} />
                <span className="ml-2 text-gray-400">
                  Connecting to peer...
                </span>
              </div>
            )}

            <div className="flex justify-end space-x-4">
              <Button
                onClick={() => setShowConnectionDialog(false)}
                size="md"
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                disabled={isConnecting}
                isLoading={isConnecting}
                onClick={handleConnect}
                size="md"
                type="button"
                variant="primary"
              >
                Connect
              </Button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
