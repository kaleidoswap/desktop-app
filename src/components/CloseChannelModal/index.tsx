import { X, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'react-toastify'

import { nodeApi, NodeApiError } from '../../slices/nodeApi/nodeApi.slice'

interface CloseChannelModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  channelId: string
  peerPubkey: string
}

export const CloseChannelModal: React.FC<CloseChannelModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  channelId,
  peerPubkey,
}) => {
  const [closeChannel] = nodeApi.endpoints.closeChannel.useLazyQuery()
  const [forceClose, setForceClose] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestForceClose, setSuggestForceClose] = useState(false)

  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isClosing) {
      onClose()
    }
  }

  const handleConfirm = async () => {
    setIsClosing(true)
    setError(null)
    setSuggestForceClose(false)

    try {
      const response = await closeChannel({
        channel_id: channelId,
        force: forceClose,
        peer_pubkey: peerPubkey,
      })

      // Check if the response contains an error
      if (response.error) {
        // Type guard to check if it's a NodeApiError
        const isNodeApiError = (err: any): err is NodeApiError =>
          err && typeof err === 'object' && 'data' in err

        const nodeError = isNodeApiError(response.error) ? response.error : null
        const errorMessage = nodeError?.data?.error || 'Unknown error'

        setError(errorMessage)
        handleErrorMessage(errorMessage)
        return
      }

      toast.success(
        `Channel ${channelId.substring(0, 8)}... closing ${forceClose ? '(force)' : ''} initiated successfully`
      )

      if (onSuccess) {
        onSuccess()
      }

      onClose()
    } catch (error: any) {
      console.error('Error closing channel:', error)

      const errorMessage = error?.data?.error || 'Unknown error'
      setError(errorMessage)

      handleErrorMessage(errorMessage)
    } finally {
      setIsClosing(false)
    }
  }

  // Helper function to handle error messaging
  const handleErrorMessage = (errorMessage: string) => {
    // Check if the error suggests a force close is needed
    const forceClosePatterns = [
      'force-close instead',
      'peer is disconnected',
      'waiting on a monitor update',
      'Cannot begin shutdown',
      'Channel unavailable',
      'maybe force-close instead',
    ]

    const shouldSuggestForceClose = forceClosePatterns.some((pattern) =>
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    )

    if (shouldSuggestForceClose) {
      setSuggestForceClose(true)
      setForceClose(true)
    } else {
      toast.error(`Failed to close channel: ${errorMessage}`)
    }
  }

  const resetAndClose = () => {
    setError(null)
    setSuggestForceClose(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl border border-gray-700/50">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-white">Close Channel</h3>
          <button
            className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700/50"
            disabled={isClosing}
            onClick={(e) => {
              e.stopPropagation()
              resetAndClose()
            }}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        {suggestForceClose ? (
          <div className="mb-5">
            <div className="flex items-center p-4 text-amber-300 bg-amber-900/30 rounded-lg border border-amber-900/30 mb-4">
              <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
              <div>
                <p className="font-medium">
                  Channel cannot be closed cooperatively
                </p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
            <p className="text-gray-300">
              Would you like to force close this channel instead? Force closing:
            </p>
            <ul className="text-sm text-gray-400 space-y-1 list-disc pl-5 mt-2">
              <li>Does not require your peer to be online</li>
              <li>Will lock your funds in a timelock contract temporarily</li>
              <li>May result in higher fees</li>
            </ul>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <p className="text-gray-300">
                Are you sure you want to close this channel?
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Closing a channel will settle the current balance to your
                on-chain wallet.
              </p>
            </div>

            <div className="mt-5 p-4 bg-gray-700/30 rounded-lg border border-gray-600/30">
              <div className="flex items-start mb-2">
                <input
                  checked={forceClose}
                  className="mr-3 mt-1 h-4 w-4 accent-red-500 bg-gray-700 rounded border-gray-600 focus:ring focus:ring-blue-500"
                  disabled={isClosing}
                  id="force-close"
                  onChange={(e) => setForceClose(e.target.checked)}
                  type="checkbox"
                />
                <div>
                  <label
                    className="font-medium text-white flex items-center"
                    htmlFor="force-close"
                  >
                    Force close
                    <span className="ml-2 px-2 py-0.5 text-xs bg-red-900/40 text-red-300 rounded-full border border-red-900/40">
                      Use with caution
                    </span>
                  </label>
                </div>
              </div>

              <div className="ml-7">
                <p className="text-sm text-gray-300 mb-3">
                  Only use force close if:
                </p>
                <ul className="text-xs text-gray-400 space-y-2 list-disc pl-5">
                  <li>The peer is offline or unresponsive</li>
                  <li>The channel is stuck or in a problematic state</li>
                  <li>A regular cooperative close has failed</li>
                </ul>

                <div className="mt-3 flex items-start text-xs">
                  <AlertTriangle className="text-amber-400 mt-0.5 mr-2 h-4 w-4 flex-shrink-0" />
                  <p className="text-amber-300">
                    Force closing may result in higher fees and longer
                    confirmation times. Your funds will be locked in a
                    time-locked contract until the timelock expires.
                  </p>
                </div>
              </div>
            </div>

            {!forceClose && (
              <div className="mt-4 flex items-start text-xs">
                <CheckCircle className="text-green-400 mt-0.5 mr-2 h-4 w-4 flex-shrink-0" />
                <p className="text-green-300">
                  Cooperative closing (default) is faster, cheaper, and returns
                  funds to your wallet after on-chain confirmation.
                </p>
              </div>
            )}
          </>
        )}

        {error && !suggestForceClose && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-900/30 rounded-lg text-red-300 text-sm">
            <div className="flex items-start">
              <AlertTriangle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          </div>
        )}

        {isClosing && (
          <div className="mt-4 text-center">
            <div className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-blue-400 rounded-full"></div>
            <p className="text-blue-300 text-sm mt-2">
              Closing channel... Please wait
            </p>
          </div>
        )}

        <div className="flex justify-end space-x-4 mt-6">
          <button
            className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 active:bg-gray-500 transition-colors"
            disabled={isClosing}
            onClick={(e) => {
              e.stopPropagation()
              resetAndClose()
            }}
            type="button"
          >
            Cancel
          </button>
          <button
            className={`px-4 py-2 rounded-lg flex items-center justify-center ${
              isClosing ? 'opacity-70 cursor-not-allowed' : ''
            } ${
              suggestForceClose
                ? 'bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-700 hover:to-red-700 text-white font-medium shadow-md'
                : forceClose
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-md border border-red-700/30'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
            } active:bg-blue-800 transition-colors shadow-sm`}
            disabled={isClosing}
            onClick={(e) => {
              e.stopPropagation()
              handleConfirm()
            }}
            type="button"
          >
            {isClosing ? (
              <>
                <span className="animate-spin mr-2">⟳</span>
                Processing...
              </>
            ) : suggestForceClose ? (
              <>
                <AlertTriangle className="w-4 h-4 mr-2" />
                Force Close Channel
              </>
            ) : forceClose ? (
              <>
                <AlertTriangle className="w-4 h-4 mr-2" />
                Force Close
              </>
            ) : (
              'Close Channel'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
