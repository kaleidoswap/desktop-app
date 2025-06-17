import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { Update, check } from '@tauri-apps/plugin-updater'
import { useState, useEffect, createContext, useContext, useRef } from 'react'

import { NotificationProvider, useNotification } from '../NotificationSystem'

const UPDATE_STORAGE_KEYS = {
  LAST_CHECK: 'kaleidoswap_last_update_check',
  NOTIFIED_VERSION: 'kaleidoswap_notified_update_version',
  SKIPPED_VERSION: 'kaleidoswap_skipped_update_version',
}

// Helper function to compare semantic versions
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
  const [skippedVersion, setSkippedVersion] = useState<string | null>(null)
  const [hasAvailableSkippedUpdate, setHasAvailableSkippedUpdate] =
    useState(false)

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
    // Clear any stale notifications first
    clearStaleNotifications()

    const checkForUpdate = async () => {
      // Prevent multiple simultaneous checks and repeated initial checks
      if (hasPerformedInitialCheck.current || updateCheckInProgress.current) {
        console.log('Update check skipped - already performed or in progress')
        return
      }

      updateCheckInProgress.current = true
      hasPerformedInitialCheck.current = true

      console.log('Starting initial update check...')
      console.log(
        'Update endpoint configured:',
        'https://github.com/kaleidoswap/desktop-app/releases/latest/download/latest.json'
      )

      // Get current app version dynamically
      let currentVersion = '0.1.0' // fallback
      try {
        currentVersion = await getVersion()
        console.log('Current app version:', currentVersion)
      } catch (e) {
        console.warn('Failed to get current version, using fallback:', e)
      }

      let _update: Update | null = null

      try {
        _update = await check({ timeout: 10000 })
        console.log('Initial update check result:', _update)

        // Add detailed logging for debugging
        if (_update) {
          console.log('Update details:', {
            availableVersion: _update.version,
            body: _update.body?.substring(0, 100) + '...',
            currentVersion,
            updateDate: _update.date, // First 100 chars of release notes
          })

          // Check if the available version is actually newer than current
          const isActuallyNewer = isVersionNewer(
            _update.version,
            currentVersion
          )
          console.log('Is update actually newer?', isActuallyNewer, {
            available: _update.version,
            current: currentVersion,
          })

          if (!isActuallyNewer) {
            console.log(
              'Available version is not newer than current, skipping notification'
            )
            _update = null // Treat as no update available
          }
        } else {
          console.log('No update available - app is up to date')
        }
      } catch (e) {
        console.error('Initial update check failed:', e)
        console.error('Error details:', {
          message: e instanceof Error ? e.message : 'Unknown error',
          stack: e instanceof Error ? e.stack : undefined,
        })
        updateCheckInProgress.current = false
        return
      }
      updateCheckInProgress.current = false

      if (_update) {
        console.log('Update available:', _update.version)
        const skippedVersion = localStorage.getItem(
          UPDATE_STORAGE_KEYS.SKIPPED_VERSION
        )
        const notifiedVersion = localStorage.getItem(
          UPDATE_STORAGE_KEYS.NOTIFIED_VERSION
        )

        console.log('Update state check:', {
          availableVersion: _update.version,
          notifiedVersion,
          skippedVersion,
          willShowNotification: notifiedVersion !== _update.version,
        })

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
          console.log('Update notification added successfully')
        } else {
          console.log(
            'Skipping notification - already notified about this version'
          )
        }
      } else {
        console.log('No update available')
        setHasAvailableSkippedUpdate(false)
      }
    }

    checkForUpdate()
  }, []) // Remove addNotification from dependencies to prevent infinite loop

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
    console.log(
      'Checking endpoint:',
      'https://github.com/kaleidoswap/desktop-app/releases/latest/download/latest.json'
    )

    // Get current app version dynamically
    let currentVersion = '0.1.0' // fallback
    try {
      currentVersion = await getVersion()
      console.log('Current app version (manual check):', currentVersion)
    } catch (e) {
      console.warn('Failed to get current version, using fallback:', e)
    }

    lastCheckTime.current = now
    updateCheckInProgress.current = true
    let _update: Update | null = null

    try {
      _update = await check({ timeout: 10000 })
      console.log('Manual update check result:', _update)

      if (_update) {
        console.log('Manual check update details:', {
          availableVersion: _update.version,
          currentVersion,
          updateDate: _update.date,
        })

        // Check if the available version is actually newer than current
        const isActuallyNewer = isVersionNewer(_update.version, currentVersion)
        console.log(
          'Manual check - Is update actually newer?',
          isActuallyNewer,
          {
            available: _update.version,
            current: currentVersion,
          }
        )

        if (!isActuallyNewer) {
          console.log(
            'Manual check - Available version is not newer than current, treating as no update'
          )
          _update = null // Treat as no update available
        }
      }
    } catch (e) {
      console.error('Manual update check failed:', e)
      console.error('Manual check error details:', {
        endpoint:
          'https://github.com/kaleidoswap/desktop-app/releases/latest/download/latest.json',
        message: e instanceof Error ? e.message : 'Unknown error',
        stack: e instanceof Error ? e.stack : undefined,
      })
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

    if (_update) {
      console.log('Manual check found update:', _update.version)
      // Clear the notified version so user can see the update modal
      localStorage.removeItem(UPDATE_STORAGE_KEYS.NOTIFIED_VERSION)
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
      console.log('Manual update notification added successfully')
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
    localStorage.removeItem(UPDATE_STORAGE_KEYS.LAST_CHECK) // Also clear last check time
    setSkippedVersion(null)
    setHasAvailableSkippedUpdate(false)
    console.log('Cleared all update-related localStorage data')
  }

  // Add function to clear stale notifications if they match current version
  const clearStaleNotifications = async () => {
    try {
      const currentVersion = await getVersion()
      const notifiedVersion = localStorage.getItem(
        UPDATE_STORAGE_KEYS.NOTIFIED_VERSION
      )
      const skippedVersion = localStorage.getItem(
        UPDATE_STORAGE_KEYS.SKIPPED_VERSION
      )

      // If we've been notified about the current version, clear it
      if (notifiedVersion === currentVersion) {
        localStorage.removeItem(UPDATE_STORAGE_KEYS.NOTIFIED_VERSION)
        console.log(
          'Cleared stale notification for current version:',
          currentVersion
        )
      }

      // If we've skipped the current version, clear it too
      if (skippedVersion === currentVersion) {
        localStorage.removeItem(UPDATE_STORAGE_KEYS.SKIPPED_VERSION)
        setSkippedVersion(null)
        setHasAvailableSkippedUpdate(false)
        console.log('Cleared stale skip for current version:', currentVersion)
      }
    } catch (e) {
      console.warn('Failed to clear stale notifications:', e)
    }
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
