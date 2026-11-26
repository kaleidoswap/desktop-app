import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import Decimal from 'decimal.js'
import {
  Activity,
  Brain,
  Download,
  HardDriveDownload,
  Loader2,
  RefreshCw,
  Server,
  Upload,
  User,
} from 'lucide-react'
import React, { useEffect, useLayoutEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast, ToastContainer } from 'react-toastify'

import {
  desktopPathname,
  CREATEUTXOS_PATH,
  SETTINGS_PATH,
  WALLET_SETUP_PATH,
  KALEIDO_MIND_PATH,
  P2P_WALLET_PATH,
  MAINNET_PATH,
} from '../../app/router/paths'
import { useAppDispatch, useAppSelector } from '../../app/store/hooks'
import { type BitcoinNetwork, getNetworkDisplayName } from '../../constants'
import { isBtcWalletTx } from '../../helpers/walletHistoryUtils'
import { useNodeLifecycleEvents } from '../../hooks/useNodeLifecycleEvents'
import { useOnClickOutside } from '../../hooks/useOnClickOutside'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { nodeSettingsActions } from '../../slices/nodeSettings/nodeSettings.slice'
import {
  setAppMode,
  isNodeEnabled,
  isMindEnabled,
} from '../../slices/settings/settings.slice'
import { rememberProfile } from '../../routes/p2p-home/navigation'
import { uiSliceActions } from '../../slices/ui/ui.slice'
import { BackupModal } from '../BackupModal'
import { useBackup } from '../../hooks/useBackup'
import { useDcaScheduler } from '../../hooks/useDcaScheduler'
import { useLimitOrderScheduler } from '../../hooks/useLimitOrderScheduler'
import { useNwcAutostart } from '../../hooks/useNwcAutostart'
import { useNodeReachabilityMonitor } from '../../hooks/useNodeReachabilityMonitor'
import { useNodeReconnect } from '../../hooks/useNodeReconnect'
import { LogoutModal, LogoutButton } from '../LogoutModal'
import { useNotification } from '../NotificationSystem'
import { ShutdownAnimation } from '../ShutdownAnimation'
import { SupportModal } from '../SupportModal'

import 'react-toastify/dist/ReactToastify.min.css'
import { DesktopFrame } from './DesktopFrame'
import { SetupFrame } from './SetupFrame'
import {
  getMindLinks,
  getNodeLinks,
  SETUP_PATHS,
  matchesSectionLink,
} from './config'
import { LayoutModal } from './Modal'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const DEFAULT_TOAST_AUTO_CLOSE_MS = 5000

interface Props {
  setupNetwork?: BitcoinNetwork
  setupBusy?: boolean
  walletActions?: boolean
  className?: string
  children: React.ReactNode
}

const profileItemClass =
  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-content-primary hover:bg-surface-overlay'

function UserProfile({ onLogout }: { onLogout: () => void }) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()
  const nodeInfo = nodeApi.endpoints.nodeInfo.useQueryState()
  const dispatch = useAppDispatch()
  const mindEnabled = useAppSelector((state) =>
    isMindEnabled(state.settings.appMode)
  )
  const nodeSettingsData = useAppSelector((state) => state.nodeSettings.data)
  const nodeReachability = useAppSelector((state) => state.node.reachability)
  const { reconnect, isReconnecting } = useNodeReconnect()
  const isNodeReachable =
    nodeReachability === 'reachable' ||
    (nodeReachability === 'unknown' && nodeInfo.isSuccess)
  // A node is "configured" once an account exists; without one the app is
  // running KaleidoMind-only and the bar invites connecting a node.
  const hasNode = !!nodeSettingsData?.name
  const nameText = hasNode
    ? nodeSettingsData.name
    : t('userProfile.noNode', { defaultValue: 'No node connected' })
  const statusText = hasNode
    ? isNodeReachable
      ? t('userProfile.connected')
      : nodeReachability === 'unknown'
        ? t('ux.checking')
        : t('userProfile.disconnected')
    : t('userProfile.tapToConnect', { defaultValue: 'Tap to connect' })
  const statusLabel = hasNode
    ? `${t('ux.node')}: ${statusText} · ${getNetworkDisplayName(nodeSettingsData.network)}`
    : statusText
  const statusDotClass = !hasNode
    ? 'bg-content-tertiary'
    : isNodeReachable
      ? 'bg-green shadow-lg shadow-green/50 animate-pulse'
      : 'bg-red shadow-lg shadow-red/50'

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
  } = useBackup({
    nodeSettings: nodeSettingsData || {
      indexer_url: '',
      proxy_endpoint: '',
      rpc_connection_url: '',
    },
  })

  useOnClickOutside(menuRef, () => setIsOpen(false))

  return (
    <div
      className="relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isOpen) {
          setIsOpen(false)
          triggerRef.current?.focus()
        }
      }}
      ref={menuRef}
    >
      <button
        aria-expanded={isOpen}
        aria-label={`${nameText} · ${statusLabel}`}
        className="flex min-h-9 items-center gap-2 rounded-lg p-1 text-left hover:bg-surface-overlay"
        onClick={() => setIsOpen(!isOpen)}
        ref={triggerRef}
        type="button"
      >
        <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-purple/25 text-content-primary">
          <User aria-hidden className="h-4 w-4" />
          <span
            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface-base ${statusDotClass}`}
          />
        </span>
        <span className="hidden max-w-44 flex-col lg:flex">
          <span className="truncate text-xs font-medium text-content-primary">
            {nameText}
          </span>
          <span className="truncate text-[0.65rem] text-content-secondary">
            {statusLabel}
          </span>
        </span>
      </button>

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

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-divider/30 bg-surface-elevated p-1 shadow-xl">
          <div className="mb-1 border-b border-divider/20 px-3 py-2">
            <div className="break-words text-sm font-semibold">{nameText}</div>
            <div className="text-xs text-content-secondary">{statusLabel}</div>
          </div>
          {!hasNode && (
            <Link
              className={profileItemClass}
              onClick={() => setIsOpen(false)}
              to={WALLET_SETUP_PATH}
            >
              <Server aria-hidden className="h-4 w-4" />
              {t('userProfile.connectNode')}
            </Link>
          )}
          {hasNode && !isNodeReachable && (
            <button
              className={profileItemClass}
              disabled={isReconnecting}
              onClick={() => void reconnect()}
              type="button"
            >
              {isReconnecting ? (
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw aria-hidden className="h-4 w-4" />
              )}
              {t(
                isReconnecting
                  ? 'userProfile.reconnecting'
                  : 'userProfile.reconnect'
              )}
            </button>
          )}
          <button
            className={profileItemClass}
            onClick={() => {
              setIsOpen(false)
              if (!mindEnabled) dispatch(setAppMode('both'))
              navigate(KALEIDO_MIND_PATH)
            }}
            type="button"
          >
            <Brain aria-hidden className="h-4 w-4" />
            {mindEnabled
              ? t('launcher.openMind')
              : t('navigation.activate', { name: t('navigation.kaleidoMind') })}
          </button>
          {hasNode && (
            <>
              <button
                className={profileItemClass}
                onClick={() => {
                  setIsOpen(false)
                  setShowBackupModal(true)
                }}
                type="button"
              >
                <HardDriveDownload aria-hidden className="h-4 w-4" />
                {t('settings.backupWallet')}
              </button>
              <LogoutButton
                onClick={() => {
                  setIsOpen(false)
                  onLogout()
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

export const Layout = (props: Props) => {
  const { t, i18n } = useTranslation()
  const [lastDeposit, setLastDeposit] = useState<number | undefined>(undefined)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isShuttingDown, setIsShuttingDown] = useState(false)
  const [shutdownStatus, setShutdownStatus] = useState<string>('')
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false)
  const [isHandlingCloseAction, setIsHandlingCloseAction] = useState(false)
  const {
    reconnect: retryNodeConnection,
    isReconnecting: isRetryingNodeConnection,
    lastResult: lastReconnectResult,
  } = useNodeReconnect()

  const [showSupportModal, setShowSupportModal] = useState(false)

  const toastAutoDismissTimers = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({})

  const { pathname: routePath } = useLocation()
  const pathname = desktopPathname(routePath)
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  useEffect(() => {
    if (props.walletActions === false) {
      dispatch(uiSliceActions.setModal({ type: 'none' }))
    }
  }, [dispatch, props.walletActions])
  const isWalletProfileRoute =
    pathname === P2P_WALLET_PATH ||
    pathname.startsWith(`${P2P_WALLET_PATH}/`) ||
    pathname === MAINNET_PATH ||
    pathname.startsWith(`${MAINNET_PATH}/`)
  const isSetupRoute = SETUP_PATHS.includes(pathname)
  const isNodeWorkspace = !isWalletProfileRoute && !isSetupRoute
  useLayoutEffect(() => {
    if (!isNodeWorkspace) return
    rememberProfile('node')
    // Deposit and withdrawal use the active wallet backend. Dismiss the node's
    // dialog before the next workspace can install its wallet and render it.
    return () => {
      dispatch(uiSliceActions.setModal({ type: 'none' }))
    }
  }, [dispatch, isNodeWorkspace])
  // KaleidoMind does not depend on the node, so the node-offline overlay must
  // never block it — a node-less or "KaleidoMind only" user can keep using it.
  const isMindRoute = pathname.startsWith(KALEIDO_MIND_PATH)

  const isSettingsRoute = pathname === SETTINGS_PATH
  const section = isMindRoute
    ? 'accounts'
    : isSettingsRoute
      ? 'settings'
      : 'node'
  const links = isMindRoute ? getMindLinks(t) : getNodeLinks(t)
  const activeLink = links.find((link) => matchesSectionLink(link, pathname))
  const activeTab = useRef<HTMLAnchorElement>(null)
  useLayoutEffect(() => {
    activeTab.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [pathname, i18n.resolvedLanguage])

  const title = isMindRoute
    ? t('navigation.kaleidoMind')
    : isSettingsRoute
      ? t('navigation.settings')
      : pathname === CREATEUTXOS_PATH
        ? t('createUtxos.title')
        : (activeLink?.label ?? t('unified.node'))

  const [lock] = nodeApi.endpoints.lock.useMutation()

  useDcaScheduler()
  useLimitOrderScheduler()
  useNwcAutostart()
  useNodeLifecycleEvents()

  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const { addNotification } = useNotification()

  const nodeInfo = nodeApi.endpoints.nodeInfo.useQueryState()
  const nodeLifecycle = useAppSelector((state) => state.node.lifecycle)
  const nodeReachability = useAppSelector((state) => state.node.reachability)
  const nodeReachabilityError = useAppSelector(
    (state) => state.node.reachabilityError
  )
  const nodeSettingsData = useAppSelector((state) => state.nodeSettings.data)
  const appMode = useAppSelector((state) => state.settings.appMode)
  // A configured node (local OR remote) must always surface its section.
  // appMode alone isn't enough: a node connected after a "KaleidoMind only"
  // onboarding (appMode 'mind') would otherwise stay hidden behind the
  // "Activate Node" affordance even though it's live — so also enable the
  // section whenever a node account exists.
  const nodeSectionEnabled = isNodeEnabled(appMode) || !!nodeSettingsData?.name
  const mindSectionEnabled = isMindEnabled(appMode)
  const isNodeReachable =
    nodeReachability === 'reachable' ||
    (nodeReachability === 'unknown' && nodeInfo.isSuccess)
  // 'slow' (a nodeinfo timeout while the node is busy) stays silent.
  const isNodeUnreachable = nodeReachability === 'unreachable'
  const shouldPoll =
    isNodeReachable && (!isNodeWorkspace || !!nodeSettingsData?.name)
  const isNodeActive =
    nodeLifecycle.status === 'Running' ||
    nodeLifecycle.status === 'Starting' ||
    nodeLifecycle.status === 'Stopping'

  useNodeReachabilityMonitor({
    accountKey: nodeSettingsData?.name,
    skip: !isNodeWorkspace || !nodeSettingsData?.name,
  })

  // In "Only Node" mode the KaleidoMind sidecar isn't reachable, so make sure
  // its process (and any loaded model) is stopped to free resources.
  useEffect(() => {
    if (!mindSectionEnabled) {
      invoke('mind_stop').catch(() => {
        /* sidecar not running — nothing to stop */
      })
    }
  }, [mindSectionEnabled])

  const { data, isFetching, error } = nodeApi.useListTransactionsQuery(
    undefined,
    {
      pollingInterval: 30_000,
      skip: isRetrying || !shouldPoll,
    }
  )

  useEffect(() => {
    const clearToastTimer = (toastId: string) => {
      const timer = toastAutoDismissTimers.current[toastId]

      if (timer) {
        clearTimeout(timer)
        delete toastAutoDismissTimers.current[toastId]
      }
    }

    const unsubscribe = toast.onChange((item) => {
      const toastId = String(item.id)

      if (item.status === 'removed') {
        clearToastTimer(toastId)
        return
      }

      if (item.isLoading) {
        clearToastTimer(toastId)
        return
      }

      clearToastTimer(toastId)
      toastAutoDismissTimers.current[toastId] = setTimeout(() => {
        toast.dismiss(item.id)
        clearToastTimer(toastId)
      }, DEFAULT_TOAST_AUTO_CLOSE_MS)
    })

    return () => {
      unsubscribe()
      Object.values(toastAutoDismissTimers.current).forEach(clearTimeout)
      toastAutoDismissTimers.current = {}
    }
  }, [])

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true)
      const lockResponse = await lock().unwrap()
      await invoke('stop_node')

      if (lockResponse !== undefined || lockResponse === null) {
        dispatch(nodeSettingsActions.resetNodeSettings())
        addNotification({
          autoClose: 3000,
          message: t('modals.logoutSuccessMessage'),
          title: t('modals.logoutSuccess'),
          type: 'success',
        })
        navigate(WALLET_SETUP_PATH)
      } else {
        throw new Error('Node lock unsuccessful')
      }
    } catch (error) {
      addNotification({
        autoClose: 5000,
        message: t('modals.logoutFailedMessage', {
          error: error instanceof Error ? error.message : '',
        }),
        title: t('modals.logoutFailed'),
        type: 'error',
      })
      navigate(WALLET_SETUP_PATH)
    } finally {
      setIsLoggingOut(false)
      setShowLogoutModal(false)
    }
  }

  useEffect(() => {
    const checkDeposits = async () => {
      if (!shouldPoll) return
      if (isFetching) return

      if (error && (error as any).status === 403) {
        setIsRetrying(true)
        await sleep(3000)
        setIsRetrying(false)
        return
      }

      const filteredTransactions =
        (data?.transactions || [])
          .filter(
            (tx: any) =>
              isBtcWalletTx(tx.transaction_type) &&
              new Decimal(tx.received ?? 0).minus(tx.sent ?? 0).gt(0)
          )
          .map((tx: any) => ({
            amount: new Decimal(tx.received ?? 0)
              .minus(tx.sent ?? 0)
              .toString(),
            asset: 'BTC',
            confirmation_time: tx.confirmation_time,
            txId: tx.txid ?? '',
            type: 'on-chain' as const,
          })) || []

      const highestBlockDeposit =
        filteredTransactions && filteredTransactions.length > 0
          ? filteredTransactions?.reduce((prev: any, current: any) =>
              (prev?.confirmation_time?.height ?? 0) >
              (current?.confirmation_time?.height ?? 0)
                ? prev
                : current
            )
          : undefined

      if (lastDeposit === undefined) {
        if (highestBlockDeposit) {
          setLastDeposit(highestBlockDeposit?.confirmation_time?.height ?? 0)
        } else {
          setLastDeposit(0)
        }
        return
      }

      if (
        lastDeposit !== undefined &&
        highestBlockDeposit &&
        (highestBlockDeposit?.confirmation_time?.height ?? 0) > lastDeposit
      ) {
        addNotification({
          autoClose: 5000,
          message: t('notifications.depositReceivedMessage'),
          title: t('notifications.depositReceived'),
          type: 'success',
        })
        setLastDeposit(highestBlockDeposit?.confirmation_time?.height ?? 0)
      }
    }

    checkDeposits()
  }, [data, error, shouldPoll, lastDeposit, isFetching, addNotification, t])

  useEffect(() => {
    const handleBeforeUnload = () => {
      setIsShuttingDown(true)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    // Listen for Tauri shutdown events
    const setupShutdownListeners = async () => {
      const unlistenCloseConfirm = await listen('confirm-app-close', () => {
        setShowCloseConfirmModal(true)
      })

      const unlistenTrigger = await listen<string>(
        'trigger-shutdown',
        (event) => {
          setIsShuttingDown(true)
          setShutdownStatus(event.payload)
        }
      )

      const unlistenStatus = await listen<string>(
        'update-shutdown-status',
        (event) => {
          setShutdownStatus(event.payload)
        }
      )

      return () => {
        unlistenCloseConfirm()
        unlistenTrigger()
        unlistenStatus()
      }
    }

    const cleanup = setupShutdownListeners()

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      cleanup.then((unsubscribe) => unsubscribe())
    }
  }, [])

  const handleTransactionAction = (type: 'deposit' | 'withdraw') => {
    dispatch(
      uiSliceActions.setModal({
        assetId: undefined,
        type,
      })
    )
  }

  const handleKeepRunningInBackground = async () => {
    setIsHandlingCloseAction(true)
    try {
      setShowCloseConfirmModal(false)
      await invoke('hide_main_window')
    } finally {
      setIsHandlingCloseAction(false)
    }
  }

  const handleQuitApp = async () => {
    setIsHandlingCloseAction(true)
    try {
      setShowCloseConfirmModal(false)
      await invoke('quit_app')
    } finally {
      setIsHandlingCloseAction(false)
    }
  }

  const handleShutdownAndQuit = async () => {
    setIsHandlingCloseAction(true)
    setIsShuttingDown(true)
    setShutdownStatus('Shutting down local node...')
    setShowCloseConfirmModal(false)

    try {
      await invoke('nwc_stop_service').catch(() => undefined)
      await invoke('shutdown_node_and_quit')
    } finally {
      setIsHandlingCloseAction(false)
    }
  }

  return (
    <div className={props.className}>
      <ShutdownAnimation isVisible={isShuttingDown} status={shutdownStatus} />

      {showCloseConfirmModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-surface-base rounded-xl border border-divider/20 shadow-xl p-6">
            <h3 className="text-xl font-semibold text-white">
              {isNodeActive ? 'Close KaleidoSwap?' : 'Quit KaleidoSwap?'}
            </h3>
            <p className="text-content-secondary mt-3">
              {isNodeActive
                ? 'The local node is still running. You can keep it running in the background or stop it before quitting the app.'
                : 'The app is ready to quit.'}
            </p>

            <div className="mt-6 flex flex-col gap-3">
              {isNodeActive ? (
                <>
                  <button
                    className="w-full px-4 py-3 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-60"
                    disabled={isHandlingCloseAction}
                    onClick={handleKeepRunningInBackground}
                  >
                    Keep Running In Background
                  </button>
                  <button
                    className="w-full px-4 py-3 rounded-md bg-red-500/15 text-red-300 border border-red-500/30 font-medium disabled:opacity-60 flex items-center justify-center gap-2"
                    disabled={isHandlingCloseAction}
                    onClick={handleShutdownAndQuit}
                  >
                    {isHandlingCloseAction ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Stopping Node...</span>
                      </>
                    ) : (
                      'Stop Node And Quit'
                    )}
                  </button>
                </>
              ) : (
                <button
                  className="w-full px-4 py-3 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-60"
                  disabled={isHandlingCloseAction}
                  onClick={handleQuitApp}
                >
                  Quit App
                </button>
              )}

              <button
                className="w-full px-4 py-3 rounded-md bg-surface-overlay text-content-secondary font-medium disabled:opacity-60"
                disabled={isHandlingCloseAction}
                onClick={() => setShowCloseConfirmModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isNodeWorkspace ? (
        <DesktopFrame
          context="node"
          headerActions={
            <UserProfile onLogout={() => setShowLogoutModal(true)} />
          }
          onHelp={() => setShowSupportModal(true)}
          secondaryNav={
            !isSettingsRoute && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider/20 bg-surface-elevated px-3 py-2 sm:px-6">
                <nav
                  aria-label={t(
                    isMindRoute ? 'navigation.kaleidoMind' : 'unified.node'
                  )}
                  className="flex max-w-full gap-1 overflow-x-auto"
                >
                  {(isMindRoute ? mindSectionEnabled : nodeSectionEnabled) ? (
                    links.map((link) => (
                      <Link
                        aria-current={activeLink === link ? 'page' : undefined}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium [&>svg]:h-4 [&>svg]:w-4 ${activeLink === link ? 'bg-primary/10 text-primary' : 'text-content-secondary hover:bg-surface-overlay hover:text-content-primary'}`}
                        key={link.to}
                        ref={activeLink === link ? activeTab : undefined}
                        to={link.to}
                      >
                        {link.icon}
                        {link.label}
                      </Link>
                    ))
                  ) : (
                    <button
                      className={profileItemClass}
                      onClick={() => {
                        if (isMindRoute) dispatch(setAppMode('both'))
                        else navigate(WALLET_SETUP_PATH)
                      }}
                      type="button"
                    >
                      {t('navigation.activate', {
                        name: t(
                          isMindRoute
                            ? 'navigation.kaleidoMind'
                            : 'navigation.node'
                        ),
                      })}
                    </button>
                  )}
                </nav>
                {!isMindRoute && nodeSettingsData?.name && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium text-content-primary hover:bg-surface-overlay"
                      onClick={() => handleTransactionAction('deposit')}
                      type="button"
                    >
                      <Download aria-hidden className="h-4 w-4 shrink-0" />
                      {t('actions.deposit')}
                    </button>
                    <button
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium text-content-primary hover:bg-surface-overlay"
                      onClick={() => handleTransactionAction('withdraw')}
                      type="button"
                    >
                      <Upload aria-hidden className="h-4 w-4 shrink-0" />
                      {t('actions.withdraw')}
                    </button>
                  </div>
                )}
              </div>
            )
          }
          section={section}
          title={title}
        >
          <div
            className="relative isolate h-full min-h-0 overflow-hidden"
            id="content-area"
          >
            {isNodeUnreachable && nodeSettingsData?.name && !isMindRoute && (
              <div className="pointer-events-none absolute inset-4 z-40 flex items-end justify-end">
                <div
                  aria-live="polite"
                  className="pointer-events-auto w-full sm:w-96 max-h-[70%] overflow-y-auto bg-surface-base rounded-lg border border-red-500/30 shadow-2xl p-4"
                  role="status"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-lg bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0">
                      <Activity className="w-5 h-5 text-red-300" />
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-xl font-semibold text-white">
                        {t('nodeReachability.unresponsiveTitle', {
                          defaultValue: 'Node response unavailable',
                        })}
                      </h3>
                      <p className="text-content-secondary mt-2">
                        {t('nodeReachability.unresponsiveMessage', {
                          defaultValue:
                            'The node may be busy processing wallet operations or disconnected. You can keep navigating; balances may be outdated. Check operation history before repeating a payment or asset operation.',
                        })}
                      </p>

                      {nodeReachabilityError && (
                        <p className="mt-4 text-xs text-red-300 break-words bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                          {nodeReachabilityError}
                        </p>
                      )}

                      <div className="mt-6 flex flex-col sm:flex-row gap-3">
                        <button
                          className="px-4 py-3 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-60 flex items-center justify-center gap-2"
                          disabled={isRetryingNodeConnection}
                          onClick={() => {
                            retryNodeConnection()
                          }}
                        >
                          {isRetryingNodeConnection ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          <span>
                            {isRetryingNodeConnection
                              ? t('nodeReachability.checking', {
                                  defaultValue: 'Checking connection…',
                                })
                              : t('nodeReachability.retry', {
                                  defaultValue: 'Retry connection',
                                })}
                          </span>
                        </button>

                        <button
                          className="px-4 py-3 rounded-md bg-surface-overlay text-content-secondary font-medium"
                          onClick={() => navigate(WALLET_SETUP_PATH)}
                        >
                          {t('nodeReachability.changeNode', {
                            defaultValue: 'Change node',
                          })}
                        </button>
                      </div>

                      {lastReconnectResult &&
                        lastReconnectResult !== 'reachable' && (
                          <p className="mt-3 text-sm text-content-secondary">
                            {t('nodeReachability.retryIncomplete', {
                              defaultValue:
                                'Check completed without a response. The node may still be busy; automatic checks continue.',
                            })}
                          </p>
                        )}
                      <p className="mt-4 flex items-center gap-2 text-xs text-content-tertiary">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {t('nodeReachability.autoRetrying', {
                          defaultValue:
                            'Reconnecting automatically — this will clear as soon as the node responds.',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="absolute inset-0 z-50" id="modal-portal" />
            <div
              className={`h-full min-h-0 ${isMindRoute ? 'overflow-hidden p-3' : 'overflow-y-auto p-4'}`}
            >
              {props.children}
            </div>
          </div>
        </DesktopFrame>
      ) : isSetupRoute ? (
        <SetupFrame
          setupBusy={props.setupBusy}
          setupNetwork={props.setupNetwork}
        >
          {props.children}
        </SetupFrame>
      ) : (
        <div className="h-screen flex flex-col overflow-hidden">
          {props.children}
        </div>
      )}

      {/* Support Modal */}
      <SupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />

      {/* Logout Modal */}
      <LogoutModal
        isLoggingOut={isLoggingOut}
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
      />

      <ToastContainer
        autoClose={5000}
        closeOnClick={false}
        draggable={false}
        hideProgressBar={false}
        limit={3}
        newestOnTop={false}
        pauseOnFocusLoss={false}
        pauseOnHover={false}
        position="bottom-right"
        rtl={false}
        theme="dark"
      />

      {props.walletActions !== false && <LayoutModal />}
    </div>
  )
}
