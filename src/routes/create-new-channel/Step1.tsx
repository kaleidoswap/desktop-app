import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Link,
  Plus,
  X,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { Controller, SubmitHandler, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Spinner } from '../../components/Spinner'
import { Button } from '../../components/ui'
import { NETWORK_DEFAULTS } from '../../constants/networks'
import { isValidPubkeyAndAddress } from '../../helpers/address'
import kaleidoswapPictogram from '../../assets/logo.svg'
import {
  NewChannelFormSchema,
  TNewChannelForm,
} from '../../slices/channel/channel.slice'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'

interface Props {
  onNext: VoidFunction
  onBack: VoidFunction
  formData: TNewChannelForm
  onFormUpdate: (updates: Partial<TNewChannelForm>) => void
  formError?: string | null
}

interface FormFields {
  pubKeyAndAddress: string
}

export const Step1 = ({ onNext, formData, onFormUpdate, formError }: Props) => {
  const { t } = useTranslation()
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
            message: t('createChannel.step1.invalidPeerFormat'),
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
        if (peers.peers) {
          setConnectedPeers(
            peers.peers
              .filter((p: any) => p.pubkey)
              .map((p: any) => ({ pubkey: p.pubkey ?? '' }))
          )
        } else {
          setConnectedPeers([])
        }
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
      setLocalError(t('createChannel.step1.invalidPeerFormat'))
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
        throw new Error(t('createChannel.step1.errorNetworkUnavailable'))
      }

      // Match the node's network to a NETWORK_DEFAULTS key case-insensitively
      // (e.g. "SignetCustom"/"signetcustom" both resolve to the "SignetCustom" key)
      const network = Object.keys(NETWORK_DEFAULTS).find(
        (key) => key.toLowerCase() === String(networkInfo.network).toLowerCase()
      )

      if (!network) {
        throw new Error(
          t('createChannel.step1.errorUnsupportedNetwork', {
            network: networkInfo.network,
          })
        )
      }

      const apiUrl = NETWORK_DEFAULTS[network].default_lsp_url
      if (!apiUrl) {
        throw new Error(t('createChannel.step1.errorNoLspUrl', { network }))
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
          : t('createChannel.step1.errorFetchLsp')
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
      return (peers.peers ?? []).some((peer: any) => peer.pubkey === pubkey)
    } catch (error) {
      return false
    }
  }

  const handleConnect = async () => {
    if (!selectedPeerInfo || !isValidPubkeyAndAddress(selectedPeerInfo)) {
      setLocalError(t('createChannel.step1.errorInvalidPeerString'))
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
          : t('createChannel.step1.errorConnectFailed')
      )
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="text-center mt-4 mb-8">
        <h3 className="text-3xl font-bold text-white">
          {t('createChannel.step1.title')}
        </h3>
      </div>

      {formError && (
        <div className="flex items-center gap-2 text-sm text-red-400 mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <p>{formError}</p>
        </div>
      )}

      <div className="flex gap-6">
        {/* Left card: Connect New Peer */}
        <div className="flex-1 bg-surface-overlay/50 backdrop-blur-sm rounded-xl border border-border-default/50 p-6 flex flex-col gap-5">
          <h4 className="text-lg font-semibold text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            {t('createChannel.step1.connectNewPeer')}
          </h4>

          {/* Suggested nodes */}
          <div>
            <div className="mb-3 text-sm font-medium text-white">
              {t('createChannel.step1.suggestedNodes')}
            </div>
            <div className="flex gap-3">
              <button
                className="flex items-center gap-2 p-3 rounded-lg border border-white/30 hover:border-white/50 hover:bg-white/5 transition-colors"
                disabled={isLoading}
                onClick={fetchLspInfo}
                type="button"
              >
                <img
                  alt="KaleidoSwap"
                  className="w-8 h-8"
                  src={kaleidoswapPictogram}
                />
              </button>
            </div>
            {isLoading && (
              <div className="flex items-center mt-3">
                <Spinner color="#15E99A" size={20} />
                <span className="ml-2 text-content-secondary text-sm">
                  {t('createChannel.step1.loadingLsp')}
                </span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-border-default/40" />

          {/* Connect manually subtitle + textarea */}
          <div className="flex flex-col gap-3">
            <div className="text-sm font-medium text-white">
              {t('createChannel.step1.connectManually')}
            </div>
            <Controller
              control={control}
              name="pubKeyAndAddress"
              render={({ field, fieldState }) => (
                <div className="space-y-2">
                  <input
                    className={`w-full px-3 py-2 bg-surface-overlay/50 rounded-xl border ${
                      fieldState.error || localError
                        ? 'border-red-500 focus:border-red-500'
                        : 'border-border-default focus:border-primary'
                    } focus:outline-none text-white placeholder:text-content-tertiary transition-colors duration-150 text-sm`}
                    placeholder="pubkey@host:port"
                    type="text"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e)
                      if (formState.errors.pubKeyAndAddress) {
                        clearErrors('pubKeyAndAddress')
                      }
                      if (localError) {
                        setLocalError('')
                      }
                      if (selectedFromConnected) {
                        setSelectedFromConnected('')
                      }
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
                  <p className="text-content-secondary text-xs">
                    {t('createChannel.step1.helpText')}
                  </p>
                  <p className="text-content-secondary/60 text-xs font-mono break-all">
                    e.g.
                    039257e0669aa5dea5df7c971048699a39f9023333d550a90800b9412f231ee8e7@lsp.signet.kaleidoswap.com:9735
                  </p>
                </div>
              )}
            />
          </div>

          <Button
            disabled={!formData.pubKeyAndAddress}
            icon={<ArrowRight className="w-4 h-4" />}
            iconPosition="right"
            isLoading={isLoading}
            size="md"
            type="submit"
            variant="primary"
          >
            {t('createChannel.step1.continue')}
          </Button>
        </div>

        {/* Right card: Connected Peers */}
        <div className="flex-1 bg-surface-overlay/50 backdrop-blur-sm rounded-xl border border-border-default/50 p-6">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Link className="w-5 h-5 text-primary" />
            {t('createChannel.step1.connectedPeers')}
          </h4>

          {loadingPeers ? (
            <div className="flex items-center justify-center py-4">
              <Spinner color="#15E99A" size={24} />
              <span className="ml-2 text-content-secondary">
                {t('createChannel.step1.loadingPeers')}
              </span>
            </div>
          ) : connectedPeers.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {connectedPeers.map((peer) => (
                <div
                  className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                    selectedFromConnected === peer.pubkey
                      ? 'border-primary bg-primary/10'
                      : 'border-border-default bg-surface-high/50 hover:border-primary/50 hover:bg-primary/5'
                  }`}
                  key={peer.pubkey}
                  onClick={() => handleSelectConnectedPeer(peer.pubkey)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-mono text-content-secondary break-all">
                        {peer.pubkey}
                      </div>
                    </div>
                    {selectedFromConnected === peer.pubkey && (
                      <CheckCircle className="w-5 h-5 text-primary ml-2 flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-content-secondary">
              {t('createChannel.step1.noPeers')}
            </div>
          )}
        </div>
      </div>

      {/* Connection Dialog */}
      {showConnectionDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-surface-overlay p-8 rounded-xl border border-border-default max-w-md w-full mx-4 relative">
            <button
              className="absolute top-4 right-4 text-content-tertiary hover:text-white transition-colors"
              onClick={() => setShowConnectionDialog(false)}
              type="button"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-2xl font-bold text-white mb-4">
              {t('createChannel.step1.connectDialog.title')}
            </h3>
            <p className="text-content-secondary mb-6">
              Would you like to connect to this peer to open a channel?
            </p>

            {isConnecting && (
              <div className="flex items-center justify-center mb-4">
                <Spinner color="#3B82F6" size={24} />
                <span className="ml-2 text-content-secondary">
                  {t('createChannel.step1.connectDialog.connecting')}
                </span>
              </div>
            )}

            <Button
              disabled={isConnecting}
              fullWidth
              icon={<Link className="w-4 h-4" />}
              iconPosition="right"
              isLoading={isConnecting}
              onClick={handleConnect}
              size="md"
              type="button"
              variant="primary"
            >
              {t('createChannel.step1.connectDialog.connect')}
            </Button>
          </div>
        </div>
      )}
    </form>
  )
}
