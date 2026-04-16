import { invoke } from '@tauri-apps/api/core'
import { Cloud, ArrowRight, AlertTriangle, Check } from 'lucide-react'
import { useState, useEffect } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
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
import { RegtestConnectionSelector } from '../../components/RegtestConnectionSelector'
import { TermsWarningModal } from '../../components/TermsWarningModal'
import {
  Button,
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

export const Component = () => {
  const { t } = useTranslation()
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
  const [showTermsModal, setShowTermsModal] = useState(false)

  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const constructApiUrl = (baseUrl: string, endpoint: string): string => {
    if (!baseUrl || !endpoint) {
      throw new Error(t('walletRemote.apiUrlMissingParams'))
    }

    const cleanBaseUrl = baseUrl.replace(/\/+$/, '')
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`

    return `${cleanBaseUrl}${cleanEndpoint}`
  }

  const form = useForm<Fields>({
    defaultValues: {
      authToken: '',
      daemon_listening_port:
        NETWORK_DEFAULTS.BitfinexRegtest.daemon_listening_port,
      indexer_url: NETWORK_DEFAULTS.BitfinexRegtest.indexer_url,
      ldk_peer_listening_port:
        NETWORK_DEFAULTS.BitfinexRegtest.ldk_peer_listening_port,
      name: t('walletRemote.accountNamePlaceholder'),
      network: 'Regtest',
      node_url: `http://localhost:${NETWORK_DEFAULTS.BitfinexRegtest.daemon_listening_port}`,
      password: t('walletRemote.passwordPlaceholder'),
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
          details: t('walletRemote.authenticationFailedDetails'),
          message: t('walletRemote.authenticationFailed'),
          type: 'auth',
        })
        toast.error(t('walletRemote.authenticationFailedToast'))
        return
      }

      if (response.status === 404) {
        setConnectionError({
          details: t('walletRemote.nodeEndpointNotFoundDetails'),
          message: t('walletRemote.nodeEndpointNotFound'),
          type: 'connection',
        })
        toast.error(t('walletRemote.nodeEndpointNotFoundToast'))
        return
      }

      if (response.status >= 500) {
        setConnectionError({
          details: t('walletRemote.serverErrorDetails', {
            status: response.status,
          }),
          message: t('walletRemote.serverError'),
          type: 'network',
        })
        toast.error(t('walletRemote.serverErrorToast'))
        return
      }

      if (!response.ok) {
        setConnectionError({
          details: t('walletRemote.connectionTestFailedDetails', {
            status: response.status,
            statusText: response.statusText,
          }),
          message: t('walletRemote.connectionTestFailed'),
          type: 'connection',
        })
        toast.error(
          t('walletRemote.connectionTestFailedToast', {
            status: response.status,
          })
        )
        return
      }

      // Test if response is valid JSON
      try {
        await response.json()
        setConnectionSuccess(true)
        toast.success(t('walletRemote.connectionSuccessToast'))
      } catch (jsonError) {
        setConnectionError({
          details: t('walletRemote.invalidResponseFormatDetails'),
          message: t('walletRemote.invalidResponseFormat'),
          type: 'connection',
        })
        toast.error(t('walletRemote.invalidResponseFormatToast'))
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setConnectionError({
          details: t('walletRemote.connectionTimeoutDetails'),
          message: t('walletRemote.connectionTimeout'),
          type: 'connection',
        })
        toast.error(t('walletRemote.connectionTimeoutToast'))
      } else if (
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('Network Error')
      ) {
        setConnectionError({
          details: t('walletRemote.networkConnectionFailedDetails'),
          message: t('walletRemote.networkConnectionFailed'),
          type: 'network',
        })
        toast.error(t('walletRemote.networkConnectionFailedToast'))
      } else {
        setConnectionError({
          details: error.message || t('walletRemote.unknownTestError'),
          message: t('walletRemote.connectionTestFailed'),
          type: 'connection',
        })
        toast.error(t('walletRemote.connectionTestFailed'))
      }
    } finally {
      setIsTestingConnection(false)
    }
  }

  const onSubmit: SubmitHandler<Fields> = async () => {
    // Show terms modal first
    setShowTermsModal(true)
  }

  const handleTermsAccept = async () => {
    setShowTermsModal(false)
    const data = form.getValues()
    setIsConnecting(true)
    setConnectionStep('testing')
    setConnectionError(null)

    // Auto-generate a unique account name if one already exists
    try {
      let finalName = data.name
      let suffix = 1
      while (await invoke('check_account_exists', { name: finalName })) {
        finalName = `${data.name}-${suffix}`
        suffix++
      }
      if (finalName !== data.name) {
        data.name = finalName
        form.setValue('name', finalName)
      }
    } catch (error) {
      // If check fails, proceed with the original name — insert will catch real conflicts
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
          details: t('walletRemote.authenticationFailedDetails'),
          message: t('walletRemote.authenticationFailed'),
          type: 'auth',
        })
        toast.error(t('walletRemote.authenticationFailedToast'))
        setIsConnecting(false)
        setConnectionStep('idle')
        return
      }

      if (response.status === 404) {
        setConnectionError({
          details: t('walletRemote.nodeEndpointNotFoundDetails'),
          message: t('walletRemote.nodeEndpointNotFound'),
          type: 'connection',
        })
        toast.error(t('walletRemote.nodeEndpointNotFoundToast'))
        setIsConnecting(false)
        setConnectionStep('idle')
        return
      }

      if (response.status >= 500) {
        setConnectionError({
          details: t('walletRemote.serverErrorDetails', {
            status: response.status,
          }),
          message: t('walletRemote.serverError'),
          type: 'network',
        })
        toast.error(t('walletRemote.serverErrorToast'))
        setIsConnecting(false)
        setConnectionStep('idle')
        return
      }

      if (!response.ok) {
        setConnectionError({
          details: t('walletRemote.connectionTestFailedDetails', {
            status: response.status,
            statusText: response.statusText,
          }),
          message: t('walletRemote.connectionFailed'),
          type: 'connection',
        })
        toast.error(
          t('walletRemote.connectionFailedToast', {
            status: response.status,
            statusText: response.statusText,
          })
        )
        setIsConnecting(false)
        setConnectionStep('idle')
        return
      }

      // Test if response is valid JSON
      try {
        await response.json()
        setConnectionStep('creating')
        toast.success(t('walletRemote.connectionSuccessCreating'))
      } catch (jsonError) {
        setConnectionError({
          details: t('walletRemote.invalidResponseFormatDetails'),
          message: t('walletRemote.invalidResponseFormat'),
          type: 'connection',
        })
        toast.error(t('walletRemote.invalidResponseToast'))
        setIsConnecting(false)
        setConnectionStep('idle')
        return
      }
    } catch (error: any) {
      setIsConnecting(false)
      setConnectionStep('idle')

      if (error.name === 'AbortError') {
        setConnectionError({
          details: t('walletRemote.connectionTimeoutDetails'),
          message: t('walletRemote.connectionTimeout'),
          type: 'connection',
        })
        toast.error(t('walletRemote.connectionTimeoutLong'))
      } else if (
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('Network Error')
      ) {
        setConnectionError({
          details: t('walletRemote.networkConnectionFailedDetails'),
          message: t('walletRemote.networkConnectionFailed'),
          type: 'network',
        })
        toast.error(t('walletRemote.networkErrorToast'))
      } else if (error.message?.includes('CORS')) {
        setConnectionError({
          details: t('walletRemote.corsErrorDetails'),
          message: t('walletRemote.corsError'),
          type: 'connection',
        })
        toast.error(t('walletRemote.corsErrorToast'))
      } else {
        setConnectionError({
          details: error.message || t('walletRemote.unknownConnectionError'),
          message: t('walletRemote.unexpectedError'),
          type: 'connection',
        })
        toast.error(t('walletRemote.failedToConnectToast'))
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
          bearer_token: data.authToken,
          daemon_listening_port: data.daemon_listening_port,
          datapath: '',
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
        bearerToken: data.useAuth ? data.authToken : '',
        daemonListeningPort: '',
        datapath: '',
        defaultLspUrl: networkDefaults.default_lsp_url,
        defaultMakerUrl,

        indexerUrl: data.indexer_url,
        language: 'en',
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

      toast.success(t('walletRemote.accountCreatedSuccess'))
      setIsConnecting(false)
      setConnectionStep('idle')
      navigate(WALLET_DASHBOARD_PATH)
    } catch (error: any) {
      setIsConnecting(false)
      setConnectionStep('idle')
      setConnectionError({
        details: t('walletRemote.failedToCreateAccountDetails', {
          error: error.message || t('walletRemote.unexpectedError'),
        }),
        message: t('walletRemote.failedToCreateAccount'),
        type: 'account',
      })
      toast.error(t('walletRemote.failedToCreateAccountToast'))
    }
  }

  const selectedNetwork = form.watch('network')
  const regtestConnectionType = form.watch('regtestConnectionType')
  const nodeUrlDescription =
    selectedNetwork === 'Regtest'
      ? t('walletRemote.nodeUrlDescriptionRegtest', {
          type:
            regtestConnectionType === 'local'
              ? t('walletRemote.regtestTypeLocal')
              : t('walletRemote.regtestTypeBitfinex'),
        })
      : t('walletRemote.nodeUrlDescription')
  const nodeUrlPlaceholder =
    selectedNetwork === 'Regtest'
      ? regtestConnectionType === 'local'
        ? t('walletRemote.nodeUrlPlaceholderRegtest')
        : t('walletRemote.nodeUrlPlaceholderBitfinex')
      : t('walletRemote.nodeUrlPlaceholder')

  return (
    <>
      <Layout>
        <SetupLayout
          centered
          fullHeight
          icon={<Cloud />}
          maxWidth="3xl"
          onBack={() => navigate(WALLET_SETUP_PATH)}
          title={t('walletRemote.title')}
        >
          {connectionError && (
            <Alert
              className="mb-6"
              icon={<AlertTriangle className="w-4 h-4" />}
              title={connectionError.message}
              variant="error"
            >
              <div className="space-y-2">
                <p className="text-sm text-red-200">
                  {connectionError.details}
                </p>
                {connectionError.type === 'connection' && (
                  <div className="text-xs text-red-300 bg-red-500/10 p-2 rounded border border-red-500/20">
                    <p className="font-medium mb-1">
                      {t('walletRemote.troubleshootingTips')}
                    </p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>{t('walletRemote.verifyNodeUrl')}</li>
                      <li>{t('walletRemote.checkNodeRunning')}</li>
                      <li>{t('walletRemote.ensurePortCorrect')}</li>
                      <li>{t('walletRemote.trySwitchingRegtest')}</li>
                    </ul>
                  </div>
                )}
                {connectionError.type === 'auth' && (
                  <div className="text-xs text-red-300 bg-red-500/10 p-2 rounded border border-red-500/20">
                    <p className="font-medium mb-1">
                      {t('walletRemote.authHelp')}
                    </p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>{t('walletRemote.doubleCheckPassword')}</li>
                      <li>{t('walletRemote.verifyAuthToken')}</li>
                      <li>{t('walletRemote.ensureNodeAccepts')}</li>
                    </ul>
                  </div>
                )}
                {connectionError.type === 'network' && (
                  <div className="text-xs text-red-300 bg-red-500/10 p-2 rounded border border-red-500/20">
                    <p className="font-medium mb-1">
                      {t('walletRemote.networkTroubleshooting')}
                    </p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>{t('walletRemote.checkInternet')}</li>
                      <li>{t('walletRemote.verifyNodeOnline')}</li>
                      <li>{t('walletRemote.trySwitchingConnection')}</li>
                    </ul>
                  </div>
                )}
                <button
                  className="mt-3 text-xs text-red-300 hover:text-red-200 underline transition-colors"
                  onClick={() => setConnectionError(null)}
                  type="button"
                >
                  {t('walletRemote.dismissAndRetry')}
                </button>
              </div>
            </Alert>
          )}

          {connectionSuccess && (
            <Alert
              className="mb-6"
              icon={<Check className="w-4 h-4" />}
              title={t('walletRemote.connectionTestSuccessful')}
              variant="success"
            >
              <div className="space-y-2">
                <p className="text-sm text-green-200">
                  {t('walletRemote.connectionTestSuccessMessage')}
                </p>
                <div className="text-xs text-green-300 bg-green-500/10 p-2 rounded border border-green-500/20">
                  <p className="font-medium mb-1">
                    {t('walletRemote.connectionVerifiedHeading')}
                  </p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>{t('walletRemote.nodeOnline')}</li>
                    <li>{t('walletRemote.authWorking')}</li>
                    <li>{t('walletRemote.nodeRespondingValidData')}</li>
                  </ul>
                </div>
                <button
                  className="mt-3 text-xs text-green-300 hover:text-green-200 underline transition-colors"
                  onClick={() => setConnectionSuccess(false)}
                  type="button"
                >
                  {t('common.close')}
                </button>
              </div>
            </Alert>
          )}

          <div className="w-full">
            <p className="text-content-secondary mb-6 leading-relaxed">
              {t('walletRemote.configureRemoteNode')}
            </p>

            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <SetupSection>
                <FormField
                  description={t('walletRemote.accountNameDescription')}
                  error={form.formState.errors.name?.message}
                  htmlFor="name"
                  label={t('walletRemote.accountName')}
                >
                  <Input
                    id="name"
                    placeholder={t('walletRemote.accountNamePlaceholder')}
                    {...form.register('name', {
                      required: t('walletRemote.accountNameRequired'),
                    })}
                    error={!!form.formState.errors.name}
                  />
                </FormField>
                <FormField
                  description={nodeUrlDescription}
                  error={form.formState.errors.node_url?.message}
                  htmlFor="node_url"
                  label={t('walletRemote.nodeUrl')}
                >
                  <Input
                    id="node_url"
                    placeholder={nodeUrlPlaceholder}
                    {...form.register('node_url', {
                      required: t('walletRemote.nodeUrlRequired'),
                      validate: (value) => {
                        // Check for common URL formatting issues
                        if (value.includes('//nodeinfo')) {
                          return t('walletRemote.nodeUrlInvalidFormat')
                        }
                        if (value.match(/\/\/+$/)) {
                          return t('walletRemote.nodeUrlTrailingSlash')
                        }
                        if (!value.match(/^https?:\/\//)) {
                          return t('walletRemote.nodeUrlProtocol')
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
                  selectedNetwork={selectedNetwork}
                />

                {selectedNetwork === 'Regtest' && (
                  <RegtestConnectionSelector
                    onChange={(type) =>
                      form.setValue('regtestConnectionType', type)
                    }
                    selectedType={regtestConnectionType}
                  />
                )}

                <FormField
                  error={form.formState.errors.password?.message}
                  htmlFor="password"
                  label={t('walletRemote.password')}
                >
                  <PasswordInput
                    id="password"
                    isVisible={isPasswordVisible}
                    onToggleVisibility={() =>
                      setIsPasswordVisible(!isPasswordVisible)
                    }
                    placeholder={t('walletRemote.passwordPlaceholder')}
                    {...form.register('password', {
                      required: t('walletRemote.passwordRequired'),
                    })}
                    error={!!form.formState.errors.password}
                  />
                </FormField>
              </SetupSection>

              <AdvancedSettings>
                <NetworkSettings form={form} />

                <div className="p-2.5 bg-surface-elevated/40 rounded-lg border border-border-default/30 mt-4">
                  <div className="flex items-center mb-2.5">
                    <input
                      className="w-3.5 h-3.5 text-primary bg-surface-elevated border-border-default rounded focus:ring-cyan"
                      id="useAuth"
                      type="checkbox"
                      {...form.register('useAuth')}
                    />
                    <label
                      className="ml-2 text-xs font-medium text-content-secondary"
                      htmlFor="useAuth"
                    >
                      {t('walletRemote.useAuthToken')}
                    </label>
                  </div>

                  {form.watch('useAuth') && (
                    <FormField
                      error={form.formState.errors.authToken?.message}
                      htmlFor="authToken"
                      label={t('walletRemote.authToken')}
                    >
                      <Input
                        id="authToken"
                        {...form.register('authToken', {
                          required: form.watch('useAuth')
                            ? t('walletRemote.authTokenRequired')
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
                  <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg">
                    <Spinner size="sm" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">
                        {connectionStep === 'testing' &&
                          t('walletRemote.processingStep1')}
                        {connectionStep === 'creating' &&
                          t('walletRemote.processingStep2')}
                        {connectionStep === 'finalizing' &&
                          t('walletRemote.processingStep3')}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex gap-1">
                          <div
                            className={`w-2 h-2 rounded-full transition-colors ${connectionStep === 'testing' ? 'bg-primary' : 'bg-surface-elevated'}`}
                          />
                          <div
                            className={`w-2 h-2 rounded-full transition-colors ${connectionStep === 'creating' ? 'bg-primary' : connectionStep === 'finalizing' ? 'bg-primary' : 'bg-surface-elevated'}`}
                          />
                          <div
                            className={`w-2 h-2 rounded-full transition-colors ${connectionStep === 'finalizing' ? 'bg-primary' : 'bg-surface-elevated'}`}
                          />
                        </div>
                        <span className="text-xs text-content-secondary">
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
                  variant="outline"
                >
                  {isTestingConnection
                    ? t('walletRemote.testingConnection')
                    : t('walletRemote.testConnection')}
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
                      ? t('walletRemote.testingConnection')
                      : connectionStep === 'creating'
                        ? t('walletRemote.creatingAccount')
                        : connectionStep === 'finalizing'
                          ? t('walletRemote.finalizingSetup')
                          : t('walletRemote.processing')
                    : t('walletRemote.testConnectionAndCreate')}
                </Button>

                {connectionSuccess && (
                  <p className="text-xs text-center text-green-400">
                    {t('walletRemote.connectionVerified')}
                  </p>
                )}
              </div>
            </form>
          </div>
        </SetupLayout>
      </Layout>
      <TermsWarningModal
        isOpen={showTermsModal}
        onAccept={handleTermsAccept}
        onClose={() => setShowTermsModal(false)}
      />
    </>
  )
}
