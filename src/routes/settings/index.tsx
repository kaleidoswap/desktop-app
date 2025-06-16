import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import {
  ChevronDown,
  LogOut,
  Undo,
  Save,
  Shield,
  Power,
  AlertTriangle,
  Download,
  Activity,
  Settings,
  CheckCircle2,
  XCircle,
  Server,
  Trash2,
  Star,
  RefreshCw,
} from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import { webSocketService } from '../../app/hubs/websocketService'
import { WALLET_SETUP_PATH } from '../../app/router/paths'
import { RootState } from '../../app/store'
import { useAppSelector } from '../../app/store/hooks'
import { AppVersion } from '../../components/AppVersion'
import { BackupModal } from '../../components/BackupModal'
import {
  ModalType,
  ModalTypeValue,
  StatusModal,
} from '../../components/StatusModal'
import { useBackup } from '../../hooks/useBackup'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { nodeSettingsActions } from '../../slices/nodeSettings/nodeSettings.slice'
import {
  setBitcoinUnit,
  setNodeConnectionString,
} from '../../slices/settings/settings.slice'

import { TerminalLogDisplay } from './TerminalLogDisplay'

interface FormFields {
  bitcoinUnit: string
  nodeConnectionString: string
  lspUrl: string
  rpcConnectionUrl: string
  indexerUrl: string
  proxyEndpoint: string
  makerUrls: string[]
  defaultMakerUrl: string
}

export const Component: React.FC = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { bitcoinUnit, nodeConnectionString } = useSelector(
    (state: RootState) => state.settings
  )
  const currentAccount = useAppSelector((state) => state.nodeSettings.data)
  const nodeSettings = useAppSelector((state) => state.nodeSettings.data)

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

  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false)
  const [showShutdownConfirmation, setShowShutdownConfirmation] =
    useState(false)
  const [isShuttingDown, setIsShuttingDown] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [shutdown] = nodeApi.endpoints.shutdown.useLazyQuery()
  const [lock] = nodeApi.endpoints.lock.useLazyQuery()

  const { control, handleSubmit, reset, watch, setValue } = useForm<FormFields>(
    {
      defaultValues: {
        bitcoinUnit,
        defaultMakerUrl: nodeSettings.default_maker_url || '',
        indexerUrl: nodeSettings.indexer_url || '',
        lspUrl: nodeSettings.default_lsp_url || 'http://localhost:8000',
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

  const [nodeLogs, setNodeLogs] = useState<string[]>([])
  const [maxLogEntries, setMaxLogEntries] = useState(200)

  const fetchNodeLogs = async () => {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Logs fetch timeout')), 5000)
      )

      const logsPromise = invoke<string[]>('get_node_logs')

      // Race between the fetch and the timeout
      const logs = (await Promise.race([
        logsPromise,
        timeoutPromise,
      ])) as string[]

      if (logs && Array.isArray(logs)) {
        setNodeLogs(logs)
      }
    } catch (error) {
      console.error('Failed to fetch node logs:', error)
      // Don't update state on error to avoid UI flickering
    }
  }

  const [isLoading, setIsLoading] = useState(true)

  // Optimize the useEffect for data loading
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true)
        await fetchNodeLogs()
      } catch (error) {
        console.error('Error loading initial data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadInitialData()

    // Set up polling with a cleanup function
    const logsInterval = setInterval(fetchNodeLogs, 10000) // Poll logs every 10 seconds

    return () => {
      clearInterval(logsInterval)
    }
  }, [])

  useEffect(() => {
    reset({
      bitcoinUnit,
      defaultMakerUrl: nodeSettings.default_maker_url || '',
      indexerUrl: nodeSettings.indexer_url || '',
      lspUrl: nodeSettings.default_lsp_url || 'http://localhost:8000',
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
  }, [bitcoinUnit, nodeConnectionString, nodeSettings, reset])

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
        dispatch(setNodeConnectionString(data.nodeConnectionString))

        await invoke('update_account', {
          daemonListeningPort: currentAccount.daemon_listening_port,
          datapath: currentAccount.datapath,
          defaultLspUrl: data.lspUrl,
          defaultMakerUrl: data.defaultMakerUrl,
          indexerUrl: data.indexerUrl,
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
            daemon_listening_port: currentAccount.daemon_listening_port,
            default_lsp_url: data.lspUrl,
            default_maker_url: data.defaultMakerUrl,
            indexer_url: data.indexerUrl,
            ldk_peer_listening_port: currentAccount.ldk_peer_listening_port,
            maker_urls: data.makerUrls,
            node_url: data.nodeConnectionString,
            proxy_endpoint: data.proxyEndpoint,
            rpc_connection_url: data.rpcConnectionUrl,
          })
        )
      }

      await updates()

      // Update websocket connection if maker URL changed
      if (data.defaultMakerUrl !== nodeSettings.default_maker_url) {
        webSocketService.updateUrl(data.defaultMakerUrl)
      }

      // Check if node connection settings were changed
      const nodeSettingsChanged =
        data.nodeConnectionString !== nodeConnectionString ||
        data.rpcConnectionUrl !== nodeSettings.rpc_connection_url ||
        data.indexerUrl !== nodeSettings.indexer_url ||
        data.proxyEndpoint !== nodeSettings.proxy_endpoint

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

  const [showRestartConfirmation, setShowRestartConfirmation] = useState(false)

  const handleLogout = async () => {
    setShowLogoutConfirmation(true)
  }

  const confirmLogout = async () => {
    try {
      const lockResponse = await lock().unwrap()

      if (lockResponse !== undefined && lockResponse !== null) {
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
      bitcoinUnit,
      defaultMakerUrl: nodeSettings.default_maker_url || '',
      indexerUrl: nodeSettings.indexer_url || '',
      lspUrl: nodeSettings.default_lsp_url || 'http://localhost:8000',
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

  // Separate useEffect for node info polling
  useEffect(() => {
    nodeInfo()

    const interval = setInterval(() => {
      nodeInfo()
    }, 10000)

    return () => clearInterval(interval)
  }, [nodeInfo])

  // If the page is loading, show a loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen py-8 px-4">
        <div className="w-16 h-16 mb-8">
          <div className="w-full h-full border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Loading Settings</h2>
        <p className="text-gray-400">
          Please wait while we load your settings...
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen py-8 px-4">
      {/* Page Header */}
      <div className="w-full max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-10 h-10 text-blue-400" />
          <div>
            <h1 className="text-4xl font-bold text-white">Settings</h1>
            <p className="text-gray-400">
              Manage your node and application preferences
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="w-full max-w-7xl mx-auto space-y-8">
        {/* Settings Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Application Settings */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSubmit(handleSave)}>
              {/* Application Settings Card */}
              <div className="bg-gray-800/80 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
                <div className="flex items-center gap-2 mb-6">
                  <Settings className="w-5 h-5 text-blue-400" />
                  <h3 className="text-xl font-semibold text-white">
                    Application Settings
                  </h3>
                </div>

                <div className="space-y-8">
                  {/* General Settings */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-4">
                      General Settings
                    </h4>
                    <div className="space-y-6">
                      {/* Bitcoin Unit */}
                      <Controller
                        control={control}
                        name="bitcoinUnit"
                        render={({ field }) => (
                          <div className="group transition-all duration-300 hover:translate-x-1">
                            <label className="block text-sm font-semibold text-gray-300 mb-2">
                              Bitcoin Unit
                            </label>
                            <div className="relative">
                              <select
                                {...field}
                                className="block w-full pl-4 pr-10 py-3 text-white bg-gray-700/50 border border-gray-600 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200"
                              >
                                <option value="SAT">Satoshi (SAT)</option>
                                <option value="BTC">Bitcoin (BTC)</option>
                              </select>
                              <ChevronDown className="absolute right-3 top-3.5 h-5 w-5 text-gray-400 pointer-events-none" />
                            </div>
                          </div>
                        )}
                      />

                      {/* LSP URL */}
                      <Controller
                        control={control}
                        name="lspUrl"
                        render={({ field }) => (
                          <div className="group transition-all duration-300 hover:translate-x-1">
                            <label className="block text-sm font-semibold text-gray-300 mb-2">
                              LSP URL
                            </label>
                            <input
                              {...field}
                              className="w-full px-4 py-3 text-white bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200"
                              placeholder="e.g., http://localhost:8000"
                              type="text"
                            />
                          </div>
                        )}
                      />
                    </div>
                  </div>

                  {/* Maker Settings */}
                  <div className="pt-6 border-t border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-400 mb-4">
                      Maker Settings
                    </h4>
                    <div className="space-y-6">
                      {/* Additional Maker URLs */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-4">
                          Maker URLs
                        </label>
                        <Controller
                          control={control}
                          name="makerUrls"
                          render={({ field }) => (
                            <div className="space-y-4">
                              {field.value.map((url, index) => (
                                <div className="flex gap-2" key={index}>
                                  <div className="flex-1 relative group">
                                    <input
                                      className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200"
                                      onChange={(e) => {
                                        const newUrls = [...field.value]
                                        newUrls[index] = e.target.value
                                        field.onChange(newUrls)
                                      }}
                                      placeholder="Maker URL"
                                      type="text"
                                      value={url}
                                    />
                                    {url === watch('defaultMakerUrl') && (
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded-md">
                                        Default
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      className={`p-3 rounded-lg transition-colors ${
                                        url === watch('defaultMakerUrl')
                                          ? 'bg-blue-500/20 text-blue-400'
                                          : 'bg-gray-600/20 text-gray-400 hover:bg-blue-500/20 hover:text-blue-400'
                                      }`}
                                      onClick={() => {
                                        setValue('defaultMakerUrl', url)
                                      }}
                                      title={
                                        url === watch('defaultMakerUrl')
                                          ? 'Current default'
                                          : 'Set as default'
                                      }
                                      type="button"
                                    >
                                      <Star
                                        className={`w-5 h-5 ${
                                          url === watch('defaultMakerUrl')
                                            ? 'fill-current'
                                            : ''
                                        }`}
                                      />
                                    </button>
                                    <button
                                      className="p-3 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition-colors"
                                      onClick={() => {
                                        const newUrls = field.value.filter(
                                          (_, i) => i !== index
                                        )
                                        field.onChange(newUrls)
                                        // If we're removing the default URL, clear it
                                        if (url === watch('defaultMakerUrl')) {
                                          setValue(
                                            'defaultMakerUrl',
                                            newUrls[0] || ''
                                          )
                                        }
                                      }}
                                      title="Remove URL"
                                      type="button"
                                    >
                                      <Trash2 className="w-5 h-5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                              <button
                                className="w-full px-4 py-3 border border-blue-500/20 text-blue-500 rounded-lg hover:bg-blue-500/10 transition-colors"
                                onClick={() => {
                                  const newUrls = [...field.value, '']
                                  field.onChange(newUrls)
                                  // If this is the first URL, set it as default
                                  if (field.value.length === 0) {
                                    setValue('defaultMakerUrl', '')
                                  }
                                }}
                                type="button"
                              >
                                Add Maker URL
                              </button>
                            </div>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Node Connection Settings Card */}
              <div className="bg-gray-800/80 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Server className="w-5 h-5 text-blue-400" />
                    <h3 className="text-xl font-semibold text-white">
                      Node Connection Settings
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    <span className="text-xs text-yellow-500">
                      Requires restart
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Node Connection String */}
                  <Controller
                    control={control}
                    name="nodeConnectionString"
                    render={({ field }) => (
                      <div className="group transition-all duration-300 hover:translate-x-1">
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                          Node Connection String
                        </label>
                        <input
                          {...field}
                          className="w-full px-4 py-3 text-white bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200"
                          placeholder="e.g., http://localhost:3001"
                          type="text"
                        />
                      </div>
                    )}
                  />

                  {/* RPC Connection URL */}
                  <Controller
                    control={control}
                    name="rpcConnectionUrl"
                    render={({ field }) => (
                      <div className="group transition-all duration-300 hover:translate-x-1">
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                          Bitcoind RPC Connection URL
                        </label>
                        <input
                          {...field}
                          className="w-full px-4 py-3 text-white bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200"
                          placeholder="Bitcoin RPC URL"
                          type="text"
                        />
                      </div>
                    )}
                  />

                  {/* Indexer URL */}
                  <Controller
                    control={control}
                    name="indexerUrl"
                    render={({ field }) => (
                      <div className="group transition-all duration-300 hover:translate-x-1">
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                          Indexer URL
                        </label>
                        <input
                          {...field}
                          className="w-full px-4 py-3 text-white bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200"
                          placeholder="Indexer service URL"
                          type="text"
                        />
                      </div>
                    )}
                  />

                  {/* Proxy Endpoint */}
                  <Controller
                    control={control}
                    name="proxyEndpoint"
                    render={({ field }) => (
                      <div className="group transition-all duration-300 hover:translate-x-1">
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                          RGB Proxy Endpoint
                        </label>
                        <input
                          {...field}
                          className="w-full px-4 py-3 text-white bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200"
                          placeholder="Proxy service endpoint"
                          type="text"
                        />
                      </div>
                    )}
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="sticky bottom-6 mt-6">
                <div className="bg-gray-800/95 backdrop-blur-sm p-4 rounded-xl border border-gray-700 shadow-lg">
                  <div className="flex gap-4">
                    <button
                      className="flex-1 flex items-center justify-center px-6 py-3.5 bg-[#2A2D3A] text-white rounded-xl hover:bg-[#363A4B] focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all duration-200"
                      disabled={isSaving}
                      onClick={handleUndo}
                      type="button"
                    >
                      <Undo className="w-5 h-5 mr-2.5" />
                      Reset Changes
                    </button>
                    <button
                      className="flex-1 flex items-center justify-center px-6 py-3.5 bg-[#4361EE] text-white rounded-xl hover:bg-[#3651DE] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                      disabled={isSaving}
                      type="submit"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-5 h-5 mr-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-5 h-5 mr-2.5" />
                          Save Settings
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Right Column - Node Status and Actions */}
          <div className="space-y-6">
            {/* Node Status Card */}
            <div className="bg-gray-800/80 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
              <div className="flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-blue-400" />
                <h3 className="text-xl font-semibold text-white">
                  Node Status
                </h3>
              </div>

              <div className="space-y-4">
                {/* Status Indicator */}
                <div
                  className={`p-4 rounded-xl border ${
                    isNodeRunning
                      ? 'bg-green-500/10 border-green-500/20'
                      : 'bg-red-500/10 border-red-500/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isNodeRunning ? (
                      <div className="relative">
                        <CheckCircle2 className="w-6 h-6 text-green-400" />
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                      </div>
                    ) : (
                      <div className="relative">
                        <XCircle className="w-6 h-6 text-red-400" />
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full" />
                      </div>
                    )}
                    <span
                      className={`text-lg font-medium ${
                        isNodeRunning ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      Node is {isNodeRunning ? 'Running' : 'Offline'}
                    </span>
                  </div>
                </div>

                {/* Connection Type */}
                <div className="p-4 bg-gray-700/30 rounded-xl border border-gray-700">
                  <div className="flex items-center gap-2 text-gray-400 mb-1">
                    <Server className="w-4 h-4" />
                    <span className="text-sm font-medium">Connection Type</span>
                  </div>
                  <p className="text-white font-medium ml-6">
                    {isLocalNode ? 'Local Node' : 'Remote Node'}
                  </p>
                </div>
              </div>

              {/* Node Actions */}
              <div className="space-y-4 mt-6">
                <button
                  className="w-full flex items-center justify-center px-4 py-3 bg-[#4361EE] text-white rounded-xl hover:bg-[#3651DE] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                  onClick={() => setShowBackupModal(true)}
                >
                  <Shield className="w-5 h-5 mr-2" />
                  Backup Wallet
                </button>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    className="flex items-center justify-center px-4 py-3 bg-[#2A2D3A] text-white rounded-xl hover:bg-[#363A4B] focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all duration-200"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-5 h-5 mr-2" />
                    Logout
                  </button>

                  <button
                    className="flex items-center justify-center px-4 py-3 bg-[#2A2D3A] text-red-500 rounded-xl hover:bg-[#363A4B] focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all duration-200 text-sm"
                    onClick={handleShutdown}
                  >
                    <Power className="w-5 h-5 mr-2" />
                    Shutdown
                  </button>
                </div>
              </div>
            </div>

            {/* App Version Info */}
            <div className="bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-gray-700">
              <AppVersion showDetailed={true} />
            </div>
          </div>
        </div>

        {/* Logs Section */}
        {isLocalNode && (
          <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
            {/* Header with controls */}
            <div className="p-4 border-b border-gray-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-400" />
                  <h3 className="text-xl font-semibold text-white">
                    Node Logs
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  {/* Entry selector */}
                  <div className="flex items-center gap-2 bg-gray-700/30 px-2 py-1 rounded-lg border border-gray-600">
                    <span className="text-sm text-gray-400">Show</span>
                    <select
                      className="bg-transparent text-white text-sm focus:outline-none focus:ring-0 border-0"
                      onChange={(e) => setMaxLogEntries(Number(e.target.value))}
                      value={maxLogEntries}
                    >
                      <option value="100">100</option>
                      <option value="200">200</option>
                      <option value="500">500</option>
                      <option value="1000">1000</option>
                      <option value="5000">5000</option>
                    </select>
                    <span className="text-sm text-gray-400">entries</span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-1.5">
                    <button
                      className="p-2 text-sm bg-gray-700/30 hover:bg-gray-600/50 text-white rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-600"
                      disabled={nodeLogs.length === 0}
                      onClick={handleExportLogs}
                      title="Export logs"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 text-sm bg-gray-700/30 hover:bg-gray-600/50 text-white rounded-lg transition-colors border border-gray-600"
                      onClick={fetchNodeLogs}
                      title="Refresh logs"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 text-sm bg-gray-700/30 hover:bg-gray-600/50 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-600"
                      disabled={nodeLogs.length === 0}
                      onClick={() => setNodeLogs([])}
                      title="Clear logs"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Logs display area */}
            <div className="bg-gray-900/95">
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700/50 bg-gray-800/50">
                <span className="text-sm font-medium text-gray-300">
                  Live Node Logs
                </span>
                <span className="text-xs text-gray-500">
                  Showing {Math.min(maxLogEntries, nodeLogs.length)} of{' '}
                  {nodeLogs.length} entries
                </span>
              </div>

              <div className="h-[500px] overflow-auto">
                {nodeLogs.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <span className="flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      No logs available
                    </span>
                  </div>
                ) : (
                  <TerminalLogDisplay
                    logs={nodeLogs}
                    maxEntries={maxLogEntries}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

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

      {showRestartConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-center text-yellow-500 mb-4">
              <AlertTriangle size={48} />
            </div>
            <h2 className="text-2xl font-bold mb-4 text-center text-white">
              Restart Node?
            </h2>
            <p className="text-gray-300 text-center mb-6">
              Your node settings have changed. Would you like to restart the
              node now for changes to take effect?
            </p>
            <div className="flex justify-between space-x-4">
              <button
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                onClick={() => setShowRestartConfirmation(false)}
                type="button"
              >
                Later
              </button>
              <button
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                onClick={() => {
                  setShowRestartConfirmation(false)
                  handleRestartNode()
                }}
                type="button"
              >
                Restart Now
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-center text-yellow-500 mb-4">
              <AlertTriangle size={48} />
            </div>
            <h2 className="text-2xl font-bold mb-4 text-center text-white">
              Confirm Logout
            </h2>
            <p className="text-gray-300 text-center mb-6">
              Are you sure you want to logout? This will lock your node.
            </p>
            <div className="flex justify-between space-x-4">
              <button
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                onClick={() => setShowLogoutConfirmation(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                onClick={confirmLogout}
                type="button"
              >
                Confirm Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {showShutdownConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-sm">
            {isShuttingDown ? (
              <div className="flex flex-col items-center py-6">
                <div className="w-16 h-16 mb-4">
                  <div className="w-full h-full border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Shutting Down Node
                </h3>
                <p className="text-gray-400 text-center">
                  Please wait while the node is being shut down...
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center text-red-500 mb-4">
                  <AlertTriangle size={48} />
                </div>
                <h2 className="text-2xl font-bold mb-4 text-center text-white">
                  Confirm Shutdown
                </h2>
                <p className="text-gray-300 text-center mb-6">
                  Are you sure you want to shut down the node? This action
                  cannot be undone.
                </p>
                <div className="flex justify-between space-x-4">
                  <button
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                    onClick={() => setShowShutdownConfirmation(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                    onClick={confirmShutdown}
                    type="button"
                  >
                    Confirm Shutdown
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
