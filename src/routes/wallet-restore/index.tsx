import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Folder,
  ArrowLeftRight,
  AlertCircle,
  Loader2,
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
  Alert,
  Input,
  Modal,
  PasswordInput,
  AdvancedSettings,
  NetworkSettings,
} from '../../components/ui'
import { buildLocalNodeUrl } from '../../api/client'
import { BitcoinNetwork } from '../../constants'
import { NETWORK_DEFAULTS, getDefaultMakerUrls } from '../../constants/networks'
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
    <Modal isOpen={isOpen} onClose={onClose} size="sm" title={title}>
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">{config.icon}</div>
          <p className="text-content-secondary text-sm">{message}</p>
        </div>

        {details && (
          <div className="bg-surface-elevated rounded-lg p-3 max-h-40 overflow-y-auto text-xs text-content-secondary font-mono border border-border-default/50">
            <p className="whitespace-pre-wrap break-words">{details}</p>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button onClick={onClose} variant="primary">
            {type === ModalType.SUCCESS
              ? t('walletRestore.continue')
              : t('walletRestore.close')}
          </Button>
        </div>
      </div>
    </Modal>
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
      network: 'SignetCustom' as BitcoinNetwork,
      password: '',
      ...NETWORK_DEFAULTS['SignetCustom'],
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

    if (modalState.type === ModalType.SUCCESS) {
      navigate(WALLET_DASHBOARD_PATH)
    } else if (modalState.type === ModalType.ERROR) {
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
    if (isStartingNode || isSubmitting.current) return

    isSubmitting.current = true
    setAdditionalErrors([])

    try {
      const nodeInfoRes = await nodeInfo()
      if (nodeInfoRes.isSuccess) {
        navigate(WALLET_DASHBOARD_PATH)
        return
      }

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
            maker_urls: getDefaultMakerUrls(data.network),
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
            makerUrls: getDefaultMakerUrls(data.network).join(','),
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

  const labelCls = 'block text-sm font-medium text-content-secondary'

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
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-2xl mx-auto px-6 py-6">
              <div className="text-center mt-4 mb-8">
                <h3 className="text-3xl font-bold text-white">
                  {t('walletRestore.title')}
                </h3>
              </div>

              {currentStep === 'backup-selection' && (
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <div className="space-y-5">
                    {additionalErrors.length > 0 && (
                      <Alert
                        icon={<AlertCircle className="w-5 h-5" />}
                        title={t('common.error')}
                        variant="error"
                      >
                        <ul className="text-sm space-y-1">
                          {additionalErrors.map((error, index) => (
                            <li className="flex items-center gap-2" key={index}>
                              <span>•</span> {error}
                            </li>
                          ))}
                        </ul>
                      </Alert>
                    )}

                    {/* Account Name */}
                    <div className="space-y-1.5">
                      <label className={labelCls} htmlFor="name">
                        {t('walletRestore.accountName')}
                      </label>
                      <Input
                        className="!py-2.5 text-sm"
                        id="name"
                        placeholder={t('walletRestore.accountNamePlaceholder')}
                        {...form.register('name', {
                          required: t('walletRestore.accountNameRequired'),
                        })}
                        error={!!form.formState.errors.name}
                      />
                      {form.formState.errors.name && (
                        <p className="text-sm text-red-500">
                          {form.formState.errors.name.message}
                        </p>
                      )}
                      <p className="text-xs text-content-tertiary">
                        {t('walletRestore.accountNameDescription')}
                      </p>
                    </div>

                    <NetworkSelector
                      onChange={(network) => form.setValue('network', network)}
                      selectedNetwork={form.watch('network')}
                    />

                    {/* Backup File */}
                    <div className="space-y-1.5">
                      <label className={labelCls} htmlFor="backup_path">
                        {t('walletRestore.backupFile')}
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          className="!py-2.5 text-sm"
                          error={!!form.formState.errors.backup_path}
                          id="backup_path"
                          placeholder={t('walletRestore.backupFilePlaceholder')}
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
                      {form.formState.errors.backup_path && (
                        <p className="text-sm text-red-500">
                          {form.formState.errors.backup_path.message}
                        </p>
                      )}
                      <p className="text-xs text-content-tertiary">
                        {t('walletRestore.backupFileDescription')}
                      </p>
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                      <label className={labelCls} htmlFor="password">
                        {t('walletRestore.password')}
                      </label>
                      <PasswordInput
                        className="!py-2.5 text-sm"
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
                      {form.formState.errors.password && (
                        <p className="text-sm text-red-500">
                          {form.formState.errors.password.message}
                        </p>
                      )}
                      <p className="text-xs text-content-tertiary">
                        {t('walletRestore.passwordDescription')}
                      </p>
                    </div>

                    <AdvancedSettings>
                      <NetworkSettings form={form} />
                    </AdvancedSettings>
                  </div>

                  <div className="flex justify-between items-center pt-6">
                    <button
                      className="px-3 py-2 text-content-secondary hover:text-white transition-colors flex items-center gap-1.5 hover:bg-surface-overlay/50 rounded-lg text-sm"
                      onClick={() => navigate(WALLET_SETUP_PATH)}
                      type="button"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Back
                    </button>
                    <Button
                      disabled={isStartingNode || isSubmitting.current}
                      icon={
                        isStartingNode ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ArrowRight className="w-4 h-4" />
                        )
                      }
                      iconPosition="right"
                      size="lg"
                      type="submit"
                      variant="primary"
                    >
                      {isStartingNode
                        ? t('walletRestore.restoring')
                        : t('walletRestore.restoreWallet')}
                    </Button>
                  </div>
                </form>
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
