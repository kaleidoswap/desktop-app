import { invoke } from '@tauri-apps/api/core'
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
import { useState, useEffect, createContext, useContext, useRef } from 'react'

import { NotificationProvider, useNotification } from '../NotificationSystem'

const UPDATE_STORAGE_KEYS = {
  LAST_CHECK: 'kaleidoswap_last_update_check',
  NOTIFIED_VERSION: 'kaleidoswap_notified_update_version',
  SKIPPED_VERSION: 'kaleidoswap_skipped_update_version',
}

interface UpdateContextType {
  hasSkippedUpdate: boolean
  skippedVersion: string | null
  checkForUpdates: () => void
  clearSkippedUpdate: () => void
}

const UpdateContext = createContext<UpdateContextType>({
  checkForUpdates: () => {},
  clearSkippedUpdate: () => {},
  hasSkippedUpdate: false,
  skippedVersion: null,
})

export const useUpdate = () => {
  const context = useContext(UpdateContext)
  if (!context) {
    throw new Error('useUpdate must be used within an UpdateProvider')
  }
  return context
}

const UpdateChecker = ({ children }: { children: React.ReactNode }) => {
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(true)
  const [updateChecked, setUpdateChecked] = useState(false)
  const [update, setUpdate] = useState<Update | null>(null)
  const [skippedVersion, setSkippedVersion] = useState<string | null>(null)
  const [hasAvailableSkippedUpdate, setHasAvailableSkippedUpdate] =
    useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isInstalling, setIsInstalling] = useState(false)
  const [contentLength, setContentLength] = useState<number | null>(null)
  const [downloaded, setDownloaded] = useState<number>(0)
  const [completed, setCompleted] = useState(false)

  // Add refs to prevent infinite loops
  const hasPerformedInitialCheck = useRef(false)
  const updateCheckInProgress = useRef(false)
  const lastCheckTime = useRef(0)

  const { addNotification } = useNotification()

  useEffect(() => {
    const closeSplashscreen = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await invoke('close_splashscreen')
      } catch (error) {
        console.error('Failed to close splashscreen:', error)
      }
    }

    closeSplashscreen()
  }, [])

  // useEffect(() => {
  //   const checkSkippedVersion = () => {
  //     const skipped = localStorage.getItem(UPDATE_STORAGE_KEYS.SKIPPED_VERSION)
  //     if (skipped) {
  //       console.log('Found skipped version in localStorage:', skipped)
  //       setSkippedVersion(skipped)
  //       // We'll determine if it's still available during the update check
  //     }
  //   }

  //   checkSkippedVersion()
  // }, [])

  useEffect(() => {
    const checkForUpdate = async () => {
      // Prevent multiple simultaneous checks and repeated initial checks
      if (hasPerformedInitialCheck.current || updateCheckInProgress.current) {
        return
      }

      updateCheckInProgress.current = true
      hasPerformedInitialCheck.current = true

      console.log('Starting initial update check...')
      let _update: Update | null = null

      try {
        _update = await check({ timeout: 10000 })
        console.log('Initial update check result:', _update)
      } catch (e) {
        console.error('Initial update check failed:', e)
        setError('Failed to check for updates. Please try again later.')
        setIsCheckingUpdate(false)
        setUpdateChecked(true) // Mark as checked even on error to prevent infinite loop
        updateCheckInProgress.current = false
        return
      }

      setIsCheckingUpdate(false)
      updateCheckInProgress.current = false

      if (_update) {
        console.log('Update available:', _update.version)
        const skippedVersion = localStorage.getItem(
          UPDATE_STORAGE_KEYS.SKIPPED_VERSION
        )
        const notifiedVersion = localStorage.getItem(
          UPDATE_STORAGE_KEYS.NOTIFIED_VERSION
        )

        // If user has skipped this version, add it as a notification instead of showing modal
        if (skippedVersion === _update.version) {
          console.log('Update was previously skipped, adding notification')
          setUpdate(null)
          setHasAvailableSkippedUpdate(true)
          setUpdateChecked(true)

          // Only add notification if we haven't already notified about this version
          if (notifiedVersion !== _update.version) {
            localStorage.setItem(
              UPDATE_STORAGE_KEYS.NOTIFIED_VERSION,
              _update.version
            )
            addNotification({
              data: { update: _update },
              message: `Version ${_update.version} is available. Click to install.`,
              onClose: () => {},
              title: 'Update Available',
              type: 'info',
            })
          }
        } else {
          console.log('New update found, showing modal')
          setUpdate(_update)
          setHasAvailableSkippedUpdate(false)
        }
      } else {
        console.log('No update available')
        setUpdateChecked(true)
        setHasAvailableSkippedUpdate(false)
        // Add a subtle notification on app start to show that update check completed
        addNotification({
          autoClose: 3000,
          message: 'Kaleidoswap is up to date and ready to use.',
          title: 'App Ready',
          type: 'success',
        })
      }
    }

    checkForUpdate()
  }, []) // Remove addNotification from dependencies to prevent infinite loop

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

  const handleInstall = async () => {
    if (!update) return

    setIsInstalling(true)
    setError(null)

    try {
      console.log('Starting update installation...')
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            setContentLength(event.data.contentLength || null)
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

  const handleSkip = () => {
    if (update) {
      localStorage.setItem(UPDATE_STORAGE_KEYS.SKIPPED_VERSION, update.version)
      localStorage.setItem(UPDATE_STORAGE_KEYS.NOTIFIED_VERSION, update.version)
      setSkippedVersion(update.version)
      setHasAvailableSkippedUpdate(true)

      // Add notification for skipped update
      addNotification({
        autoClose: 5000,
        data: { update },
        message: `Version ${update.version} was skipped. You can install it later from notifications.`,
        title: 'Update Skipped',
        type: 'info',
      })
    }
    setUpdateChecked(true)
  }

  const checkForUpdates = async () => {
    const now = Date.now()

    // Prevent multiple simultaneous checks
    if (updateCheckInProgress.current) {
      console.log('Update check already in progress, skipping...')
      return
    }

    // Prevent rapid clicking (cooldown of 2 seconds)
    if (now - lastCheckTime.current < 2000) {
      console.log('Update check cooldown active, skipping...')
      return
    }

    console.log(
      `[${new Date().toISOString()}] Manual update check triggered...`
    )
    lastCheckTime.current = now
    updateCheckInProgress.current = true
    setIsCheckingUpdate(true)
    setError(null)
    let _update: Update | null = null

    try {
      _update = await check({ timeout: 10000 })
      console.log('Manual update check result:', _update)
    } catch (e) {
      console.error('Manual update check failed:', e)
      setError('Failed to check for updates. Please try again later.')
      addNotification({
        message: 'Failed to check for updates. Please try again later.',
        title: 'Update Check Failed',
        type: 'error',
        // Remove autoClose so error notifications persist until manually dismissed
      })
      // Reset state and exit early on error
      setIsCheckingUpdate(false)
      updateCheckInProgress.current = false
      return
    }

    // Reset loading state for successful completion
    setIsCheckingUpdate(false)
    updateCheckInProgress.current = false

    if (_update) {
      console.log('Manual check found update:', _update.version)
      // Clear the notified version so user can see the update modal
      localStorage.removeItem(UPDATE_STORAGE_KEYS.NOTIFIED_VERSION)
      setUpdate(_update)
      setHasAvailableSkippedUpdate(false)

      addNotification({
        autoClose: 5000,
        message: `Version ${_update.version} is available for download.`,
        title: 'Update Found',
        type: 'info',
      })
    } else {
      console.log('Manual check: no updates available')
      setHasAvailableSkippedUpdate(false)
      addNotification({
        autoClose: 3000,
        message: 'You are running the latest version.',
        title: 'No Updates',
        type: 'info',
      })
    }
  }

  const clearSkippedUpdate = () => {
    localStorage.removeItem(UPDATE_STORAGE_KEYS.SKIPPED_VERSION)
    localStorage.removeItem(UPDATE_STORAGE_KEYS.NOTIFIED_VERSION)
    setSkippedVersion(null)
    setHasAvailableSkippedUpdate(false)
  }

  const contextValue: UpdateContextType = {
    checkForUpdates,
    clearSkippedUpdate,
    hasSkippedUpdate: hasAvailableSkippedUpdate,
    skippedVersion,
  }

  // Show update UI before the app loads
  if (!updateChecked) {
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
                  We're looking for the latest version to ensure you have the
                  best experience.
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
                    {update?.version}
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

    // Update available state
    if (update) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-amber-900 to-orange-900 p-6">
          <div className="max-w-lg w-full">
            <div className="bg-white/10 backdrop-blur-xl border border-amber-300/30 rounded-3xl p-8 shadow-2xl">
              <div className="text-center">
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
                    onClick={handleSkip}
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
  }

  // App is ready to load
  return (
    <UpdateContext.Provider value={contextValue}>
      {children}
    </UpdateContext.Provider>
  )
}

interface UpdateProviderProps {
  children: React.ReactNode
}

export const UpdateProvider = ({ children }: UpdateProviderProps) => {
  return (
    <NotificationProvider>
      <UpdateChecker>{children}</UpdateChecker>
    </NotificationProvider>
  )
}
