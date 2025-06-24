import { openUrl } from '@tauri-apps/plugin-opener'
import {
  ChevronDown,
  Star,
  Globe,
  RefreshCw,
  Plus,
  Check,
  ExternalLink,
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
  hasNoPairs?: boolean
  onMakerChange: () => Promise<void>
  show?: boolean
}

export const MakerSelector: React.FC<MakerSelectorProps> = ({
  hasNoPairs = false,
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

      // Reset WebSocket state and circuit breaker for new maker
      webSocketService.resetForNewMaker()

      // Update the maker URL in settings immediately
      dispatch(
        nodeSettingsActions.setNodeSettings({
          ...nodeSettings,
          default_maker_url: url,
        })
      )

      toast.info('Switching to new maker...', {
        autoClose: 3000,
        icon: () => <RefreshCw className="animate-spin h-4 w-4" />,
        toastId: 'switching-maker',
      })

      // Wait a moment for the reset to complete, then trigger reconnection
      setTimeout(async () => {
        try {
          // The WebSocket initialization will be triggered by the useEffect in the main component
          // due to the makerConnectionUrl change

          // Wait a bit for the connection to establish
          setTimeout(() => {
            if (webSocketService.isConnected()) {
              toast.success('Successfully reconnected to market maker', {
                autoClose: 3000,
                toastId: 'maker-selector-reconnection-success',
              })
            }
          }, 2000)
        } catch (reconnectError) {
          console.error('Error during reconnection:', reconnectError)
          toast.warning('Reconnection in progress. Please wait...', {
            autoClose: 3000,
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
      // Close the dropdown and reset loading state
      setIsOpen(false)
      // Only set loading to false after a delay to allow connection to establish
      setTimeout(() => {
        setIsLoading(false)
      }, 2000)
    }
  }

  const handleAddNewMaker = () => {
    try {
      if (!newMakerUrl) return

      // Basic URL validation
      let url = newMakerUrl
      console.log('newMakerUrl', newMakerUrl)
      // Check if URL is valid
      new URL(url)

      // Add to maker URLs if not already present
      if (!allMakerUrls.includes(url)) {
        const updatedMakerUrls = [...(nodeSettings.maker_urls || []), url]
        dispatch(
          nodeSettingsActions.setNodeSettings({
            ...nodeSettings,
            maker_urls: updatedMakerUrls,
          })
        )

        // Switch to the new maker
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

      // Use the service's reconnect method
      const reconnectInitiated = webSocketService.reconnect()

      if (reconnectInitiated) {
        toast.info('Reconnecting to maker...', {
          autoClose: 3000,
          icon: () => <RefreshCw className="animate-spin h-4 w-4" />,
          toastId: 'maker-reconnecting',
        })

        // Wait a moment for the connection to establish
        await new Promise((resolve) => setTimeout(resolve, 2000))

        // Check if the connection was successful
        if (webSocketService.isConnected()) {
          if (onMakerChange) {
            await onMakerChange()
          }
          toast.success('Successfully reconnected to market maker', {
            autoClose: 3000,
            toastId: 'maker-selector-reconnection-success',
          })
        } else {
          // If not connected after delay, show warning
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

  return (
    show && (
      <div className="relative" ref={dropdownRef}>
        <div className="flex flex-col gap-1 mb-1">
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider mr-2">
              Market Maker
            </label>
            {wsConnected ? (
              hasNoPairs ? (
                <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded-full flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
                  No Trading Pairs
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                  Connected
                </span>
              )
            ) : (
              <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-300 rounded-full flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></div>
                Disconnected
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              className={twJoin(
                'flex-1 flex items-center justify-between gap-3 px-4 py-3 rounded-xl',
                'transition-all duration-200',
                'border-2',
                wsConnected
                  ? hasNoPairs
                    ? 'bg-yellow-500/5 border-yellow-500/30 hover:bg-yellow-500/10'
                    : 'bg-slate-800/80 border-slate-600/50 hover:bg-slate-700'
                  : 'bg-red-500/5 border-red-500/30 hover:bg-red-500/10',
                hasNoPairs ? 'animate-pulse' : '',
                'hover:scale-[1.02] active:scale-[0.98]'
              )}
              onClick={() => setIsOpen(!isOpen)}
              type="button"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={twJoin(
                    'relative flex items-center gap-3 min-w-0',
                    wsConnected
                      ? hasNoPairs
                        ? 'text-yellow-200'
                        : 'text-emerald-200'
                      : 'text-red-200'
                  )}
                >
                  <div className="relative flex-shrink-0">
                    <div
                      className={twJoin(
                        'absolute inset-0 blur-md rounded-full',
                        wsConnected
                          ? hasNoPairs
                            ? 'bg-yellow-400/30'
                            : 'bg-emerald-400/30'
                          : 'bg-red-400/30'
                      )}
                    />
                    <div
                      className={twJoin(
                        'relative w-2 h-2 rounded-full',
                        wsConnected
                          ? hasNoPairs
                            ? 'bg-yellow-400'
                            : 'bg-emerald-400'
                          : 'bg-red-400',
                        wsConnected && !hasNoPairs ? 'animate-pulse' : '',
                        !wsConnected
                          ? 'animate-[pulse_1.5s_ease-in-out_infinite]'
                          : ''
                      )}
                    />
                  </div>
                  <span className="text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                    {currentUrl ? new URL(currentUrl).hostname : 'Select Maker'}
                  </span>
                </div>
              </div>
              {isLoading ? (
                <RefreshCw className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />
              ) : (
                <ChevronDown
                  className={twJoin(
                    'w-4 h-4 flex-shrink-0',
                    hasNoPairs ? 'text-yellow-400' : 'text-slate-400',
                    'transition-transform duration-200',
                    isOpen ? 'rotate-180' : ''
                  )}
                />
              )}
            </button>

            {!wsConnected && !isLoading && (
              <button
                className="p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 
                transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
                text-red-200 border-2 border-red-500/30 flex-shrink-0"
                onClick={handleRefreshConnection}
                title="Refresh connection"
                type="button"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}

            {isLoading && (
              <div
                className="p-3 rounded-xl bg-slate-800 
              text-slate-400 border-2 border-slate-700/50 flex-shrink-0"
              >
                <RefreshCw className="w-4 h-4 animate-spin" />
              </div>
            )}
          </div>
        </div>

        {isOpen && (
          <div className="absolute top-full mt-2 right-0 w-96 bg-slate-800/95 backdrop-blur-sm rounded-xl border-2 border-slate-700/50 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-2 max-h-[320px] overflow-y-auto custom-scrollbar">
              <div className="px-4 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-slate-700/50 mb-1">
                Available Makers
              </div>
              {allMakerUrls.map((url) => (
                <button
                  className={twJoin(
                    'group flex items-center gap-3 w-full px-4 py-3 rounded-lg',
                    'transition-all duration-200',
                    url === currentUrl
                      ? 'bg-blue-600/30 hover:bg-blue-600/40 border-l-2 border-blue-500'
                      : 'hover:bg-slate-700/60 border-l-2 border-transparent',
                    'hover:scale-[1.01] active:scale-[0.99]'
                  )}
                  key={url}
                  onClick={() => handleMakerChange(url)}
                  type="button"
                >
                  {url === currentUrl ? (
                    <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  ) : (
                    <Globe className="w-4 h-4 text-slate-500 group-hover:text-slate-300 flex-shrink-0" />
                  )}
                  <div className="flex flex-col flex-1 text-left overflow-hidden">
                    <span
                      className={twJoin(
                        'text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap transition-colors duration-200',
                        url === currentUrl
                          ? 'text-blue-400'
                          : 'text-slate-400 group-hover:text-slate-200'
                      )}
                    >
                      {new URL(url).hostname}
                    </span>
                    <span className="text-xs text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
                      {url}
                    </span>
                  </div>
                  {url === nodeSettings.default_maker_url && (
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-500 flex-shrink-0" />
                  )}
                </button>
              ))}

              {isAddingNew ? (
                <div className="p-3 border-t border-slate-700/50 mt-2">
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                      onChange={(e) => setNewMakerUrl(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === 'Enter' && handleAddNewMaker()
                      }
                      placeholder="Enter maker URL"
                      type="text"
                      value={newMakerUrl}
                    />
                    <button
                      className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex-shrink-0"
                      onClick={handleAddNewMaker}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="flex items-center gap-2 w-full px-4 py-3 text-sm text-blue-400 hover:text-blue-300 border-t border-slate-700/50 mt-2 transition-colors hover:bg-slate-700/50 rounded-lg"
                  onClick={() => setIsAddingNew(true)}
                >
                  <Plus className="w-4 h-4 flex-shrink-0" />
                  <span>Add new maker</span>
                </button>
              )}

              <button
                className="flex items-center gap-2 w-full px-4 py-3 text-sm text-slate-400 hover:text-slate-300 transition-colors hover:bg-slate-700/50 rounded-lg"
                onClick={() =>
                  openUrl('https://docs.kaleidoswap.com/api/market-maker')
                }
              >
                <ExternalLink className="w-4 h-4 flex-shrink-0" />
                <span>Learn about makers</span>
              </button>
            </div>
          </div>
        )}
      </div>
    )
  )
}

export const MakerNotConnected: React.FC = () => (
  <div className="max-w-xl w-full bg-slate-800/30 backdrop-blur-sm border-2 border-red-500/20 rounded-xl overflow-hidden">
    <div className="px-6 py-8">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full" />
          <div className="relative inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          </div>
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-lg font-medium text-red-200">Connection Lost</h3>
          <p className="text-sm text-slate-400 max-w-md">
            Unable to connect to the selected maker. Please check if the maker
            is online or try selecting a different maker from above.
          </p>
        </div>

        <button
          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-200 rounded-lg transition-colors"
          onClick={() => window.location.reload()}
          type="button"
        >
          Refresh Page
        </button>
      </div>
    </div>
  </div>
)
