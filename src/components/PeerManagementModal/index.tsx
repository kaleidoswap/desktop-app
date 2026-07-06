import { Users, Plus, Loader, X, Link as LinkIcon, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import {
  getModalPortalTarget,
  getModalPositionClass,
} from '../../helpers/modalPortal'
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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const pos = getModalPositionClass()

  return createPortal(
    <div
      className={`${pos} inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 pt-20`}
      onMouseDown={handleBackdropClick}
    >
      <div className="bg-surface-base rounded-2xl border border-border-subtle p-6 max-w-2xl w-full m-4 max-h-[calc(100vh-120px)] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-blue-500" />
            <h2 className="text-2xl font-bold text-white">
              {t('peerManagement.title')}
            </h2>
          </div>
          <button
            className="text-content-secondary hover:text-white transition-colors"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {showConnectForm ? (
          <form className="mb-6" onSubmit={handleSubmit(handleConnect)}>
            <div className="flex gap-3">
              <input
                {...register('peerAddress')}
                className="flex-1 bg-surface-overlay border border-border-default rounded-xl px-4 py-3 text-white
                         placeholder-slate-500 focus:outline-none focus:border-blue-500"
                placeholder={t('peerManagement.peerPlaceholder')}
                type="text"
              />
              <button
                className="px-4 py-2 bg-primary hover:bg-primary-emphasis text-primary-foreground rounded-lg
                         font-medium transition-colors flex items-center gap-2"
                type="submit"
              >
                <LinkIcon className="w-4 h-4" />
                {t('peerManagement.connect')}
              </button>
              <button
                className="px-4 py-2 bg-surface-overlay hover:bg-surface-high text-content-secondary
                         rounded-lg font-medium transition-colors"
                onClick={() => setShowConnectForm(false)}
                type="button"
              >
                {t('peerManagement.cancel')}
              </button>
            </div>
          </form>
        ) : (
          <button
            className="w-full mb-6 px-4 py-3 bg-primary hover:bg-primary-emphasis text-primary-foreground rounded-lg
                     font-medium transition-colors flex items-center justify-center gap-2"
            onClick={() => setShowConnectForm(true)}
          >
            <Plus className="w-5 h-5" />
            {t('peerManagement.connectToPeer')}
          </button>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : peersData?.peers && peersData.peers.length > 0 ? (
          <div className="space-y-3">
            {peersData.peers.map((peer: any) => (
              <div
                className="bg-surface-overlay/50 rounded-xl border border-border-default p-4
                         flex items-center gap-3 justify-between group hover:border-red-500/20 hover:bg-red-500/5"
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
          <div className="text-center py-8 text-content-secondary">
            {t('peerManagement.noPeers')}
          </div>
        )}
      </div>
    </div>,
    getModalPortalTarget()
  )
}
