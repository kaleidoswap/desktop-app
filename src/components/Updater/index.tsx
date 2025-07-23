import { relaunch } from '@tauri-apps/plugin-process'
import { Update, check } from '@tauri-apps/plugin-updater'
import {
  Loader2,
  AlertCircle,
  Download,
  CheckCircle2,
  RefreshCw,
  Calendar,
  FileText,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'

type UpdaterProps = {
  setUpdateChecked: (checked: boolean) => void
}

export const Updater = ({ setUpdateChecked }: UpdaterProps) => {
  const [update, setUpdate] = useState<null | Update>(null)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(true)
  const [contentLength, setContentLength] = useState<number | undefined>(
    undefined
  )
  const [downloaded, setDownloaded] = useState<number>(0)
  const [completed, setCompleted] = useState<boolean>(false)
  const [isInstalling, setIsInstalling] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkForUpdate = async () => {
      setIsCheckingUpdate(true)
      setError(null)
      let _update: Update | null = null
      try {
        console.log('Checking for updates...')
        _update = await check({
          timeout: 10000,
        })
        console.log('Update check result:', _update)
      } catch (e) {
        console.log('Update check error:', e)
        setError('Failed to check for updates. Please try again later.')
      } finally {
        setIsCheckingUpdate(false)
      }

      if (_update) {
        console.log('Update available:', _update.version)
        setUpdate(_update)
      } else {
        console.log('No update available')
        setUpdateChecked(true)
      }
    }

    checkForUpdate()
  }, [setUpdateChecked])

  // Auto-reset stuck installing state after 10 minutes
  useEffect(() => {
    let resetTimer: ReturnType<typeof setTimeout> | undefined

    if (isInstalling && !completed) {
      resetTimer = setTimeout(() => {
        console.log('Auto-resetting stuck installing state')
        setIsInstalling(false)
        setError('Update process seems to be stuck. Please try again.')
      }, 600000) // 10 minutes
    }

    return () => {
      if (resetTimer) {
        clearTimeout(resetTimer)
      }
    }
  }, [isInstalling, completed])

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

  // Checking for updates state
  if (isCheckingUpdate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6">
        <div className="max-w-md w-full">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-400 to-cyan-300 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Checking for Updates
              </h2>
              <p className="text-blue-100/80 text-sm leading-relaxed">
                We're looking for the latest version to ensure you have the best
                experience.
              </p>
              <div className="mt-6 flex justify-center">
                <div className="flex space-x-1">
                  <div
                    className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-red-900 to-pink-900 p-6">
        <div className="max-w-md w-full">
          <div className="bg-white/10 backdrop-blur-xl border border-red-300/30 rounded-3xl p-8 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-red-400 to-pink-400 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                Update Check Failed
              </h2>
              <p className="text-red-100/80 text-sm leading-relaxed mb-6">
                {error}
              </p>
              <div className="flex gap-3">
                <button
                  className="flex-1 px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all duration-200 border border-white/20"
                  onClick={() => window.location.reload()}
                >
                  Try Again
                </button>
                <button
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl hover:from-red-600 hover:to-pink-600 transition-all duration-200 shadow-lg"
                  onClick={() => setUpdateChecked(true)}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!update) return null

  const handleInstall = async () => {
    setIsInstalling(true)
    setError(null)

    // Add timeout protection
    const timeoutId = setTimeout(() => {
      console.log('Update timeout - resetting state')
      setError('Update process timed out. Please try again.')
      setIsInstalling(false)
      setCompleted(false)
    }, 300000) // 5 minutes timeout

    try {
      console.log('Starting download and install...')
      await update.downloadAndInstall((event) => {
        console.log('Download event:', event)
        switch (event.event) {
          case 'Started':
            console.log(
              'Download started, content length:',
              event.data.contentLength
            )
            setContentLength(() => event.data.contentLength)
            break
          case 'Progress':
            console.log('Download progress:', event.data.chunkLength, 'bytes')
            setDownloaded((prev) => {
              const newDownloaded = prev + event.data.chunkLength
              console.log('Total downloaded:', newDownloaded)
              return newDownloaded
            })
            break
          case 'Finished':
            console.log('Download finished, setting completed state')
            clearTimeout(timeoutId)
            setCompleted(true)
            setIsInstalling(false)
            break
        }
      })
      console.log('Download and install completed successfully')
    } catch (err) {
      console.error('Download/install error:', err)
      clearTimeout(timeoutId)
      setError('Failed to install update. Please try again.')
      setIsInstalling(false)
      setCompleted(false)
      toast.error('Failed to install update')
    }
  }

  // Update completed state
  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-green-900 to-emerald-900 p-6">
        <div className="max-w-md w-full">
          <div className="bg-white/10 backdrop-blur-xl border border-green-300/30 rounded-3xl p-8 shadow-2xl">
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
      </div>
    )
  }

  // Installing state
  if (contentLength && isInstalling && update) {
    const progress = Math.round((downloaded / contentLength) * 100)
    const downloadedSize = formatFileSize(downloaded)
    const totalSize = formatFileSize(contentLength)

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 p-6">
        <div className="max-w-md w-full">
          <div className="bg-white/10 backdrop-blur-xl border border-purple-300/30 rounded-3xl p-8 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-400 to-indigo-400 rounded-2xl flex items-center justify-center mb-6 shadow-lg relative overflow-hidden">
                <Download className="w-8 h-8 text-white z-10" />
                {/* Animated background */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-300/20 to-indigo-300/20 animate-pulse"></div>
                <div className="absolute -inset-2 bg-gradient-to-r from-purple-400/10 to-indigo-400/10 blur animate-ping"></div>
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

              {/* Enhanced Progress Section */}
              <div className="bg-white/5 rounded-2xl p-6 mb-6 border border-white/10">
                {/* Progress Ring/Circle */}
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

              {/* Release notes */}
              {update.body && (
                <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-left">
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
      </div>
    )
  }

  // Update available state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-amber-900 to-orange-900 p-6">
      <div className="max-w-lg w-full">
        <div className="bg-white/10 backdrop-blur-xl border border-amber-300/30 rounded-3xl p-8 shadow-2xl">
          <div className="text-center">
            {/* Header */}
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-400 rounded-2xl flex items-center justify-center mb-6 shadow-lg relative">
              <Sparkles className="w-8 h-8 text-white" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
            </div>

            <h2 className="text-3xl font-bold text-white mb-2">
              New Update Available!
            </h2>

            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="text-amber-100/80">Version</span>
              <span className="px-3 py-1 bg-gradient-to-r from-amber-400/20 to-orange-400/20 text-amber-200 font-semibold rounded-full border border-amber-400/30">
                {update.version}
              </span>
            </div>

            {/* Release info */}
            {update.date && (
              <div className="flex items-center justify-center gap-2 mb-6 text-amber-100/60">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">
                  Released {formatDate(update.date)}
                </span>
              </div>
            )}

            {/* Release notes */}
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

            {/* Action buttons */}
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
                onClick={() => setUpdateChecked(true)}
              >
                Skip for now
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
