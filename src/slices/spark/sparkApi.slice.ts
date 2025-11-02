import init, {
  connect,
  defaultConfig,
  type BreezSdk,
  type Seed,
  type Payment,
  type PrepareSendPaymentResponse,
  type SendPaymentOptions,
} from '@breeztech/breez-sdk-spark'
import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'

import type {
  SparkWalletConfig,
  SparkWalletInfo,
  PreparedPayment,
  ReceivePaymentRequest,
  SparkPayment,
} from '../../types/spark'

let sdkInstance: BreezSdk | null = null
let wasmInitialized = false

// Initialize WASM module
const initWasm = async () => {
  if (!wasmInitialized) {
    await init()
    wasmInitialized = true
  }
}

const convertPaymentFromSdk = (payment: Payment): SparkPayment => {
  return {
    amount: payment.amount,
    description:
      payment.details?.type === 'lightning'
        ? payment.details.description
        : undefined,
    direction: payment.paymentType === 'send' ? 'outgoing' : 'incoming',
    id: payment.id,
    status: payment.status,
    timestamp: payment.timestamp,
    type:
      payment.details?.type === 'lightning'
        ? 'lightning'
        : payment.details?.type === 'withdraw'
          ? 'onchain'
          : 'spark',
  }
}

export const sparkApi = createApi({
  baseQuery: fakeBaseQuery(),
  endpoints: (builder) => ({
    connectWallet: builder.mutation<BreezSdk, { config: SparkWalletConfig }>({
      invalidatesTags: ['SparkInfo'],
      queryFn: async ({ config }) => {
        try {
          // Initialize WASM first
          await initWasm()

          // Construct the seed
          const seed: Seed = {
            mnemonic: config.mnemonic,
            passphrase: config.passphrase,
            type: 'mnemonic',
          }

          // Create the default config - only mainnet and regtest are supported
          const network = config.network === 'mainnet' ? 'mainnet' : 'regtest'
          const sdkConfig = defaultConfig(network)
          sdkConfig.apiKey = config.apiKey

          // Connect to the SDK
          const sdk = await connect({
            config: sdkConfig,
            seed,
            storageDir: config.storageDir,
          })

          sdkInstance = sdk

          return { data: sdk }
        } catch (error) {
          return {
            error: {
              error:
                error instanceof Error ? error.message : 'Failed to connect',
              status: 'CUSTOM_ERROR',
            },
          }
        }
      },
    }),

    disconnectWallet: builder.mutation<void, void>({
      invalidatesTags: ['SparkInfo', 'SparkPayments'],
      queryFn: async () => {
        try {
          if (sdkInstance) {
            await sdkInstance.disconnect()
            sdkInstance = null
          }
          return { data: undefined }
        } catch (error) {
          return {
            error: {
              error:
                error instanceof Error ? error.message : 'Failed to disconnect',
              status: 'CUSTOM_ERROR',
            },
          }
        }
      },
    }),

    // Token Balance & Transfer Endpoints
    getTokenBalances: builder.query<
      Map<string, { balance: bigint; bech32mTokenIdentifier: string }>,
      void
    >({
      providesTags: ['SparkInfo'],
      queryFn: async () => {
        try {
          if (!sdkInstance) {
            throw new Error('SDK not connected')
          }

          // Get wallet balance which includes token balances
          const info = await sdkInstance.getInfo({ ensureSynced: true })

          // Convert tokenBalances from SDK format to our format
          const tokenBalances = new Map<
            string,
            { balance: bigint; bech32mTokenIdentifier: string }
          >()

          // Note: SDK's getInfo should return tokenBalances
          // If it doesn't exist yet, return empty map
          if ('tokenBalances' in info && info.tokenBalances) {
            for (const [key, value] of Object.entries(
              info.tokenBalances as Record<string, any>
            )) {
              tokenBalances.set(key, value as any)
            }
          }

          return { data: tokenBalances }
        } catch (error) {
          return {
            error: {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to get token balances',
              status: 'CUSTOM_ERROR',
            },
          }
        }
      },
    }),

    getTokenInfo: builder.query<
      Array<{
        tokenIdentifier: string
        name?: string
        ticker?: string
        precision: number
      }>,
      void
    >({
      providesTags: ['SparkInfo'],
      queryFn: async () => {
        try {
          if (!sdkInstance) {
            throw new Error('SDK not connected')
          }

          // Note: This assumes the SDK has a getTokenInfo method
          // If not available yet, this will need to be implemented when SDK is updated
          const tokenInfo = await (sdkInstance as any).getTokenInfo()

          return { data: tokenInfo || [] }
        } catch (error) {
          return {
            error: {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to get token info',
              status: 'CUSTOM_ERROR',
            },
          }
        }
      },
    }),

    getWalletInfo: builder.query<SparkWalletInfo, { ensureSynced?: boolean }>({
      providesTags: ['SparkInfo'],
      queryFn: async ({ ensureSynced = false }) => {
        try {
          if (!sdkInstance) {
            throw new Error('SDK not connected')
          }

          const info = await sdkInstance.getInfo({ ensureSynced })

          // Get addresses by calling receivePayment for each type
          const sparkAddressResponse = await sdkInstance.receivePayment({
            paymentMethod: { type: 'sparkAddress' },
          })
          const bitcoinAddressResponse = await sdkInstance.receivePayment({
            paymentMethod: { type: 'bitcoinAddress' },
          })

          const walletInfo: SparkWalletInfo = {
            balanceSats: info.balanceSats,
            bitcoinAddress: bitcoinAddressResponse.paymentRequest,
            network: 'mainnet',
            sparkAddress: sparkAddressResponse.paymentRequest, // SDK doesn't expose network from info
          }

          return { data: walletInfo }
        } catch (error) {
          return {
            error: {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to get wallet info',
              status: 'CUSTOM_ERROR',
            },
          }
        }
      },
    }),

    listPayments: builder.query<SparkPayment[], void>({
      providesTags: ['SparkPayments'],
      queryFn: async () => {
        try {
          if (!sdkInstance) {
            throw new Error('SDK not connected')
          }

          const response = await sdkInstance.listPayments({})
          const sparkPayments = response.payments.map(convertPaymentFromSdk)

          return { data: sparkPayments }
        } catch (error) {
          return {
            error: {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to list payments',
              status: 'CUSTOM_ERROR',
            },
          }
        }
      },
    }),

    prepareSendPayment: builder.mutation<
      PreparedPayment,
      { paymentRequest: string; amount?: number }
    >({
      queryFn: async ({ paymentRequest, amount }) => {
        try {
          if (!sdkInstance) {
            throw new Error('SDK not connected')
          }

          const prepareResponse = await sdkInstance.prepareSendPayment({
            amountSats: amount,
            paymentRequest,
          })

          const prepared: PreparedPayment = {
            amount: prepareResponse.amountSats,
            fees: {},
            paymentRequest,
          }

          // Add fees based on payment method type
          if (prepareResponse.paymentMethod.type === 'bolt11Invoice') {
            prepared.fees.lightning =
              prepareResponse.paymentMethod.lightningFeeSats
            if (prepareResponse.paymentMethod.sparkTransferFeeSats) {
              prepared.fees.spark =
                prepareResponse.paymentMethod.sparkTransferFeeSats
            }
          } else if (prepareResponse.paymentMethod.type === 'bitcoinAddress') {
            const feeQuote = prepareResponse.paymentMethod.feeQuote
            prepared.fees.onchain = {
              fast:
                feeQuote.speedFast.userFeeSat +
                feeQuote.speedFast.l1BroadcastFeeSat,
              medium:
                feeQuote.speedMedium.userFeeSat +
                feeQuote.speedMedium.l1BroadcastFeeSat,
              slow:
                feeQuote.speedSlow.userFeeSat +
                feeQuote.speedSlow.l1BroadcastFeeSat,
            }
          } else if (prepareResponse.paymentMethod.type === 'sparkAddress') {
            prepared.fees.spark = prepareResponse.paymentMethod.feeSats
          }

          return { data: prepared }
        } catch (error) {
          return {
            error: {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to prepare payment',
              status: 'CUSTOM_ERROR',
            },
          }
        }
      },
    }),

    receivePayment: builder.mutation<
      { invoice?: string; address: string; fees: number },
      ReceivePaymentRequest
    >({
      queryFn: async (request) => {
        try {
          if (!sdkInstance) {
            throw new Error('SDK not connected')
          }

          let paymentMethod:
            | {
                type: 'bolt11Invoice'
                description: string
                amountSats?: number
              }
            | { type: 'bitcoinAddress' }
            | { type: 'sparkAddress' }

          if (request.type === 'lightning') {
            paymentMethod = {
              amountSats: request.amount,
              description: request.description || '',
              type: 'bolt11Invoice',
            }
          } else if (request.type === 'onchain') {
            paymentMethod = { type: 'bitcoinAddress' }
          } else {
            paymentMethod = { type: 'sparkAddress' }
          }

          const response = await sdkInstance.receivePayment({
            paymentMethod,
          })

          return {
            data: {
              address: response.paymentRequest,
              fees: response.feeSats,
              invoice:
                request.type === 'lightning'
                  ? response.paymentRequest
                  : undefined,
            },
          }
        } catch (error) {
          return {
            error: {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to receive payment',
              status: 'CUSTOM_ERROR',
            },
          }
        }
      },
    }),

    sendPayment: builder.mutation<
      Payment,
      {
        prepareResponse: PrepareSendPaymentResponse
        options?: {
          preferSpark?: boolean
          confirmationSpeed?: 'slow' | 'medium' | 'fast'
          completionTimeout?: number
        }
      }
    >({
      invalidatesTags: ['SparkInfo', 'SparkPayments'],
      queryFn: async ({ prepareResponse, options }) => {
        try {
          if (!sdkInstance) {
            throw new Error('SDK not connected')
          }

          let sendOptions: SendPaymentOptions | undefined

          // Set options based on payment method type
          if (prepareResponse.paymentMethod.type === 'bolt11Invoice') {
            sendOptions = {
              completionTimeoutSecs: options?.completionTimeout,
              preferSpark: options?.preferSpark ?? false,
              type: 'bolt11Invoice',
            }
          } else if (prepareResponse.paymentMethod.type === 'bitcoinAddress') {
            sendOptions = {
              confirmationSpeed: options?.confirmationSpeed ?? 'fast',
              type: 'bitcoinAddress',
            }
          }

          const sendResponse = await sdkInstance.sendPayment({
            options: sendOptions,
            prepareResponse,
          })

          return { data: sendResponse.payment }
        } catch (error) {
          return {
            error: {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to send payment',
              status: 'CUSTOM_ERROR',
            },
          }
        }
      },
    }),

    transferTokens: builder.mutation<
      { transactionId: string },
      {
        tokenIdentifier: string
        tokenAmount: bigint
        receiverSparkAddress: string
        selectedOutputs?: any[]
      }
    >({
      invalidatesTags: ['SparkInfo', 'SparkPayments'],
      queryFn: async ({
        tokenIdentifier,
        tokenAmount,
        receiverSparkAddress,
        selectedOutputs,
      }) => {
        try {
          if (!sdkInstance) {
            throw new Error('SDK not connected')
          }

          // Note: This assumes the SDK has a transferTokens method
          // If not available yet, this will need to be implemented when SDK is updated
          const result = await (sdkInstance as any).transferTokens({
            receiverSparkAddress,
            selectedOutputs,
            tokenAmount,
            tokenIdentifier,
          })

          return { data: { transactionId: result.transactionId } }
        } catch (error) {
          return {
            error: {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to transfer tokens',
              status: 'CUSTOM_ERROR',
            },
          }
        }
      },
    }),

    withdrawToL1: builder.mutation<
      Payment,
      { address: string; amount: number; speed?: 'slow' | 'medium' | 'fast' }
    >({
      invalidatesTags: ['SparkInfo', 'SparkPayments'],
      queryFn: async ({ address, amount, speed = 'fast' }) => {
        try {
          if (!sdkInstance) {
            throw new Error('SDK not connected')
          }

          // Prepare the on-chain payment
          const prepareResponse = await sdkInstance.prepareSendPayment({
            amountSats: amount,
            paymentRequest: address,
          })

          // Send the payment with selected speed
          const sendOptions: SendPaymentOptions = {
            confirmationSpeed: speed,
            type: 'bitcoinAddress',
          }

          const sendResponse = await sdkInstance.sendPayment({
            options: sendOptions,
            prepareResponse,
          })

          return { data: sendResponse.payment }
        } catch (error) {
          return {
            error: {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to withdraw to L1',
              status: 'CUSTOM_ERROR',
            },
          }
        }
      },
    }),
  }),
  reducerPath: 'sparkApi',
  tagTypes: ['SparkInfo', 'SparkPayments'],
})

export const {
  useConnectWalletMutation,
  useDisconnectWalletMutation,
  useGetWalletInfoQuery,
  useLazyGetWalletInfoQuery,
  usePrepareSendPaymentMutation,
  useSendPaymentMutation,
  useReceivePaymentMutation,
  useListPaymentsQuery,
  useLazyListPaymentsQuery,
  useWithdrawToL1Mutation,
} = sparkApi
