import { invoke } from '@tauri-apps/api/core'
import {
  ChevronDown,
  LogOut,
  Eye,
  EyeOff,
  Loader2,
  Plus,
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
  Lock,
  ArrowRight,
  KeyRound,
} from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import { isValidBitcoindRpcUrl } from '../../helpers/unlock'
import { WALLET_SETUP_PATH } from '../../app/router/paths'
import { RootState } from '../../app/store'
import { useAppSelector } from '../../app/store/hooks'
import { AppVersion } from '../../components/AppVersion'
import { BackupModal } from '../../components/BackupModal'
import { ChangePasswordModal } from '../../components/ChangePasswordModal'
import { MnemonicViewerModal } from '../../components/MnemonicViewer'
import { BitcoindRpcField, ConfirmDialog } from '../../components/ui'
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

import { NodeLogsPanel } from './NodeLogsPanel'

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

type SettingsTab = 'general' | 'trading' | 'node' | 'security' | 'logs'

const SettingsCard = ({
  title,
  description,
  badge,
  children,
}: {
  title: string
  description?: string
  badge?: React.ReactNode
  children: React.ReactNode
}) => (
  <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-overlay">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-divider/10 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-bold text-white">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-content-tertiary">{description}</p>
        )}
      </div>
      {badge}
    </div>
    <div className="divide-y divide-divider/10 px-5">{children}</div>
  </section>
)

// Label + description on the left, control on the right (stacks when narrow).
const SettingRow = ({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) => (
  <div className="grid items-center gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,320px)] sm:gap-6">
    <div className="min-w-0">
      <p className="text-sm font-medium text-white">{label}</p>
      {description && (
        <p className="mt-0.5 text-xs leading-relaxed text-content-tertiary">
          {description}
        </p>
      )}
    </div>
    <div>{children}</div>
  </div>
)

const FieldBlock = ({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) => (
  <div className="space-y-2 py-4">
    <label className="block text-sm font-medium text-white">{label}</label>
    {children}
  </div>
)

const ActionCard = ({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  description: string
  onClick: () => void
}) => (
  <button
    className="group flex flex-col items-start gap-3 rounded-xl border border-border-default bg-surface-base/40 p-4 text-left transition-colors hover:border-primary/40 hover:bg-surface-high/50"
    onClick={onClick}
    type="button"
  >
    <span className="rounded-lg bg-primary/10 p-2 transition-colors group-hover:bg-primary/15">
      {icon}
    </span>
    <span>
      <span className="flex items-center gap-1 text-sm font-semibold text-white">
        {label}
        <ArrowRight className="h-3.5 w-3.5 text-content-tertiary transition-transform group-hover:translate-x-0.5" />
      </span>
      <span className="mt-0.5 block text-xs text-content-tertiary">
        {description}
      </span>
    </span>
  </button>
)

export const Component: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
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
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false)
  const [showShutdownConfirmation, setShowShutdownConfirmation] =
    useState(false)
  const [isShuttingDown, setIsShuttingDown] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showRestartConfirmation, setShowRestartConfirmation] = useState(false)
  const [showMnemonicModal, setShowMnemonicModal] = useState(false)
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)
  const [tab, setTab] = useState<SettingsTab>('general')
  const [showToken, setShowToken] = useState(false)

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

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isDirty },
  } = useForm<FormFields>({
    defaultValues: {
      bearerToken: nodeSettings.bearer_token || '',
      bitcoinUnit,
      defaultMakerUrl: nodeSettings.default_maker_url || '',
      fiatCurrency,
      indexerUrl: nodeSettings.indexer_url || '',
      language: language || 'en',
      lspUrl:
        nodeSettings.default_lsp_url || nodeSettings.default_maker_url || '',
      makerUrls: Array.isArray(nodeSettings.maker_urls)
        ? nodeSettings.maker_urls
        : [],
      nodeConnectionString: nodeConnectionString || 'http://localhost:3001',
      proxyEndpoint: nodeSettings.proxy_endpoint || '',
      rpcConnectionUrl: nodeSettings.rpc_connection_url || '',
    },
  })

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

  useEffect(() => {
    reset({
      bearerToken: nodeSettings.bearer_token || '',
      bitcoinUnit,
      defaultMakerUrl: nodeSettings.default_maker_url || '',
      fiatCurrency,
      indexerUrl: nodeSettings.indexer_url || '',
      language: language || 'en',
      lspUrl:
        nodeSettings.default_lsp_url || nodeSettings.default_maker_url || '',
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
      toast.info(t('settings.toasts.restarting', 'Restarting the node…'))
      await invoke('stop_node')

      // Wait a moment for the node to fully stop
      await new Promise((resolve) => setTimeout(resolve, 2000))

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

      toast.success(
        t('settings.toasts.restarted', 'Node restarted with the new settings')
      )
    } catch (error) {
      setModal({
        autoClose: false,
        details: error instanceof Error ? error.message : String(error),
        isOpen: true,
        message: t(
          'settings.toasts.restartFailedMessage',
          'There was a problem restarting the node.'
        ),
        title: t('settings.toasts.restartFailedTitle', 'Node restart failed'),
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

      // The market maker page owns the WebSocket and reconnects on this change.

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

      toast.success(t('settings.toasts.saved', 'Settings saved'))
      if (nodeSettingsChanged) setShowRestartConfirmation(true)
    } catch (error) {
      setModal({
        autoClose: false,
        details: error instanceof Error ? error.message : String(error),
        isOpen: true,
        message: t(
          'settings.toasts.saveFailedMessage',
          'There was a problem saving your settings.'
        ),
        title: t('settings.toasts.saveFailedTitle', 'Settings not saved'),
        type: ModalType.ERROR,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const closeModal = () => setModal((prev) => ({ ...prev, isOpen: false }))

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
        toast.success(t('settings.toasts.loggedOut', 'Logged out'))
      } else {
        throw new Error('Node lock unsuccessful')
      }
    } catch (error) {
      toast.error(
        t('settings.toasts.logoutFailed', {
          defaultValue:
            'The wallet could not be locked cleanly ({{error}}). You have been logged out anyway.',
          error: error instanceof Error ? error.message : String(error),
        })
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
        nodeSettings.default_lsp_url || nodeSettings.default_maker_url || '',
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
      toast.success(t('settings.toasts.shutDown', 'Node shut down'))
    } catch (error) {
      toast.error(
        t('settings.toasts.shutdownFailed', 'Failed to shut down the node')
      )
    } finally {
      setIsShuttingDown(false)
      setShowShutdownConfirmation(false)
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

  const inputCls =
    'w-full px-3.5 py-2.5 text-sm text-white bg-surface-base/60 border border-border-default rounded-lg placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors'
  const selectCls = `${inputCls} appearance-none pr-10`

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    {
      icon: <Settings className="h-4 w-4" />,
      id: 'general',
      label: t('settings.tabs.general', 'General'),
    },
    {
      icon: <Store className="h-4 w-4" />,
      id: 'trading',
      label: t('settings.tabs.trading', 'Maker & LSP'),
    },
    {
      icon: <Server className="h-4 w-4" />,
      id: 'node',
      label: t('settings.tabs.node', 'Node connection'),
    },
    {
      icon: <Shield className="h-4 w-4" />,
      id: 'security',
      label: t('settings.tabs.security', 'Security'),
    },
    {
      icon: <Activity className="h-4 w-4" />,
      id: 'logs',
      label: t('settings.tabs.logs', 'Logs'),
    },
  ]
  const activeTab = tabs.some((x) => x.id === tab) ? tab : 'general'
  const isFormTab =
    activeTab === 'general' || activeTab === 'trading' || activeTab === 'node'

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6">
      {/* ── Header: account + node status ── */}
      <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-border-subtle bg-surface-overlay px-5 py-4">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-white">
            {t('settings.title', 'Settings')}
          </h1>
          <p className="truncate text-sm text-content-secondary">
            {currentAccount.name}
            {currentAccount.network ? ` · ${currentAccount.network}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-default px-2.5 py-1 text-xs text-content-secondary">
            <Server className="h-3.5 w-3.5" />
            {isLocalNode ? t('settings.localNode') : t('settings.remoteNode')}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              isNodeRunning
                ? 'bg-status-success-subtle text-status-success'
                : 'bg-status-danger-subtle text-status-danger'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isNodeRunning
                  ? 'animate-pulse bg-status-success'
                  : 'bg-status-danger'
              }`}
            />
            {isNodeRunning
              ? t('settings.nodeRunning')
              : t('settings.nodeOffline')}
          </span>
        </div>
      </header>

      {/* ── Tabs ── */}
      <nav className="sticky top-0 z-10 flex gap-1 overflow-x-auto rounded-xl border border-border-subtle bg-surface-base/90 p-1 backdrop-blur">
        {tabs.map((x) => (
          <button
            className={`inline-flex flex-shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              activeTab === x.id
                ? 'bg-surface-high text-white shadow-sm'
                : 'text-content-secondary hover:bg-surface-overlay hover:text-white'
            }`}
            key={x.id}
            onClick={() => setTab(x.id)}
            type="button"
          >
            <span className={activeTab === x.id ? 'text-primary' : ''}>
              {x.icon}
            </span>
            {x.label}
          </button>
        ))}
      </nav>

      <form
        className={isFormTab ? 'flex flex-col gap-5' : 'hidden'}
        onSubmit={handleSubmit(handleSave)}
      >
        {/* ── General ── */}
        {activeTab === 'general' && (
          <>
            <SettingsCard title={t('settings.applicationSettings')}>
              <SettingRow
                description={t('settings.capabilitiesDescription', {
                  defaultValue:
                    'Choose which parts of KaleidoSwap are shown — the node, the AI brain, or both.',
                })}
                label={t('settings.capabilities', {
                  defaultValue: 'Capabilities',
                })}
              >
                <div className="grid grid-cols-3 gap-1 rounded-lg border border-border-default bg-surface-base/60 p-1">
                  {APP_MODE_OPTIONS.map((opt) => (
                    <button
                      className={`whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                        appMode === opt.mode
                          ? 'bg-primary/15 text-primary'
                          : 'text-content-secondary hover:text-white'
                      }`}
                      key={opt.mode}
                      onClick={() => dispatch(setAppMode(opt.mode))}
                      type="button"
                    >
                      {t(opt.labelKey, { defaultValue: opt.fallback })}
                    </button>
                  ))}
                </div>
              </SettingRow>

              <Controller
                control={control}
                name="bitcoinUnit"
                render={({ field }) => (
                  <SettingRow label={t('settings.bitcoinUnit')}>
                    <div className="relative">
                      <select {...field} className={selectCls}>
                        <option value="SAT">
                          {t('settings.bitcoinUnitSat')}
                        </option>
                        <option value="BTC">
                          {t('settings.bitcoinUnitBtc')}
                        </option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-secondary" />
                    </div>
                  </SettingRow>
                )}
              />

              <Controller
                control={control}
                name="fiatCurrency"
                render={({ field }) => (
                  <SettingRow
                    description={t('settings.fiatCurrencyDescription')}
                    label={t('settings.fiatCurrency')}
                  >
                    <div className="relative">
                      <select {...field} className={selectCls}>
                        {SUPPORTED_CURRENCIES.map((currency) => (
                          <option key={currency} value={currency}>
                            {CURRENCY_SYMBOLS[currency]}{' '}
                            {CURRENCY_LABELS[currency]}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-secondary" />
                    </div>
                  </SettingRow>
                )}
              />

              <Controller
                control={control}
                name="language"
                render={({ field }) => (
                  <SettingRow label={t('settings.language')}>
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
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-secondary" />
                    </div>
                  </SettingRow>
                )}
              />
            </SettingsCard>

            <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-overlay">
              <AppVersion showDetailed={true} />
            </section>
          </>
        )}

        {/* ── Maker & LSP ── */}
        {activeTab === 'trading' && (
          <SettingsCard
            description={t(
              'settings.makerLspDescription',
              'Market makers quote your swaps; the LSP sells you channels and inbound liquidity.'
            )}
            title={t('settings.makerLspSettings', 'Maker & LSP Settings')}
          >
            <div className="space-y-2 py-4">
              <label className="block text-sm font-medium text-white">
                {t('settings.makerUrls')}
              </label>
              <Controller
                control={control}
                name="makerUrls"
                render={({ field }) => (
                  <div className="space-y-2">
                    {(field.value ?? []).map((url, index) => {
                      const isDefault = url === watch('defaultMakerUrl')
                      return (
                        <div className="flex items-center gap-2" key={index}>
                          <div className="relative flex-1">
                            <input
                              className={`${inputCls} ${isDefault ? 'pr-20' : ''}`}
                              onChange={(e) => {
                                const n = [...(field.value ?? [])]
                                n[index] = e.target.value
                                field.onChange(n)
                              }}
                              placeholder={
                                t('settings.makerUrlPlaceholder') || 'Maker URL'
                              }
                              type="text"
                              value={url}
                            />
                            {isDefault && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-primary/15 px-2 py-0.5 text-xs text-primary">
                                {t('settings.default')}
                              </span>
                            )}
                          </div>
                          <button
                            className="rounded-lg p-2 text-content-secondary transition-colors hover:bg-primary/15 hover:text-primary"
                            onClick={() =>
                              setValue('defaultMakerUrl', url, {
                                shouldDirty: true,
                              })
                            }
                            title={
                              isDefault
                                ? t('settings.currentDefault')
                                : t('settings.setAsDefault')
                            }
                            type="button"
                          >
                            <Star
                              className={`h-4 w-4 ${isDefault ? 'fill-current text-primary' : ''}`}
                            />
                          </button>
                          <button
                            className="rounded-lg p-2 text-content-secondary transition-colors hover:bg-status-danger/15 hover:text-status-danger"
                            onClick={() => {
                              const n = (field.value ?? []).filter(
                                (_, i) => i !== index
                              )
                              field.onChange(n)
                              if (isDefault)
                                setValue('defaultMakerUrl', n[0] || '', {
                                  shouldDirty: true,
                                })
                            }}
                            title={t('settings.removeUrl')}
                            type="button"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )
                    })}
                    <button
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border-default text-sm font-medium text-content-secondary transition-colors hover:border-primary/50 hover:text-primary"
                      onClick={() => {
                        const n = [...(field.value ?? []), '']
                        field.onChange(n)
                        if ((field.value ?? []).length === 0)
                          setValue('defaultMakerUrl', '')
                      }}
                      type="button"
                    >
                      <Plus className="h-4 w-4" />
                      {t('settings.addMakerUrl')}
                    </button>
                  </div>
                )}
              />
            </div>

            <Controller
              control={control}
              name="lspUrl"
              render={({ field }) => (
                <div className="space-y-2 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-sm font-medium text-white">
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
          </SettingsCard>
        )}

        {/* ── Node connection ── */}
        {activeTab === 'node' && (
          <SettingsCard
            badge={
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-status-warning/20 bg-status-warning/10 px-2.5 py-1 text-xs text-status-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t('settings.requiresRestart')}
              </span>
            }
            title={t('settings.nodeConnectionSettings')}
          >
            <Controller
              control={control}
              name="nodeConnectionString"
              render={({ field }) => (
                <FieldBlock label={t('settings.nodeConnectionString')}>
                  <input
                    {...field}
                    className={`${inputCls} font-mono placeholder:font-sans`}
                    placeholder="http://localhost:3001"
                    type="text"
                  />
                </FieldBlock>
              )}
            />
            <Controller
              control={control}
              name="indexerUrl"
              render={({ field }) => (
                <FieldBlock label={t('settings.indexerUrl')}>
                  <input
                    {...field}
                    className={`${inputCls} font-mono placeholder:font-sans`}
                    placeholder="Indexer service URL"
                    type="text"
                  />
                </FieldBlock>
              )}
            />
            <Controller
              control={control}
              name="proxyEndpoint"
              render={({ field }) => (
                <FieldBlock label={t('settings.rgbProxyEndpoint')}>
                  <input
                    {...field}
                    className={`${inputCls} font-mono placeholder:font-sans`}
                    placeholder={t('settings.rgbProxyPlaceholder')}
                    type="text"
                  />
                </FieldBlock>
              )}
            />
            <Controller
              control={control}
              name="bearerToken"
              render={({ field }) => (
                <FieldBlock label={t('settings.bearerToken')}>
                  <div className="relative">
                    <input
                      {...field}
                      autoComplete="off"
                      className={`${inputCls} pr-10 font-mono placeholder:font-sans`}
                      placeholder={t('settings.bearerTokenPlaceholder')}
                      type={showToken ? 'text' : 'password'}
                    />
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-content-tertiary hover:text-white"
                      onClick={() => setShowToken((v) => !v)}
                      title={
                        showToken
                          ? t('settings.hideToken', 'Hide token')
                          : t('settings.showToken', 'Show token')
                      }
                      type="button"
                    >
                      {showToken ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FieldBlock>
              )}
            />
            <Controller
              control={control}
              name="rpcConnectionUrl"
              render={({ field, fieldState }) => (
                <div className="py-4">
                  <BitcoindRpcField
                    error={fieldState.error?.message}
                    inputId="settings-rpc-connection-url"
                    value={field.value}
                  >
                    <input
                      {...field}
                      className={`${inputCls} font-mono placeholder:font-sans`}
                      id="settings-rpc-connection-url"
                      placeholder={t('chainSync.placeholder')}
                      type="text"
                    />
                  </BitcoindRpcField>
                </div>
              )}
              rules={{
                validate: (value) =>
                  isValidBitcoindRpcUrl(value) || t('chainSync.invalidFormat'),
              }}
            />
          </SettingsCard>
        )}

        {/* ── Save bar: only with unsaved changes ── */}
        {isDirty && (
          <div className="sticky bottom-4 z-10 animate-fadeIn">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-surface-elevated/95 px-4 py-3 shadow-2xl backdrop-blur">
              <span className="flex-1 text-sm text-content-secondary">
                {t('settings.unsavedChanges', 'You have unsaved changes')}
              </span>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-high hover:text-white disabled:opacity-50"
                disabled={isSaving}
                onClick={handleUndo}
                type="button"
              >
                <Undo className="h-4 w-4" />
                {t('settings.resetChanges')}
              </button>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-emphasis disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSaving}
                type="submit"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSaving ? t('settings.saving') : t('settings.saveSettings')}
              </button>
            </div>
          </div>
        )}
      </form>

      {/* ── Security ── */}
      {activeTab === 'security' && (
        <>
          <SettingsCard title={t('settings.securityBackup')}>
            <div className="grid gap-3 py-4 sm:grid-cols-3">
              <ActionCard
                description={t('settings.accessSeedPhrase')}
                icon={<Lock className="h-4 w-4 text-primary" />}
                label={t('settings.viewRecoveryPhrase')}
                onClick={() => setShowMnemonicModal(true)}
              />
              <ActionCard
                description={t(
                  'settings.changePasswordDescription',
                  'Update wallet encryption password'
                )}
                icon={<KeyRound className="h-4 w-4 text-primary" />}
                label={t('settings.changePassword', 'Change Password')}
                onClick={() => setShowChangePasswordModal(true)}
              />
              <ActionCard
                description={t(
                  'settings.backupWalletDescription',
                  'Export an encrypted wallet backup'
                )}
                icon={<Download className="h-4 w-4 text-primary" />}
                label={t('settings.backupWallet')}
                onClick={() => setShowBackupModal(true)}
              />
            </div>
          </SettingsCard>

          <SettingsCard title={t('settings.session', 'Session')}>
            <SettingRow
              description={t('settings.logoutDescription')}
              label={t('settings.logout')}
            >
              <button
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border-default text-sm font-medium text-white transition-colors hover:bg-surface-high"
                onClick={handleLogout}
                type="button"
              >
                <LogOut className="h-4 w-4" />
                {t('settings.logout')}
              </button>
            </SettingRow>
            <SettingRow
              description={t('settings.shutdownDescription')}
              label={t('settings.shutdown')}
            >
              <button
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-status-danger/30 bg-status-danger/10 text-sm font-medium text-status-danger transition-colors hover:bg-status-danger/20"
                onClick={handleShutdown}
                type="button"
              >
                <Power className="h-4 w-4" />
                {t('settings.shutdown')}
              </button>
            </SettingRow>
          </SettingsCard>
        </>
      )}

      {/* ── Logs ── */}
      {activeTab === 'logs' && (
        <NodeLogsPanel
          remoteUrl={
            isLocalNode
              ? undefined
              : nodeSettings.node_url ||
                nodeConnectionString ||
                'http://localhost:3001'
          }
        />
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

      <ConfirmDialog
        cancelLabel={t('settings.later')}
        confirmLabel={t('settings.restartNow')}
        isOpen={showRestartConfirmation}
        message={t('settings.restartNodeMessage')}
        onCancel={() => setShowRestartConfirmation(false)}
        onConfirm={() => {
          setShowRestartConfirmation(false)
          handleRestartNode()
        }}
        title={t('settings.restartNode')}
      />

      <ConfirmDialog
        cancelLabel={t('settings.cancel')}
        confirmLabel={t('settings.confirmLogout')}
        isOpen={showLogoutConfirmation}
        message={t('settings.logoutMessage')}
        onCancel={() => setShowLogoutConfirmation(false)}
        onConfirm={confirmLogout}
        title={t('settings.confirmLogout')}
      />

      <ConfirmDialog
        cancelLabel={t('settings.cancel')}
        confirmLabel={t('settings.confirmShutdown')}
        isLoading={isShuttingDown}
        isOpen={showShutdownConfirmation}
        message={
          isShuttingDown
            ? t('settings.shuttingDownMessage')
            : t('settings.confirmShutdownMessage')
        }
        onCancel={() => setShowShutdownConfirmation(false)}
        onConfirm={confirmShutdown}
        title={
          isShuttingDown
            ? t('settings.shuttingDownTitle')
            : t('settings.confirmShutdown')
        }
        tone="danger"
      />
    </div>
  )
}
