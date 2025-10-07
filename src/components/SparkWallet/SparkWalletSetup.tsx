import { Zap, AlertCircle, X } from 'lucide-react'
import { useForm } from 'react-hook-form'

import { useAppDispatch } from '../../app/store/hooks'
import { sparkSliceActions } from '../../slices/spark/spark.slice'
import { useConnectWalletMutation } from '../../slices/spark/sparkApi.slice'
import type { SparkWalletConfig } from '../../types/spark'
import { Button, Card } from '../ui'

interface SparkWalletSetupForm {
  mnemonic: string
  passphrase?: string
  network: 'mainnet' | 'testnet' | 'signet'
  apiKey: string
}

interface SparkWalletSetupModalProps {
  onClose: () => void
}

export const SparkWalletSetupModal = ({
  onClose,
}: SparkWalletSetupModalProps) => {
  const dispatch = useAppDispatch()
  const [connectWallet, { isLoading, error }] = useConnectWalletMutation()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SparkWalletSetupForm>({
    defaultValues: {
      apiKey: import.meta.env.VITE_BREEZ_SDK_API_KEY || '',
      mnemonic: import.meta.env.VITE_MNEMONIC || '',
      network: 'mainnet',
    },
  })

  const onSubmit = async (data: SparkWalletSetupForm) => {
    dispatch(sparkSliceActions.setConnecting(true))

    const config: SparkWalletConfig = {
      apiKey: data.apiKey.trim(),
      mnemonic: data.mnemonic.trim(),
      network: data.network,
      passphrase: data.passphrase?.trim() || undefined,
      storageDir: './.spark-data',
    }

    try {
      const result = await connectWallet({ config }).unwrap()
      dispatch(sparkSliceActions.setConnected({ connected: true, sdk: result }))
      onClose()
    } catch (err) {
      dispatch(
        sparkSliceActions.setError(
          err instanceof Error ? err.message : 'Failed to connect Spark wallet'
        )
      )
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-2xl w-full">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-500/10 rounded-lg">
              <Zap className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Create Spark Wallet
              </h2>
              <p className="text-sm text-slate-400">
                Setup your self-custodial Layer 2 Bitcoin wallet
              </p>
            </div>
          </div>
          <button className="text-slate-400 hover:text-white" onClick={onClose}>
            <X className="w-6 h-6" />
          </button>
        </div>

        {error ? (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-red-500 mb-1">
                  Connection Error
                </h4>
                <p className="text-sm text-slate-300">
                  {typeof error === 'object' && 'error' in error
                    ? String(error.error)
                    : 'Failed to connect to Spark wallet'}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Mnemonic (12 or 24 words)
              </label>
              <textarea
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                placeholder="word1 word2 word3..."
                rows={3}
                {...register('mnemonic', {
                  required: 'Mnemonic is required',
                })}
              />
              {errors.mnemonic && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.mnemonic.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Passphrase (optional)
              </label>
              <input
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                placeholder="Optional passphrase"
                type="password"
                {...register('passphrase')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Network
              </label>
              <select
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                {...register('network', { required: true })}
              >
                <option value="mainnet">Mainnet</option>
                <option value="testnet">Testnet</option>
                <option value="signet">Signet</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Breez API Key
              </label>
              <input
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                placeholder="Your Breez API key"
                type="text"
                {...register('apiKey', {
                  required: 'API key is required',
                })}
              />
              {errors.apiKey && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.apiKey.message}
                </p>
              )}
              <p className="text-slate-400 text-xs mt-1">
                Request a free API key at{' '}
                <a
                  className="text-yellow-500 hover:underline"
                  href="https://breez.technology/request-api-key/"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  breez.technology
                </a>
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={onClose}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={isLoading}
                icon={<Zap className="w-4 h-4" />}
                type="submit"
              >
                {isLoading ? 'Connecting...' : 'Connect Spark Wallet'}
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  )
}
