import { invoke } from '@tauri-apps/api/core'
import {
  Eye,
  EyeOff,
  Lock,
  AlertTriangle,
  Copy,
  CheckCircle,
  X,
  Shield,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'

import { Button } from './ui'

interface MnemonicViewerModalProps {
  isOpen: boolean
  onClose: () => void
}

export const MnemonicViewerModal: React.FC<MnemonicViewerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [step, setStep] = useState<'password' | 'display'>('password')
  const [password, setPassword] = useState('')
  const [mnemonic, setMnemonic] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('password')
      setPassword('')
      setMnemonic(null)
      setError(null)
      setShowPassword(false)
      setCopied(false)
    }
  }, [isOpen])

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!password) {
      setError('Password is required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const decryptedMnemonic = await invoke<string>('get_decrypted_mnemonic', {
        password,
      })

      setMnemonic(decryptedMnemonic)
      setStep('display')
      toast.success('Recovery phrase retrieved successfully')
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.toString()
          : 'Incorrect password or no mnemonic stored'
      setError(errorMessage)
      toast.error(
        'Failed to decrypt recovery phrase. Please check your password.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!mnemonic) return

    try {
      await navigator.clipboard.writeText(mnemonic)
      setCopied(true)
      toast.success('Recovery phrase copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error('Failed to copy to clipboard')
    }
  }

  const handleClose = () => {
    onClose()
  }

  const mnemonicWords = mnemonic ? mnemonic.split(' ') : []

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/20 rounded-lg">
                <Shield className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {step === 'password'
                    ? 'Unlock Recovery Phrase'
                    : 'Your Recovery Phrase'}
                </h2>
                <p className="text-sm text-gray-400">
                  {step === 'password'
                    ? 'Enter your password to decrypt and view your recovery phrase'
                    : 'Keep this phrase safe and secret'}
                </p>
              </div>
            </div>
            <button
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
              onClick={handleClose}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'password' ? (
            // Password Entry Step
            <form className="space-y-6" onSubmit={handlePasswordSubmit}>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-400 mb-1">
                      Security Notice
                    </h4>
                    <p className="text-xs text-blue-200/80">
                      Your recovery phrase is encrypted with your wallet
                      password. This ensures that only you can access it.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Wallet Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    autoFocus
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-12 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    disabled={isLoading}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError(null)
                    }}
                    placeholder="Enter your wallet password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                  />
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                    type="button"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {error && (
                  <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <p className="text-sm text-red-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3"
                  disabled={isLoading}
                  onClick={handleClose}
                  type="button"
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading || !password}
                  type="submit"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Decrypting...
                    </>
                  ) : (
                    <>
                      <Eye className="w-5 h-5 mr-2" />
                      View Recovery Phrase
                    </>
                  )}
                </Button>
              </div>
            </form>
          ) : (
            // Mnemonic Display Step
            <div className="space-y-6">
              {/* Critical Warning */}
              <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-base font-bold text-yellow-400 mb-2">
                      ⚠️ Critical Security Warning
                    </h4>
                    <ul className="text-sm text-yellow-200/90 space-y-1 list-disc list-inside">
                      <li>Never share this phrase with anyone</li>
                      <li>Anyone with this phrase can control your wallet</li>
                      <li>Store it in a secure location offline</li>
                      <li>Make sure no one can see your screen</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Mnemonic Grid */}
              <div className="bg-gray-800/50 border-2 border-gray-700 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wide">
                  Your 12-Word Recovery Phrase
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {mnemonicWords.map((word, index) => (
                    <div
                      className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 flex items-center gap-3 hover:border-blue-500/50 transition-colors"
                      key={index}
                    >
                      <span className="text-xs text-gray-500 font-mono font-bold min-w-[24px]">
                        {index + 1}.
                      </span>
                      <span className="text-base text-white font-mono font-medium flex-1">
                        {word}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Copied to Clipboard
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5 mr-2" />
                      Copy to Clipboard
                    </>
                  )}
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3"
                  onClick={handleClose}
                >
                  <EyeOff className="w-5 h-5 mr-2" />
                  Close & Hide
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
