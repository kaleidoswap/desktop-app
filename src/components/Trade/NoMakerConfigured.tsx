import { invoke } from '@tauri-apps/api/core'
import { Server, Settings } from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import { SETTINGS_PATH } from '../../app/router/paths'
import { useAppDispatch, useAppSelector } from '../../app/store/hooks'
import { nodeSettingsActions } from '../../slices/nodeSettings/nodeSettings.slice'
import { logger } from '../../utils/logger'

export const isValidMakerUrl = (value: string): boolean => {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/** Shown instead of a maker-backed screen when the account has no maker URL. */
export const NoMakerConfigured: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const account = useAppSelector((state) => state.nodeSettings.data)
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const makerUrl = url.trim()
    if (!isValidMakerUrl(makerUrl)) {
      toast.error(t('trade.maker.invalidUrl'), { toastId: 'invalid-maker-url' })
      return
    }
    const makerUrls = [...new Set([makerUrl, ...(account.maker_urls ?? [])])]
    const lspUrl = account.default_lsp_url || makerUrl
    setSaving(true)
    try {
      await invoke('update_account', {
        bearerToken: account.bearer_token || null,
        daemonListeningPort: account.daemon_listening_port,
        datapath: account.datapath,
        defaultLspUrl: lspUrl,
        defaultMakerUrl: makerUrl,
        indexerUrl: account.indexer_url,
        language: account.language || 'en',
        ldkPeerListeningPort: account.ldk_peer_listening_port,
        makerUrls: makerUrls.join(','),
        name: account.name,
        network: account.network,
        nodeUrl: account.node_url,
        proxyEndpoint: account.proxy_endpoint,
        rpcConnectionUrl: account.rpc_connection_url,
      })
      dispatch(
        nodeSettingsActions.setNodeSettings({
          ...account,
          default_lsp_url: lspUrl,
          default_maker_url: makerUrl,
          maker_urls: makerUrls,
        })
      )
      toast.success(t('trade.maker.noMaker.saved'))
    } catch (error) {
      logger.error('Failed to save maker URL:', error)
      toast.error(t('trade.maker.noMaker.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex justify-center items-center min-h-[60vh] px-4">
      <div className="max-w-xl w-full rounded-2xl border border-border-default bg-surface-base/50 p-8">
        <div className="flex flex-col items-center space-y-5 text-center">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
            <Server className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-content-primary">
            {t('trade.maker.noMaker.title')}
          </h2>
          <p className="text-content-secondary text-sm max-w-md">
            {t('trade.maker.noMaker.message', { network: account.network })}
          </p>
          <form
            className="flex w-full gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void save()
            }}
          >
            <input
              aria-label={t('trade.maker.enterUrl')}
              className="flex-1 rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-content-primary outline-none focus:border-primary"
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://maker.example.com"
              type="url"
              value={url}
            />
            <button
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-emphasis disabled:opacity-50"
              disabled={saving || !url.trim()}
              type="submit"
            >
              {t('trade.maker.noMaker.save')}
            </button>
          </form>
          <button
            className="inline-flex items-center gap-2 text-sm text-content-secondary hover:text-content-primary"
            onClick={() => navigate(SETTINGS_PATH)}
            type="button"
          >
            <Settings className="w-4 h-4" />
            {t('trade.maker.noMaker.openSettings')}
          </button>
        </div>
      </div>
    </div>
  )
}

export const RequireMaker: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const makerUrl = useAppSelector(
    (state) => state.nodeSettings.data.default_maker_url
  )
  return makerUrl?.trim() ? <>{children}</> : <NoMakerConfigured />
}
