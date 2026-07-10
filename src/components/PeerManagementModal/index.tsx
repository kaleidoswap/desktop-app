import { Users, Plus, Loader, X, Link as LinkIcon, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import { Modal } from '../ui/Modal'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'

interface PeerManagementModalProps {
  onClose: () => void
}

interface ConnectPeerForm {
  peerAddress: string
}

export const PeerManagementModal = ({ onClose }: PeerManagementModalProps) => {
  const { t } = useTranslation()
  const [showConnectForm, setShowConnectForm] = useState(false)
  const { register, handleSubmit, reset } = useForm<ConnectPeerForm>()

  const [getPeers, { data: peersData, isLoading }] =
    nodeApi.endpoints.listPeers.useLazyQuery()
  const [connectPeer] = nodeApi.useConnectPeerMutation()
  const [disconnectPeer] = nodeApi.useDisconnectPeerMutation()

  useEffect(() => {
    getPeers()
    const intervalId = setInterval(() => getPeers(), 10000)
    return () => clearInterval(intervalId)
  }, [getPeers])

  const handleConnect = async (data: ConnectPeerForm) => {
    try {
      await connectPeer({
        peer_pubkey_and_addr: data.peerAddress,
      }).unwrap()
      toast.success(t('peerManagement.success.connected'))
      setShowConnectForm(false)
      reset()
      getPeers()
    } catch (error: any) {
      toast.error(error.data?.error || t('peerManagement.errors.connectFailed'))
    }
  }

  const handleDisconnect = async (pubkey: string) => {
    try {
      await disconnectPeer({
        peer_pubkey: pubkey,
      }).unwrap()
      toast.success(t('peerManagement.success.disconnected'))
      getPeers()
    } catch (error: any) {
      toast.error(
        error.data?.error || t('peerManagement.errors.disconnectFailed')
      )
    }
  }

  return (
    <Modal isOpen onClose={onClose} size="md">
      <div className="flex items-center justify-between p-4 border-b border-divider/10">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold text-white">
            {t('peerManagement.title')}
          </h3>
        </div>
        <button
          aria-label="Close modal"
          className="p-2 rounded-full hover:bg-surface-overlay text-content-secondary hover:text-white transition-colors"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>

      <div className="p-6 space-y-6">
        {showConnectForm ? (
          <form onSubmit={handleSubmit(handleConnect)}>
            <div className="flex gap-3">
              <input
                {...register('peerAddress')}
                className="flex-1 bg-surface-overlay border border-border-default rounded-lg px-4 py-2.5 text-sm text-white
                         placeholder-content-tertiary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                placeholder={t('peerManagement.peerPlaceholder')}
                type="text"
              />
              <button
                className="px-4 py-2 bg-primary hover:bg-primary-emphasis text-primary-foreground rounded-lg
                         text-sm font-medium transition-colors flex items-center gap-2"
                type="submit"
              >
                <LinkIcon className="w-4 h-4" />
                {t('peerManagement.connect')}
              </button>
              <button
                className="px-4 py-2 text-content-secondary hover:text-white hover:bg-surface-overlay/50
                         rounded-lg text-sm font-medium transition-colors"
                onClick={() => setShowConnectForm(false)}
                type="button"
              >
                {t('peerManagement.cancel')}
              </button>
            </div>
          </form>
        ) : (
          <button
            className="w-full px-4 py-2.5 bg-primary hover:bg-primary-emphasis text-primary-foreground rounded-lg
                     text-sm font-medium transition-colors flex items-center justify-center gap-2"
            onClick={() => setShowConnectForm(true)}
          >
            <Plus className="w-4 h-4" />
            {t('peerManagement.connectToPeer')}
          </button>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : peersData?.peers && peersData.peers.length > 0 ? (
          <div className="space-y-3">
            {peersData.peers.map((peer: any) => (
              <div
                className="bg-surface-overlay/50 rounded-lg border border-border-default p-4
                         flex items-center gap-3 justify-between group hover:border-red-500/20 hover:bg-red-500/5 transition-colors"
                key={peer.pubkey}
              >
                <div className="w-8 h-8 rounded-full bg-surface-high flex items-center justify-center flex-shrink-0 border border-border-default/60">
                  <span className="text-[10px] font-bold text-content-secondary uppercase">
                    {peer.pubkey?.slice(0, 2)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-content-secondary truncate">
                    {peer.pubkey}
                  </div>
                </div>
                <div className="relative group/disc ml-4 flex-shrink-0">
                  <button
                    className="rounded-lg p-1.5 text-content-secondary transition-colors hover:bg-status-danger/15 hover:text-status-danger opacity-60 group-hover:opacity-100"
                    onClick={() => handleDisconnect(peer.pubkey ?? '')}
                    type="button"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-full mb-1.5 right-0 bg-surface-high text-content-primary text-[10px] rounded-md py-0.5 px-1.5 opacity-0 group-hover/disc:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border-default/40 shadow-lg z-20">
                    {t('peerManagement.disconnectTooltip')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-content-secondary text-sm">
            {t('peerManagement.noPeers')}
          </div>
        )}
      </div>
    </Modal>
  )
}
