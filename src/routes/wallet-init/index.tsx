import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Wallet,
  Lock,
  FileText,
  CheckCircle,
  AlertTriangle,
  Zap,
  Loader2,
  Terminal,
  Key,
  Shuffle,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { SubmitHandler, UseFormReturn, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'

import { ROOT_PATH, WALLET_SETUP_PATH } from '../../app/router/paths'
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
import { TermsWarningModal } from '../../components/TermsWarningModal'
import {
  Button,
  Card,
  Alert,
  SetupSection,
  FormField,
  Input,
  AdvancedSettings,
  NetworkSettings,
} from '../../components/ui'
import { UnlockingProgress } from '../../components/UnlockingProgress'
import kaleidoswapPictogram from '../../assets/logo.svg'
import { BitcoinNetwork } from '../../constants'
import { NETWORK_DEFAULTS } from '../../constants/networks'
import { buildLocalNodeUrl } from '../../api/client'
import { parseRpcUrl } from '../../helpers/utils'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { setSettingsAsync } from '../../slices/nodeSettings/nodeSettings.slice'
import { unlockNodeWithRetry, withTimeout } from '../../utils/nodeUnlock'
import { waitForNodeReady } from '../../utils/nodeState'

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
    throw new Error('Failed to check port availability', { cause: error })
  }
}

const NODE_UNLOCK_TIMEOUT_MS = 120000

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
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const isDockerMode = searchParams.get('mode') === 'docker'
  const [currentStep, setCurrentStep] = useState<SetupStep>('terms')
  const [redirectToRoot, setRedirectToRoot] = useState(false)
  const [mnemonic, setMnemonic] = useState<string[]>([])
  const [isNodeError, setIsNodeError] = useState(false)
  const [nodeErrorMessage, setNodeErrorMessage] = useState('')
  const [startupErrorMessage, setStartupErrorMessage] = useState('')
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [unlockStatusMessage, setUnlockStatusMessage] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [nodePassword, setNodePassword] = useState('')
  const isCancelledRef = useRef(false)
  const [isCancellingUnlock, setIsCancellingUnlock] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(true)
  const [isInitializing, setIsInitializing] = useState(false)
  const [initPhase, setInitPhase] = useState<
    | 'starting-node'
    | 'waiting-ready'
    | 'initializing-wallet'
    | 'unlocking-wallet'
    | 'idle'
  >('idle')
  const [nodeLogs, setNodeLogs] = useState<string[]>([])
  const logUnlistenRef = useRef<(() => void) | null>(null)
  const [showSkipMnemonicWarning, setShowSkipMnemonicWarning] = useState(false)

  const [init] = nodeApi.endpoints.init.useMutation()
  const [unlock] = nodeApi.endpoints.unlock.useMutation()
  const [nodeInfo] = nodeApi.endpoints.nodeInfo.useLazyQuery()

  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const WALLET_INIT_STEPS = [
    { id: 'terms', label: t('walletInit.steps.terms') },
    { id: 'setup', label: t('walletInit.steps.setup') },
    { id: 'password', label: t('walletInit.steps.password') },
    { id: 'mnemonic', label: t('walletInit.steps.mnemonic') },
    { id: 'verify', label: t('walletInit.steps.verify') },
    { id: 'unlock', label: t('walletInit.steps.unlock') },
  ]

  // Separate forms for each step
  const nodeSetupForm = useForm<NodeSetupFields>({
    defaultValues: {
      bearer_token: '',
      name: generateRandomName(),
      network: 'SignetCustom',
      ...NETWORK_DEFAULTS['SignetCustom'],
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
      if (logUnlistenRef.current) {
        logUnlistenRef.current()
        logUnlistenRef.current = null
      }
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
    setStartupErrorMessage('')
    setUnlockStatusMessage('')

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
        setErrors([t('walletInit.setupStep.accountExistsError')])
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
          node_url: buildLocalNodeUrl(data.daemon_listening_port),
          proxy_endpoint: data.proxy_endpoint,
          rpc_connection_url: data.rpc_connection_url,
        })
      )

      handleStepChange('password')
    } catch (error) {
      toast.error(t('walletInit.setupStep.failedToSetup'))
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
    // Docker mode doesn't need a local datapath — data lives in Docker volumes
    if (isDockerMode) return ''
    return `kaleidoswap-${formatAccountName(accountName)}`
  }

  const buildNodeSettings = (
    accountName: string,
    network: BitcoinNetwork,
    datapath: string
  ) => {
    const daemonPort = nodeSetupForm.getValues('daemon_listening_port')
    const defaultMakerUrl = NETWORK_DEFAULTS[network].default_maker_url

    return {
      daemon_listening_port: daemonPort,
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
      node_url: buildLocalNodeUrl(daemonPort),
      proxy_endpoint: nodeSetupForm.getValues('proxy_endpoint'),
      rpc_connection_url: nodeSetupForm.getValues('rpc_connection_url'),
    }
  }

  const allowLoadingStateToPaint = async (): Promise<void> => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  }

  const appendNodeOutput = (
    message: string,
    type: 'log' | 'error' | 'crash' = 'log'
  ) => {
    const line =
      type === 'log'
        ? message
        : `${type === 'crash' ? 'CRASH' : 'ERROR'}: ${message}`

    setNodeLogs((prev) => [...prev, line].slice(-200))
  }

  const cleanupStartupListeners = () => {
    if (logUnlistenRef.current) {
      logUnlistenRef.current()
      logUnlistenRef.current = null
    }
  }

  const registerStartupListeners = async () => {
    cleanupStartupListeners()

    const unlisteners = await Promise.all([
      listen<string>('node-log', (event) => {
        appendNodeOutput(event.payload)
      }),
      listen<string>('node-error', (event) => {
        appendNodeOutput(event.payload, 'error')
      }),
      listen<string>('node-crashed', (event) => {
        appendNodeOutput(event.payload, 'crash')
      }),
    ])

    logUnlistenRef.current = () => {
      unlisteners.forEach((unlisten) => unlisten())
    }
  }

  const handleCancelInitialization = async () => {
    isCancelledRef.current = true
    setIsInitializing(false)
    setInitPhase('idle')
    setStartupErrorMessage('')
    setNodeLogs([])
    cleanupStartupListeners()
    try {
      await invoke('stop_node')
    } catch (e) {
      console.error('Failed to stop node during cancellation:', e)
    }
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
        throw new Error(`Failed to stop existing node: ${error}`, {
          cause: error,
        })
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
    let daemonPort = nodeSetupForm.getValues('daemon_listening_port')
    let ldkPort = nodeSetupForm.getValues('ldk_peer_listening_port')
    const ports = [daemonPort, ldkPort]

    try {
      // Auto-resolve port conflicts by finding available ports
      const portCheck = isDockerMode
        ? { available: true, conflictingPorts: [] as string[] }
        : await checkPortAvailability(ports)

      if (!portCheck.available) {
        // Try to stop our own nodes first
        const runningNodePorts = await invoke<{ [port: string]: string }>(
          'get_running_node_ports'
        )
        const ourConflictingPorts = portCheck.conflictingPorts.filter(
          (port) => port in runningNodePorts
        )

        if (ourConflictingPorts.length > 0) {
          toast.info(t('walletInit.passwordStep.stoppingExistingNodes'), {
            autoClose: 2000,
          })
          for (const port of ourConflictingPorts) {
            const nodeAccount = runningNodePorts[port]
            try {
              await invoke('stop_node_by_account', { accountName: nodeAccount })
              await new Promise((resolve) => setTimeout(resolve, 2000))
            } catch (error) {
              console.warn(`Could not stop node on port ${port}:`, error)
            }
          }
        } else {
          // Try stopping any stale node
          try {
            await invoke('stop_node')
            await new Promise((resolve) => setTimeout(resolve, 2000))
          } catch {
            // Ignore — may not be running
          }
        }

        // After stopping, find available ports automatically
        const recheckPorts = await checkPortAvailability(ports)
        if (!recheckPorts.available) {
          const availablePorts = await invoke<{ daemon: number; ldk: number }>(
            'find_available_ports',
            {
              baseDaemonPort: parseInt(daemonPort) || 3001,
              baseLdkPort: parseInt(ldkPort) || 9735,
            }
          )
          daemonPort = String(availablePorts.daemon)
          ldkPort = String(availablePorts.ldk)
          nodeSetupForm.setValue('daemon_listening_port', daemonPort)
          nodeSetupForm.setValue('ldk_peer_listening_port', ldkPort)
          toast.info(
            `Ports auto-updated: daemon ${availablePorts.daemon}, peer ${availablePorts.ldk}`,
            { autoClose: 3000 }
          )
        }
      }

      // Start the node
      if (isDockerMode) {
        // Docker mode: auto-create environment from account name + form params
        const envName = `kaleidoswap-${accountName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')}`
        const network = nodeSetupForm.getValues('network')

        // Find available ports — auto-resolve conflicts instead of erroring
        let finalDaemonPort = parseInt(daemonPort) || 3001
        let finalPeerPort = parseInt(ldkPort) || 9735
        const availablePorts = await invoke<{ daemon: number; ldk: number }>(
          'find_available_ports',
          {
            baseDaemonPort: finalDaemonPort,
            baseLdkPort: finalPeerPort,
          }
        )
        finalDaemonPort = availablePorts.daemon
        finalPeerPort = availablePorts.ldk

        // Update form with the actual ports being used
        nodeSetupForm.setValue('daemon_listening_port', String(finalDaemonPort))
        nodeSetupForm.setValue('ldk_peer_listening_port', String(finalPeerPort))

        // Create Docker environment with available ports and network
        await invoke('create_docker_environment', {
          config: {
            base_daemon_port: finalDaemonPort,
            base_peer_port: finalPeerPort,
            count: 1,
            disable_authentication: true,
            name: envName,
            network: network.toLowerCase(),
          },
        })

        // Start the Docker container
        const dockerPort = await invoke<number>('start_docker_node', {
          envName,
        })
        const dockerDaemonPort = String(dockerPort)
        // Update form with the actual Docker port
        nodeSetupForm.setValue('daemon_listening_port', dockerDaemonPort)

        setInitPhase('waiting-ready')
        // Docker readiness: poll HTTP directly (don't use waitForNodeReady which
        // checks native NodeProcess state and would see "Stopped")
        const maxWait = 90000
        const pollInterval = 2000
        const startTime = Date.now()
        let dockerReady = false
        while (Date.now() - startTime < maxWait) {
          if (isCancelledRef.current) throw new Error('CANCELLED')
          try {
            const status = await invoke<number>('probe_node_http', {
              daemonPort: dockerPort,
            })
            // 200 = unlocked, 403 = locked but running — both mean node is ready
            if (status === 200 || status === 403) {
              dockerReady = true
              break
            }
          } catch {
            // Not ready yet
          }
          await new Promise((r) => setTimeout(r, pollInterval))
        }
        if (!dockerReady) {
          throw new Error('Docker node did not become ready within 90 seconds')
        }
      } else {
        // Native binary mode
        await invoke('start_node', {
          accountName,
          daemonListeningPort: daemonPort,
          datapath,
          ldkPeerListeningPort: ldkPort,
          network,
        })

        setInitPhase('waiting-ready')
        await waitForNodeReady({ daemonPort })
      }

      if (isCancelledRef.current) throw new Error('CANCELLED')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      // If the error is about ports in use, suggest alternative ports
      if (
        errorMessage.includes('Ports') ||
        errorMessage.includes('in use') ||
        errorMessage.includes('port')
      ) {
        try {
          const suggestedPorts = await invoke<{ daemon: string; ldk: string }>(
            'find_available_ports'
          )

          throw new Error(
            `${errorMessage}\n` +
              `Suggested alternative ports:\n` +
              `- Daemon port: ${suggestedPorts.daemon}\n` +
              `- LDK peer port: ${suggestedPorts.ldk}`,
            { cause: error }
          )
        } catch (e) {
          throw new Error(errorMessage, { cause: e })
        }
      }

      throw new Error(`Failed to start node: ${errorMessage}`, {
        cause: error,
      })
    }
  }

  const initializeNode = async (password: string): Promise<string[]> => {
    const initResult = await withTimeout(
      init({ password }) as unknown as Promise<
        Awaited<ReturnType<typeof init>>
      >,
      20000,
      'Node init'
    )

    if ('error' in initResult) {
      const error = initResult.error
      // Handle 403 status case
      if (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        error.status === 403
      ) {
        throw new Error('NODE_ALREADY_INITIALIZED')
      }
      // Extract message from error data if available
      if (
        typeof error === 'object' &&
        error !== null &&
        'data' in error &&
        error.data &&
        typeof error.data === 'object' &&
        'error' in error.data &&
        typeof (error.data as Record<string, unknown>).error === 'string'
      ) {
        throw new Error((error.data as Record<string, string>).error)
      }
      throw new Error('Node initialization failed')
    }

    const { mnemonic } = initResult.data
    if (!mnemonic) {
      throw new Error('Invalid response: missing mnemonic')
    }

    return mnemonic.split(' ')
  }

  const buildUnlockRequest = (password: string) => {
    const rpcConfig = parseRpcUrl(nodeSetupForm.getValues('rpc_connection_url'))

    return {
      announce_addresses: [],
      bitcoind_rpc_host: rpcConfig.host,
      bitcoind_rpc_password: rpcConfig.password,
      bitcoind_rpc_port: rpcConfig.port,
      bitcoind_rpc_username: rpcConfig.username,
      indexer_url: nodeSetupForm.getValues('indexer_url'),
      password,
      proxy_endpoint: nodeSetupForm.getValues('proxy_endpoint'),
    }
  }

  const unlockNodeUntilReady = async (password: string): Promise<void> => {
    const outcome = await unlockNodeWithRetry({
      getNodeInfo: () => nodeInfo(),
      invalidPasswordMessage: t('walletUnlock.invalidPassword'),
      isCancelled: () => isCancelledRef.current,
      maxRetriesMessage: t('walletUnlock.maxRetriesReached', {
        defaultValue:
          'Maximum unlock attempts reached. The node may still be syncing — please try again shortly.',
      }),
      onLongUnlock: setUnlockStatusMessage,
      unlock: () =>
        unlock(buildUnlockRequest(password))
          .unwrap()
          .then(() => undefined),
      unlockLabel: 'Node unlock',
      unlockTimeoutMessage: t('walletUnlock.unlockTimeoutMessage', {
        defaultValue:
          'Unlocking is taking longer than usual. If the node was offline for a while, it may still be syncing the blockchain in the background. Please keep the app open while unlock continues.',
      }),
      unlockTimeoutMs: NODE_UNLOCK_TIMEOUT_MS,
      verifyFailureMessage: t('walletInit.unlockStep.failedToVerify'),
    })

    if (outcome === 'cancelled') {
      throw new Error('CANCELLED')
    }

    if (outcome === 'needs-init') {
      throw new Error('Wallet has not been initialized (hint: call init)')
    }
  }

  const handlePasswordSetup: SubmitHandler<PasswordFields> = async (data) => {
    console.log('[init] handlePasswordSetup called')
    const accountName = nodeSetupForm.getValues('name')
    const network = nodeSetupForm.getValues('network')
    const datapath = getDatapath(accountName)
    const pendingNodeSettings = buildNodeSettings(
      accountName,
      network,
      datapath
    )

    isCancelledRef.current = false
    setIsInitializing(true)
    setInitPhase('starting-node')
    setStartupErrorMessage('')
    setNodeLogs([])
    setIsNodeError(false)
    setNodeErrorMessage('')
    await allowLoadingStateToPaint()

    try {
      await dispatch(setSettingsAsync(pendingNodeSettings))

      console.log('[init] registering startup listeners')
      await registerStartupListeners()
      console.log('[init] startup listeners registered')

      // Check and stop any existing node
      console.log('[init] step 1: checkAndStopExistingNode')
      await checkAndStopExistingNode()
      console.log('[init] step 1 done')
      if (isCancelledRef.current) return

      try {
        console.log('[init] step 2: startLocalNode (spawn + backend readiness)')
        await startLocalNode(accountName, network, datapath)
        console.log('[init] step 2 done — node HTTP server is responding')
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)

        if (errorMessage === 'CANCELLED' || isCancelledRef.current) {
          setIsInitializing(false)
          setInitPhase('idle')
          return
        }

        setStartupErrorMessage(errorMessage)
        setNodeLogs((prev) =>
          prev.length > 0 ? prev : [`ERROR: ${errorMessage}`]
        )
        if (
          errorMessage.includes('Ports') ||
          errorMessage.includes('in use') ||
          errorMessage.includes('Suggested alternative ports')
        ) {
          toast.warning(t('walletInit.passwordStep.portsInUse'), {
            autoClose: false,
            closeOnClick: true,
          })
        } else {
          toast.error(errorMessage, {
            autoClose: false,
            closeOnClick: true,
          })
        }
        setIsInitializing(false)
        setInitPhase('idle')
        return
      }

      // Node is started — now initializing wallet (generating mnemonic)
      cleanupStartupListeners()
      setInitPhase('initializing-wallet')

      // Rebuild settings to pick up actual port (Docker may have changed it)
      const finalNodeSettings = buildNodeSettings(
        accountName,
        network,
        datapath
      )
      await dispatch(setSettingsAsync(finalNodeSettings))

      // Rest of the initialization process
      try {
        console.log(
          `[init] step 3 target node URL: ${finalNodeSettings.node_url}`
        )
        console.log('[init] step 3: POST /init')
        const mnemonic = await initializeNode(data.password)
        console.log('[init] step 3 done — mnemonic received')
        if (isCancelledRef.current) return

        setNodePassword(data.password)
        setMnemonic(mnemonic)
        await saveAccountSettings(accountName, network, datapath)
        if (isCancelledRef.current) return

        handleStepChange('mnemonic')
        toast.success(t('walletInit.passwordStep.nodeInitializedSuccess'))
      } catch (error) {
        console.log(
          '[init] step 3 error:',
          error instanceof Error ? error.message : error
        )
        if (
          error instanceof Error &&
          error.message === 'NODE_ALREADY_INITIALIZED'
        ) {
          toast.info(t('walletInit.passwordStep.nodeAlreadyInitialized'))
          setNodePassword(data.password)
          setInitPhase('unlocking-wallet')
          console.log('[init] step 4: POST /unlock')
          await unlockNodeUntilReady(data.password)
          console.log('[init] step 4 done — unlock succeeded')
          if (isCancelledRef.current) return
          await saveAccountSettings(accountName, network, datapath)
          setRedirectToRoot(true)
        } else {
          throw error
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('walletInit.passwordStep.failedToInitialize')
      setStartupErrorMessage(errorMessage)
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
      setInitPhase('idle')
      cleanupStartupListeners()
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
      language: 'en',
      ldkPeerListeningPort: nodeSetupForm.getValues('ldk_peer_listening_port'),
      makerUrls: defaultMakerUrl,
      name: accountName,
      network,
      nodeUrl: buildLocalNodeUrl(
        nodeSetupForm.getValues('daemon_listening_port')
      ),
      proxyEndpoint: nodeSetupForm.getValues('proxy_endpoint'),
      rpcConnectionUrl: nodeSetupForm.getValues('rpc_connection_url'),
    })

    await invoke('set_current_account', { accountName })

    await dispatch(
      setSettingsAsync(buildNodeSettings(accountName, network, datapath))
    )
  }

  const handleMnemonicVerify: SubmitHandler<MnemonicVerifyFields> = async (
    data
  ) => {
    try {
      if (mnemonic.join(' ') !== data.mnemonic.trim()) {
        setErrors([t('walletInit.verifyStep.mnemonicMismatch')])
        return
      }

      // Clear any previous errors
      setErrors([])
      setIsNodeError(false)
      setNodeErrorMessage('')

      // Store encrypted mnemonic before proceeding
      try {
        const accountName = nodeSetupForm.getValues('name')
        await invoke('store_encrypted_mnemonic', {
          accountName,
          mnemonic: mnemonic.join(' '),
          password: nodePassword,
        })
        console.log('Mnemonic encrypted and stored successfully')
      } catch (error) {
        console.error('Failed to store encrypted mnemonic:', error)
        toast.error(t('walletInit.passwordStep.failedToStoreRecovery'))
        return
      }

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
        error instanceof Error
          ? error.message
          : t('walletInit.verifyStep.unexpectedError')
      toast.error(errorMessage)
    }
  }

  const copyMnemonicToClipboard = () => {
    navigator.clipboard
      .writeText(mnemonic.join(' '))
      .then(() => toast.success(t('walletInit.mnemonicStep.mnemonicCopied')))
      .catch(() => toast.error(t('walletInit.mnemonicStep.failedToCopy')))
  }

  const handleUnlockComplete = async () => {
    try {
      setIsUnlocking(true)
      await unlockNodeUntilReady(nodePassword)
      if (isCancelledRef.current) return

      const network = nodeSetupForm.getValues('network')
      const accountName = nodeSetupForm.getValues('name')
      const datapath = getDatapath(accountName)

      await dispatch(
        setSettingsAsync(buildNodeSettings(accountName, network, datapath))
      )

      // Show success message
      toast.success(t('walletInit.unlockStep.walletUnlockedSuccess'))

      // Navigate to trade path
      setRedirectToRoot(true)
    } catch (error) {
      setIsNodeError(true)
      setUnlockStatusMessage('')
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
      toast.info(t('walletInit.unlockStep.unlockingCancelled'))
      handleStepChange('verify')
    } catch (error) {
      toast.error(t('walletInit.unlockStep.failedToCancel'))
    } finally {
      setIsUnlocking(false)
      setUnlockStatusMessage('')
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
      onBack?: () => void
    ) => (
      <div className="flex flex-1 overflow-hidden">
        {/* Left decorative panel */}
        <div className="hidden md:flex flex-col w-64 xl:w-72 shrink-0 bg-surface-base border-r border-border-subtle relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full bg-primary/6 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-secondary/4 blur-2xl" />
          </div>
          <div className="relative flex-1 flex flex-col items-center justify-center p-8 gap-6">
            {/* Pictogram */}
            <img
              alt="KaleidoSwap"
              className="w-16 h-16"
              src={kaleidoswapPictogram}
            />
            {/* Step progress */}
            <div className="w-full space-y-1.5">
              {WALLET_INIT_STEPS.map((step, idx) => {
                const currentIdx = WALLET_INIT_STEPS.findIndex(
                  (s) => s.id === currentStep
                )
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
          {onBack && (
            <div className="flex items-center px-6 py-4 border-b border-border-subtle shrink-0">
              <button
                className="flex items-center gap-2 text-sm text-content-secondary hover:text-content-primary transition-colors"
                onClick={onBack}
                type="button"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-2xl mx-auto px-6 py-8">
              {/* Mobile header */}
              <div className="md:hidden mb-6">
                <h1 className="text-2xl font-bold text-content-primary mb-1">
                  {title}
                </h1>
                <p className="text-sm text-content-secondary">{subtitle}</p>
              </div>
              {content}
            </div>
          </div>
        </div>
      </div>
    )

    switch (currentStep) {
      case 'terms':
        return renderStepLayout(
          'Welcome to KaleidoSwap',
          'Please read and accept our terms and privacy policy to continue',
          <FileText className="w-8 h-8 text-blue-400" />,
          <div className="flex flex-col items-center justify-center space-y-6 p-8">
            <p className="text-content-secondary text-center max-w-lg">
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
          () => navigate(WALLET_SETUP_PATH)
        )

      case 'setup':
        return renderStepLayout(
          t('walletInit.setupStep.title'),
          t('walletInit.setupStep.subtitle'),
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
        if (isInitializing) {
          const phaseTitle: Record<typeof initPhase, string> = {
            idle: 'Starting Local Node',
            'initializing-wallet': 'Initializing Wallet',
            'starting-node': 'Starting Node Process',
            'unlocking-wallet': 'Unlocking Wallet',
            'waiting-ready': 'Waiting for Node',
          }
          const phaseSubtitle: Record<typeof initPhase, string> = {
            idle: '',
            'initializing-wallet':
              'Generating your 24-word mnemonic seed phrase',
            'starting-node': 'Spawning the node process and binding to ports',
            'unlocking-wallet': 'Sending unlock request to the node',
            'waiting-ready':
              'Node process started — waiting for HTTP server to respond',
          }
          const PulsingIcon = ({ icon: Icon }: { icon: React.ElementType }) => (
            <div className="relative flex items-center justify-center">
              <span className="absolute inline-flex w-full h-full rounded-full bg-primary/40 animate-ping" />
              <Icon className="w-10 h-10 text-primary relative z-10" />
            </div>
          )
          const phaseIcon: Record<typeof initPhase, JSX.Element> = {
            idle: <PulsingIcon icon={Zap} />,
            'initializing-wallet': <PulsingIcon icon={Key} />,
            'starting-node': <PulsingIcon icon={Zap} />,
            'unlocking-wallet': <PulsingIcon icon={Key} />,
            'waiting-ready': <PulsingIcon icon={Zap} />,
          }
          return renderStepLayout(
            phaseTitle[initPhase],
            phaseSubtitle[initPhase],
            phaseIcon[initPhase],
            <NodeStartupProgress
              logs={nodeLogs}
              onCancel={handleCancelInitialization}
              phase={initPhase}
            />,
            undefined
          )
        }
        return renderStepLayout(
          t('walletInit.passwordStep.title'),
          t('walletInit.passwordStep.subtitle'),
          <Lock />,
          <div className="w-full space-y-4">
            {startupErrorMessage && (
              <StartupFailureDetails
                errorMessage={startupErrorMessage}
                logs={nodeLogs}
              />
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
          () => handleBackNavigation()
        )

      case 'mnemonic':
        return renderStepLayout(
          t('walletInit.mnemonicStep.title'),
          t('walletInit.mnemonicStep.subtitle'),
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
          t('walletInit.verifyStep.title'),
          t('walletInit.verifyStep.subtitle'),
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
          isNodeError
            ? t('walletInit.unlockStep.errorTitle')
            : t('walletInit.unlockStep.title'),
          isNodeError
            ? t('walletInit.unlockStep.errorSubtitle')
            : t('walletInit.unlockStep.subtitle'),
          isNodeError ? <AlertTriangle /> : <Zap />,
          isNodeError ? (
            <Alert
              className="mb-4"
              icon={<AlertTriangle className="w-4 h-4" />}
              title={t('walletInit.unlockStep.errorTitle')}
              variant="error"
            >
              <p className="text-sm">{nodeErrorMessage}</p>
              <div className="mt-4">
                <Button
                  onClick={() => handleStepChange('verify')}
                  size="sm"
                  variant="outline"
                >
                  {t('walletInit.unlockStep.backToVerification')}
                </Button>
              </div>
            </Alert>
          ) : (
            <div className="w-full">
              <UnlockingProgress
                infoMessage={unlockStatusMessage || undefined}
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
          isNodeError ? () => handleStepChange('verify') : undefined
        )

      default:
        return null
    }
  }

  if (redirectToRoot) {
    return <Navigate replace to={ROOT_PATH} />
  }

  return (
    <>
      <Layout>{renderCurrentStep()}</Layout>
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

interface NodeStartupProgressProps {
  phase:
    | 'starting-node'
    | 'waiting-ready'
    | 'initializing-wallet'
    | 'unlocking-wallet'
    | 'idle'
  logs: string[]
  onCancel: () => void
}

const NodeStartupProgress = ({
  phase,
  logs,
  onCancel,
}: NodeStartupProgressProps) => {
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const phases = [
    {
      description:
        'Spawning the RGB Lightning node process and binding to daemon and LDK ports.',
      id: 'starting-node',
      label: 'Start Process',
    },
    {
      description:
        'Process is running — polling the HTTP server until it starts accepting requests.',
      id: 'waiting-ready',
      label: 'Wait Ready',
    },
    {
      description:
        'Generating a unique 24-word mnemonic seed phrase and encrypting your wallet with your password.',
      id: 'initializing-wallet',
      label: 'Init Wallet',
    },
    {
      description:
        'Wallet already exists — sending the unlock request so the node can resume operations.',
      id: 'unlocking-wallet',
      label: 'Unlock',
    },
  ]

  const currentPhaseIndex = phases.findIndex((p) => p.id === phase)
  const currentPhaseData = phases[currentPhaseIndex]

  return (
    <div className="w-full space-y-6">
      {/* Phase stepper */}
      <div className="flex items-center justify-center gap-2">
        {phases.map((p, i) => {
          const isCompleted = i < currentPhaseIndex
          const isCurrent = i === currentPhaseIndex
          return (
            <div className="flex items-center gap-2" key={p.id}>
              {i > 0 && (
                <div
                  className={`h-px w-10 transition-colors ${
                    isCompleted ? 'bg-status-success' : 'bg-border-subtle'
                  }`}
                />
              )}
              <div
                className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                  isCurrent
                    ? 'text-primary'
                    : isCompleted
                      ? 'text-status-success'
                      : 'text-content-tertiary'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle className="w-4 h-4" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-border-subtle" />
                )}
                <span>{p.label}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Description */}
      {currentPhaseData && (
        <Card className="p-4 bg-surface-elevated/40 border border-border-subtle/20">
          <p className="text-sm text-content-secondary leading-relaxed">
            {currentPhaseData.description}
          </p>
          {phase === 'initializing-wallet' && (
            <div className="mt-3 flex items-start gap-2 rounded-md bg-primary/10 border border-primary/20 px-3 py-2">
              <Key className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-content-primary">
                A 24-word mnemonic is being generated. You will need to save it
                on the next screen — it is the only way to recover your wallet.
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Live log viewer — only during node startup */}
      {(phase === 'starting-node' || phase === 'waiting-ready') && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
            <Terminal className="w-3.5 h-3.5" />
            <span>Node output</span>
            {logs.length === 0 && (
              <span className="text-content-tertiary/60">— waiting...</span>
            )}
          </div>
          <div className="bg-surface-base border border-border-subtle rounded-lg p-3 h-40 overflow-y-auto font-mono text-xs text-content-secondary">
            {logs.length === 0 ? (
              <div className="flex items-center gap-2 text-content-tertiary/60">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Waiting for node output...</span>
              </div>
            ) : (
              logs.map((line, i) => (
                <div
                  className="leading-5 whitespace-pre-wrap break-all"
                  key={i}
                >
                  {line}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      <Button className="w-full" onClick={onCancel} size="sm" variant="outline">
        Cancel
      </Button>
    </div>
  )
}

interface StartupFailureDetailsProps {
  errorMessage: string
  logs: string[]
}

const StartupFailureDetails = ({
  errorMessage,
  logs,
}: StartupFailureDetailsProps) => {
  const recentLogs = logs.slice(-20)

  return (
    <div className="space-y-3">
      <Alert
        icon={<AlertTriangle className="w-4 h-4" />}
        title="Node startup failed"
        variant="error"
      >
        <p className="text-sm whitespace-pre-wrap break-words">
          {errorMessage}
        </p>
      </Alert>

      {recentLogs.length > 0 && (
        <Card className="p-4 bg-surface-elevated/40 border border-border-subtle/20">
          <div className="flex items-center gap-1.5 text-xs text-content-tertiary mb-2">
            <Terminal className="w-3.5 h-3.5" />
            <span>Recent node output</span>
          </div>
          <div className="bg-surface-base border border-border-subtle rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs text-content-secondary">
            {recentLogs.map((line, index) => (
              <div
                className={`leading-5 whitespace-pre-wrap break-all ${
                  line.startsWith('ERROR:') || line.startsWith('CRASH:')
                    ? 'text-status-error'
                    : ''
                }`}
                key={`${line}-${index}`}
              >
                {line}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

const ADJECTIVES = [
  'Arctic',
  'Atomic',
  'Bold',
  'Bright',
  'Calm',
  'Cedar',
  'Clear',
  'Cloud',
  'Cold',
  'Coral',
  'Cyan',
  'Dark',
  'Deep',
  'Ember',
  'Epic',
  'Fast',
  'Firm',
  'Free',
  'Fresh',
  'Frost',
  'Gold',
  'Grand',
  'Grey',
  'Hard',
  'High',
  'Ice',
  'Iron',
  'Jade',
  'Keen',
  'Lean',
  'Lost',
  'Lunar',
  'Matte',
  'Meta',
  'Mint',
  'Mist',
  'Neon',
  'Onyx',
  'Open',
  'Peak',
  'Pine',
  'Pure',
  'Raw',
  'Real',
  'Red',
  'Root',
  'Royal',
  'Rust',
  'Safe',
  'Salt',
  'Sharp',
  'Silk',
  'Slim',
  'Solar',
  'Steel',
  'Still',
  'Storm',
  'Swift',
  'True',
  'Ultra',
  'Vast',
  'Void',
  'Warm',
  'Wave',
  'Wild',
  'Zero',
]

const NOUNS = [
  'Arc',
  'Ark',
  'Atom',
  'Bay',
  'Beam',
  'Block',
  'Bolt',
  'Bridge',
  'Byte',
  'Chain',
  'Code',
  'Core',
  'Crypt',
  'Dash',
  'Data',
  'Dawn',
  'Deck',
  'Dex',
  'Digit',
  'Dock',
  'Drop',
  'Echo',
  'Edge',
  'Field',
  'Flow',
  'Flux',
  'Fog',
  'Forge',
  'Fork',
  'Gate',
  'Grid',
  'Hash',
  'Hub',
  'Key',
  'Knot',
  'Layer',
  'Link',
  'Loop',
  'Mesh',
  'Mine',
  'Mint',
  'Mode',
  'Node',
  'Orb',
  'Path',
  'Peer',
  'Pipe',
  'Pool',
  'Port',
  'Proof',
  'Pulse',
  'Reef',
  'Relay',
  'Ring',
  'Root',
  'Route',
  'Seed',
  'Shard',
  'Shift',
  'Spark',
  'Stack',
  'State',
  'Sync',
  'Tide',
  'Token',
  'Tower',
  'Trace',
  'Vault',
  'Wave',
  'Wire',
  'Wing',
  'Zone',
]

const generateRandomName = () => {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  return `${adj} ${noun}`
}

interface NodeSetupFormProps {
  form: UseFormReturn<NodeSetupFields>
  onSubmit: SubmitHandler<NodeSetupFields>
  errors: string[]
}

const NodeSetupForm = ({ form, onSubmit, errors }: NodeSetupFormProps) => {
  const { t } = useTranslation()
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
      <p className="text-content-secondary mb-6 leading-relaxed">
        {t('walletInit.setupStep.description')}
      </p>

      <Card className="p-6 bg-surface-elevated/40 border border-border-subtle/20">
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          {errors.length > 0 && (
            <Alert
              icon={<AlertCircle className="w-4 h-4" />}
              title={t('common.error')}
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

          <div className="space-y-4">
            <FormField
              description={t('walletInit.setupStep.accountNameDescription')}
              error={form.formState.errors.name?.message}
              htmlFor="name"
              label={t('walletInit.setupStep.accountNameLabel')}
            >
              <Input
                id="name"
                placeholder={t('walletInit.setupStep.accountNamePlaceholder')}
                {...form.register('name', {
                  required: t('walletInit.setupStep.accountNameRequired'),
                })}
                error={!!form.formState.errors.name}
                suffixNode={
                  <button
                    className="text-content-tertiary hover:text-primary transition-colors"
                    onClick={() =>
                      form.setValue('name', generateRandomName(), {
                        shouldValidate: true,
                      })
                    }
                    title="Generate random name"
                    type="button"
                  >
                    <Shuffle className="w-4 h-4" />
                  </button>
                }
              />
            </FormField>

            <NetworkSelector
              className="mb-2"
              onChange={(network) => form.setValue('network', network)}
              selectedNetwork={selectedNetwork}
            />
          </div>

          <AdvancedSettings>
            <NetworkSettings form={form} />

            <FormField
              description={t('walletInit.setupStep.bearerTokenDescription')}
              error={form.formState.errors.bearer_token?.message}
              htmlFor="bearer_token"
              label={t('walletInit.setupStep.bearerTokenLabel')}
            >
              <Input
                id="bearer_token"
                placeholder={t('walletInit.setupStep.bearerTokenPlaceholder')}
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
              {t('walletInit.setupStep.continueButton')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
