import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Folder,
  ArrowLeftRight,
  AlertCircle,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import {
  WALLET_DASHBOARD_PATH,
  WALLET_SETUP_PATH,
} from '../../app/router/paths'
import { useAppDispatch } from '../../app/store/hooks'
import { Layout } from '../../components/Layout'
import { NetworkSelector } from '../../components/NetworkSelector'
import { Spinner } from '../../components/Spinner'
import {
  Button,
  Card,
  Alert,
  FormField,
  Input,
  PasswordInput,
  AdvancedSettings,
  NetworkSettings,
} from '../../components/ui'
import { buildLocalNodeUrl } from '../../api/client'
import { BitcoinNetwork } from '../../constants'
import { NETWORK_DEFAULTS } from '../../constants/networks'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { setSettingsAsync } from '../../slices/nodeSettings/nodeSettings.slice'
import { waitForNodeReady } from '../../utils/nodeState'

const ModalType = {
  ERROR: 'error',
  NONE: 'none',
  SUCCESS: 'success',
  WARNING: 'warning',
} as const

type ModalTypeValues = (typeof ModalType)[keyof typeof ModalType]

interface ModalState {
  type: ModalTypeValues
  title: string
  message: string
  details: string
  isOpen: boolean
  autoClose: boolean
}

interface FormData {
  name: string
  network: BitcoinNetwork
  rpc_connection_url: string
  backup_path: string
  password: string
  indexer_url: string
  proxy_endpoint: string
  daemon_listening_port: string
  ldk_peer_listening_port: string
}

interface StatusModalProps {
  type: ModalTypeValues
  title: string
  message: string
  details?: string
  onClose: () => void
  autoClose?: boolean
  autoCloseDelay?: number
  isOpen: boolean
}

const StatusModal = ({
  type,
  title,
  message,
  details = '',
  onClose,
  autoClose = false,
  autoCloseDelay = 3000,
  isOpen,
}: StatusModalProps) => {
  const { t } = useTranslation()

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    if (autoClose && isOpen) {
      timer = setTimeout(() => {
        onClose()
      }, autoCloseDelay)
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [autoClose, isOpen, onClose, autoCloseDelay])

  if (!isOpen) return null

  const getModalConfig = () => {
    switch (type) {
      case ModalType.SUCCESS:
        return {
          bgColor: 'bg-status-success/10',
          borderColor: 'border-status-success/30',
          icon: <CheckCircle className="h-7 w-7 text-status-success" />,
        }
      case ModalType.ERROR:
        return {
          bgColor: 'bg-status-danger/10',
          borderColor: 'border-status-danger/30',
          icon: <XCircle className="h-7 w-7 text-status-danger" />,
        }
      case ModalType.WARNING:
        return {
          bgColor: 'bg-status-warning/10',
          borderColor: 'border-status-warning/30',
          icon: <AlertTriangle className="h-7 w-7 text-status-warning" />,
        }
      default:
        return {
          bgColor: 'bg-primary/10',
          borderColor: 'border-primary/30',
          icon: <CheckCircle className="h-7 w-7 text-primary" />,
        }
    }
  }

  const config = getModalConfig()

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className={`max-w-md w-full rounded-xl shadow-2xl ${config.bgColor} border ${config.borderColor} p-6`}
      >
        <div className="flex items-start gap-4">
          <div className="shrink-0 mt-0.5">{config.icon}</div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-content-primary mb-1.5">
              {title}
            </h3>
            <p className="text-content-secondary text-sm mb-3">{message}</p>

            {details && (
              <div className="mb-4">
                <div className="bg-surface-base rounded-lg p-3 max-h-48 overflow-y-auto text-sm text-content-secondary font-mono border border-border-default/50 custom-scrollbar">
                  <p className="whitespace-pre-wrap break-words">{details}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-emphasis text-white text-sm font-medium transition-colors"
                onClick={onClose}
              >
                {type === ModalType.SUCCESS
                  ? t('walletRestore.continue')
                  : t('walletRestore.close')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const Component = () => {
  const { t } = useTranslation()
  const [isStartingNode, setIsStartingNode] = useState(false)
  const [additionalErrors, setAdditionalErrors] = useState<string[]>([])
  const [currentStep, setCurrentStep] = useState<string>('backup-selection')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const isSubmitting = useRef(false)

  const steps = [
    { id: 'backup-selection', label: t('walletRestore.steps.backupSelection') },
    { id: 'restoration', label: t('walletRestore.steps.restoration') },
    { id: 'completion', label: t('walletRestore.steps.completion') },
  ]

  const [modalState, setModalState] = useState<ModalState>({
    autoClose: false,
    details: '',
    isOpen: false,
    message: '',
    title: '',
    type: ModalType.NONE,
  })

  const [restore] = nodeApi.useRestoreMutation()
  const [nodeInfo] = nodeApi.endpoints.nodeInfo.useLazyQuery()

  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const form = useForm<FormData>({
    defaultValues: {
      backup_path: '',
      name: t('walletRestore.defaultAccountName'),
      network: 'Regtest' as BitcoinNetwork,
      password: '',
      ...NETWORK_DEFAULTS['Regtest'],
    },
  })

  const network = form.watch('network')

  useEffect(() => {
    const defaults = NETWORK_DEFAULTS[network]
    form.setValue('rpc_connection_url', defaults.rpc_connection_url)
    form.setValue('indexer_url', defaults.indexer_url)
    form.setValue('proxy_endpoint', defaults.proxy_endpoint)
    form.setValue('daemon_listening_port', defaults.daemon_listening_port)
    form.setValue('ldk_peer_listening_port', defaults.ldk_peer_listening_port)
  }, [network, form])

  const closeModal = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }))

    // Navigate if it was a success modal
    if (modalState.type === ModalType.SUCCESS) {
      navigate(WALLET_DASHBOARD_PATH)
    } else if (modalState.type === ModalType.ERROR) {
      // On error, go back to the first step
      setCurrentStep('backup-selection')
      setIsStartingNode(false)
    }
  }

  const showSuccessModal = () => {
    setCurrentStep('completion')
    setModalState({
      autoClose: true,
      details: '',
      isOpen: true,
      message: t('walletRestore.successMessage'),
      title: t('walletRestore.successTitle'),
      type: ModalType.SUCCESS,
    })
  }

  const showErrorModal = (title: string, details: string) => {
    setModalState({
      autoClose: false,
      details,
      isOpen: true,
      message: t('walletRestore.errorMessage'),
      title,
      type: ModalType.ERROR,
    })
  }

  const onSubmit = async (data: FormData) => {
    // Prevent multiple submissions
    if (isStartingNode || isSubmitting.current) return

    isSubmitting.current = true
    setAdditionalErrors([])

    try {
      const nodeInfoRes = await nodeInfo()
      if (nodeInfoRes.isSuccess) {
        navigate(WALLET_DASHBOARD_PATH)
        return
      }

      // Validate required fields
      if (!data.backup_path) {
        setAdditionalErrors([t('walletRestore.selectBackupFile')])
        isSubmitting.current = false
        return
      }

      if (!data.password) {
        setAdditionalErrors([t('walletRestore.passwordRequiredError')])
        isSubmitting.current = false
        return
      }

      const formattedName = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')

      const datapath = `kaleidoswap-${formattedName}`

      const accountExists = await invoke('check_account_exists', {
        name: data.name,
      })
      if (accountExists) {
        showErrorModal(
          t('walletRestore.accountExistsTitle'),
          t('walletRestore.accountExistsMessage')
        )
        isSubmitting.current = false
        return
      }

      setIsStartingNode(true)
      setCurrentStep('restoration')

      try {
        const defaultMakerUrl = NETWORK_DEFAULTS[data.network].default_maker_url
        await dispatch(
          setSettingsAsync({
            daemon_listening_port: data.daemon_listening_port,
            datapath: datapath,
            default_lsp_url: NETWORK_DEFAULTS[data.network].default_lsp_url,
            default_maker_url: defaultMakerUrl,
            indexer_url: data.indexer_url,
            ldk_peer_listening_port: data.ldk_peer_listening_port,
            maker_urls: [defaultMakerUrl],
            name: data.name,
            network: data.network,
            node_url: buildLocalNodeUrl(data.daemon_listening_port),
            proxy_endpoint: data.proxy_endpoint,
            rpc_connection_url: data.rpc_connection_url,
          })
        )
        try {
          await invoke('start_node', {
            accountName: data.name,
            daemonListeningPort: data.daemon_listening_port,
            datapath: datapath,
            ldkPeerListeningPort: data.ldk_peer_listening_port,
            network: data.network,
          })
          await waitForNodeReady({
            daemonPort: data.daemon_listening_port,
          })

          toast.success(t('walletRestore.nodeStartedSuccess'))
        } catch (error) {
          toast.error(t('walletRestore.couldNotStartNode', { error }))
          throw new Error(`Could not start node: ${error}`, { cause: error })
        }

        const restoreResponse = await restore({
          backup_path: data.backup_path,
          password: data.password,
        })

        if (!restoreResponse.error) {
          await invoke('insert_account', {
            daemonListeningPort: data.daemon_listening_port,
            datapath: datapath,
            defaultLspUrl: NETWORK_DEFAULTS[data.network].default_lsp_url,
            defaultMakerUrl,
            indexerUrl: data.indexer_url,
            language: 'en',
            ldkPeerListeningPort: data.ldk_peer_listening_port,
            makerUrls: defaultMakerUrl,
            name: data.name,
            network: data.network,
            nodeUrl: buildLocalNodeUrl(data.daemon_listening_port),
            proxyEndpoint: data.proxy_endpoint,
            rpcConnectionUrl: data.rpc_connection_url,
          })

          await invoke('set_current_account', {
            accountName: data.name,
          })

          showSuccessModal()
        } else {
          showErrorModal(
            t('walletRestore.errorTitle'),
            restoreResponse.error
              ? t('walletRestore.errorRestoringWallet', {
                  error: JSON.stringify(restoreResponse.error),
                })
              : t('walletRestore.failedToRestore')
          )
          await invoke('stop_node')
        }
      } catch (error) {
        await invoke('stop_node')
        showErrorModal(
          t('walletRestore.nodeOperationFailedTitle'),
          t('walletRestore.failedToStartNode', {
            error: error instanceof Error ? error.message : String(error),
          })
        )
      }
    } catch (error) {
      showErrorModal(
        t('walletRestore.unexpectedErrorTitle'),
        t('walletRestore.unexpectedError', {
          error: error instanceof Error ? error.message : String(error),
        })
      )
      await invoke('stop_node')
    } finally {
      setIsStartingNode(false)
      isSubmitting.current = false
    }
  }

  const handleSelectBackupFile = async () => {
    try {
      const selected = await open({
        directory: false,
        filters: [
          {
            extensions: ['enc'],
            name: 'Backup Files',
          },
        ],
        multiple: false,
      })
      if (selected && typeof selected === 'string') {
        form.setValue('backup_path', selected)
      }
    } catch (error) {
      toast.error(t('walletRestore.failedToSelectBackup'))
    }
  }

  return (
    <Layout>
      <div className="flex flex-1 overflow-hidden">
        {/* Left decorative panel */}
        <div className="hidden md:flex flex-col w-64 xl:w-72 shrink-0 bg-surface-base border-r border-border-subtle relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full bg-primary/6 blur-3xl" />
          </div>
          <div className="relative flex-1 flex flex-col items-center justify-center p-8 gap-6">
            {/* Icon ring */}
            <div className="relative w-24 h-24 shrink-0">
              <div className="absolute inset-0 rounded-full border-2 border-primary/15" />
              <div className="absolute inset-2 rounded-full border border-dashed border-primary/20 animate-[spin_12s_linear_infinite]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-secondary/10 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/10">
                  <ArrowLeftRight className="w-7 h-7 text-primary" />
                </div>
              </div>
            </div>
            {/* Title + subtitle */}
            <div className="text-center space-y-2">
              <h2 className="text-lg font-bold text-content-primary">
                {t('walletRestore.title')}
              </h2>
              <p className="text-xs text-content-secondary leading-relaxed">
                {t('walletRestore.subtitle')}
              </p>
            </div>
            {/* Step progress */}
            <div className="w-full space-y-1.5">
              {steps.map((step, idx) => {
                const currentIdx = steps.findIndex((s) => s.id === currentStep)
                const isCompleted = idx < currentIdx
                const isActive = step.id === currentStep
                return (
                  <div className="flex items-center gap-2.5" key={step.id}>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold transition-colors ${
                        isCompleted
                          ? 'bg-status-success text-white'
                          : isActive
                            ? 'bg-primary text-white'
                            : 'bg-surface-high text-content-tertiary'
                      }`}
                    >
                      {isCompleted ? '✓' : idx + 1}
                    </div>
                    <span
                      className={`text-xs truncate transition-colors ${
                        isActive
                          ? 'text-content-primary font-medium'
                          : isCompleted
                            ? 'text-status-success'
                            : 'text-content-tertiary'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        {/* Right content panel */}
        <div className="flex flex-col flex-1 overflow-hidden bg-surface-raised">
          <div className="flex items-center px-6 py-4 border-b border-border-subtle shrink-0">
            <button
              className="flex items-center gap-2 text-sm text-content-secondary hover:text-content-primary transition-colors"
              onClick={() => navigate(WALLET_SETUP_PATH)}
              type="button"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-2xl mx-auto px-6 py-8">
              {/* Mobile header */}
              <div className="md:hidden mb-6">
                <h1 className="text-2xl font-bold text-content-primary mb-1">
                  {t('walletRestore.title')}
                </h1>
                <p className="text-sm text-content-secondary">
                  {t('walletRestore.subtitle')}
                </p>
              </div>

              {currentStep === 'backup-selection' && (
                <div className="max-w-2xl mx-auto">
                  <form onSubmit={form.handleSubmit(onSubmit)}>
                    <Card className="p-6 mb-6">
                      <div className="space-y-6">
                        {additionalErrors.length > 0 && (
                          <Alert
                            icon={<AlertCircle className="w-5 h-5" />}
                            title={t('common.error')}
                            variant="error"
                          >
                            <ul className="text-sm space-y-1">
                              {additionalErrors.map((error, index) => (
                                <li
                                  className="flex items-center gap-2"
                                  key={index}
                                >
                                  <span>•</span> {error}
                                </li>
                              ))}
                            </ul>
                          </Alert>
                        )}

                        <FormField
                          description={t(
                            'walletRestore.accountNameDescription'
                          )}
                          error={form.formState.errors.name?.message}
                          htmlFor="name"
                          label={t('walletRestore.accountName')}
                        >
                          <Input
                            id="name"
                            placeholder={t(
                              'walletRestore.accountNamePlaceholder'
                            )}
                            {...form.register('name', {
                              required: t('walletRestore.accountNameRequired'),
                            })}
                            error={!!form.formState.errors.name}
                          />
                        </FormField>

                        <NetworkSelector
                          className="mb-2"
                          onChange={(network) =>
                            form.setValue('network', network)
                          }
                          selectedNetwork={form.watch('network')}
                        />

                        <FormField
                          description={t('walletRestore.backupFileDescription')}
                          error={form.formState.errors.backup_path?.message}
                          htmlFor="backup_path"
                          label={t('walletRestore.backupFile')}
                        >
                          <div className="flex items-center gap-2">
                            <Input
                              error={!!form.formState.errors.backup_path}
                              id="backup_path"
                              placeholder={t(
                                'walletRestore.backupFilePlaceholder'
                              )}
                              readOnly
                              value={form.watch('backup_path')}
                            />
                            <Button
                              className="flex-shrink-0"
                              onClick={handleSelectBackupFile}
                              type="button"
                              variant="outline"
                            >
                              <Folder className="w-5 h-5" />
                            </Button>
                          </div>
                        </FormField>

                        <FormField
                          description={t('walletRestore.passwordDescription')}
                          error={form.formState.errors.password?.message}
                          htmlFor="password"
                          label={t('walletRestore.password')}
                        >
                          <PasswordInput
                            id="password"
                            isVisible={isPasswordVisible}
                            onToggleVisibility={() =>
                              setIsPasswordVisible(!isPasswordVisible)
                            }
                            placeholder={t('walletRestore.passwordPlaceholder')}
                            {...form.register('password', {
                              required: t('walletRestore.passwordRequired'),
                            })}
                            error={!!form.formState.errors.password}
                          />
                        </FormField>

                        <AdvancedSettings>
                          <NetworkSettings form={form} />
                        </AdvancedSettings>
                      </div>

                      <div className="pt-6">
                        <Button
                          className="w-full"
                          disabled={isStartingNode || isSubmitting.current}
                          size="lg"
                          type="submit"
                        >
                          {isStartingNode ? (
                            <span className="flex items-center justify-center gap-2">
                              <Spinner size="sm" />
                              {t('walletRestore.restoring')}
                            </span>
                          ) : (
                            t('walletRestore.restoreWallet')
                          )}
                        </Button>
                      </div>
                    </Card>
                  </form>
                </div>
              )}

              {currentStep === 'restoration' && (
                <div className="py-8 space-y-6 text-center">
                  <div className="relative inline-flex">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/20 flex items-center justify-center">
                      <Spinner size="lg" />
                    </div>
                    <div className="absolute inset-0 rounded-full bg-primary/5 animate-ping" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-xl font-semibold text-content-primary">
                      {t('walletRestore.restoringYourWallet')}
                    </h3>
                    <p className="text-content-secondary text-sm">
                      {t('walletRestore.restoringMessage')}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-overlay/40 border border-border-subtle/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs text-content-secondary">
                      This may take up to 60 seconds
                    </span>
                  </div>
                </div>
              )}

              <StatusModal
                autoClose={modalState.autoClose}
                autoCloseDelay={3000}
                details={modalState.details}
                isOpen={modalState.isOpen}
                message={modalState.message}
                onClose={closeModal}
                title={modalState.title}
                type={modalState.type}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
