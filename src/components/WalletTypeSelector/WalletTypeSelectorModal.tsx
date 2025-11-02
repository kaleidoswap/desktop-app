import { Zap } from 'lucide-react'
import React, { useState } from 'react'

import sparkLogo from '../../assets/spark-logo.svg'
import { Button } from '../ui'

import { WalletTypeCard } from './WalletTypeCard'

export interface WalletTypeSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (selectedWallets: string[]) => void
  context?: 'setup' | 'dashboard'
}

const WALLET_TYPES = [
  {
    description:
      'RGB Lightning Node - Full featured Lightning Network node with RGB assets support',
    features: [
      'Lightning Network channels',
      'RGB20 & RGB21 asset support',
      'On-chain and off-chain transactions',
      'Channel liquidity management',
      'Asset swaps and trading',
    ],
    id: 'rln',
    isRequired: true,
    logo: <Zap className="w-12 h-12 text-purple-400" />,
    name: 'RGB Lightning Node',
  },
  {
    description:
      'Spark Wallet - Fast and lightweight wallet for instant Bitcoin transfers',
    features: [
      'Instant Bitcoin transfers',
      'Lightning Network integration',
      'Low fees and fast confirmations',
      'Token support (BTKN assets)',
      'L1 deposits and withdrawals',
    ],
    id: 'spark',
    isRequired: false,
    logo: <img alt="Spark" className="h-12 w-auto" src={sparkLogo} />,
    name: 'Spark Wallet',
  },
]

export const WalletTypeSelectorModal: React.FC<
  WalletTypeSelectorModalProps
> = ({ isOpen, onClose, onConfirm, context = 'setup' }) => {
  const [selectedWallets, setSelectedWallets] = useState<string[]>(['rln'])

  if (!isOpen) return null

  const handleToggle = (walletId: string) => {
    setSelectedWallets((prev) => {
      if (prev.includes(walletId)) {
        return prev.filter((id) => id !== walletId)
      } else {
        return [...prev, walletId]
      }
    })
  }

  const handleConfirm = () => {
    onConfirm(selectedWallets)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-4xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-8 border-b border-slate-700">
          <h2 className="text-3xl font-bold text-white mb-2">
            {context === 'setup' ? 'Choose Your Wallets' : 'Add Wallet'}
          </h2>
          <p className="text-slate-400">
            {context === 'setup'
              ? 'Select which wallets you want to set up. RLN is required and always active.'
              : 'Select an additional wallet to add to your account.'}
          </p>
        </div>

        {/* Wallet Cards */}
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {WALLET_TYPES.map((wallet) => (
              <WalletTypeCard
                description={wallet.description}
                disabled={context === 'dashboard' && wallet.id === 'rln'}
                features={wallet.features}
                id={wallet.id}
                isRequired={wallet.isRequired}
                isSelected={selectedWallets.includes(wallet.id)}
                key={wallet.id}
                logo={wallet.logo}
                name={wallet.name}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 bg-slate-900/50 border-t border-slate-700 flex justify-between items-center">
          <div className="text-sm text-slate-400">
            {selectedWallets.length} wallet
            {selectedWallets.length !== 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-3">
            <Button
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
              onClick={onClose}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
              onClick={handleConfirm}
            >
              {context === 'setup' ? 'Continue' : 'Add Wallet'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
