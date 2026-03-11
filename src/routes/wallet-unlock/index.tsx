import { invoke } from '@tauri-apps/api/core'
import {
  ChevronDown,
  Lock,
  Shield,
  Server,
  Globe,
  Zap,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import {
  ROOT_PATH,
  WALLET_SETUP_PATH,
} from '../../app/router/paths'
import { useAppSelector } from '../../app/store/hooks'
import { Layout } from '../../components/Layout'
import {
  Alert,
  Button,
  Card,
  FormField,
  PasswordInput,
} from '../../components/ui'
import { UnlockingProgress } from '../../components/UnlockingProgress'
import { parseRpcUrl } from '../../helpers/utils'
import { nodeApi, NodeApiError } from '../../slices/nodeApi/nodeApi.slice'

const withTimeout = <T,>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
        ms
      )
    ),
  ])

interface Fields {
  password: string
}

const MAX_UNLOCK_RETRIES = 20

export const Component = () => {
  const { t } = useTranslation()
  const nodeSettings = useAppSelector((state) => state.nodeSettings.data)
  const nodeLifecycle = useAppSelector((state) => state.node.lifecycle)
  const [unlock] = nodeApi.endpoints.unlock.useMutation()
  const [nodeInfo] = nodeApi.endpoints.nodeInfo.useLazyQuery()

  const navigate = useNavigate()

  // Ref-based cancellation flag so handleCancelUnlocking can break the retry loop
  // synchronously regardless of which async await the loop is currently suspended at.
  const isCancelledRef = useRef(false)

  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [showInitModal, setShowInitModal] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [isConnectionDetailsOpen, setIsConnectionDetailsOpen] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(true)
  const [redirectToRoot, setRedirectToRoot] = useState(false)

  useEffect(() => {
    const checkNodeStatus = async () => {
      if (!nodeSettings.node_url) {
        navigate(WALLET_SETUP_PATH)
        return
      }
      setIsCheckingStatus(true)
      try {
        // 10 s timeout — prevents the spinner from hanging if the node HTTP
        // server accepts the TCP connection but never sends a response.
        const nodeInfoRes = await withTimeout(
          nodeInfo(),
          10000,
          'Node status check'
        )
        if (nodeInfoRes.isSuccess) {
          setRedirectToRoot(true)
        }
      } catch (error: any) {
        // FETCH_ERROR (connection refused) and timeout both just mean "node is
        // locked / not ready" — show the form, no toast needed.
        if (
          error?.status !== 'FETCH_ERROR' &&
          !error?.message?.includes('timed out')
        ) {
          toast.error(
            t('walletUnlock.failedCheckStatus', {
              error: error.message || t('walletUnlock.unknownError'),
            }),
            { autoClose: 5000, position: 'top-right' }
          )
        }
      } finally {
        setIsCheckingStatus(false)
      }
    }
    checkNodeStatus()
  }, [])

  useEffect(() => {
    if (nodeLifecycle.status === 'Failed') {
      setUnlockError(nodeLifecycle.message)
      setErrors([nodeLifecycle.message])
      setIsUnlocking(false)
      return
    }

    if (
      isUnlocking &&
      nodeLifecycle.status === 'Stopped' &&
      !isCancelledRef.current
    ) {
      const message = t('walletUnlock.nodeStoppedUnexpectedly', {
        defaultValue: 'Node stopped before the wallet unlock completed.',
      })
      setUnlockError(message)
      setErrors([message])
      setIsUnlocking(false)
    }
  }, [isUnlocking, nodeLifecycle, t])

  const unlockForm = useForm<Fields>({
    defaultValues: { password: '' },
  })

  const onSubmit: SubmitHandler<Fields> = async (data) => {
    let shouldRetry = true
    let pollingInterval = 2000
    const maxPollingInterval = 15000
    let retryCount = 0
    // Separate counter for unlock timeouts — the /unlock endpoint can legitimately
    // take 30–120 s on first run (bitcoind connection + blockchain sync).
    // We allow one silent timeout retry, then surface an informative message.
    let unlockTimeoutCount = 0
    const MAX_UNLOCK_TIMEOUTS = 2

    isCancelledRef.current = false
    setIsUnlocking(true)
    setErrors([])
    setUnlockError(null)

    while (shouldRetry && !isCancelledRef.current) {
      if (retryCount >= MAX_UNLOCK_RETRIES) {
        const maxRetriesMsg = t('walletUnlock.maxRetriesReached', {
          defaultValue:
            'Maximum unlock attempts reached. The node may still be syncing — please try again shortly.',
        })
        setUnlockError(maxRetriesMsg)
        setErrors([maxRetriesMsg])
        shouldRetry = false
        break
      }

      try {
        const rpcConfig = parseRpcUrl(nodeSettings.rpc_connection_url)

        // 120 s timeout — the RGB Lightning Node's /unlock endpoint connects to
        // bitcoind, verifies the chain, starts LDK, etc. and can take a long time.
        // Without a timeout the fetch hangs forever, freezing the UI.
        await withTimeout(
          unlock({
            announce_addresses: [],
            announce_alias: 'kaleidoswap-desktop',
            bitcoind_rpc_host: rpcConfig.host,
            bitcoind_rpc_password: rpcConfig.password,
            bitcoind_rpc_port: rpcConfig.port,
            bitcoind_rpc_username: rpcConfig.username,
            indexer_url: nodeSettings.indexer_url,
            password: data.password,
            proxy_endpoint: nodeSettings.proxy_endpoint,
          }).unwrap(),
          120000,
          'Wallet unlock'
        )

        if (isCancelledRef.current) break

        // 10 s timeout for the follow-up nodeInfo check
        const nodeInfoRes = await withTimeout(nodeInfo(), 10000, 'Node info check')
        if (nodeInfoRes.isSuccess) {
          toast.success(t('walletUnlock.successMessage'), {
            autoClose: 3000,
            position: 'bottom-right',
          })
          setRedirectToRoot(true)
        } else {
          throw new Error(t('walletUnlock.failedGetNodeInfo'))
        }

        shouldRetry = false
      } catch (e: any) {
        if (isCancelledRef.current) break

        // Handle unlock-specific timeout: the node is doing a long operation
        // (blockchain sync, bitcoind connection). Allow a couple of silent retries,
        // then surface a clear message so the user knows what's happening.
        if (e?.message?.startsWith('Wallet unlock timed out')) {
          unlockTimeoutCount++
          if (unlockTimeoutCount >= MAX_UNLOCK_TIMEOUTS) {
            const timeoutMsg = t('walletUnlock.unlockTimeoutMessage', {
              defaultValue:
                'The node is taking longer than expected to unlock. This is normal during the first unlock while the node syncs the blockchain. Please wait a moment and try again.',
            })
            setUnlockError(timeoutMsg)
            setErrors([timeoutMsg])
            shouldRetry = false
            break
          }
          // Silent retry — the node is busy, wait a bit
          await new Promise((res) => setTimeout(res, pollingInterval))
          pollingInterval = Math.min(pollingInterval * 1.5, maxPollingInterval)
          continue
        }

        if (
          e?.message?.includes('timeout') ||
          e?.message?.includes('timed out') ||
          e?.message?.includes('The request timed out')
        ) {
          retryCount++
          await new Promise((res) => setTimeout(res, pollingInterval))
          pollingInterval = Math.min(pollingInterval * 1.5, maxPollingInterval)
          continue
        }

        const error = e as NodeApiError
        let errorMessage: string

        if (error?.data?.error) {
          errorMessage = error.data.error
        } else if (e instanceof Error) {
          errorMessage = e.message
        } else {
          errorMessage = t('walletUnlock.unknownError')
        }

        if (
          typeof error.status === 'string' &&
          (error?.status === 'FETCH_ERROR' || error?.status === 'TIMEOUT_ERROR')
        ) {
          retryCount++
          await new Promise((res) => setTimeout(res, pollingInterval))
          pollingInterval = Math.min(pollingInterval * 1.5, maxPollingInterval)
          continue
        }

        if (
          error?.status === 403 &&
          errorMessage === 'Cannot call other APIs while node is changing state'
        ) {
          retryCount++
          await new Promise((res) => setTimeout(res, pollingInterval))
          pollingInterval = Math.min(pollingInterval * 1.5, maxPollingInterval)
          continue
        }

        if (
          (error?.status === 401 && errorMessage === 'Invalid password') ||
          errorMessage.toLowerCase().includes('password is incorrect')
        ) {
          setUnlockError(t('walletUnlock.invalidPassword'))
          toast.error(t('walletUnlock.invalidPassword'), {
            autoClose: 5000,
            position: 'top-right',
          })
          shouldRetry = false
          continue
        }

        if (
          error.status === 403 &&
          errorMessage === 'Wallet has not been initialized (hint: call init)'
        ) {
          setShowInitModal(true)
          shouldRetry = false
        } else if (
          errorMessage === 'Node has already been unlocked' ||
          errorMessage.includes('Node is unlocked')
        ) {
          toast.info(t('walletUnlock.alreadyUnlocked'), {
            autoClose: 3000,
            position: 'bottom-right',
          })
          setRedirectToRoot(true)
          shouldRetry = false
        } else {
          setUnlockError(errorMessage)
          setErrors([errorMessage])
          toast.error(errorMessage, { autoClose: 5000, position: 'top-right' })
          shouldRetry = false
        }
      }
    }

    if (!isCancelledRef.current && !shouldRetry && !showInitModal) {
      setIsUnlocking(false)
    }
  }

  const handleBack = async () => {
    if (nodeSettings.datapath) {
      try {
        await invoke('stop_node')
        toast.info(t('walletUnlock.nodeStopped'), {
          autoClose: 2000,
          position: 'bottom-right',
        })
      } catch (error) {
        console.error('Failed to stop node:', error)
      }
    }
    navigate(WALLET_SETUP_PATH)
  }

  const handleCancelUnlocking = () => {
    isCancelledRef.current = true
    setIsUnlocking(false)
    setUnlockError(null)
    toast.info(t('walletUnlock.unlockCancelled'), {
      autoClose: 3000,
      position: 'bottom-right',
    })
  }

  const rpcConfig = parseRpcUrl(nodeSettings.rpc_connection_url || '')
  const accountName = nodeSettings.name || 'Your Wallet'

  if (redirectToRoot) {
    return <Navigate replace to={ROOT_PATH} />
  }

  return (
    <Layout>
      {isCheckingStatus ? (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <div className="text-center">
            <p className="text-content-primary font-medium">
              {t('walletUnlock.checkingStatus')}
            </p>
            <p className="text-content-secondary text-sm mt-1">
              {t('walletUnlock.checkingMessage')}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* ── Left decorative panel ── */}
          <div className="hidden md:flex flex-col items-center justify-center relative overflow-hidden flex-1 bg-gradient-to-br from-surface-raised via-surface-base to-surface-raised border-r border-border-subtle p-10">
            {/* Background glows */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-primary/8 blur-3xl" />
              <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 translate-y-1/2 w-56 h-56 rounded-full bg-secondary/6 blur-3xl" />
            </div>

            <div className="relative flex flex-col items-center gap-8 w-full max-w-xs">
              {/* Animated lock ring */}
              <div className="relative w-32 h-32">
                <div className="absolute inset-0 rounded-full border-2 border-primary/15" />
                <div className="absolute inset-2 rounded-full border border-dashed border-primary/20 animate-[spin_12s_linear_infinite]" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary/50 border-r-primary/30 animate-[spin_4s_linear_infinite]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/10 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/10">
                    <Lock className="w-9 h-9 text-primary" />
                  </div>
                </div>
              </div>

              {/* Account info */}
              <div className="text-center space-y-2">
                <p className="text-xs font-medium text-content-tertiary uppercase tracking-widest">
                  Account
                </p>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  {accountName}
                </h2>
              </div>

              {/* Node info pills */}
              <div className="w-full space-y-2">
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-overlay/40 border border-border-subtle">
                  <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-xs text-content-secondary font-mono truncate">
                    {nodeSettings.node_url || 'Node not configured'}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-overlay/40 border border-border-subtle">
                  <Zap className="w-3.5 h-3.5 text-secondary shrink-0" />
                  <span className="text-xs text-content-secondary font-mono truncate">
                    {rpcConfig.host}:{rpcConfig.port}
                  </span>
                </div>
              </div>

              {/* Security badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-status-success/10 border border-status-success/20">
                <Shield className="w-3 h-3 text-status-success" />
                <span className="text-xs text-status-success font-medium">
                  End-to-end encrypted
                </span>
              </div>
            </div>
          </div>

          {/* ── Right form panel ── */}
          <div className="flex flex-col w-full md:w-[420px] lg:w-[460px] overflow-y-auto">
            <div className="flex flex-col justify-center min-h-full px-8 md:px-10 py-8">
              {/* Back button */}
              {!isUnlocking && (
                <div className="mb-8">
                  <Button
                    icon={<ArrowLeft className="w-4 h-4" />}
                    onClick={handleBack}
                    size="sm"
                    variant="ghost"
                  >
                    {t('common.back', { defaultValue: 'Back' })}
                  </Button>
                </div>
              )}

              {!isUnlocking ? (
                <>
                  {/* Header */}
                  <div className="mb-8">
                    <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 mb-4 md:hidden">
                      <Lock className="w-5 h-5 text-primary" />
                    </div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-content-primary mb-2">
                      {t('walletUnlock.title')}
                    </h1>
                    <p className="text-content-secondary text-sm leading-relaxed">
                      {t('walletUnlock.subtitle')}
                    </p>
                  </div>

                  {/* Form */}
                  <form className="space-y-5" onSubmit={unlockForm.handleSubmit(onSubmit)}>
                    {/* Connection Details */}
                    <div>
                      <button
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-overlay/40 border border-border-default/30 hover:border-primary/30 transition-colors text-sm"
                        onClick={() => setIsConnectionDetailsOpen(!isConnectionDetailsOpen)}
                        type="button"
                      >
                        <span className="flex items-center gap-2 text-content-secondary">
                          <Server className="w-4 h-4 text-primary" />
                          Connection Details
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-content-tertiary transition-transform duration-200 ${isConnectionDetailsOpen ? 'rotate-180' : ''
                            }`}
                        />
                      </button>

                      {isConnectionDetailsOpen && (
                        <div className="mt-2 p-4 rounded-lg bg-surface-base border border-border-default/20 space-y-3">
                          <div className="flex items-center gap-3">
                            <Globe className="w-4 h-4 text-primary shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs text-content-tertiary mb-0.5">Node URL</p>
                              <p className="text-sm text-content-primary font-mono truncate">
                                {nodeSettings.node_url}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Zap className="w-4 h-4 text-secondary shrink-0" />
                            <div>
                              <p className="text-xs text-content-tertiary mb-0.5">Bitcoind RPC</p>
                              <p className="text-sm text-content-primary font-mono">
                                {rpcConfig.host}:{rpcConfig.port}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Server className="w-4 h-4 text-content-secondary mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs text-content-tertiary mb-0.5">Indexer</p>
                              <p className="text-sm text-content-primary font-mono break-all">
                                {nodeSettings.indexer_url}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Globe className="w-4 h-4 text-content-secondary mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs text-content-tertiary mb-0.5">RGB Proxy</p>
                              <p className="text-sm text-content-primary font-mono break-all">
                                {nodeSettings.proxy_endpoint}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Password */}
                    <FormField
                      htmlFor="password"
                      label={t('walletUnlock.walletPassword')}
                    >
                      <PasswordInput
                        id="password"
                        isVisible={isPasswordVisible}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            unlockForm.handleSubmit(onSubmit)()
                          }
                        }}
                        onToggleVisibility={() => setIsPasswordVisible(!isPasswordVisible)}
                        placeholder={t('walletUnlock.passwordPlaceholder')}
                        {...unlockForm.register('password', {
                          required: t('walletUnlock.passwordRequired'),
                        })}
                        error={!!unlockForm.formState.errors.password}
                      />
                      {unlockForm.formState.errors.password && (
                        <p className="mt-1 text-xs text-status-danger">
                          {unlockForm.formState.errors.password.message}
                        </p>
                      )}
                    </FormField>

                    {/* Errors */}
                    {errors.length > 0 && (
                      <Alert
                        icon={<AlertCircle className="w-4 h-4" />}
                        title={t('common.error')}
                        variant="error"
                      >
                        <ul className="text-xs space-y-1">
                          {errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </Alert>
                    )}

                    <Button
                      className="w-full"
                      disabled={isUnlocking}
                      icon={<Shield className="w-4 h-4" />}
                      size="lg"
                      type="submit"
                      variant="primary"
                    >
                      {t('walletUnlock.unlockButton')}
                    </Button>
                  </form>
                </>
              ) : (
                <div className="flex flex-col flex-1 pb-8">
                  <UnlockingProgress
                    errorMessage={unlockError || undefined}
                    isUnlocking={isUnlocking}
                    onCancel={handleCancelUnlocking}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Wallet not initialized modal */}
      {showInitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm">
            <Card className="p-6">
              <div className="text-center mb-5">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-status-warning/10 border border-status-warning/20 mb-3">
                  <Shield className="w-6 h-6 text-status-warning" />
                </div>
                <h3 className="text-lg font-bold text-content-primary mb-2">
                  {t('walletUnlock.initializeWalletTitle')}
                </h3>
                <p className="text-content-secondary text-sm leading-relaxed">
                  {t('walletUnlock.initializeWalletMessage')}
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  onClick={() => setShowInitModal(false)}
                  variant="outline"
                >
                  {t('walletUnlock.cancel')}
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    setShowInitModal(false)
                    navigate(WALLET_SETUP_PATH)
                  }}
                  variant="primary"
                >
                  {t('walletUnlock.initialize')}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </Layout>
  )
}
