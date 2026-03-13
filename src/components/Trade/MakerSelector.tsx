import {
  ChevronDown,
  Globe,
  RefreshCw,
  Plus,
  Check,
  Server,
} from 'lucide-react'
import React, { useState, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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

      toast.info(t('trade.maker.switching'), {
        autoClose: 2000,
        icon: () => <RefreshCw className="animate-spin h-4 w-4" />,
        toastId: 'switching-maker',
      })

      setTimeout(async () => {
        try {
          setTimeout(() => {
            if (webSocketService.isConnected()) {
              toast.success(t('trade.maker.reconnected'), {
                autoClose: 2000,
                toastId: 'maker-selector-reconnection-success',
              })
            }
          }, 2000)
        } catch (reconnectError) {
          console.error('Error during reconnection:', reconnectError)
          toast.warning(t('trade.maker.reconnecting'), {
            autoClose: 2000,
            toastId: 'maker-reconnection-progress',
          })
        }
      }, 500)
    } catch (error) {
      console.error('Failed to change maker:', error)
      toast.error(t('trade.maker.changeFailed'), {
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

      const url = newMakerUrl
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
      toast.error(t('trade.maker.invalidUrl'), {
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
        toast.info(t('trade.maker.reconnectingStatus'), {
          autoClose: 3000,
          icon: () => <RefreshCw className="animate-spin h-4 w-4" />,
          toastId: 'maker-reconnecting',
        })

        await new Promise((resolve) => setTimeout(resolve, 2000))

        if (webSocketService.isConnected()) {
          if (onMakerChange) {
            await onMakerChange()
          }
          toast.success(t('trade.maker.reconnected'), {
            autoClose: 3000,
            toastId: 'maker-selector-reconnection-success',
          })
        } else {
          toast.warning(t('trade.maker.reconnecting'), {
            autoClose: 3000,
            toastId: 'maker-reconnection-progress',
          })
        }
      } else {
        toast.error(t('trade.maker.reconnectionInitFailed'), {
          autoClose: 5000,
          toastId: 'maker-reconnection-initiation-failed',
        })
      }
    } catch (error) {
      console.error('Failed to refresh connection:', error)
      toast.error(t('trade.maker.reconnectionFailed'), {
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
    'transition-all duration-200 ease-out',
    'border shadow-sm',
    'group overflow-hidden',
    'bg-surface-overlay',
    'border-border-default/50',
    'hover:border-border-default/80',
    'hover:bg-surface-high',
    'active:scale-[0.98]'
  )

  const refreshButtonClasses = twJoin(
    'relative p-2 rounded-xl',
    !wsConnected
      ? 'bg-red-500/15 text-red-300 border-red-500/30 hover:bg-red-500/25'
      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25',
    'transition-all duration-200',
    'active:scale-[0.95]',
    'border',
    'flex-shrink-0',
    'shadow-sm',
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
            {/* Background effects removed */}

            <div className="relative flex items-center gap-2.5 min-w-0">
              <Server className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-content-primary overflow-hidden text-ellipsis whitespace-nowrap max-w-[140px]">
                {currentUrl
                  ? new URL(currentUrl).hostname
                  : t('trade.maker.selectMaker')}
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

          <button
            className={refreshButtonClasses}
            onClick={handleRefreshConnection}
            title={
              wsConnected
                ? t('trade.maker.connected')
                : t('trade.maker.reconnect')
            }
            type="button"
          >
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
            <div className="bg-surface-overlay rounded-xl border border-border-default/50 shadow-2xl overflow-hidden">
              {/* Maker List */}
              <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
                <div className="px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-white via-cyan-100 to-blue-100 bg-clip-text text-transparent uppercase tracking-wider border-b border-border-default/40 mb-2">
                  {t('trade.maker.marketMakers')}
                </div>
                {allMakerUrls.map((url) => (
                  <button
                    className={twJoin(
                      'w-full px-3 py-2 rounded-lg',
                      'flex items-center justify-between gap-2',
                      'transition-all duration-200',
                      'group/item',
                      'hover:bg-surface-high/50',
                      url === currentUrl
                        ? 'bg-blue-500/20 text-blue-200'
                        : 'text-content-secondary hover:text-white'
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
              <div className="border-t border-border-default/30 p-2">
                {isAddingNew ? (
                  <div className="space-y-2 p-2">
                    <input
                      className="w-full px-3 py-2 rounded-lg bg-surface-base/50 border border-border-default/50 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20"
                      onChange={(e) => setNewMakerUrl(e.target.value)}
                      placeholder={t('trade.maker.enterUrl')}
                      type="text"
                      value={newMakerUrl}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        className="px-3 py-1.5 rounded-lg text-sm font-medium text-content-secondary hover:text-white transition-colors"
                        onClick={() => {
                          setIsAddingNew(false)
                          setNewMakerUrl('')
                        }}
                        type="button"
                      >
                        {t('trade.maker.cancel')}
                      </button>
                      <button
                        className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-sm font-medium text-blue-300 hover:bg-blue-500/30 hover:text-blue-200 transition-all"
                        onClick={handleAddNewMaker}
                        type="button"
                      >
                        {t('trade.maker.addMaker')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="w-full px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium text-content-secondary hover:text-content-primary hover:bg-surface-high/50 transition-all"
                    onClick={() => setIsAddingNew(true)}
                    type="button"
                  >
                    <Plus className="w-4 h-4" />
                    {t('trade.maker.addNewMaker')}
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

export const MakerNotConnected: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200">
      <Server className="w-4 h-4" />
      <span className="text-sm">{t('trade.maker.notConnected')}</span>
    </div>
  )
}
