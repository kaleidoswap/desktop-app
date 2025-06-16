import { invoke } from '@tauri-apps/api/core'
import { relaunch } from '@tauri-apps/plugin-process'
import { Update, check } from '@tauri-apps/plugin-updater'
import { Download } from 'lucide-react'
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
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
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

        // Always add notification for available updates, never block the app
        console.log('New update found, adding notification')
        setHasAvailableSkippedUpdate(skippedVersion === _update.version)

        // Only add notification if we haven't already notified about this version
        if (notifiedVersion !== _update.version) {
          localStorage.setItem(
            UPDATE_STORAGE_KEYS.NOTIFIED_VERSION,
            _update.version
          )
          addNotification({
            data: { update: _update },
            message:
              skippedVersion === _update.version
                ? `Version ${_update.version} is available (previously skipped). Click to install now.`
                : `Version ${_update.version} is available. Click to install now.`,
            title: 'Update Available',
            type: 'info',
            // Don't auto-close so user can click it later
          })
        }
      } else {
        console.log('No update available')
        setHasAvailableSkippedUpdate(false)
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
      // Set skipped version and mark as notified for this session
      localStorage.setItem(UPDATE_STORAGE_KEYS.SKIPPED_VERSION, update.version)
      localStorage.setItem(UPDATE_STORAGE_KEYS.NOTIFIED_VERSION, update.version)
      setSkippedVersion(update.version)
      setHasAvailableSkippedUpdate(true)

      // Add persistent notification for skipped update that user can click
      addNotification({
        data: { update },
        message: `Version ${update.version} was skipped. Click here to install now.`,
        title: 'Update Available',
        type: 'info',
        // Don't auto-close so user can click it later
      })
    }
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
      const wasSkipped =
        localStorage.getItem(UPDATE_STORAGE_KEYS.SKIPPED_VERSION) ===
        _update.version
      setHasAvailableSkippedUpdate(wasSkipped)

      addNotification({
        data: { update: _update },
        message: `Version ${_update.version} is available for download. ${wasSkipped ? 'This update was previously skipped.' : 'Click to install now.'}`,
        title: 'Update Found',
        type: 'info',
        // Don't auto-close so user can click it later
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

  // No blocking UI for updates - app always loads, notifications only

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
