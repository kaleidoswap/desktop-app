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
    setDownloaded(0)
    setContentLength(undefined)
    setCompleted(false)

    // Add timeout protection like the old Updater - but with better error handling
    const timeoutId = setTimeout(() => {
      console.log('Update timeout - resetting state after 5 minutes')
      setError(
        'Update process timed out after 5 minutes. Please check your internet connection and try again.'
      )
      setIsInstalling(false)
      setCompleted(false)
    }, 300000) // 5 minutes timeout

    try {
      console.log('Starting update installation...', {
        timestamp: new Date().toISOString(),
        version: update.version,
      })

      await update.downloadAndInstall((event) => {
        console.log(
          'Download event received:',
          event.event,
          'data' in event ? event.data : 'no data'
        )
        switch (event.event) {
          case 'Started':
            console.log('Download started event')
            if ('data' in event && event.data) {
              setContentLength(event.data.contentLength)
              setDownloaded(0)
              console.log(
                `Update download started, content length: ${event.data.contentLength} bytes (${((event.data.contentLength || 0) / 1024 / 1024).toFixed(2)} MB)`
              )
            }
            break
          case 'Progress':
            console.log(
              'Download progress event:',
              'data' in event ? event.data : 'no data'
            )
            // Fix: Accumulate downloaded bytes instead of just setting chunk length
            if ('data' in event && event.data) {
              setDownloaded((prev) => {
                const newDownloaded = prev + event.data.chunkLength
                const progress = contentLength
                  ? Math.round((newDownloaded / contentLength) * 100)
                  : 0
                console.log(
                  `Downloaded chunk: ${event.data.chunkLength} bytes, Total: ${newDownloaded} bytes (${progress}%)`
                )
                return newDownloaded
              })
            }
            break
          case 'Finished':
            console.log('Download finished event')
            clearTimeout(timeoutId)
            // Clear the skipped and notified versions since update is being installed
            localStorage.removeItem(UPDATE_STORAGE_KEYS.SKIPPED_VERSION)
            localStorage.removeItem(UPDATE_STORAGE_KEYS.NOTIFIED_VERSION)
            console.log(
              'Update download finished - will restart application in 2 seconds'
            )

            // Show completion state briefly before restart
            setCompleted(true)
            setIsInstalling(false)

            // Automatically restart the application after download completes
            setTimeout(() => {
              console.log('Restarting application...')
              relaunch()
            }, 2000) // 2 second delay to show completion state
            break
        }
      })

      // Fallback: If we reach here without getting a 'Finished' event, assume success
      console.log(
        'Update installation function completed, checking if UI needs fallback update'
      )
      if (!completed) {
        console.log(
          'No Finished event received, assuming update completed successfully'
        )
        clearTimeout(timeoutId)
        localStorage.removeItem(UPDATE_STORAGE_KEYS.SKIPPED_VERSION)
        localStorage.removeItem(UPDATE_STORAGE_KEYS.NOTIFIED_VERSION)
        setCompleted(true)
        setIsInstalling(false)

        setTimeout(() => {
          console.log('Restarting application via fallback...')
          relaunch()
        }, 2000)
      }
      console.log('Download and install completed successfully')
    } catch (err) {
      console.error('Download/install error:', err)
      clearTimeout(timeoutId)
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred'
      setError(
        `Failed to install update: ${errorMessage}. Please try again or download manually from GitHub.`
      )
      setIsInstalling(false)
      setCompleted(false)
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
              Update Complete! 🎉
            </h2>
            <p className="text-green-100/80 text-sm leading-relaxed mb-2">
              Version{' '}
              <span className="font-semibold text-green-200">
                {update.version}
              </span>{' '}
              has been installed successfully.
            </p>
            <p className="text-green-100/60 text-xs mb-8">
              The application is restarting automatically to apply the update...
            </p>

            {/* Loading indicator for restart */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <RefreshCw className="w-5 h-5 text-green-400 animate-spin" />
              <span className="text-sm text-green-200">Restarting...</span>
            </div>

            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <p className="text-xs text-green-100/70">
                If the application doesn't restart automatically within a few
                seconds, please restart it manually to apply the update.
              </p>
            </div>
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
              {/* Enhanced Progress Section with Circular Indicator */}
              <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                {/* Circular Progress Ring */}
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <svg
                    className="w-24 h-24 transform -rotate-90"
                    viewBox="0 0 100 100"
                  >
                    {/* Background circle */}
                    <circle
                      className="text-white/10"
                      cx="50"
                      cy="50"
                      fill="none"
                      r="45"
                      stroke="currentColor"
                      strokeWidth="8"
                    />
                    {/* Progress circle */}
                    <circle
                      className="transition-all duration-500 ease-out drop-shadow-lg"
                      cx="50"
                      cy="50"
                      fill="none"
                      r="45"
                      stroke="url(#progressGradient)"
                      strokeDasharray={`${2 * Math.PI * 45}`}
                      strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                      strokeLinecap="round"
                      strokeWidth="8"
                    />
                    <defs>
                      <linearGradient
                        id="progressGradient"
                        x1="0%"
                        x2="100%"
                        y1="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#a855f7" />
                        <stop offset="100%" stopColor="#6366f1" />
                      </linearGradient>
                    </defs>
                  </svg>
                  {/* Percentage in center */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">
                      {progress}%
                    </span>
                  </div>
                </div>

                {/* Download info */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-purple-200/80">Downloaded</span>
                    <span className="font-medium text-purple-100">
                      {downloadedSize} / {totalSize}
                    </span>
                  </div>

                  {/* Linear Progress Bar */}
                  <div className="relative">
                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-400 via-purple-300 to-indigo-400 rounded-full transition-all duration-300 ease-out relative"
                        style={{ width: `${progress}%` }}
                      >
                        {/* Animated shine effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-full animate-pulse"></div>
                        {/* Moving highlight */}
                        <div className="absolute right-0 top-0 w-4 h-full bg-gradient-to-l from-white/60 to-transparent rounded-full animate-pulse"></div>
                      </div>
                    </div>
                  </div>

                  {/* Status indicator */}
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

                  {/* Emergency cancel button for stuck states */}
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <button
                      className="w-full px-4 py-2 text-purple-200/60 hover:text-purple-100 text-xs transition-all duration-200 rounded-lg hover:bg-white/10"
                      onClick={() => {
                        console.log('User cancelled update')
                        setIsInstalling(false)
                        setCompleted(false)
                        setError('Update cancelled by user')
                      }}
                    >
                      Having issues? Click to cancel and try again
                    </button>
                  </div>
                </div>
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
