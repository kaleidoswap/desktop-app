import { Wallet, Zap, Eye, Save } from 'lucide-react'
import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'react-toastify'

import { useAppDispatch, useAppSelector } from '../../app/store/hooks'
import sparkLogo from '../../assets/spark-logo.svg'
import {
  setShowSparkWallet,
  setShowRgbAssets,
  setShowSparkAssets,
} from '../../slices/settings/settings.slice'
import type { SparkNetwork } from '../../types/spark'
import { Button, Card } from '../ui'

interface WalletSettingsForm {
  showSparkWallet: boolean
  showRgbAssets: boolean
  showSparkAssets: boolean
  sparkApiKey?: string
  defaultNetwork: SparkNetwork
}

export const WalletSettings: React.FC = () => {
  const dispatch = useAppDispatch()
  const settings = useAppSelector((state) => state.settings)
  const [isSaving, setIsSaving] = useState(false)

  const { register, handleSubmit, watch } = useForm<WalletSettingsForm>({
    defaultValues: {
      defaultNetwork: settings.sparkWalletsConfig.defaultNetwork,
      showRgbAssets: settings.showRgbAssets,
      showSparkAssets: settings.showSparkAssets,
      showSparkWallet: settings.showSparkWallet,
      sparkApiKey: '',
    },
  })

  const onSubmit = async (data: WalletSettingsForm) => {
    setIsSaving(true)
    try {
      // Update Redux state
      dispatch(setShowSparkWallet(data.showSparkWallet))
      dispatch(setShowRgbAssets(data.showRgbAssets))
      dispatch(setShowSparkAssets(data.showSparkAssets))

      // TODO: Save to persistent storage (e.g., localStorage, backend)
      toast.success('Wallet settings saved successfully!')
    } catch (error) {
      toast.error('Failed to save wallet settings')
      console.error('Error saving wallet settings:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const showSparkWallet = watch('showSparkWallet')
  const showRgbAssets = watch('showRgbAssets')
  const showSparkAssets = watch('showSparkAssets')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-500/20 rounded-xl">
          <Wallet className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Wallet Settings</h2>
          <p className="text-sm text-slate-400">
            Configure wallet display and preferences
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Wallet Display Settings */}
        <Card className="p-6 mb-6 bg-slate-800/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-400" />
            Display Settings
          </h3>

          <div className="space-y-4">
            {/* Show Spark Wallet */}
            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
              <div className="flex items-center gap-3">
                <img alt="Spark" className="w-6 h-6" src={sparkLogo} />
                <div>
                  <label className="text-sm font-medium text-white">
                    Show Spark Wallet
                  </label>
                  <p className="text-xs text-slate-400">
                    Display Spark wallet in the dashboard
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  className="sr-only peer"
                  type="checkbox"
                  {...register('showSparkWallet')}
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Show RGB Assets */}
            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6 text-emerald-400" />
                <div>
                  <label className="text-sm font-medium text-white">
                    Show RGB Assets
                  </label>
                  <p className="text-xs text-slate-400">
                    Display RGB assets card in the dashboard
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  className="sr-only peer"
                  type="checkbox"
                  {...register('showRgbAssets')}
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Show Spark Assets */}
            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
              <div className="flex items-center gap-3">
                <img alt="Spark" className="w-6 h-6" src={sparkLogo} />
                <div>
                  <label className="text-sm font-medium text-white">
                    Show Spark Assets
                  </label>
                  <p className="text-xs text-slate-400">
                    Display Spark assets card in the dashboard
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  className="sr-only peer"
                  type="checkbox"
                  {...register('showSparkAssets')}
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </Card>

        {/* Network Configuration */}
        {showSparkWallet && (
          <Card className="p-6 mb-6 bg-slate-800/50">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <img alt="Spark" className="w-5 h-5" src={sparkLogo} />
              Spark Configuration
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Default Network
                </label>
                <select
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  {...register('defaultNetwork')}
                >
                  <option value="mainnet">Mainnet</option>
                  <option value="regtest">Regtest</option>
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  Default network for new Spark wallets
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Spark API Key
                </label>
                <input
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Enter your Spark API key"
                  type="password"
                  {...register('sparkApiKey')}
                />
                <p className="mt-1 text-xs text-slate-400">
                  Required for connecting Spark wallets
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
            disabled={isSaving}
            type="submit"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>

      {/* Summary Card */}
      <Card className="p-6 bg-blue-900/20 border-blue-500/30">
        <h3 className="text-sm font-semibold text-blue-300 mb-3">
          Current Configuration
        </h3>
        <div className="space-y-2 text-sm text-slate-300">
          <div className="flex items-center justify-between">
            <span>Spark Wallet:</span>
            <span
              className={showSparkWallet ? 'text-green-400' : 'text-slate-500'}
            >
              {showSparkWallet ? 'Visible' : 'Hidden'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>RGB Assets:</span>
            <span
              className={showRgbAssets ? 'text-green-400' : 'text-slate-500'}
            >
              {showRgbAssets ? 'Visible' : 'Hidden'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Spark Assets:</span>
            <span
              className={showSparkAssets ? 'text-green-400' : 'text-slate-500'}
            >
              {showSparkAssets ? 'Visible' : 'Hidden'}
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}
