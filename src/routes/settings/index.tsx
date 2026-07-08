import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import {
  ChevronDown,
  LogOut,
  Moon,
  // Sun, // temporarily unused — light mode disabled
  Undo,
  Save,
  Shield,
  Power,
  AlertTriangle,
  Download,
  Activity,
  Settings,
  Server,
  Trash2,
  Star,
  Store,
  RefreshCw,
  Lock,
  ArrowRight,
  KeyRound,
} from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useForm, Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import {
  getModalPortalTarget,
  getModalPositionClass,
} from '../../helpers/modalPortal'
import { WALLET_SETUP_PATH } from '../../app/router/paths'
import { RootState } from '../../app/store'
import { useAppSelector } from '../../app/store/hooks'
import { AppVersion } from '../../components/AppVersion'
import { BackupModal } from '../../components/BackupModal'
import { ChangePasswordModal } from '../../components/ChangePasswordModal'
import { MnemonicViewerModal } from '../../components/MnemonicViewer'
import {
  ModalType,
  ModalTypeValue,
  StatusModal,
} from '../../components/StatusModal'
import { useBackup } from '../../hooks/useBackup'
import { LANGUAGES } from '../../i18n'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { nodeSettingsActions } from '../../slices/nodeSettings/nodeSettings.slice'
import { waitForNodeReady } from '../../utils/nodeState'
import {
  setAppMode,
  setBitcoinUnit,
  setFiatCurrency,
  setLanguage,
  setNodeConnectionString,
  type AppMode,
  // setTheme, // temporarily unused — light mode disabled
} from '../../slices/settings/settings.slice'
import {
  CURRENCY_LABELS,
  CURRENCY_SYMBOLS,
  SUPPORTED_CURRENCIES,
} from '../../slices/priceApi/priceApi.slice'

import { TerminalLogDisplay } from './TerminalLogDisplay'

interface FormFields {
  bitcoinUnit: string
  fiatCurrency: string
  language: string
  nodeConnectionString: string
  lspUrl: string
  rpcConnectionUrl: string
  indexerUrl: string
  proxyEndpoint: string
  makerUrls: string[]
  defaultMakerUrl: string
  bearerToken: string
}

export const Component: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const pos = getModalPositionClass()
  const dispatch = useDispatch()
  const { bitcoinUnit, fiatCurrency, nodeConnectionString, language, appMode } =
    useSelector((state: RootState) => state.settings)

  const APP_MODE_OPTIONS: {
    mode: AppMode
    labelKey: string
    fallback: string
  }[] = [
    {
      fallback: 'Node + Mind',
      labelKey: 'launcher.modes.both.title',
      mode: 'both',
    },
    {
      fallback: 'Only Node',
      labelKey: 'launcher.modes.node.title',
      mode: 'node',
    },
    {
      fallback: 'Only Mind',
      labelKey: 'launcher.modes.mind.title',
      mode: 'mind',
    },
  ]
  const currentAccount = useAppSelector((state) => state.nodeSettings.data)
  const nodeSettings = useAppSelector((state) => state.nodeSettings.data)

  // All state declarations in one place
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [logsFetchRetries, setLogsFetchRetries] = useState(0)
  const [isLogsFetchDisabled, setIsLogsFetchDisabled] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalLogs, setTotalLogs] = useState(0)
  const [nodeLogs, setNodeLogs] = useState<string[]>([])
  const [maxLogEntries, setMaxLogEntries] = useState(200)
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false)
  const [showShutdownConfirmation, setShowShutdownConfirmation] =
    useState(false)
  const [isShuttingDown, setIsShuttingDown] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showRestartConfirmation, setShowRestartConfirmation] = useState(false)
  const [showMnemonicModal, setShowMnemonicModal] = useState(false)
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)
  const maxLogsFetchRetries = 3

  // Replace showModal with unified modal state
  const [modal, setModal] = useState<{
    type: ModalTypeValue
    title: string
    message: string
    details: string
    isOpen: boolean
    autoClose: boolean
  }>({
    autoClose: false,
    details: '',
    isOpen: false,
    message: '',
    title: '',
    type: ModalType.NONE,
  })

  const [shutdown] = nodeApi.endpoints.shutdown.useMutation()
  const [lock] = nodeApi.endpoints.lock.useMutation()

  const { control, handleSubmit, reset, watch, setValue } = useForm<FormFields>(
    {
      defaultValues: {
        bearerToken: nodeSettings.bearer_token || '',
        bitcoinUnit,
        defaultMakerUrl: nodeSettings.default_maker_url || '',
        fiatCurrency,
        indexerUrl: nodeSettings.indexer_url || '',
        language: language || 'en',
        lspUrl:
          nodeSettings.default_lsp_url ||
          nodeSettings.default_maker_url ||
          'http://localhost:8000',
        makerUrls: Array.isArray(nodeSettings.maker_urls)
          ? nodeSettings.maker_urls
          : [],
        nodeConnectionString: nodeConnectionString || 'http://localhost:3001',
        proxyEndpoint: nodeSettings.proxy_endpoint || '',
        rpcConnectionUrl: nodeSettings.rpc_connection_url || '',
      },
    }
  )

  const {
    showBackupModal,
    setShowBackupModal,
    isBackupInProgress,
    control: backupControl,
    handleSubmit: handleBackupSubmit,
    formState: backupFormState,
    backupPath,
    handleBackup,
    selectBackupFolder,
  } = useBackup({ nodeSettings })

  const fetchNodeLogs = async () => {
    // Skip if too many failures
    if (isLogsFetchDisabled) {
      return
    }

    try {
      setIsLoadingLogs(true)
      console.log('Fetching logs with params:', { currentPage, maxLogEntries })

      const result = await invoke<{ logs: string[]; total: number }>(
        'get_node_logs',
        {
          page: currentPage,
          pageSize: maxLogEntries,
        }
      )

      console.log('Received logs:', result)

      if (result && Array.isArray(result.logs)) {
        setNodeLogs(result.logs)
        setTotalLogs(result.total)
        // Reset retry count on success
        setLogsFetchRetries(0)
        setIsLogsFetchDisabled(false)
      } else {
        console.error('Invalid logs format received:', result)
        toast.error('Invalid logs format received from server')
      }
    } catch (error) {
      console.error('Failed to fetch node logs:', error)
      toast.error(
        `Failed to load logs: ${error instanceof Error ? error.message : 'Unknown error'}`
      )

      // Increment retry count and implement backoff
      const newRetryCount = logsFetchRetries + 1
      setLogsFetchRetries(newRetryCount)

      if (newRetryCount >= maxLogsFetchRetries) {
        console.warn(
          'Too many log fetch failures, disabling polling for 2 minutes'
        )
        setIsLogsFetchDisabled(true)
        toast.error('Log loading temporarily disabled due to errors')
        // Re-enable after 2 minutes
        setTimeout(() => {
          setIsLogsFetchDisabled(false)
          setLogsFetchRetries(0)
        }, 120000) // 2 minutes
      }
    } finally {
      setIsLoadingLogs(false)
    }
  }

  // Optimize the useEffect for data loading
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true)
        // Ensure we start from page 1
        setCurrentPage(1)
        await fetchNodeLogs()
      } catch (error) {
        console.error('Error loading initial data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadInitialData()

    // Set up polling with a cleanup function and longer interval
    const logsInterval = setInterval(fetchNodeLogs, 10000) // Poll logs every 10 seconds instead of 5

    return () => {
      clearInterval(logsInterval)
    }
  }, []) // Empty dependency array to run only on mount

  // Add effect to refetch when page or page size changes
  useEffect(() => {
    if (!isLoading) {
      fetchNodeLogs()
    }
  }, [currentPage, maxLogEntries])

  useEffect(() => {
    reset({
      bearerToken: nodeSettings.bearer_token || '',
      bitcoinUnit,
      defaultMakerUrl: nodeSettings.default_maker_url || '',
      fiatCurrency,
      indexerUrl: nodeSettings.indexer_url || '',
      language: language || 'en',
      lspUrl:
        nodeSettings.default_lsp_url ||
        nodeSettings.default_maker_url ||
        'http://localhost:8000',
      makerUrls: Array.isArray(nodeSettings.maker_urls)
        ? nodeSettings.maker_urls
        : [],
      nodeConnectionString:
        nodeSettings.node_url ||
        nodeConnectionString ||
        'http://localhost:3001',
      proxyEndpoint: nodeSettings.proxy_endpoint || '',
      rpcConnectionUrl: nodeSettings.rpc_connection_url || '',
    })
  }, [bitcoinUnit, language, nodeConnectionString, nodeSettings, reset])

  const handleRestartNode = async () => {
    try {
      setIsSaving(true)

      // First, stop the current node
      await invoke('stop_node')
      toast.info('Stopping current node...')

      // Wait a moment for the node to fully stop
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Then start the node with the updated settings
      toast.info('Starting node with new settings...')

      await invoke('start_node', {
        accountName: currentAccount.name,
        daemonListeningPort: currentAccount.daemon_listening_port,
        datapath: currentAccount.datapath,
        ldkPeerListeningPort: currentAccount.ldk_peer_listening_port,
        network: currentAccount.network,
      })
      await waitForNodeReady({
        daemonPort: currentAccount.daemon_listening_port,
      })

      toast.success('Node restarted successfully with new settings')

      // Show success modal
      setModal({
        autoClose: true,
        details: '',
        isOpen: true,
        message: 'The node has been restarted with your new settings.',
        title: 'Node Restarted',
        type: ModalType.SUCCESS,
      })
    } catch (error) {
      toast.error(
        `Failed to restart node: ${error instanceof Error ? error.message : 'Unknown error'}`
      )

      // Show error modal
      setModal({
        autoClose: false,
        details: error instanceof Error ? error.message : 'Unknown error',
        isOpen: true,
        message: 'There was a problem restarting the node.',
        title: 'Node Restart Failed',
        type: ModalType.ERROR,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSave = async (data: FormFields) => {
    try {
      setIsSaving(true)

      // Batch state updates to reduce renders
      const updates = async () => {
        dispatch(setBitcoinUnit(data.bitcoinUnit))
        dispatch(setFiatCurrency(data.fiatCurrency as any))
        dispatch(setLanguage(data.language))
        dispatch(setNodeConnectionString(data.nodeConnectionString))

        await invoke('update_account', {
          bearerToken: data.bearerToken || null,
          daemonListeningPort: currentAccount.daemon_listening_port,
          datapath: currentAccount.datapath,
          defaultLspUrl: data.lspUrl,
          defaultMakerUrl: data.defaultMakerUrl,
          indexerUrl: data.indexerUrl,
          language: data.language || 'en',
          ldkPeerListeningPort: currentAccount.ldk_peer_listening_port,
          makerUrls: data.makerUrls.join(','),
          name: currentAccount.name,
          network: currentAccount.network,
          nodeUrl: data.nodeConnectionString,
          proxyEndpoint: data.proxyEndpoint,
          rpcConnectionUrl: data.rpcConnectionUrl,
        })

        dispatch(
          nodeSettingsActions.setNodeSettings({
            ...currentAccount,
            bearer_token: data.bearerToken || null,
            daemon_listening_port: currentAccount.daemon_listening_port,
            default_lsp_url: data.lspUrl,
            default_maker_url: data.defaultMakerUrl,
            indexer_url: data.indexerUrl,
            language: data.language || 'en',
            ldk_peer_listening_port: currentAccount.ldk_peer_listening_port,
            maker_urls: data.makerUrls,
            node_url: data.nodeConnectionString,
            proxy_endpoint: data.proxyEndpoint,
            rpc_connection_url: data.rpcConnectionUrl,
          })
        )
      }

      await updates()

      // Note: WebSocket connection management is handled by the market maker page
      // We just update the settings here - the market maker page will detect the change
      // and reconnect automatically if needed

      // Check if node *connection* settings actually changed. Maker/LSP URLs
      // don't require a node restart, so they must never trip this check.
      // Compare against the same normalized baselines used to seed the form —
      // otherwise a null/undefined stored field (shown as '') or a node_url
      // that differs from the settings-slice value falsely reports a change
      // and prompts a needless restart on maker/LSP-only saves.
      const nodeSettingsChanged =
        data.nodeConnectionString !==
          (nodeSettings.node_url ||
            nodeConnectionString ||
            'http://localhost:3001') ||
        data.rpcConnectionUrl !== (nodeSettings.rpc_connection_url || '') ||
        data.indexerUrl !== (nodeSettings.indexer_url || '') ||
        data.proxyEndpoint !== (nodeSettings.proxy_endpoint || '')

      if (nodeSettingsChanged) {
        // Show restart confirmation modal instead of just a toast
        setModal({
          autoClose: false,
          details: '',
          isOpen: true,
          message:
            'Node connection settings have changed. Would you like to restart the node now for changes to take effect?',
          title: 'Node Settings Changed',
          type: ModalType.WARNING,
        })

        // We'll handle the restart in the modal's action buttons
      } else {
        toast.success('Settings saved successfully')

        // Show success modal
        setModal({
          autoClose: true,
          details: '',
          isOpen: true,
          message: 'Your settings have been successfully saved.',
          title: 'Settings Saved',
          type: ModalType.SUCCESS,
        })
      }
    } catch (error) {
      toast.error(
        `Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`
      )

      // Show error modal
      setModal({
        autoClose: false,
        details: error instanceof Error ? error.message : 'Unknown error',
        isOpen: true,
        message: 'There was a problem saving your settings.',
        title: 'Settings Save Failed',
        type: ModalType.ERROR,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const closeModal = () => {
    // If it's a warning modal about node settings changed, we need to ask about restart
    if (
      modal.type === ModalType.WARNING &&
      modal.title === 'Node Settings Changed'
    ) {
      setModal((prev) => ({ ...prev, isOpen: false }))

      // Show restart confirmation modal
      setShowRestartConfirmation(true)
    } else {
      setModal((prev) => ({ ...prev, isOpen: false }))
    }
  }

  const handleLogout = async () => {
    setShowLogoutConfirmation(true)
  }

  const confirmLogout = async () => {
    try {
      const lockResponse = await lock().unwrap()

      if (lockResponse !== undefined && lockResponse !== null) {
        await invoke('nwc_stop_service').catch(() => undefined)
        await invoke('stop_node')
        dispatch(nodeSettingsActions.resetNodeSettings())
        toast.success('Logout successful')
      } else {
        throw new Error('Node lock unsuccessful')
      }
    } catch (error) {
      toast.error(
        `Logout failed: ${error instanceof Error ? error.message : ''}. Redirecting anyway.`
      )
    } finally {
      navigate(WALLET_SETUP_PATH)
      setShowLogoutConfirmation(false)
    }
  }

  const handleUndo = () => {
    reset({
      bearerToken: nodeSettings.bearer_token || '',
      bitcoinUnit,
      defaultMakerUrl: nodeSettings.default_maker_url || '',
      fiatCurrency,
      indexerUrl: nodeSettings.indexer_url || '',
      language: language || 'en',
      lspUrl:
        nodeSettings.default_lsp_url ||
        nodeSettings.default_maker_url ||
        'http://localhost:8000',
      makerUrls: Array.isArray(nodeSettings.maker_urls)
        ? nodeSettings.maker_urls
        : [],
      nodeConnectionString: nodeConnectionString || 'http://localhost:3001',
      proxyEndpoint: nodeSettings.proxy_endpoint || '',
      rpcConnectionUrl: nodeSettings.rpc_connection_url || '',
    })
  }

  const handleShutdown = () => {
    setShowShutdownConfirmation(true)
  }

  const confirmShutdown = async () => {
    try {
      setIsShuttingDown(true)
      await shutdown().unwrap()
      dispatch(nodeSettingsActions.resetNodeSettings())
      navigate(WALLET_SETUP_PATH)
      toast.success('Node shut down successfully')
    } catch (error) {
      toast.error('Failed to shut down node')
    } finally {
      setIsShuttingDown(false)
      setShowShutdownConfirmation(false)
    }
  }

  const handleExportLogs = async () => {
    try {
      const filePath = await save({
        defaultPath: `node-logs-${new Date().toISOString().split('T')[0]}.txt`,
        filters: [
          {
            extensions: ['txt'],
            name: 'Log Files',
          },
        ],
      })

      if (filePath) {
        await invoke('save_logs_to_file', { filePath })
        toast.success('Logs exported successfully')
      }
    } catch (error) {
      toast.error('Failed to export logs')
    }
  }

  const isLocalNode = !!currentAccount.datapath

  // Add useEffect for polling node info separately to avoid blocking
  const [nodeInfo] = nodeApi.endpoints.nodeInfo.useLazyQuery()
  const nodeInfoState = nodeApi.endpoints.nodeInfo.useQueryState()
  const isNodeRunning = nodeInfoState.isSuccess

  // Separate useEffect for node info polling - reduced frequency to improve performance
  useEffect(() => {
    nodeInfo()

    const interval = setInterval(() => {
      nodeInfo()
    }, 60000) // Poll node info every 60 seconds instead of 10 seconds

    return () => clearInterval(interval)
  }, [nodeInfo])

  // If the page is loading, show a loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8 px-4">
        <div className="w-12 h-12 mb-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <h2 className="text-xl font-bold text-white mb-1">
          {t('settings.loadingSettings')}
        </h2>
        <p className="text-content-secondary text-sm">
          {t('settings.pleaseWait')}
        </p>
      </div>
    )
  }

  const inputCls =
    'w-full px-4 py-2.5 text-sm text-white bg-surface-overlay/30 border border-border-default/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors'
  const selectCls = `${inputCls} appearance-none pr-10`

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ── Left column: forms ── */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <form
            className="flex flex-col gap-6"
            onSubmit={handleSubmit(handleSave)}
          >
            {/* Application Settings */}
            <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-overlay">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-divider/10">
                <Settings className="w-5 h-5 text-primary flex-shrink-0" />
                <h2 className="text-base font-bold text-white">
                  {t('settings.applicationSettings')}
                </h2>
              </div>

              <div className="p-5 space-y-5">
                {/* Capabilities */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-content-secondary">
                    {t('settings.capabilities', {
                      defaultValue: 'Capabilities',
                    })}
                  </label>
                  <p className="text-xs text-content-tertiary">
                    {t('settings.capabilitiesDescription', {
                      defaultValue:
                        'Choose which parts of KaleidoSwap are shown — the node, the AI brain, or both.',
                    })}
                  </p>
                  <div className="flex gap-1 rounded-xl bg-surface-base/35 p-1 w-fit mt-2">
                    {APP_MODE_OPTIONS.map((opt) => (
                      <button
                        className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 focus:outline-none ${
                          appMode === opt.mode
                            ? 'bg-primary/15 text-primary border border-primary/30'
                            : 'text-content-secondary hover:text-white border border-transparent'
                        }`}
                        key={opt.mode}
                        onClick={() => dispatch(setAppMode(opt.mode))}
                        type="button"
                      >
                        {t(opt.labelKey, { defaultValue: opt.fallback })}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bitcoin Unit */}
                <Controller
                  control={control}
                  name="bitcoinUnit"
                  render={({ field }) => (
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-content-secondary">
                        {t('settings.bitcoinUnit')}
                      </label>
                      <div className="relative">
                        <select {...field} className={selectCls}>
                          <option value="SAT">
                            {t('settings.bitcoinUnitSat')}
                          </option>
                          <option value="BTC">
                            {t('settings.bitcoinUnitBtc')}
                          </option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-content-secondary pointer-events-none" />
                      </div>
                    </div>
                  )}
                />

                {/* Fiat Currency */}
                <Controller
                  control={control}
                  name="fiatCurrency"
                  render={({ field }) => (
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-content-secondary">
                        {t('settings.fiatCurrency')}
                      </label>
                      <p className="text-xs text-content-tertiary">
                        {t('settings.fiatCurrencyDescription')}
                      </p>
                      <div className="relative">
                        <select {...field} className={selectCls}>
                          {SUPPORTED_CURRENCIES.map((currency) => (
                            <option key={currency} value={currency}>
                              {CURRENCY_SYMBOLS[currency]}
                              {CURRENCY_LABELS[currency]}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-content-secondary pointer-events-none" />
                      </div>
                    </div>
                  )}
                />

                {/* Theme (disabled) */}
                <div className="space-y-1.5 opacity-50 pointer-events-none">
                  <label className="block text-sm font-medium text-content-secondary">
                    {t('settings.theme')}
                  </label>
                  <div className="flex rounded-lg overflow-hidden border border-border-default/50 w-fit">
                    <button
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-[#12131C]"
                      disabled
                      type="button"
                    >
                      <Moon className="w-4 h-4" />
                      {t('settings.themeDark')}
                    </button>
                  </div>
                </div>

                {/* Language */}
                <Controller
                  control={control}
                  name="language"
                  render={({ field }) => (
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-content-secondary">
                        {t('settings.language')}
                      </label>
                      <div className="relative">
                        <select {...field} className={selectCls}>
                          {Object.entries(LANGUAGES).map(
                            ([code, { name, flag }]) => (
                              <option key={code} value={code}>
                                {flag} {name}
                              </option>
                            )
                          )}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-content-secondary pointer-events-none" />
                      </div>
                    </div>
                  )}
                />
              </div>
            </section>

            {/* Maker & LSP Settings */}
            <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-overlay">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-divider/10">
                <Store className="w-5 h-5 text-primary flex-shrink-0" />
                <h2 className="text-base font-bold text-white">
                  {t('settings.makerLspSettings', 'Maker & LSP Settings')}
                </h2>
              </div>
              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-content-secondary">
                    {t('settings.makerUrls')}
                  </label>
                  <Controller
                    control={control}
                    name="makerUrls"
                    render={({ field }) => (
                      <div className="space-y-2">
                        {(field.value ?? []).map((url, index) => (
                          <div className="flex items-center gap-2" key={index}>
                            <div className="flex-1 relative">
                              <input
                                className={inputCls}
                                onChange={(e) => {
                                  const n = [...(field.value ?? [])]
                                  n[index] = e.target.value
                                  field.onChange(n)
                                }}
                                placeholder={
                                  t('settings.makerUrlPlaceholder') ||
                                  'Maker URL'
                                }
                                type="text"
                                value={url}
                              />
                              {url === watch('defaultMakerUrl') && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs bg-primary/15 text-primary rounded-md">
                                  {t('settings.default')}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <button
                                className="rounded p-1.5 text-content-secondary transition-colors hover:bg-primary/15 hover:text-primary"
                                onClick={() => setValue('defaultMakerUrl', url)}
                                title={
                                  url === watch('defaultMakerUrl')
                                    ? t('settings.currentDefault')
                                    : t('settings.setAsDefault')
                                }
                                type="button"
                              >
                                <Star
                                  className={`w-4 h-4 ${url === watch('defaultMakerUrl') ? 'fill-current' : ''}`}
                                />
                              </button>
                              <button
                                className="rounded p-1.5 text-content-secondary transition-colors hover:bg-status-danger/15 hover:text-status-danger"
                                onClick={() => {
                                  const n = (field.value ?? []).filter(
                                    (_, i) => i !== index
                                  )
                                  field.onChange(n)
                                  if (url === watch('defaultMakerUrl'))
                                    setValue('defaultMakerUrl', n[0] || '')
                                }}
                                title={t('settings.removeUrl')}
                                type="button"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          className="w-full inline-flex items-center justify-center h-10 rounded-lg border border-white/30 hover:border-white/50 bg-transparent hover:bg-white/5 text-sm font-semibold text-white transition-colors"
                          onClick={() => {
                            const n = [...(field.value ?? []), '']
                            field.onChange(n)
                            if ((field.value ?? []).length === 0)
                              setValue('defaultMakerUrl', '')
                          }}
                          type="button"
                        >
                          {t('settings.addMakerUrl')}
                        </button>
                      </div>
                    )}
                  />
                </div>

                {/* LSP URL — usually matches the default Maker URL */}
                <Controller
                  control={control}
                  name="lspUrl"
                  render={({ field }) => (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label className="block text-sm font-medium text-content-secondary">
                          {t('settings.lspUrl')}
                        </label>
                        {watch('defaultMakerUrl') &&
                          field.value !== watch('defaultMakerUrl') && (
                            <button
                              className="text-xs font-medium text-primary hover:underline"
                              onClick={() =>
                                field.onChange(watch('defaultMakerUrl'))
                              }
                              type="button"
                            >
                              {t(
                                'settings.matchMakerUrl',
                                'Match default Maker URL'
                              )}
                            </button>
                          )}
                      </div>
                      <input
                        {...field}
                        className={inputCls}
                        placeholder={t('settings.lspUrlPlaceholder')}
                        type="text"
                      />
                      <p className="text-xs text-content-tertiary">
                        {t(
                          'settings.lspUrlHint',
                          'The LSP URL usually matches your default Maker URL.'
                        )}
                      </p>
                    </div>
                  )}
                />
              </div>
            </section>

            {/* Node Connection Settings */}
            <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-overlay">
              <div className="flex items-center justify-between px-5 py-4 border-b border-divider/10">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-primary flex-shrink-0" />
                  <h2 className="text-base font-bold text-white">
                    {t('settings.nodeConnectionSettings')}
                  </h2>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-status-warning/10 border border-status-warning/20 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-status-warning" />
                  <span className="text-xs text-status-warning">
                    {t('settings.requiresRestart')}
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <Controller
                  control={control}
                  name="nodeConnectionString"
                  render={({ field }) => (
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-content-secondary">
                        {t('settings.nodeConnectionString')}
                      </label>
                      <input
                        {...field}
                        className={inputCls}
                        placeholder="e.g., http://localhost:3001"
                        type="text"
                      />
                    </div>
                  )}
                />
                <Controller
                  control={control}
                  name="rpcConnectionUrl"
                  render={({ field }) => (
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-content-secondary">
                        {t('settings.bitcoindRpc')}
                      </label>
                      <input
                        {...field}
                        className={inputCls}
                        placeholder="Bitcoin RPC URL"
                        type="text"
                      />
                    </div>
                  )}
                />
                <Controller
                  control={control}
                  name="indexerUrl"
                  render={({ field }) => (
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-content-secondary">
                        {t('settings.indexerUrl')}
                      </label>
                      <input
                        {...field}
                        className={inputCls}
                        placeholder="Indexer service URL"
                        type="text"
                      />
                    </div>
                  )}
                />
                <Controller
                  control={control}
                  name="proxyEndpoint"
                  render={({ field }) => (
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-content-secondary">
                        {t('settings.rgbProxyEndpoint')}
                      </label>
                      <input
                        {...field}
                        className={inputCls}
                        placeholder={t('settings.rgbProxyPlaceholder')}
                        type="text"
                      />
                    </div>
                  )}
                />
                <Controller
                  control={control}
                  name="bearerToken"
                  render={({ field }) => (
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-content-secondary">
                        {t('settings.bearerToken')}
                      </label>
                      <input
                        {...field}
                        className={inputCls}
                        placeholder={t('settings.bearerTokenPlaceholder')}
                        type="text"
                      />
                    </div>
                  )}
                />
              </div>
            </section>

            {/* Sticky save bar */}
            <div className="sticky bottom-4">
              <div className="flex gap-3">
                <button
                  className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-lg border border-white/30 hover:border-white/50 bg-transparent hover:bg-white/5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
                  disabled={isSaving}
                  onClick={handleUndo}
                  type="button"
                >
                  <Undo className="w-4 h-4" />
                  {t('settings.resetChanges')}
                </button>
                <button
                  className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-primary hover:bg-primary-emphasis text-sm font-semibold text-[#12131C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#12131C]/40 border-t-[#12131C] rounded-full animate-spin" />
                      {t('settings.saving')}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {t('settings.saveSettings')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* ── Right column: status + actions ── */}
        <div className="flex flex-col gap-6">
          {/* Security & Backup */}
          <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-overlay">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-divider/10">
              <Shield className="w-5 h-5 text-primary flex-shrink-0" />
              <h2 className="text-base font-bold text-white">
                {t('settings.securityBackup')}
              </h2>
            </div>
            <div className="p-4 space-y-3">
              <button
                className="w-full group flex items-center justify-between gap-3 p-4 rounded-xl border border-border-default/50 bg-surface-overlay/30 hover:bg-surface-elevated transition-colors text-white"
                onClick={() => setShowMnemonicModal(true)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/15 transition-colors">
                    <Lock className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold">
                      {t('settings.viewRecoveryPhrase')}
                    </div>
                    <div className="text-xs text-content-secondary">
                      {t('settings.accessSeedPhrase')}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-content-secondary group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button
                className="w-full group flex items-center justify-between gap-3 p-4 rounded-xl border border-border-default/50 bg-surface-overlay/30 hover:bg-surface-elevated transition-colors text-white"
                onClick={() => setShowChangePasswordModal(true)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/15 transition-colors">
                    <KeyRound className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold">
                      {t('settings.changePassword', 'Change Password')}
                    </div>
                    <div className="text-xs text-content-secondary">
                      {t(
                        'settings.changePasswordDescription',
                        'Update wallet encryption password'
                      )}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-content-secondary group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                className="w-full group flex items-center justify-between gap-3 p-4 rounded-xl border border-border-default/50 bg-surface-overlay/30 hover:bg-surface-elevated transition-colors text-white"
                onClick={() => setShowBackupModal(true)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/15 transition-colors">
                    <Download className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold">
                      {t('settings.backupWallet')}
                    </div>
                    <div className="text-xs text-content-secondary">
                      Export encrypted backup wallet
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-content-secondary group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </section>

          {/* Node Status */}
          <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-overlay">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-divider/10">
              <Activity className="w-5 h-5 text-primary flex-shrink-0" />
              <h2 className="text-base font-bold text-white">
                {t('settings.nodeStatus')}
              </h2>
            </div>
            <div className="p-4 space-y-3">
              {/* Status pill */}
              <div
                className={`flex items-center gap-3 p-3 rounded-xl border ${isNodeRunning ? 'bg-status-success/10 border-status-success/20' : 'bg-status-danger/10 border-status-danger/20'}`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isNodeRunning ? 'bg-status-success animate-pulse' : 'bg-status-danger'}`}
                />
                <span
                  className={`text-sm font-semibold ${isNodeRunning ? 'text-status-success' : 'text-status-danger'}`}
                >
                  {isNodeRunning
                    ? t('settings.nodeRunning')
                    : t('settings.nodeOffline')}
                </span>
              </div>

              {/* Connection type */}
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border-default/50 bg-surface-overlay/30">
                <Server className="w-4 h-4 text-content-tertiary flex-shrink-0" />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-content-tertiary">
                    {t('settings.connectionType')}
                  </p>
                  <p className="text-sm font-medium text-white">
                    {isLocalNode
                      ? t('settings.localNode')
                      : t('settings.remoteNode')}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  className="inline-flex items-center justify-center gap-2 h-10 rounded-lg border border-white/30 hover:border-white/50 bg-transparent hover:bg-white/5 text-sm font-medium text-white transition-colors"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4" />
                  {t('settings.logout')}
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 h-10 rounded-lg border border-status-danger/20 bg-status-danger/10 text-sm font-medium text-status-danger hover:bg-status-danger/20 transition-colors"
                  onClick={handleShutdown}
                >
                  <Power className="w-4 h-4" />
                  {t('settings.shutdown')}
                </button>
              </div>
            </div>
          </section>

          {/* App Version */}
          <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-overlay">
            <AppVersion showDetailed={true} />
          </section>
        </div>
      </div>

      {/* Logs */}
      {isLocalNode && (
        <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-overlay">
          <div className="flex items-center justify-between px-5 py-4 border-b border-divider/10">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-primary flex-shrink-0" />
              <h2 className="text-base font-bold text-white">
                {t('settings.nodeLogs')}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border-default/50 bg-surface-overlay/30 text-sm text-content-secondary">
                <span>{t('settings.show')}</span>
                <select
                  className="bg-transparent text-white text-sm focus:outline-none border-0"
                  onChange={(e) => {
                    setMaxLogEntries(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  value={maxLogEntries}
                >
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="500">500</option>
                </select>
                <span>{t('settings.entries')}</span>
              </div>
              <div className="flex gap-1">
                <button
                  className="p-2 rounded-lg border border-white/30 hover:border-white/50 bg-transparent hover:bg-white/5 text-white transition-colors disabled:opacity-40"
                  disabled={nodeLogs.length === 0 || isLoadingLogs}
                  onClick={handleExportLogs}
                  title={t('settings.exportLogs')}
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  className="p-2 rounded-lg border border-white/30 hover:border-white/50 bg-transparent hover:bg-white/5 text-white transition-colors disabled:opacity-40"
                  disabled={isLoadingLogs}
                  onClick={() => {
                    setCurrentPage(1)
                    fetchNodeLogs()
                  }}
                  title={t('settings.refreshLogs')}
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin' : ''}`}
                  />
                </button>
                <button
                  className="p-2 rounded-lg border border-white/30 hover:border-white/50 bg-transparent hover:bg-white/5 text-white transition-colors disabled:opacity-40"
                  disabled={nodeLogs.length === 0 || isLoadingLogs}
                  onClick={() => setNodeLogs([])}
                  title={t('settings.clearLogs')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-5 py-2 border-b border-divider/10 bg-surface-base/50">
            <span className="text-xs text-content-tertiary">
              {t('settings.liveNodeLogs')}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-content-tertiary">
                {t('settings.page')} {currentPage} {t('settings.of')}{' '}
                {Math.max(1, Math.ceil(totalLogs / maxLogEntries))} ({totalLogs}{' '}
                {t('settings.totalEntries')})
              </span>
              <div className="flex gap-1">
                <button
                  className="px-2 py-1 text-xs rounded-md border border-white/30 hover:border-white/50 bg-transparent hover:bg-white/5 text-white transition-colors disabled:opacity-40"
                  disabled={currentPage === 1 || isLoadingLogs}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  {t('settings.previous')}
                </button>
                <button
                  className="px-2 py-1 text-xs rounded-md border border-white/30 hover:border-white/50 bg-transparent hover:bg-white/5 text-white transition-colors disabled:opacity-40"
                  disabled={
                    currentPage >= Math.ceil(totalLogs / maxLogEntries) ||
                    isLoadingLogs
                  }
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  {t('settings.next')}
                </button>
              </div>
            </div>
          </div>

          <div className="h-[500px] overflow-auto relative bg-surface-base/95">
            {isLoadingLogs ? (
              <div className="absolute inset-0 flex items-center justify-center bg-surface-base/50">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <span className="text-sm text-content-secondary">
                    {t('settings.loadingLogs')}
                  </span>
                </div>
              </div>
            ) : nodeLogs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-content-tertiary gap-2">
                <Activity className="w-4 h-4" />
                <span className="text-sm">{t('settings.noLogsAvailable')}</span>
              </div>
            ) : (
              <TerminalLogDisplay logs={nodeLogs} maxEntries={maxLogEntries} />
            )}
          </div>
        </section>
      )}

      <MnemonicViewerModal
        isOpen={showMnemonicModal}
        onClose={() => setShowMnemonicModal(false)}
      />

      <ChangePasswordModal
        accountName={currentAccount?.name ?? ''}
        onClose={() => setShowChangePasswordModal(false)}
        showModal={showChangePasswordModal}
      />

      <BackupModal
        backupPath={backupPath}
        control={backupControl}
        formState={backupFormState}
        isBackupInProgress={isBackupInProgress}
        onClose={() => setShowBackupModal(false)}
        onSelectFolder={selectBackupFolder}
        onSubmit={handleBackupSubmit(handleBackup)}
        setValue={backupControl.setValue}
        showModal={showBackupModal}
      />

      <StatusModal
        autoClose={modal.autoClose}
        autoCloseDelay={3000}
        details={modal.details}
        isOpen={modal.isOpen}
        message={modal.message}
        onClose={closeModal}
        title={modal.title}
        type={modal.type}
      />

      {showRestartConfirmation &&
        createPortal(
          <div
            className={`${pos} inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50`}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget)
                setShowRestartConfirmation(false)
            }}
          >
            <div
              className="bg-surface-overlay p-6 rounded-xl shadow-2xl w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-center text-yellow-500 mb-4">
                <AlertTriangle size={48} />
              </div>
              <h2 className="text-2xl font-bold mb-4 text-center text-white">
                {t('settings.restartNode')}
              </h2>
              <p className="text-content-secondary text-center mb-6">
                {t('settings.restartNodeMessage')}
              </p>
              <div className="flex justify-between space-x-4">
                <button
                  className="flex-1 px-4 py-2 bg-surface-elevated text-white rounded-lg hover:bg-surface-high focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-surface-overlay"
                  onClick={() => setShowRestartConfirmation(false)}
                  type="button"
                >
                  {t('settings.later')}
                </button>
                <button
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-emphasis focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-overlay"
                  onClick={() => {
                    setShowRestartConfirmation(false)
                    handleRestartNode()
                  }}
                  type="button"
                >
                  {t('settings.restartNow')}
                </button>
              </div>
            </div>
          </div>,
          getModalPortalTarget()
        )}

      {showLogoutConfirmation &&
        createPortal(
          <div
            className={`${pos} inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50`}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setShowLogoutConfirmation(false)
            }}
          >
            <div
              className="bg-surface-overlay p-6 rounded-xl shadow-2xl w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-center text-yellow-500 mb-4">
                <AlertTriangle size={48} />
              </div>
              <h2 className="text-2xl font-bold mb-4 text-center text-white">
                {t('settings.confirmLogout')}
              </h2>
              <p className="text-content-secondary text-center mb-6">
                {t('settings.logoutMessage')}
              </p>
              <div className="flex justify-between space-x-4">
                <button
                  className="flex-1 px-4 py-2 bg-surface-elevated text-white rounded-lg hover:bg-surface-high focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-surface-overlay"
                  onClick={() => setShowLogoutConfirmation(false)}
                  type="button"
                >
                  {t('settings.cancel')}
                </button>
                <button
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-emphasis focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-overlay"
                  onClick={confirmLogout}
                  type="button"
                >
                  {t('settings.confirmLogout')}
                </button>
              </div>
            </div>
          </div>,
          getModalPortalTarget()
        )}

      {showShutdownConfirmation &&
        createPortal(
          <div
            className={`${pos} inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50`}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget)
                setShowShutdownConfirmation(false)
            }}
          >
            <div
              className="bg-surface-overlay p-6 rounded-xl shadow-2xl w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              {isShuttingDown ? (
                <div className="flex flex-col items-center py-6">
                  <div className="w-16 h-16 mb-4">
                    <div className="w-full h-full border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    {t('settings.shuttingDownTitle')}
                  </h3>
                  <p className="text-content-secondary text-center">
                    {t('settings.shuttingDownMessage')}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-center text-red-500 mb-4">
                    <AlertTriangle size={48} />
                  </div>
                  <h2 className="text-2xl font-bold mb-4 text-center text-white">
                    {t('settings.confirmShutdown')}
                  </h2>
                  <p className="text-content-secondary text-center mb-6">
                    {t('settings.confirmShutdownMessage')}
                  </p>
                  <div className="flex justify-between space-x-4">
                    <button
                      className="flex-1 px-4 py-2 bg-surface-elevated text-white rounded-lg hover:bg-surface-high focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-surface-overlay"
                      onClick={() => setShowShutdownConfirmation(false)}
                      type="button"
                    >
                      {t('settings.cancel')}
                    </button>
                    <button
                      className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-emphasis focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-overlay"
                      onClick={confirmShutdown}
                      type="button"
                    >
                      {t('settings.confirmShutdown')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          getModalPortalTarget()
        )}
    </div>
  )
}
