import {
  ChevronDown,
  Globe,
  RefreshCw,
  Plus,
  Check,
  Server,
} from 'lucide-react'
import React, { useState, useMemo, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { toast } from 'react-toastify'
import { twJoin } from 'tailwind-merge'

import { webSocketService } from '../../app/hubs/websocketService'
import { useAppSelector } from '../../app/store/hooks'
import { useOnClickOutside } from '../../hooks/useOnClickOutside'
import { nodeSettingsActions } from '../../slices/nodeSettings/nodeSettings.slice'

interface MakerSelectorProps {
  onMakerChange: () => Promise<void>
  show?: boolean
}

export const MakerSelector: React.FC<MakerSelectorProps> = ({
  onMakerChange,
  show = true,
}) => {
  const nodeSettings = useAppSelector((state) => state.nodeSettings.data)
  const wsConnected = useAppSelector((state) => state.pairs.wsConnected)
  const [isOpen, setIsOpen] = useState(false)
  const [newMakerUrl, setNewMakerUrl] = useState('')
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const dispatch = useDispatch()

  useOnClickOutside(dropdownRef, () => setIsOpen(false))

  const allMakerUrls = useMemo(() => {
    const defaultUrl = nodeSettings.default_maker_url
    const additionalUrls = Array.isArray(nodeSettings.maker_urls)
      ? nodeSettings.maker_urls
      : []

    return [defaultUrl, ...additionalUrls]
      .filter(Boolean)
      .filter((url, index, self) => self.indexOf(url) === index)
  }, [nodeSettings.default_maker_url, nodeSettings.maker_urls])

  const handleMakerChange = async (url: string) => {
    try {
      setIsLoading(true)
      webSocketService.resetForNewMaker()

      dispatch(
        nodeSettingsActions.setNodeSettings({
          ...nodeSettings,
          default_maker_url: url,
        })
      )

      toast.info('Switching to new maker...', {
        autoClose: 2000,
        icon: () => <RefreshCw className="animate-spin h-4 w-4" />,
        toastId: 'switching-maker',
      })

      setTimeout(async () => {
        try {
          setTimeout(() => {
            if (webSocketService.isConnected()) {
              toast.success('Successfully reconnected to market maker', {
                autoClose: 2000,
                toastId: 'maker-selector-reconnection-success',
              })
            }
          }, 2000)
        } catch (reconnectError) {
          console.error('Error during reconnection:', reconnectError)
          toast.warning('Reconnection in progress. Please wait...', {
            autoClose: 2000,
            toastId: 'maker-reconnection-progress',
          })
        }
      }, 500)
    } catch (error) {
      console.error('Failed to change maker:', error)
      toast.error('Failed to change maker', {
        autoClose: 5000,
        toastId: 'maker-change-failed',
      })
    } finally {
      setIsOpen(false)
      setTimeout(() => {
        setIsLoading(false)
      }, 2000)
    }
  }

  const handleAddNewMaker = () => {
    try {
      if (!newMakerUrl) return

      let url = newMakerUrl
      new URL(url)

      if (!allMakerUrls.includes(url)) {
        const updatedMakerUrls = [...(nodeSettings.maker_urls || []), url]
        dispatch(
          nodeSettingsActions.setNodeSettings({
            ...nodeSettings,
            maker_urls: updatedMakerUrls,
          })
        )

        handleMakerChange(url)
      }

      setNewMakerUrl('')
      setIsAddingNew(false)
    } catch (error) {
      toast.error('Invalid URL format', {
        autoClose: 5000,
        toastId: 'invalid-maker-url',
      })
    }
  }

  const handleRefreshConnection = async () => {
    try {
      setIsLoading(true)

      const reconnectInitiated = webSocketService.reconnect()

      if (reconnectInitiated) {
        toast.info('Reconnecting to maker...', {
          autoClose: 3000,
          icon: () => <RefreshCw className="animate-spin h-4 w-4" />,
          toastId: 'maker-reconnecting',
        })

        await new Promise((resolve) => setTimeout(resolve, 2000))

        if (webSocketService.isConnected()) {
          if (onMakerChange) {
            await onMakerChange()
          }
          toast.success('Successfully reconnected to market maker', {
            autoClose: 3000,
            toastId: 'maker-selector-reconnection-success',
          })
        } else {
          toast.warning('Reconnection in progress. Please wait...', {
            autoClose: 3000,
            toastId: 'maker-reconnection-progress',
          })
        }
      } else {
        toast.error('Failed to initiate reconnection. Please try again.', {
          autoClose: 5000,
          toastId: 'maker-reconnection-initiation-failed',
        })
      }
    } catch (error) {
      console.error('Failed to refresh connection:', error)
      toast.error('Failed to reconnect to maker', {
        autoClose: 5000,
        toastId: 'maker-refresh-connection-failed',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const currentUrl =
    webSocketService.getCurrentUrl() || nodeSettings.default_maker_url

  const selectorButtonClasses = twJoin(
    'relative flex items-center gap-2.5',
    'px-3.5 py-2 rounded-xl',
    'transition-all duration-300 ease-out',
    'backdrop-blur-2xl border shadow-lg',
    'group overflow-hidden',
    'bg-gradient-to-br from-slate-800/90 via-slate-800/80 to-slate-900/90',
    'border-slate-600/50',
    'hover:border-slate-500/70',
    'hover:scale-[1.02]',
    'active:scale-[0.98]',
    'hover:shadow-xl hover:shadow-slate-900/20'
  )

  const refreshButtonClasses = twJoin(
    'relative p-2 rounded-xl',
    'bg-gradient-to-br',
    !wsConnected
      ? 'from-red-500/20 via-orange-500/15 to-red-500/20 hover:from-red-500/30 hover:to-orange-500/30 text-red-200 border-red-500/40'
      : 'from-emerald-500/20 via-emerald-500/15 to-emerald-500/20 hover:from-emerald-500/30 hover:to-emerald-500/30 text-emerald-200 border-emerald-500/40',
    'transition-all duration-300',
    'hover:scale-[1.05]',
    'active:scale-[0.95]',
    'border',
    'flex-shrink-0',
    'backdrop-blur-2xl',
    'shadow-lg',
    'overflow-hidden',
    'group'
  )

  return (
    show && (
      <div className="relative" ref={dropdownRef}>
        <div className="flex items-center gap-2">
          {/* Maker Selector Button */}
          <button
            className={selectorButtonClasses}
            onClick={() => setIsOpen(!isOpen)}
            type="button"
          >
            {/* Background effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-blue-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>

            <div className="relative flex items-center gap-2.5 min-w-0">
              <Server className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-slate-200 overflow-hidden text-ellipsis whitespace-nowrap max-w-[140px]">
                {currentUrl ? new URL(currentUrl).hostname : 'Select Maker'}
              </span>
              {isLoading ? (
                <RefreshCw className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
              ) : (
                <ChevronDown
                  className={`w-4 h-4 flex-shrink-0 text-blue-400 transition-transform duration-500 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              )}
            </div>
          </button>

          {/* Connection Status Button */}
          <button
            className={refreshButtonClasses}
            onClick={handleRefreshConnection}
            title={wsConnected ? 'Connected' : 'Reconnect'}
            type="button"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-slate-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <RefreshCw
              className={`relative w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            className="absolute top-full right-0 mt-2 w-72 z-[9999] animate-fade-in"
            style={{ minWidth: 'max-content' }}
          >
            <div className="bg-gradient-to-br from-slate-800/95 via-slate-800/90 to-slate-900/95 backdrop-blur-2xl rounded-xl border border-slate-600/50 shadow-2xl overflow-hidden">
              {/* Maker List */}
              <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
                <div className="px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-white via-cyan-100 to-blue-100 bg-clip-text text-transparent uppercase tracking-wider border-b border-slate-600/40 mb-2">
                  Market Makers
                </div>
                {allMakerUrls.map((url) => (
                  <button
                    className={twJoin(
                      'w-full px-3 py-2 rounded-lg',
                      'flex items-center justify-between gap-2',
                      'transition-all duration-200',
                      'group/item',
                      'hover:bg-slate-700/50',
                      url === currentUrl
                        ? 'bg-blue-500/20 text-blue-200'
                        : 'text-slate-300 hover:text-white'
                    )}
                    key={url}
                    onClick={() => handleMakerChange(url)}
                    type="button"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Globe className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate text-sm">
                        {new URL(url).hostname}
                      </span>
                    </div>
                    {url === currentUrl && (
                      <Check className="w-4 h-4 text-blue-400" />
                    )}
                  </button>
                ))}
              </div>

              {/* Add New Maker Section */}
              <div className="border-t border-slate-600/30 p-2">
                {isAddingNew ? (
                  <div className="space-y-2 p-2">
                    <input
                      className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-600/50 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20"
                      onChange={(e) => setNewMakerUrl(e.target.value)}
                      placeholder="Enter maker URL..."
                      type="text"
                      value={newMakerUrl}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-colors"
                        onClick={() => {
                          setIsAddingNew(false)
                          setNewMakerUrl('')
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                      <button
                        className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-sm font-medium text-blue-300 hover:bg-blue-500/30 hover:text-blue-200 transition-all"
                        onClick={handleAddNewMaker}
                        type="button"
                      >
                        Add Maker
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="w-full px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-all"
                    onClick={() => setIsAddingNew(true)}
                    type="button"
                  >
                    <Plus className="w-4 h-4" />
                    Add New Maker
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  )
}

export const MakerNotConnected: React.FC = () => (
  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200">
    <Server className="w-4 h-4" />
    <span className="text-sm">Not connected to maker</span>
  </div>
)
