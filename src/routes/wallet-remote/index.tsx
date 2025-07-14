import { invoke } from '@tauri-apps/api/core'
import { Cloud, ArrowRight, AlertTriangle, Check } from 'lucide-react'
import { useState, useEffect } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import {
  WALLET_DASHBOARD_PATH,
  WALLET_SETUP_PATH,
} from '../../app/router/paths'
import { useAppDispatch } from '../../app/store/hooks'
import { Layout } from '../../components/Layout'
import { NetworkSelector } from '../../components/NetworkSelector'
import { RegtestConnectionSelector } from '../../components/RegtestConnectionSelector'
import {
  Button,
  Card,
  Alert,
  SetupLayout,
  SetupSection,
  FormField,
  Input,
  PasswordInput,
  Spinner,
  AdvancedSettings,
  NetworkSettings,
} from '../../components/ui'
import { BitcoinNetwork, RegtestConnectionType } from '../../constants'
import { NETWORK_DEFAULTS } from '../../constants/networks'
import { setSettingsAsync } from '../../slices/nodeSettings/nodeSettings.slice'

interface Fields {
  name: string
  network: BitcoinNetwork
  regtestConnectionType: RegtestConnectionType
  node_url: string
  rpc_connection_url: string
  indexer_url: string
  proxy_endpoint: string
  password: string
  useAuth: boolean
  authToken: string
  daemon_listening_port: string
  ldk_peer_listening_port: string
}

// Helper function to properly construct API URLs
const constructApiUrl = (baseUrl: string, endpoint: string): string => {
  if (!baseUrl || !endpoint) {
    throw new Error('Both baseUrl and endpoint are required')
  }

  // Remove trailing slashes from base URL
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '')
  // Ensure endpoint starts with a slash but doesn't have multiple slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`

  return `${cleanBaseUrl}${cleanEndpoint}`
}

export const Component = () => {
  const [isConnecting, setIsConnecting] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionStep, setConnectionStep] = useState<
    'idle' | 'testing' | 'creating' | 'finalizing'
  >('idle')
  const [connectionError, setConnectionError] = useState<{
    type: 'connection' | 'auth' | 'account' | 'network'
    message: string
    details?: string
  } | null>(null)
  const [connectionSuccess, setConnectionSuccess] = useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  const dispatch = useAppDispatch()

  const navigate = useNavigate()

  const form = useForm<Fields>({
    defaultValues: {
      authToken: '',
      daemon_listening_port:
        NETWORK_DEFAULTS.BitfinexRegtest.daemon_listening_port,
      indexer_url: NETWORK_DEFAULTS.BitfinexRegtest.indexer_url,
      ldk_peer_listening_port:
        NETWORK_DEFAULTS.BitfinexRegtest.ldk_peer_listening_port,
      name: 'Test Account',
      network: 'Regtest',
      node_url: `http://localhost:${NETWORK_DEFAULTS.BitfinexRegtest.daemon_listening_port}`,
      password: 'password',
      proxy_endpoint: NETWORK_DEFAULTS.BitfinexRegtest.proxy_endpoint,
      regtestConnectionType: 'bitfinex',
      rpc_connection_url: NETWORK_DEFAULTS.BitfinexRegtest.rpc_connection_url,
      useAuth: false,
    },
  })

  // Update effect to use network defaults
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (
        (name === 'network' || name === 'regtestConnectionType') &&
        value.network
      ) {
        let networkKey: string = value.network

        // Handle regtest connection type selection
        if (value.network === 'Regtest' && value.regtestConnectionType) {
          networkKey =
            value.regtestConnectionType === 'local'
              ? 'LocalRegtest'
              : 'BitfinexRegtest'
        }

        const defaults = NETWORK_DEFAULTS[networkKey]
        if (defaults) {
          form.setValue('rpc_connection_url', defaults.rpc_connection_url)
          form.setValue('indexer_url', defaults.indexer_url)
          form.setValue('proxy_endpoint', defaults.proxy_endpoint)
          form.setValue('daemon_listening_port', defaults.daemon_listening_port)
          form.setValue(
            'ldk_peer_listening_port',
            defaults.ldk_peer_listening_port
          )
          form.setValue(
            'node_url',
            `http://localhost:${defaults.daemon_listening_port}`
          )
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [form])

  // Initialize form with proper defaults on mount
  useEffect(() => {
    const currentNetwork = form.getValues('network')
    const currentRegtestType = form.getValues('regtestConnectionType')

    if (currentNetwork === 'Regtest' && currentRegtestType) {
      const networkKey =
        currentRegtestType === 'local' ? 'LocalRegtest' : 'BitfinexRegtest'
      const defaults = NETWORK_DEFAULTS[networkKey]

      if (defaults) {
        form.setValue('rpc_connection_url', defaults.rpc_connection_url)
        form.setValue('indexer_url', defaults.indexer_url)
        form.setValue('proxy_endpoint', defaults.proxy_endpoint)
        form.setValue('daemon_listening_port', defaults.daemon_listening_port)
        form.setValue(
          'ldk_peer_listening_port',
          defaults.ldk_peer_listening_port
        )
        form.setValue(
          'node_url',
          `http://localhost:${defaults.daemon_listening_port}`
        )
      }
    }
  }, [])

  const testConnection = async () => {
    const data = form.getValues()
    setIsTestingConnection(true)
    setConnectionError(null)
    setConnectionSuccess(false)

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      if (data.useAuth && data.authToken) {
        headers['Authorization'] = `Bearer ${data.authToken}`
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      // Properly construct URL to avoid double slashes
      const nodeInfoUrl = constructApiUrl(data.node_url, 'nodeinfo')

      const response = await fetch(nodeInfoUrl, {
        headers,
        method: 'GET',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.status === 403) {
        setConnectionError({
          details:
            'Invalid credentials or authentication token. Please check your password or auth token.',
          message: 'Authentication failed',
          type: 'auth',
        })
        toast.error('Authentication failed during test.')
        return
      }

      if (response.status === 404) {
        setConnectionError({
          details:
            'The /nodeinfo endpoint was not found. Please verify the node URL is correct.',
          message: 'Node endpoint not found',
          type: 'connection',
        })
        toast.error('Node endpoint not found during test.')
        return
      }

      if (response.status >= 500) {
        setConnectionError({
          details: `The remote node returned a server error (${response.status}). The node may be down or misconfigured.`,
          message: 'Server error',
          type: 'network',
        })
        toast.error('Server error during connection test.')
        return
      }

      if (!response.ok) {
        setConnectionError({
          details: `HTTP ${response.status}: ${response.statusText}`,
          message: 'Connection test failed',
          type: 'connection',
        })
        toast.error(`Connection test failed: ${response.status}`)
        return
      }

      // Test if response is valid JSON
      try {
        await response.json()
        setConnectionSuccess(true)
        toast.success('✅ Connection test successful! Node is reachable.')
      } catch (jsonError) {
        setConnectionError({
          details:
            'The node responded but not with valid JSON. This may not be an RGB Lightning node.',
          message: 'Invalid response format',
          type: 'connection',
        })
        toast.error('Invalid response during connection test.')
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setConnectionError({
          details:
            'The test connection took too long to respond. Please check your network connection and node URL.',
          message: 'Connection test timeout',
          type: 'connection',
        })
        toast.error('Connection test timed out.')
      } else if (
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('Network Error')
      ) {
        setConnectionError({
          details:
            'Unable to reach the remote node during test. Please check your internet connection and node URL.',
          message: 'Network connection failed',
          type: 'network',
        })
        toast.error('Network error during connection test.')
      } else {
        setConnectionError({
          details:
            error.message ||
            'An unknown error occurred while testing the connection.',
          message: 'Connection test failed',
          type: 'connection',
        })
        toast.error('Connection test failed.')
      }
    } finally {
      setIsTestingConnection(false)
    }
  }

  const onSubmit: SubmitHandler<Fields> = async (data) => {
    setIsConnecting(true)
    setConnectionError(null)
    setConnectionStep('testing')

    // Check if account with the same name already exists
    try {
      const accountExists = await invoke('check_account_exists', {
        name: data.name,
      })
      if (accountExists) {
        setConnectionError({
          details:
            'Please choose a different account name or delete the existing account.',
          message: 'Account name already exists',
          type: 'account',
        })
        toast.error('An account with this name already exists')
        setIsConnecting(false)
        setConnectionStep('idle')
        return
      }
    } catch (error) {
      setConnectionError({
        details:
          'Unable to verify if account name is available. Please try again.',
        message: 'Failed to check account existence',
        type: 'account',
      })
      toast.error('Failed to check account existence. Please try again.')
      setIsConnecting(false)
      setConnectionStep('idle')
      return
    }

    // First, test the connection before saving anything
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      if (data.useAuth && data.authToken) {
        headers['Authorization'] = `Bearer ${data.authToken}`
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      // Properly construct URL to avoid double slashes
      const nodeInfoUrl = constructApiUrl(data.node_url, 'nodeinfo')

      const response = await fetch(nodeInfoUrl, {
        headers,
        method: 'GET',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.status === 403) {
        setConnectionError({
          details:
            'Invalid credentials or authentication token. Please check your password or auth token.',
          message: 'Authentication failed',
          type: 'auth',
        })
        toast.error('Authentication failed. Please check your credentials.')
        setIsConnecting(false)
        setConnectionStep('idle')
        return
      }

      if (response.status === 404) {
        setConnectionError({
          details:
            'The /nodeinfo endpoint was not found. Please verify the node URL is correct.',
          message: 'Node endpoint not found',
          type: 'connection',
        })
        toast.error('Node endpoint not found. Please check your node URL.')
        setIsConnecting(false)
        setConnectionStep('idle')
        return
      }

      if (response.status >= 500) {
        setConnectionError({
          details: `The remote node returned a server error (${response.status}). The node may be down or misconfigured.`,
          message: 'Server error',
          type: 'network',
        })
        toast.error('Server error. The remote node may be down.')
        setIsConnecting(false)
        setConnectionStep('idle')
        return
      }

      if (!response.ok) {
        setConnectionError({
          details: `HTTP ${response.status}: ${response.statusText}`,
          message: 'Connection failed',
          type: 'connection',
        })
        toast.error(
          `Connection failed: ${response.status} ${response.statusText}`
        )
        setIsConnecting(false)
        setConnectionStep('idle')
        return
      }

      // Test if response is valid JSON
      try {
        await response.json()
        setConnectionStep('creating')
        toast.success('✅ Connection successful! Creating account...')
      } catch (jsonError) {
        setConnectionError({
          details:
            'The node responded but not with valid JSON. This may not be an RGB Lightning node.',
          message: 'Invalid response format',
          type: 'connection',
        })
        toast.error('Invalid response from node. Please check the URL.')
        setIsConnecting(false)
        setConnectionStep('idle')
        return
      }
    } catch (error: any) {
      setIsConnecting(false)
      setConnectionStep('idle')

      if (error.name === 'AbortError') {
        setConnectionError({
          details:
            'The connection took too long to respond. Please check your network connection and node URL.',
          message: 'Connection timeout',
          type: 'connection',
        })
        toast.error(
          'Connection timeout. Please check your network and try again.'
        )
      } else if (
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('Network Error')
      ) {
        setConnectionError({
          details:
            'Unable to reach the remote node. Please check your internet connection and node URL.',
          message: 'Network connection failed',
          type: 'network',
        })
        toast.error('Network error. Please check your connection and node URL.')
      } else if (error.message?.includes('CORS')) {
        setConnectionError({
          details:
            'The remote node is not configured to accept requests from this application.',
          message: 'CORS policy error',
          type: 'connection',
        })
        toast.error(
          'CORS error. The remote node may not be properly configured.'
        )
      } else {
        setConnectionError({
          details:
            error.message ||
            'An unknown error occurred while connecting to the node.',
          message: 'Unexpected error',
          type: 'connection',
        })
        toast.error(
          'Failed to connect to remote node. Please check your settings.'
        )
      }
      return
    }

    // Connection successful! Now save the account
    try {
      // Prepare network configuration
      let networkKey: string = data.network

      // Handle regtest connection type selection
      if (data.network === 'Regtest' && data.regtestConnectionType) {
        networkKey =
          data.regtestConnectionType === 'local'
            ? 'LocalRegtest'
            : 'BitfinexRegtest'
      }

      const networkDefaults = NETWORK_DEFAULTS[networkKey]
      const defaultMakerUrl = networkDefaults.default_maker_url

      // Save node settings with bearer token if auth is enabled
      await dispatch(
        setSettingsAsync({
          daemon_listening_port: data.daemon_listening_port,
          datapath: '',
          bearer_token: data.authToken,
          default_lsp_url: networkDefaults.default_lsp_url,
          default_maker_url: defaultMakerUrl,
          indexer_url: data.indexer_url,
          ldk_peer_listening_port: data.ldk_peer_listening_port,
          maker_urls: [defaultMakerUrl],
          name: data.name,
          network: data.network,
          node_url: data.node_url,
          proxy_endpoint: data.proxy_endpoint,
          rpc_connection_url: data.rpc_connection_url,
        })
      )

      setConnectionStep('finalizing')

      // Navigate to dashboard after successful connection
      navigate(WALLET_DASHBOARD_PATH)

      // Insert account
      await invoke('insert_account', {
        daemonListeningPort: '',
        datapath: '',
        bearerToken: data.useAuth ? data.authToken : '',
        defaultLspUrl: networkDefaults.default_lsp_url,
        defaultMakerUrl,
        
        indexerUrl: data.indexer_url,
        // Empty for remote nodes
ldkPeerListeningPort: '',
        makerUrls: defaultMakerUrl,
        name: data.name,
        network: data.network,
        nodeUrl: data.node_url,
        proxyEndpoint: data.proxy_endpoint,
        rpcConnectionUrl: data.rpc_connection_url, // Add bearer token if auth is enabled
      })

      // Set as current account
      await invoke('set_current_account', { accountName: data.name })

      toast.success('🎉 Account created successfully!')
      setIsConnecting(false)
      setConnectionStep('idle')
      navigate(WALLET_DASHBOARD_PATH)
    } catch (error: any) {
      setIsConnecting(false)
      setConnectionStep('idle')
      setConnectionError({
        details: `Account creation failed after successful connection: ${error.message || 'Unknown error'}`,
        message: 'Failed to create account',
        type: 'account',
      })
      toast.error('Failed to create account. Please try again.')
    }
  }

  return (
    <Layout>
      <SetupLayout
        centered
        fullHeight
        icon={<Cloud />}
        maxWidth="3xl"
        onBack={() => navigate(WALLET_SETUP_PATH)}
        subtitle="Enter the details of your remote RGB Lightning node"
        title="Connect to Remote Node"
      >
        {connectionError && (
          <Alert
            className="mb-6"
            icon={<AlertTriangle className="w-4 h-4" />}
            title={connectionError.message}
            variant="error"
          >
            <div className="space-y-2">
              <p className="text-sm text-red-200">{connectionError.details}</p>
              {connectionError.type === 'connection' && (
                <div className="text-xs text-red-300 bg-red-500/10 p-2 rounded border border-red-500/20">
                  <p className="font-medium mb-1">💡 Troubleshooting tips:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Verify the node URL is correct and accessible</li>
                    <li>Check if the node is running and responding</li>
                    <li>Ensure the port number is correct</li>
                    <li>
                      Try switching between local and remote regtest if using
                      regtest
                    </li>
                  </ul>
                </div>
              )}
              {connectionError.type === 'auth' && (
                <div className="text-xs text-red-300 bg-red-500/10 p-2 rounded border border-red-500/20">
                  <p className="font-medium mb-1">🔑 Authentication help:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Double-check your password</li>
                    <li>Verify the authentication token if using one</li>
                    <li>Ensure the node accepts your credentials</li>
                  </ul>
                </div>
              )}
              {connectionError.type === 'network' && (
                <div className="text-xs text-red-300 bg-red-500/10 p-2 rounded border border-red-500/20">
                  <p className="font-medium mb-1">
                    🌐 Network troubleshooting:
                  </p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Check your internet connection</li>
                    <li>Verify the node is online and accessible</li>
                    <li>
                      Try switching regtest connection type if using regtest
                    </li>
                  </ul>
                </div>
              )}
              <button
                className="mt-3 text-xs text-red-300 hover:text-red-200 underline transition-colors"
                onClick={() => setConnectionError(null)}
                type="button"
              >
                Dismiss and try again
              </button>
            </div>
          </Alert>
        )}

        {connectionSuccess && (
          <Alert
            className="mb-6"
            icon={<Check className="w-4 h-4" />}
            title="Connection test successful"
            variant="success"
          >
            <div className="space-y-2">
              <p className="text-sm text-green-200">
                Successfully connected to the remote node! The node is
                responding correctly.
              </p>
              <div className="text-xs text-green-300 bg-green-500/10 p-2 rounded border border-green-500/20">
                <p className="font-medium mb-1">✅ Connection verified:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Node is online and accessible</li>
                  <li>Authentication is working correctly</li>
                  <li>Node is responding with valid data</li>
                </ul>
              </div>
              <button
                className="mt-3 text-xs text-green-300 hover:text-green-200 underline transition-colors"
                onClick={() => setConnectionSuccess(false)}
                type="button"
              >
                Dismiss
              </button>
            </div>
          </Alert>
        )}

        <div className="w-full">
          <p className="text-slate-400 mb-6 leading-relaxed">
            Configure your remote node connection settings. Enter the details of
            your existing RGB Lightning node.
          </p>

          <Card className="p-6 bg-blue-dark/40 border border-white/5">
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <SetupSection>
                <FormField
                  description="This name will be used to identify your remote node connection"
                  error={form.formState.errors.name?.message}
                  htmlFor="name"
                  label="Account Name"
                >
                  <Input
                    id="name"
                    placeholder="My Remote Node"
                    {...form.register('name', {
                      required: 'Account name is required',
                    })}
                    error={!!form.formState.errors.name}
                  />
                </FormField>
                <FormField
                  description={
                    form.watch('network') === 'Regtest'
                      ? `Node URL for ${form.watch('regtestConnectionType') === 'local' ? 'local' : 'Bitfinex'} regtest connection`
                      : 'The URL of your remote RGB Lightning node'
                  }
                  error={form.formState.errors.node_url?.message}
                  htmlFor="node_url"
                  label="Node URL"
                >
                  <Input
                    id="node_url"
                    placeholder={
                      form.watch('network') === 'Regtest'
                        ? form.watch('regtestConnectionType') === 'local'
                          ? 'http://localhost:3001'
                          : 'http://localhost:3001 (Bitfinex regtest)'
                        : 'http://your-node-url:3000'
                    }
                    {...form.register('node_url', {
                      required: 'Node URL is required',
                      validate: (value) => {
                        // Check for common URL formatting issues
                        if (value.includes('//nodeinfo')) {
                          return 'Remove "/nodeinfo" from the URL - it will be added automatically'
                        }
                        if (value.match(/\/\/+$/)) {
                          return 'Remove extra trailing slashes from the URL'
                        }
                        if (!value.match(/^https?:\/\//)) {
                          return 'URL must start with http:// or https://'
                        }
                        return true
                      },
                    })}
                    error={!!form.formState.errors.node_url}
                  />
                  {form.watch('node_url') &&
                    form.watch('node_url').endsWith('/')}
                </FormField>

                <NetworkSelector
                  className="mb-4"
                  onChange={(network) => form.setValue('network', network)}
                  selectedNetwork={form.watch('network')}
                />

                {form.watch('network') === 'Regtest' && (
                  <div className="mb-6 p-4 bg-blue-dark/20 border border-blue-500/20 rounded-xl">
                    <RegtestConnectionSelector
                      onChange={(type) =>
                        form.setValue('regtestConnectionType', type)
                      }
                      selectedType={form.watch('regtestConnectionType')}
                    />
                  </div>
                )}
                <FormField
                  error={form.formState.errors.password?.message}
                  htmlFor="password"
                  label="Node Password"
                >
                  <PasswordInput
                    id="password"
                    isVisible={isPasswordVisible}
                    onToggleVisibility={() =>
                      setIsPasswordVisible(!isPasswordVisible)
                    }
                    placeholder="Password"
                    {...form.register('password', {
                      required: 'Password is required',
                    })}
                    error={!!form.formState.errors.password}
                  />
                </FormField>
              </SetupSection>

              <AdvancedSettings>
                <NetworkSettings form={form} />

                <div className="p-2.5 bg-blue-dark/40 rounded-lg border border-slate-700/30 mt-4">
                  <div className="flex items-center mb-2.5">
                    <input
                      className="w-3.5 h-3.5 text-cyan bg-blue-dark border-gray-600 rounded focus:ring-cyan"
                      id="useAuth"
                      type="checkbox"
                      {...form.register('useAuth')}
                    />
                    <label
                      className="ml-2 text-xs font-medium text-gray-300"
                      htmlFor="useAuth"
                    >
                      Use Authentication Token
                    </label>
                  </div>

                  {form.watch('useAuth') && (
                    <FormField
                      error={form.formState.errors.authToken?.message}
                      htmlFor="authToken"
                      label="Authentication Token"
                    >
                      <Input
                        id="authToken"
                        {...form.register('authToken', {
                          required: form.watch('useAuth')
                            ? 'Authentication token is required'
                            : false,
                        })}
                        error={!!form.formState.errors.authToken}
                      />
                    </FormField>
                  )}
                </div>
              </AdvancedSettings>

              {/* Progress Indicator */}
              {isConnecting && (
                <div className="pt-3 pb-2">
                  <div className="flex items-center gap-3 p-3 bg-blue-dark/30 border border-blue-500/20 rounded-lg">
                    <Spinner size="sm" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">
                        {connectionStep === 'testing' &&
                          'Step 1: Testing connection to remote node...'}
                        {connectionStep === 'creating' &&
                          'Step 2: Creating account and saving settings...'}
                        {connectionStep === 'finalizing' &&
                          'Step 3: Finalizing account setup...'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex gap-1">
                          <div
                            className={`w-2 h-2 rounded-full transition-colors ${connectionStep === 'testing' ? 'bg-cyan' : 'bg-slate-600'}`}
                          />
                          <div
                            className={`w-2 h-2 rounded-full transition-colors ${connectionStep === 'creating' ? 'bg-cyan' : connectionStep === 'finalizing' ? 'bg-cyan' : 'bg-slate-600'}`}
                          />
                          <div
                            className={`w-2 h-2 rounded-full transition-colors ${connectionStep === 'finalizing' ? 'bg-cyan' : 'bg-slate-600'}`}
                          />
                        </div>
                        <span className="text-xs text-slate-400">
                          {connectionStep === 'testing' && '1/3'}
                          {connectionStep === 'creating' && '2/3'}
                          {connectionStep === 'finalizing' && '3/3'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-3 space-y-3">
                {/* Test Connection Button */}
                <Button
                  className="w-full"
                  disabled={isTestingConnection || isConnecting}
                  icon={
                    isTestingConnection ? (
                      <Spinner size="sm" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )
                  }
                  iconPosition="left"
                  onClick={testConnection}
                  size="lg"
                  type="button"
                  variant="secondary"
                >
                  {isTestingConnection
                    ? 'Testing Connection...'
                    : 'Test Connection'}
                </Button>

                {/* Main Submit Button */}
                <Button
                  className="w-full"
                  disabled={isConnecting || isTestingConnection}
                  icon={
                    isConnecting ? (
                      <Spinner size="sm" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )
                  }
                  iconPosition="right"
                  size="lg"
                  type="submit"
                  variant="primary"
                >
                  {isConnecting
                    ? connectionStep === 'testing'
                      ? 'Testing Connection...'
                      : connectionStep === 'creating'
                        ? 'Creating Account...'
                        : connectionStep === 'finalizing'
                          ? 'Finalizing Setup...'
                          : 'Processing...'
                    : 'Test Connection & Create Account'}
                </Button>

                {connectionSuccess && (
                  <p className="text-xs text-center text-green-400">
                    Connection verified! You can now safely connect to the node.
                  </p>
                )}
              </div>
            </form>
          </Card>
        </div>
      </SetupLayout>
    </Layout>
  )
}
