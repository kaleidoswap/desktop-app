import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { Update, check } from '@tauri-apps/plugin-updater'
import { useEffect, createContext, useContext, useRef } from 'react'

import { NotificationProvider, useNotification } from '../NotificationSystem'

// Helper function to compare semantic versions properly
const isVersionNewer = (
  newVersion: string,
  currentVersion: string
): boolean => {
  const parseVersion = (version: string) => {
    return version
      .replace(/^v/, '')
      .split('.')
      .map((num) => parseInt(num, 10))
  }

  const newParts = parseVersion(newVersion)
  const currentParts = parseVersion(currentVersion)

  for (let i = 0; i < Math.max(newParts.length, currentParts.length); i++) {
    const newPart = newParts[i] || 0
    const currentPart = currentParts[i] || 0

    if (newPart > currentPart) return true
    if (newPart < currentPart) return false
  }

  return false // Versions are equal
}

interface UpdateContextType {
  checkForUpdates: () => void
}

const UpdateContext = createContext<UpdateContextType>({
  checkForUpdates: () => {},
})

export const useUpdate = () => {
  const context = useContext(UpdateContext)
  if (!context) {
    throw new Error('useUpdate must be used within an UpdateProvider')
  }
  return context
}

const UpdateChecker = ({ children }: { children: React.ReactNode }) => {
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

  useEffect(() => {
    const checkForUpdate = async () => {
      // Prevent multiple simultaneous checks and repeated initial checks
      if (hasPerformedInitialCheck.current || updateCheckInProgress.current) {
        return
      }

      updateCheckInProgress.current = true
      hasPerformedInitialCheck.current = true

      // Get current app version dynamically
      let currentVersion = '0.1.0' // fallback
      try {
        currentVersion = await getVersion()
      } catch (e) {
        console.warn('Failed to get current version, using fallback:', e)
      }

      let update: Update | null

      try {
        const maybeUpdate = await check({ timeout: 10000 })
        update =
          maybeUpdate && isVersionNewer(maybeUpdate.version, currentVersion)
            ? maybeUpdate
            : null
      } catch (e) {
        console.error('Initial update check failed:', e)
        updateCheckInProgress.current = false
        return
      }
      updateCheckInProgress.current = false

      if (update) {
        addNotification({
          data: { update },
          message: `Version ${update.version} is available. Click to install now.`,
          title: 'Update Available',
          type: 'info',
          // Don't auto-close so user can click it later
        })
      }
    }

    checkForUpdate()
  }, []) // Remove addNotification from dependencies to prevent infinite loop

  const checkForUpdates = async () => {
    const now = Date.now()

    // Prevent multiple simultaneous checks
    if (updateCheckInProgress.current) {
      return
    }

    // Prevent rapid clicking (cooldown of 2 seconds)
    if (now - lastCheckTime.current < 2000) {
      return
    }

    // Get current app version dynamically
    let currentVersion = '0.1.0' // fallback
    try {
      currentVersion = await getVersion()
    } catch (e) {
      console.warn('Failed to get current version, using fallback:', e)
    }

    lastCheckTime.current = now
    updateCheckInProgress.current = true
    let update: Update | null

    try {
      const maybeUpdate = await check({ timeout: 10000 })
      update =
        maybeUpdate && isVersionNewer(maybeUpdate.version, currentVersion)
          ? maybeUpdate
          : null
    } catch (e) {
      console.error('Manual update check failed:', e)
      addNotification({
        message: `Failed to check for updates: ${e instanceof Error ? e.message : 'Unknown error'}. Please try again later.`,
        title: 'Update Check Failed',
        type: 'error',
        // Remove autoClose so error notifications persist until manually dismissed
      })
      // Reset state and exit early on error
      updateCheckInProgress.current = false
      return
    }

    // Reset loading state for successful completion
    updateCheckInProgress.current = false

    if (update) {
      addNotification({
        data: { update },
        message: `Version ${update.version} is available for download. Click to install now.`,
        title: 'Update Found',
        type: 'info',
        // Don't auto-close so user can click it later
      })
    } else {
      addNotification({
        autoClose: 3000,
        message: 'You are running the latest version.',
        title: 'No Updates',
        type: 'info',
      })
    }
  }

  const contextValue: UpdateContextType = {
    checkForUpdates,
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
