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
        <div className="flex items-center gap-1.5">
          {/* Compact Maker Selector Button */}
          <button
            className="relative flex items-center gap-2 px-2.5 py-1 rounded-lg transition-all duration-300 backdrop-blur-xl border shadow-sm group overflow-hidden bg-gradient-to-br from-slate-800/80 via-slate-700/60 to-slate-800/80 border-slate-600/60 hover:border-slate-500/80 hover:scale-[1.02] active:scale-[0.98]"
            onClick={() => setIsOpen(!isOpen)}
            type="button"
          >
            {/* Enhanced background effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-cyan-400/3 to-transparent"></div>
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/2 to-transparent"></div>

            <div className="relative flex items-center gap-2 min-w-0">
              <span className="text-xs font-medium text-slate-300 overflow-hidden text-ellipsis whitespace-nowrap max-w-[100px]">
                {currentUrl ? new URL(currentUrl).hostname : 'Select Maker'}
              </span>
              {isLoading ? (
                <RefreshCw className="w-3 h-3 text-slate-400 animate-spin flex-shrink-0" />
              ) : (
                <ChevronDown
                  className={`w-3 h-3 flex-shrink-0 text-slate-400 transition-transform duration-500 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              )}
            </div>
          </button>

          {/* Compact Refresh Button */}
          {!wsConnected && !isLoading && (
            <button
              className="relative p-1.5 rounded-lg bg-gradient-to-br from-red-500/15 via-orange-500/10 to-red-500/15 hover:from-red-500/25 hover:to-orange-500/25 
              transition-all duration-300 hover:scale-[1.05] active:scale-[0.95]
              text-red-200 border border-red-500/40 flex-shrink-0 backdrop-blur-xl shadow-sm overflow-hidden group"
              onClick={handleRefreshConnection}
              title="Refresh connection"
              type="button"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-red-400/3 to-transparent"></div>
              <RefreshCw className="relative w-3 h-3" />
            </button>
          )}

          {isLoading && (
            <div
              className="relative p-1.5 rounded-lg bg-gradient-to-br from-slate-800/80 via-slate-700/60 to-slate-800/80 
            text-slate-400 border border-slate-600/50 flex-shrink-0 backdrop-blur-xl shadow-sm overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-cyan-400/3 to-transparent"></div>
              <RefreshCw className="relative w-3 h-3 animate-spin" />
            </div>
          )}
        </div>

        {/* Compact Dropdown */}
        {isOpen && (
          <div className="absolute top-full mt-1 right-0 w-[400px] bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-2xl rounded-xl border border-slate-600/50 shadow-2xl z-[9999] animate-in fade-in slide-in-from-top-2 duration-300 overflow-hidden">
            {/* Enhanced background effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 via-blue-500/6 to-purple-600/8"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/2 to-transparent"></div>

            <div className="relative p-2 max-h-[300px] overflow-y-auto custom-scrollbar">
              <div className="px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-white via-cyan-100 to-blue-100 bg-clip-text text-transparent uppercase tracking-wider border-b border-slate-600/40 mb-2">
                Market Makers
              </div>
              {allMakerUrls.map((url) => (
                <button
                  className={`group relative flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all duration-300 overflow-hidden ${
                    url === currentUrl
                      ? 'bg-gradient-to-br from-cyan-600/30 via-blue-600/25 to-purple-600/30 hover:from-cyan-600/40 hover:to-purple-600/40 border-l-4 border-cyan-500 shadow-lg'
                      : 'hover:bg-gradient-to-br hover:from-slate-700/60 hover:to-slate-600/60 border-l-4 border-transparent hover:border-slate-500/50'
                  } hover:scale-[1.005] active:scale-[0.995]`}
                  key={url}
                  onClick={() => handleMakerChange(url)}
                  type="button"
                >
                  {/* Enhanced background effects for selected/hover states */}
                  {url === currentUrl && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-cyan-400/3 to-transparent"></div>
                      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/2 to-transparent"></div>
                    </>
                  )}

                  {url === currentUrl ? (
                    <Check className="w-4 h-4 text-cyan-400 flex-shrink-0 relative z-10" />
                  ) : (
                    <Globe className="w-4 h-4 text-slate-500 group-hover:text-slate-300 flex-shrink-0 transition-colors duration-300 relative z-10" />
                  )}
                  <div className="flex flex-col flex-1 text-left overflow-hidden relative z-10 min-w-0">
                    <span
                      className={`text-sm font-semibold overflow-hidden text-ellipsis whitespace-nowrap transition-colors duration-300 mb-0.5 ${
                        url === currentUrl
                          ? 'text-cyan-200'
                          : 'text-slate-300 group-hover:text-slate-100'
                      }`}
                    >
                      {new URL(url).hostname}
                    </span>
                    <span className="text-xs text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap group-hover:text-slate-400 transition-colors duration-300">
                      {url}
                    </span>
                  </div>
                  {url === nodeSettings.default_maker_url && (
                    <div className="flex items-center gap-1 relative z-10">
                      <span className="text-xs text-yellow-400 font-medium">
                        Default
                      </span>
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-500 flex-shrink-0" />
                    </div>
                  )}
                </button>
              ))}

              {/* Compact Add New Section */}
              {isAddingNew ? (
                <div className="relative p-3 border-t border-slate-600/40 mt-2 overflow-hidden rounded-lg bg-gradient-to-br from-slate-800/50 via-slate-700/40 to-slate-800/50">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
                  <div className="relative">
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Add Custom Maker
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        className="flex-1 px-2.5 py-1.5 bg-gradient-to-br from-slate-700/80 to-slate-600/80 border border-slate-500/60 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 backdrop-blur-sm transition-all duration-300"
                        onChange={(e) => setNewMakerUrl(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === 'Enter' && handleAddNewMaker()
                        }
                        placeholder="https://maker.example.com"
                        type="text"
                        value={newMakerUrl}
                      />
                      <button
                        className="px-2.5 py-1.5 bg-gradient-to-r from-cyan-600/80 to-blue-600/80 hover:from-cyan-600 hover:to-blue-600 text-white rounded-lg transition-all duration-300 flex-shrink-0 shadow-sm hover:shadow-cyan-500/25 flex items-center gap-1"
                        onClick={handleAddNewMaker}
                      >
                        <Check className="w-3 h-3" />
                        <span className="text-xs font-medium">Add</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  className="relative flex items-center gap-2 w-full px-3 py-2.5 text-xs text-cyan-400 hover:text-cyan-300 border-t border-slate-600/40 mt-2 transition-all duration-300 hover:bg-gradient-to-br hover:from-slate-700/50 hover:to-slate-600/50 rounded-lg overflow-hidden group"
                  onClick={() => setIsAddingNew(true)}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <Plus className="w-3.5 h-3.5 flex-shrink-0 relative z-10" />
                  <span className="relative z-10 font-medium">
                    Add Custom Maker
                  </span>
                </button>
              )}

              <button
                className="relative flex items-center gap-2 w-full px-3 py-2.5 text-xs text-slate-400 hover:text-slate-200 transition-all duration-300 hover:bg-gradient-to-br hover:from-slate-700/50 hover:to-slate-600/50 rounded-lg overflow-hidden group"
                onClick={() =>
                  openUrl('https://docs.kaleidoswap.com/api/market-maker')
                }
              >
                <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 via-transparent to-slate-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 relative z-10" />
                <span className="relative z-10 font-medium">
                  Learn About Makers
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    )
  )
}

export const MakerNotConnected: React.FC = () => (
  <div className="max-w-2xl w-full bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-2xl border border-slate-600/50 rounded-3xl shadow-2xl overflow-hidden">
    {/* Enhanced background effects */}
    <div className="absolute inset-0 bg-gradient-to-br from-red-500/8 via-orange-500/6 to-red-500/8"></div>
    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/2 to-transparent"></div>

    <div className="relative px-8 py-10">
      <div className="flex flex-col items-center gap-8">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/30 to-orange-500/30 blur-2xl rounded-full" />
          <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/40 backdrop-blur-sm">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-400 to-orange-400 animate-pulse shadow-lg" />
          </div>
        </div>

        <div className="text-center space-y-3">
          <h3 className="text-xl font-bold text-white bg-gradient-to-r from-white via-red-100 to-orange-100 bg-clip-text text-transparent">
            Connection Lost
          </h3>
          <p className="text-sm text-slate-400 max-w-lg leading-relaxed">
            Unable to connect to the selected maker. Please check if the maker
            is online or try selecting a different maker from above.
          </p>
        </div>

        <button
          className="relative px-6 py-3 bg-gradient-to-r from-red-500/20 to-orange-500/20 hover:from-red-500/30 hover:to-orange-500/30 text-red-200 rounded-2xl transition-all duration-300 border border-red-500/40 hover:border-red-400/60 backdrop-blur-sm shadow-lg hover:shadow-red-500/25 overflow-hidden group"
          onClick={() => window.location.reload()}
          type="button"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-red-400/3 to-transparent"></div>
          <span className="relative z-10">Refresh Page</span>
        </button>
      </div>
    </div>
  </div>
)
