import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import {
  AlertCircle,
  ArrowRight,
  Wallet,
  Lock,
  FileText,
  CheckCircle,
  AlertTriangle,
  Zap,
  Loader2,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { SubmitHandler, UseFormReturn, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import {
  WALLET_DASHBOARD_PATH,
  WALLET_SETUP_PATH,
} from '../../app/router/paths'
import { useAppDispatch } from '../../app/store/hooks'
import { Layout } from '../../components/Layout'
import { MnemonicDisplay } from '../../components/MnemonicDisplay'
import {
  MnemonicVerifyForm,
  MnemonicVerifyFields,
} from '../../components/MnemonicVerifyForm'
import { NetworkSelector } from '../../components/NetworkSelector'
import {
  PasswordSetupForm,
  PasswordFields,
} from '../../components/PasswordSetupForm'
import { SkipMnemonicWarningModal } from '../../components/SkipMnemonicWarningModal'
import { StepIndicator } from '../../components/StepIndicator'
import { TermsWarningModal } from '../../components/TermsWarningModal'
import {
  Button,
  Card,
  Alert,
  SetupSection,
  FormField,
  Input,
  SetupLayout,
  AdvancedSettings,
  NetworkSettings,
} from '../../components/ui'
import { UnlockingProgress } from '../../components/UnlockingProgress'
import { BitcoinNetwork } from '../../constants'
import { NETWORK_DEFAULTS } from '../../constants/networks'
import { parseRpcUrl } from '../../helpers/utils'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { setSettingsAsync } from '../../slices/nodeSettings/nodeSettings.slice'

const checkPortAvailability = async (
  ports: string[]
): Promise<{ available: boolean; conflictingPorts: string[] }> => {
  try {
    // First check if any ports are in use by our own nodes
    const runningNodePorts = await invoke<{ [port: string]: string }>(
      'get_running_node_ports'
    )
    const conflictingNodePorts = ports.filter(
      (port) => port in runningNodePorts
    )

    if (conflictingNodePorts.length > 0) {
      return {
        available: false,
        conflictingPorts: conflictingNodePorts,
      }
    }

    // Then check if ports are in use by other processes
    const portStatus = await invoke<{ [port: string]: boolean }>(
      'check_ports_available',
      { ports }
    )
    const unavailablePorts = Object.entries(portStatus)
      .filter(([_, isAvailable]) => !isAvailable)
      .map(([port]) => port)

    return {
      available: unavailablePorts.length === 0,
      conflictingPorts: unavailablePorts,
    }
  } catch (error) {
    console.error('Error checking port availability:', error)
    throw new Error('Failed to check port availability')
  }
}

const WALLET_INIT_STEPS = [
  { id: 'terms', label: 'Terms' },
  { id: 'setup', label: 'Node Setup' },
  { id: 'password', label: 'Password' },
  { id: 'mnemonic', label: 'Recovery Phrase' },
  { id: 'verify', label: 'Verification' },
  { id: 'unlock', label: 'Unlock' },
]

interface NodeSetupFields {
  name: string
  network: BitcoinNetwork
  rpc_connection_url: string
  indexer_url: string
  proxy_endpoint: string
  daemon_listening_port: string
  ldk_peer_listening_port: string
  bearer_token: string
}

type SetupStep =
  | 'terms'
  | 'setup'
  | 'password'
  | 'mnemonic'
  | 'verify'
  | 'unlock'

export const Component = () => {
  const [currentStep, setCurrentStep] = useState<SetupStep>('terms')
  const [mnemonic, setMnemonic] = useState<string[]>([])
  const [isNodeError, setIsNodeError] = useState(false)
  const [nodeErrorMessage, setNodeErrorMessage] = useState('')
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [nodePassword, setNodePassword] = useState('')
  const [isCancellingUnlock, setIsCancellingUnlock] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(true)
  const [isInitializing, setIsInitializing] = useState(false)
  const [showSkipMnemonicWarning, setShowSkipMnemonicWarning] = useState(false)

  const [init] = nodeApi.endpoints.init.useLazyQuery()
  const [unlock] = nodeApi.endpoints.unlock.useLazyQuery()
  const [nodeInfo] = nodeApi.endpoints.nodeInfo.useLazyQuery()

  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  // Separate forms for each step
  const nodeSetupForm = useForm<NodeSetupFields>({
    defaultValues: {
      bearer_token: '',
      name: 'Test Account',
      network: 'Regtest',
      ...NETWORK_DEFAULTS['Regtest'],
    },
  })

  const passwordForm = useForm<PasswordFields>({
    defaultValues: {
      confirmPassword: '',
      password: '',
    },
  })

  const mnemonicForm = useForm<MnemonicVerifyFields>({
    defaultValues: {
      mnemonic: '',
    },
  })

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      nodeSetupForm.reset()
      passwordForm.reset()
      mnemonicForm.reset()
      setErrors([])
    }
  }, [])

  // Handle back navigation based on current step
  const handleBackNavigation = () => {
    switch (currentStep) {
      case 'terms':
        navigate(WALLET_SETUP_PATH)
        break
      case 'setup':
        handleStepChange('terms')
        break
      case 'password':
        handleStepChange('setup')
        break
      case 'mnemonic':
        handleStepChange('password')
        break
      case 'verify':
        handleStepChange('mnemonic')
        break
      case 'unlock':
        handleStepChange('verify')
        break
    }
  }

  // Cleanup when changing steps
  const handleStepChange = (newStep: SetupStep) => {
    setErrors([]) // Clear additional errors

    // Reset form errors based on step
    switch (newStep) {
      case 'setup':
        nodeSetupForm.clearErrors()
        break
      case 'password':
        passwordForm.clearErrors()
        break
      case 'mnemonic':
        // No form to clear for mnemonic display
        break
      case 'verify':
        mnemonicForm.clearErrors()
        break
      case 'unlock':
        // Handle unlock step cleanup
        break
    }

    setCurrentStep(newStep)
  }

  const handleNodeSetup: SubmitHandler<NodeSetupFields> = async (data) => {
    try {
      const formattedName = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric chars with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, '') // Remove leading/trailing hyphens

      const datapath = `kaleidoswap-${formattedName}`

      const accountExists = await invoke('check_account_exists', {
        name: data.name,
      })
      if (accountExists) {
        setErrors(['An account with this name already exists'])
        return
      }
      const defaultMakerUrl = NETWORK_DEFAULTS[data.network].default_maker_url
      await dispatch(
        setSettingsAsync({
          bearer_token: data.bearer_token,
          daemon_listening_port: data.daemon_listening_port,
          datapath: datapath,
          default_lsp_url: NETWORK_DEFAULTS[data.network].default_lsp_url,
          default_maker_url: defaultMakerUrl,
          indexer_url: data.indexer_url,
          ldk_peer_listening_port: data.ldk_peer_listening_port,
          maker_urls: [defaultMakerUrl],
          name: data.name,
          network: data.network,
          node_url: `http://localhost:${data.daemon_listening_port}`,
          proxy_endpoint: data.proxy_endpoint,
          rpc_connection_url: data.rpc_connection_url,
        })
      )

      handleStepChange('password')
    } catch (error) {
      toast.error('Failed to set up node. Please try again.')
    }
  }

  const formatAccountName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const getDatapath = (accountName: string): string => {
    return `kaleidoswap-${formatAccountName(accountName)}`
  }

  // Helper functions for node management
  const checkAndStopExistingNode = async (): Promise<void> => {
    const runningNodeAccount = await invoke<string | null>(
      'get_running_node_account'
    )
    const isNodeRunning = await invoke<boolean>('is_node_running')

    if (runningNodeAccount && isNodeRunning) {
      try {
        const nodeStoppedPromise = new Promise<void>((resolve, reject) => {
          let unlistenFn: (() => void) | null = null

          const timeoutId = setTimeout(() => {
            if (unlistenFn) unlistenFn()
            reject(new Error('Timeout waiting for node to stop'))
          }, 10000)

          listen('node-stopped', () => {
            if (unlistenFn) unlistenFn()
            clearTimeout(timeoutId)
            resolve()
          })
            .then((unlisten) => {
              unlistenFn = unlisten
            })
            .catch((error) => {
              clearTimeout(timeoutId)
              reject(new Error(`Failed to set up node stop listener: ${error}`))
            })
        })

        await invoke('stop_node')
        await nodeStoppedPromise
        // Additional delay to ensure resources are released
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } catch (error) {
        throw new Error(`Failed to stop existing node: ${error}`)
      }
    } else if (runningNodeAccount) {
      console.log(
        'Node account exists but node is not running:',
        runningNodeAccount
      )
    }
  }

  const startLocalNode = async (
    accountName: string,
    network: BitcoinNetwork,
    datapath: string
  ): Promise<void> => {
    const daemonPort = nodeSetupForm.getValues('daemon_listening_port')
    const ldkPort = nodeSetupForm.getValues('ldk_peer_listening_port')
    const ports = [daemonPort, ldkPort]

    try {
      // Check port availability
      const portCheck = await checkPortAvailability(ports)

      if (!portCheck.available) {
        // If ports are in use by our own nodes, try to stop them gracefully
        const runningNodePorts = await invoke<{ [port: string]: string }>(
          'get_running_node_ports'
        )
        const ourConflictingPorts = portCheck.conflictingPorts.filter(
          (port) => port in runningNodePorts
        )

        if (ourConflictingPorts.length > 0) {
          toast.info('Stopping existing nodes on conflicting ports...', {
            autoClose: false,
            toastId: 'stopping-nodes',
          })

          for (const port of ourConflictingPorts) {
            const nodeAccount = runningNodePorts[port]
            try {
              await invoke('stop_node_by_account', { accountName: nodeAccount })
              await new Promise((resolve) => setTimeout(resolve, 2000)) // Wait for cleanup
            } catch (error) {
              console.error(`Failed to stop node on port ${port}:`, error)
              throw new Error(`Failed to stop existing node on port ${port}`)
            }
          }

          toast.update('stopping-nodes', {
            autoClose: 2000,
            render: 'Existing nodes stopped successfully',
            type: 'success',
          })

          // Recheck port availability after stopping our nodes
          const recheckPorts = await checkPortAvailability(ports)
          if (!recheckPorts.available) {
            throw new Error(
              `Ports ${recheckPorts.conflictingPorts.join(', ')} are still in use by other processes. ` +
                'Please choose different ports or stop the conflicting processes.'
            )
          }
        } else {
          // Ports are in use by external processes
          throw new Error(
            `Ports ${portCheck.conflictingPorts.join(', ')} are in use by other applications. ` +
              'Please choose different ports or stop the conflicting applications.'
          )
        }
      }

      // Now proceed with starting the node
      const nodeStartedPromise = new Promise<void>((resolve, reject) => {
        let unlistenFn: (() => void) | null = null
        const startTimeout = 30000 // 30 seconds timeout

        const timeoutId = setTimeout(async () => {
          if (unlistenFn) unlistenFn()

          try {
            const isRunning = await invoke<boolean>('is_node_running')
            if (isRunning) {
              resolve()
              return
            }
          } catch (error) {
            console.error('Error checking node status:', error)
          }

          reject(new Error('Timeout waiting for node to start'))
        }, startTimeout)

        listen('node-log', (event: { payload: string }) => {
          if (event.payload.includes('Listening on')) {
            if (unlistenFn) unlistenFn()
            clearTimeout(timeoutId)
            resolve()
          }
        })
          .then((unlisten) => {
            unlistenFn = unlisten
          })
          .catch((error) => {
            clearTimeout(timeoutId)
            reject(new Error(`Failed to set up node event listener: ${error}`))
          })
      })

      // Start the node
      await invoke('start_node', {
        accountName,
        daemonListeningPort: daemonPort,
        datapath,
        ldkPeerListeningPort: ldkPort,
        network,
      })

      await nodeStartedPromise
    } catch (error) {
      // If we fail to start, try to find alternative ports
      const suggestedPorts = await invoke<{ daemon: string; ldk: string }>(
        'find_available_ports'
      )

      throw new Error(
        `Failed to start node: ${error}\n` +
          `Suggested alternative ports:\n` +
          `- Daemon port: ${suggestedPorts.daemon}\n` +
          `- LDK peer port: ${suggestedPorts.ldk}`
      )
    }
  }

  const initializeNode = async (password: string): Promise<string[]> => {
    const initResult = await init({ password })

    if (!initResult.isSuccess) {
      // Handle 403 status case
      if (
        initResult.error &&
        typeof initResult.error === 'object' &&
        'status' in initResult.error &&
        initResult.error.status === 403
      ) {
        throw new Error('NODE_ALREADY_INITIALIZED')
      }

      // Handle error with data property
      if (
        initResult.error &&
        typeof initResult.error === 'object' &&
        'data' in initResult.error &&
        initResult.error.data &&
        typeof initResult.error.data === 'object' &&
        'error' in initResult.error.data &&
        typeof initResult.error.data.error === 'string'
      ) {
        throw new Error(initResult.error.data.error)
      }

      // Default error case
      throw new Error('Node initialization failed')
    }

    if (!initResult.data || !initResult.data.mnemonic) {
      throw new Error('Invalid response: missing mnemonic')
    }

    return initResult.data.mnemonic.split(' ')
  }

  const unlockExistingNode = async (password: string): Promise<void> => {
    const rpcConfig = parseRpcUrl(nodeSetupForm.getValues('rpc_connection_url'))

    const unlockResult = await unlock({
      bitcoind_rpc_host: rpcConfig.host,
      bitcoind_rpc_password: rpcConfig.password,
      bitcoind_rpc_port: rpcConfig.port,
      bitcoind_rpc_username: rpcConfig.username,
      indexer_url: nodeSetupForm.getValues('indexer_url'),
      password,
      proxy_endpoint: nodeSetupForm.getValues('proxy_endpoint'),
    }).unwrap()

    if (unlockResult === undefined) {
      throw new Error('Failed to unlock the node')
    }

    const nodeInfoResult = await nodeInfo()
    if (!nodeInfoResult.isSuccess) {
      throw new Error('Failed to verify node status after unlock')
    }
  }

  const handlePasswordSetup: SubmitHandler<PasswordFields> = async (data) => {
    const accountName = nodeSetupForm.getValues('name')
    const network = nodeSetupForm.getValues('network')
    const datapath = getDatapath(accountName)

    setIsInitializing(true)

    try {
      // Check and stop any existing node
      await checkAndStopExistingNode()

      try {
        toast.info(`Starting RLN node...`, {
          autoClose: 2000,
          position: 'bottom-right',
        })

        await startLocalNode(accountName, network, datapath)
      } catch (error) {
        // Show a warning toast when ports are in use
        toast.warning(
          'Cannot start node: Some ports are already in use by other processes. Please stop any running nodes or choose different ports.',
          {
            autoClose: false,
            closeOnClick: true,
          }
        )
        setIsInitializing(false)
        return
      }

      // Rest of the initialization process
      try {
        const mnemonic = await initializeNode(data.password)
        setNodePassword(data.password)
        setMnemonic(mnemonic)
        await saveAccountSettings(accountName, network, datapath)
        handleStepChange('mnemonic')
        toast.success('Node initialized successfully!')
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === 'NODE_ALREADY_INITIALIZED'
        ) {
          toast.info('Node is already initialized, attempting to unlock...')
          setNodePassword(data.password)
          await unlockExistingNode(data.password)
          await saveAccountSettings(accountName, network, datapath)
          navigate(WALLET_DASHBOARD_PATH)
        } else {
          throw error
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to initialize node'
      toast.error(errorMessage, {
        autoClose: false,
      })

      // Try to clean up
      try {
        await invoke('stop_node')
      } catch (cleanupError) {
        console.error('Failed to clean up after error:', cleanupError)
      }
    } finally {
      setIsInitializing(false)
    }
  }

  const saveAccountSettings = async (
    accountName: string,
    network: BitcoinNetwork,
    datapath: string
  ) => {
    const defaultMakerUrl = NETWORK_DEFAULTS[network].default_maker_url

    await invoke('insert_account', {
      daemonListeningPort: nodeSetupForm.getValues('daemon_listening_port'),
      datapath,
      defaultLspUrl: NETWORK_DEFAULTS[network].default_lsp_url,
      defaultMakerUrl,
      indexerUrl: nodeSetupForm.getValues('indexer_url'),
      ldkPeerListeningPort: nodeSetupForm.getValues('ldk_peer_listening_port'),
      makerUrls: defaultMakerUrl,
      name: accountName,
      network,
      nodeUrl: `http://localhost:${nodeSetupForm.getValues('daemon_listening_port')}`,
      proxyEndpoint: nodeSetupForm.getValues('proxy_endpoint'),
      rpcConnectionUrl: nodeSetupForm.getValues('rpc_connection_url'),
    })

    await invoke('set_current_account', { accountName })

    await dispatch(
      setSettingsAsync({
        daemon_listening_port: nodeSetupForm.getValues('daemon_listening_port'),
        datapath,
        default_lsp_url: NETWORK_DEFAULTS[network].default_lsp_url,
        default_maker_url: defaultMakerUrl,
        indexer_url: nodeSetupForm.getValues('indexer_url'),
        ldk_peer_listening_port: nodeSetupForm.getValues(
          'ldk_peer_listening_port'
        ),
        maker_urls: [defaultMakerUrl],
        name: accountName,
        network,
        node_url: `http://localhost:${nodeSetupForm.getValues('daemon_listening_port')}`,
        proxy_endpoint: nodeSetupForm.getValues('proxy_endpoint'),
        rpc_connection_url: nodeSetupForm.getValues('rpc_connection_url'),
      })
    )
  }

  const handleMnemonicVerify: SubmitHandler<MnemonicVerifyFields> = async (
    data
  ) => {
    try {
      if (mnemonic.join(' ') !== data.mnemonic.trim()) {
        setErrors(['Mnemonic does not match'])
        return
      }

      // Clear any previous errors
      setErrors([])
      setIsNodeError(false)
      setNodeErrorMessage('')

      // Move to unlock step
      handleStepChange('unlock')

      // Start the unlock process
      setIsUnlocking(true)

      try {
        await handleUnlockComplete()
      } catch (error) {
        console.error('Unlock failed:', error)
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred'
      toast.error(errorMessage)
    }
  }

  const copyMnemonicToClipboard = () => {
    navigator.clipboard
      .writeText(mnemonic.join(' '))
      .then(() => toast.success('Mnemonic copied to clipboard'))
      .catch(() => toast.error('Failed to copy mnemonic'))
  }

  const handleUnlockComplete = async () => {
    try {
      setIsUnlocking(true)

      const rpcConfig = parseRpcUrl(
        nodeSetupForm.getValues('rpc_connection_url')
      )

      const unlockResult = await unlock({
        bitcoind_rpc_host: rpcConfig.host,
        bitcoind_rpc_password: rpcConfig.password,
        bitcoind_rpc_port: rpcConfig.port,
        bitcoind_rpc_username: rpcConfig.username,
        indexer_url: nodeSetupForm.getValues('indexer_url'),
        password: nodePassword,
        proxy_endpoint: nodeSetupForm.getValues('proxy_endpoint'),
      }).unwrap()

      if (unlockResult === undefined) {
        throw new Error('Failed to unlock the node')
      }

      // Verify node status after unlock
      const nodeInfoResult = await nodeInfo()
      if (!nodeInfoResult.isSuccess) {
        throw new Error('Failed to verify node status after unlock')
      }

      // Format settings before dispatching
      const network = nodeSetupForm.getValues('network')
      const defaultMakerUrl = NETWORK_DEFAULTS[network].default_maker_url
      await dispatch(
        setSettingsAsync({
          daemon_listening_port: nodeSetupForm.getValues(
            'daemon_listening_port'
          ),
          datapath: `kaleidoswap-${formatAccountName(nodeSetupForm.getValues('name'))}`,
          default_lsp_url: NETWORK_DEFAULTS[network].default_lsp_url,
          default_maker_url: defaultMakerUrl,
          indexer_url: nodeSetupForm.getValues('indexer_url'),
          ldk_peer_listening_port: nodeSetupForm.getValues(
            'ldk_peer_listening_port'
          ),
          maker_urls: [defaultMakerUrl],
          name: nodeSetupForm.getValues('name'),
          network: network,
          node_url: `http://localhost:${nodeSetupForm.getValues('daemon_listening_port')}`,
          proxy_endpoint: nodeSetupForm.getValues('proxy_endpoint'),
          rpc_connection_url: nodeSetupForm.getValues('rpc_connection_url'),
        })
      )

      // Show success message
      toast.success('Wallet unlocked successfully!')

      // Navigate to trade path
      navigate(WALLET_DASHBOARD_PATH)
    } catch (error) {
      setIsNodeError(true)
      setNodeErrorMessage(
        error instanceof Error ? error.message : 'Failed to unlock node'
      )
      throw error
    } finally {
      setIsUnlocking(false)
    }
  }

  const handleCancelUnlocking = async () => {
    setIsCancellingUnlock(true)
    try {
      // Stop the node
      await invoke('stop_node')
      toast.info('Node unlocking cancelled')
      handleStepChange('verify')
    } catch (error) {
      toast.error('Failed to cancel unlocking')
    } finally {
      setIsUnlocking(false)
      setIsCancellingUnlock(false)
    }
  }

  const handleTermsAccept = () => {
    setShowTermsModal(false)
    handleStepChange('setup')
  }

  const handleSkipMnemonicBackup = () => {
    setShowSkipMnemonicWarning(true)
  }

  const handleConfirmSkipMnemonic = async () => {
    setShowSkipMnemonicWarning(false)
    // Skip directly to unlock step
    handleStepChange('unlock')
    setIsUnlocking(true)
    try {
      await handleUnlockComplete()
    } catch (error) {
      console.error('Unlock failed:', error)
    }
  }

  const renderCurrentStep = () => {
    const renderStepLayout = (
      title: string,
      subtitle: string,
      icon: React.ReactNode,
      content: React.ReactNode,
      onBack?: () => void,
      maxWidth:
        | 'sm'
        | 'md'
        | 'lg'
        | 'xl'
        | '2xl'
        | '3xl'
        | '4xl'
        | '5xl'
        | '6xl' = '3xl',
      centered: boolean = false
    ) => (
      <SetupLayout
        centered={centered}
        icon={icon}
        maxWidth={maxWidth}
        onBack={onBack}
        subtitle={subtitle}
        title={title}
      >
        {content}
      </SetupLayout>
    )

    switch (currentStep) {
      case 'terms':
        return renderStepLayout(
          'Welcome to KaleidoSwap',
          'Please read and accept our terms and privacy policy to continue',
          <FileText className="w-8 h-8 text-blue-400" />,
          <div className="flex flex-col items-center justify-center space-y-6 p-8">
            <p className="text-gray-300 text-center max-w-lg">
              Before you begin using KaleidoSwap, please review and accept our
              Terms of Service and Privacy Policy.
            </p>
            <Button
              className="w-full max-w-sm"
              onClick={() => setShowTermsModal(true)}
            >
              Review Terms & Privacy Policy
            </Button>
          </div>,
          () => navigate(WALLET_SETUP_PATH),
          'xl',
          true
        )

      case 'setup':
        return renderStepLayout(
          'Create New Wallet',
          'Set up your local node to create a new RGB Lightning wallet',
          <Wallet />,
          <div className="w-full">
            <NodeSetupForm
              errors={errors}
              form={nodeSetupForm}
              onSubmit={handleNodeSetup}
            />
          </div>,
          () => navigate(WALLET_SETUP_PATH)
        )

      case 'password':
        return renderStepLayout(
          'Create Password',
          'Set a strong password to secure your node',
          <Lock />,
          <div className="w-full">
            {isInitializing && (
              <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <Alert
                  className="border-cyan/20 bg-cyan/5 backdrop-blur-sm"
                  icon={
                    <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                  }
                  title="Initializing Node"
                  variant="info"
                >
                  <div className="space-y-2">
                    <p className="text-sm text-slate-300">
                      Please wait while we initialize your node. This may take a
                      few moments...
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <div className="flex gap-1">
                        <div
                          className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"
                          style={{ animationDelay: '0ms' }}
                        ></div>
                        <div
                          className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"
                          style={{ animationDelay: '150ms' }}
                        ></div>
                        <div
                          className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"
                          style={{ animationDelay: '300ms' }}
                        ></div>
                      </div>
                      <span>Setting up your wallet...</span>
                    </div>
                  </div>
                </Alert>
              </div>
            )}
            <PasswordSetupForm
              disabled={isInitializing}
              errors={errors}
              form={passwordForm}
              isLoading={isInitializing}
              isPasswordVisible={isPasswordVisible}
              onSubmit={handlePasswordSetup}
              setIsPasswordVisible={setIsPasswordVisible}
            />
          </div>,
          isInitializing ? undefined : () => handleBackNavigation()
        )

      case 'mnemonic':
        return renderStepLayout(
          'Recovery Phrase',
          'Save your recovery phrase in a secure location',
          <FileText />,
          <div className="w-full">
            <MnemonicDisplay
              mnemonic={mnemonic}
              onCopy={copyMnemonicToClipboard}
              onNext={() => handleStepChange('verify')}
              onSkip={handleSkipMnemonicBackup}
            />
          </div>,
          () => handleBackNavigation()
        )

      case 'verify':
        return renderStepLayout(
          'Verify Recovery Phrase',
          "Confirm you've saved your recovery phrase correctly",
          <CheckCircle />,
          <div className="w-full">
            <MnemonicVerifyForm
              errors={errors}
              form={mnemonicForm}
              onSubmit={handleMnemonicVerify}
            />
          </div>,
          () => handleBackNavigation()
        )

      case 'unlock':
        return renderStepLayout(
          isNodeError ? 'Node Error' : 'Starting Node',
          isNodeError
            ? 'There was an error initializing your node'
            : 'Your node is being initialized',
          isNodeError ? <AlertTriangle /> : <Zap />,
          isNodeError ? (
            <Alert
              className="mb-4"
              icon={<AlertTriangle className="w-4 h-4" />}
              title="Node Error"
              variant="error"
            >
              <p className="text-sm">{nodeErrorMessage}</p>
              <div className="mt-4">
                <Button
                  onClick={() => handleStepChange('verify')}
                  size="sm"
                  variant="outline"
                >
                  Back to Verification
                </Button>
              </div>
            </Alert>
          ) : (
            <div className="w-full">
              <UnlockingProgress
                isUnlocking={isUnlocking}
                onBack={() => handleBackNavigation()}
                onCancel={
                  isUnlocking && !isCancellingUnlock
                    ? handleCancelUnlocking
                    : undefined
                }
              />
            </div>
          ),
          isNodeError ? () => handleStepChange('verify') : undefined,
          '3xl',
          false
        )

      default:
        return null
    }
  }

  return (
    <>
      <Layout>
        <div className="flex-1 flex flex-col">
          <div className="container mx-auto px-4 py-8">
            <StepIndicator
              currentStep={currentStep}
              steps={WALLET_INIT_STEPS}
            />
            {renderCurrentStep()}
          </div>
        </div>
      </Layout>
      <TermsWarningModal
        isOpen={showTermsModal}
        onAccept={handleTermsAccept}
        onClose={() => navigate(WALLET_SETUP_PATH)}
      />
      <SkipMnemonicWarningModal
        isOpen={showSkipMnemonicWarning}
        onCancel={() => setShowSkipMnemonicWarning(false)}
        onConfirm={handleConfirmSkipMnemonic}
      />
    </>
  )
}

interface NodeSetupFormProps {
  form: UseFormReturn<NodeSetupFields>
  onSubmit: SubmitHandler<NodeSetupFields>
  errors: string[]
}

const NodeSetupForm = ({ form, onSubmit, errors }: NodeSetupFormProps) => {
  const selectedNetwork = form.watch('network')

  // Update effect to use network defaults
  useEffect(() => {
    const defaults = NETWORK_DEFAULTS[selectedNetwork]
    form.setValue('daemon_listening_port', defaults.daemon_listening_port)
    form.setValue('ldk_peer_listening_port', defaults.ldk_peer_listening_port)
    form.setValue('rpc_connection_url', defaults.rpc_connection_url)
    form.setValue('indexer_url', defaults.indexer_url)
    form.setValue('proxy_endpoint', defaults.proxy_endpoint)
  }, [selectedNetwork, form])

  return (
    <div className="w-full">
      <p className="text-slate-400 mb-6 leading-relaxed">
        Configure your node settings to create a new RGB Lightning wallet.
        Choose a name and network for your wallet.
      </p>

      <Card className="p-6 bg-blue-dark/40 border border-white/5">
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          {errors.length > 0 && (
            <Alert
              icon={<AlertCircle className="w-4 h-4" />}
              title="Error"
              variant="error"
            >
              <ul className="text-xs space-y-1">
                {errors.map((error, index) => (
                  <li className="flex items-center gap-1.5" key={index}>
                    <span>•</span> {error}
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          <SetupSection>
            <FormField
              description="This name will be used to identify your wallet"
              error={form.formState.errors.name?.message}
              htmlFor="name"
              label="Account Name"
            >
              <Input
                id="name"
                placeholder="My Bitcoin Wallet"
                {...form.register('name', {
                  required: 'Account name is required',
                })}
                error={!!form.formState.errors.name}
              />
            </FormField>

            <NetworkSelector
              className="mb-2"
              onChange={(network) => form.setValue('network', network)}
              selectedNetwork={selectedNetwork}
            />
          </SetupSection>

          <AdvancedSettings>
            <NetworkSettings form={form} />

            <FormField
              description="Optional authentication token for remote node access"
              error={form.formState.errors.bearer_token?.message}
              htmlFor="bearer_token"
              label="Bearer Token"
            >
              <Input
                id="bearer_token"
                placeholder="Enter your bearer token"
                {...form.register('bearer_token')}
                error={!!form.formState.errors.bearer_token}
              />
            </FormField>
          </AdvancedSettings>

          <div className="pt-3">
            <Button
              className="w-full"
              icon={<ArrowRight className="w-4 h-4" />}
              iconPosition="right"
              size="lg"
              type="submit"
              variant="primary"
            >
              Continue
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
