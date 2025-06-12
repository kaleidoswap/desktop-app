import { relaunch } from '@tauri-apps/plugin-process'
import { Update } from '@tauri-apps/plugin-updater'
import {
  X,
  Download,
  CheckCircle2,
  RefreshCw,
  Calendar,
  FileText,
  Sparkles,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { useState } from 'react'

const UPDATE_STORAGE_KEYS = {
  NOTIFIED_VERSION: 'kaleidoswap_notified_update_version',
  SKIPPED_VERSION: 'kaleidoswap_skipped_update_version',
}

interface UpdateModalProps {
  isOpen: boolean
  onClose: () => void
  update: Update
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  update,
}) => {
  const [isInstalling, setIsInstalling] = useState(false)
  const [contentLength, setContentLength] = useState<number | undefined>(
    undefined
  )
  const [downloaded, setDownloaded] = useState<number>(0)
  const [completed, setCompleted] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  const handleInstall = async () => {
    setIsInstalling(true)
    setError(null)

    try {
      console.log('Starting update installation...')
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            setContentLength(event.data.contentLength)
            setDownloaded(0)
            console.log(
              `Update download started, content length: ${event.data.contentLength}`
            )
            break
          case 'Progress':
            setDownloaded(event.data.chunkLength)
            console.log(`Downloaded chunk: ${event.data.chunkLength}`)
            break
          case 'Finished':
            setCompleted(true)
            // Clear the skipped and notified versions since update is being installed
            localStorage.removeItem(UPDATE_STORAGE_KEYS.SKIPPED_VERSION)
            localStorage.removeItem(UPDATE_STORAGE_KEYS.NOTIFIED_VERSION)
            console.log('Update download finished')
            break
        }
      })
    } catch (error) {
      console.error('Update installation error:', error)
      setError('Failed to install update. Please try again later.')
      setIsInstalling(false)
    }
  }

  // Update completed state
  if (completed) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
        <div className="max-w-md w-full bg-blue-darkest border border-green-600/30 rounded-3xl p-8 shadow-2xl">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-400 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Update Ready! 🎉
            </h2>
            <p className="text-green-100/80 text-sm leading-relaxed mb-2">
              Version{' '}
              <span className="font-semibold text-green-200">
                {update.version}
              </span>{' '}
              has been downloaded successfully.
            </p>
            <p className="text-green-100/60 text-xs mb-8">
              Restart the application to enjoy the latest features and
              improvements.
            </p>
            <button
              className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-200 shadow-lg hover:shadow-green-500/25 transform hover:scale-[1.02] flex items-center justify-center gap-2"
              onClick={() => relaunch()}
            >
              <RefreshCw className="w-5 h-5" />
              Restart Now
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Installing state
  if (contentLength && isInstalling) {
    const progress = Math.round((downloaded / contentLength) * 100)
    const downloadedSize = formatFileSize(downloaded)
    const totalSize = formatFileSize(contentLength)

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
        <div className="max-w-md w-full bg-blue-darkest border border-purple-600/30 rounded-3xl p-8 shadow-2xl">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-400 to-indigo-400 rounded-2xl flex items-center justify-center mb-6 shadow-lg relative overflow-hidden">
              <Download className="w-8 h-8 text-white z-10" />
              <div className="absolute inset-0 bg-gradient-to-r from-purple-300/20 to-indigo-300/20 animate-pulse"></div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">
              Downloading Update
            </h2>
            <p className="text-purple-100/80 text-sm mb-2">
              Version{' '}
              <span className="font-semibold text-purple-200">
                {update.version}
              </span>
            </p>
            <p className="text-purple-100/60 text-xs mb-8">
              Please don't close the application during the update
            </p>

            <div className="space-y-4">
              <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-purple-400 to-indigo-400 rounded-full transition-all duration-300 ease-out shadow-lg"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex justify-between text-sm text-purple-200/80">
                <span>{progress}%</span>
                <span>
                  {downloadedSize} / {totalSize}
                </span>
              </div>

              <div className="flex items-center justify-center gap-2 mt-4">
                <div className="flex space-x-1">
                  <div
                    className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  ></div>
                </div>
                <span className="text-xs text-purple-200/60 ml-2">
                  {progress < 100 ? 'Downloading...' : 'Installing...'}
                </span>
              </div>
            </div>

            {update.body && (
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-left mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-purple-300" />
                  <span className="text-sm font-medium text-purple-200">
                    What's New
                  </span>
                </div>
                <p className="text-xs text-purple-100/70 leading-relaxed">
                  {update.body}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
        <div className="max-w-md w-full bg-blue-darkest border border-red-600/30 rounded-3xl p-8 shadow-2xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-3">
              Update Failed
            </h2>
            <p className="text-red-100/80 text-sm leading-relaxed mb-6">
              {error}
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all duration-200 border border-white/20"
                onClick={() => setError(null)}
              >
                Try Again
              </button>
              <button
                className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl hover:from-red-600 hover:to-pink-600 transition-all duration-200 shadow-lg"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Default update modal state
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="max-w-lg w-full bg-blue-darkest border border-amber-600/30 rounded-3xl p-8 shadow-2xl">
        <div className="relative">
          {/* Close button */}
          <button
            className="absolute -top-2 -right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors z-10"
            onClick={onClose}
          >
            <X className="w-5 h-5 text-gray-300" />
          </button>

          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-400 rounded-2xl flex items-center justify-center mb-6 shadow-lg relative">
              <Sparkles className="w-8 h-8 text-white" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
            </div>

            <h2 className="text-3xl font-bold text-white mb-2">
              Update Available!
            </h2>

            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="text-amber-100/80">Version</span>
              <span className="px-3 py-1 bg-gradient-to-r from-amber-400/20 to-orange-400/20 text-amber-200 font-semibold rounded-full border border-amber-400/30">
                {update.version}
              </span>
            </div>

            {update.date && (
              <div className="flex items-center justify-center gap-2 mb-6 text-amber-100/60">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">
                  Released {formatDate(update.date)}
                </span>
              </div>
            )}

            {update.body && (
              <div className="bg-white/5 rounded-xl p-5 border border-white/10 text-left mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-amber-300" />
                  <span className="text-sm font-medium text-amber-200">
                    What's New
                  </span>
                </div>
                <p className="text-sm text-amber-100/80 leading-relaxed">
                  {update.body}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <button
                className="w-full px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all duration-200 shadow-lg hover:shadow-amber-500/25 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                disabled={isInstalling}
                onClick={handleInstall}
              >
                {isInstalling ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Installing...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Download & Install
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
              <button
                className="w-full px-6 py-3 text-amber-200/80 hover:text-white transition-all duration-200 rounded-xl hover:bg-white/10 border border-transparent hover:border-amber-400/30"
                disabled={isInstalling}
                onClick={onClose}
              >
                Maybe Later
              </button>
            </div>

            <p className="text-xs text-amber-100/40 mt-4">
              We recommend updating to get the latest features and security
              improvements.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
