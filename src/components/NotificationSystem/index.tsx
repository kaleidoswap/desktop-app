import { CheckCircle, AlertCircle, Clock, X, Bell } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { UpdateModal } from './UpdateModal'

export type NotificationType =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'loading'

export interface Notification {
  id: string
  title?: string
  message: string | React.ReactNode
  type: NotificationType
  autoClose?: number
  showProgress?: boolean
  data?: any
  onClose?: () => void
  timestamp?: Date
}

interface NotificationContextType {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id'>) => string
  removeNotification: (id: string) => void
  clearNotifications: () => void
  toggleNotificationPanel: () => void
  isNotificationPanelOpen: boolean
}

export const NotificationContext = React.createContext<NotificationContextType>(
  {
    addNotification: () => '',
    clearNotifications: () => {},
    isNotificationPanelOpen: false,
    notifications: [],
    removeNotification: () => {},
    toggleNotificationPanel: () => {},
  }
)

const getNotificationConfig = (type: NotificationType) => {
  switch (type) {
    case 'success':
      return {
        badgeClass: 'bg-green-500/20 text-green-600 dark:text-green-400',
        containerClass: 'bg-green-500/10 dark:bg-green-900/20',
        icon: CheckCircle,
        iconClass: 'text-green-500',
      }
    case 'error':
      return {
        badgeClass: 'bg-red-500/20 text-red-600 dark:text-red-400',
        containerClass: 'bg-red-500/10 dark:bg-red-900/20',
        icon: AlertCircle,
        iconClass: 'text-red-500',
      }
    case 'warning':
      return {
        badgeClass: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
        containerClass: 'bg-orange-500/10 dark:bg-orange-900/20',
        icon: AlertCircle,
        iconClass: 'text-orange-500',
      }
    case 'loading':
    case 'info':
      return {
        badgeClass: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
        containerClass: 'bg-blue-500/10 dark:bg-blue-900/20',
        icon: Clock,
        iconClass: 'text-blue-500',
      }
    default:
      return {
        badgeClass: 'bg-gray-500/20 text-gray-600 dark:text-gray-400',
        containerClass: 'bg-gray-500/10 dark:bg-gray-900/20',
        icon: Bell,
        iconClass: 'text-gray-500',
      }
  }
}

const NotificationItem: React.FC<{
  notification: Notification
  onClose: () => void
  inPanel?: boolean
  onNotificationClick?: (notification: Notification) => void
}> = ({ notification, onClose, inPanel = false, onNotificationClick }) => {
  const {
    icon: Icon,
    containerClass,
    iconClass,
    badgeClass,
  } = getNotificationConfig(notification.type)
  const [progress, setProgress] = useState(100)
  const progressInterval = useRef<number>()

  const isUpdateNotification = notification.data?.update

  useEffect(() => {
    if (notification.autoClose && notification.showProgress) {
      const startTime = Date.now()
      const endTime = startTime + notification.autoClose

      progressInterval.current = window.setInterval(() => {
        const now = Date.now()
        const remaining = endTime - now
        const percentage = (remaining / (notification.autoClose || 5000)) * 100

        if (percentage <= 0) {
          if (progressInterval.current) clearInterval(progressInterval.current)
          onClose()
        } else {
          setProgress(percentage)
        }
      }, 10)

      return () => {
        if (progressInterval.current) {
          clearInterval(progressInterval.current)
        }
      }
    }
  }, [notification.autoClose, notification.showProgress, onClose])

  return (
    <div
      className={`${inPanel ? 'border-b border-divider/10' : 'rounded-xl shadow-lg'} ${containerClass} backdrop-blur-md ${isUpdateNotification ? 'cursor-pointer hover:bg-gray-500/10' : ''}`}
      onClick={
        isUpdateNotification && onNotificationClick
          ? () => onNotificationClick(notification)
          : undefined
      }
      role="alert"
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className={`${iconClass} w-5 h-5`} />
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {notification.title || 'Notification'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium uppercase ${badgeClass}`}
            >
              {notification.type}
            </span>
            {!inPanel && (
              <button
                className="p-1 hover:bg-gray-500/10 rounded-full transition-colors"
                onClick={onClose}
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {notification.showProgress && notification.autoClose && !inPanel && (
          <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="text-sm text-gray-600 dark:text-gray-300">
          {notification.message}
        </div>

        {notification.timestamp && inPanel && (
          <div className="text-xs text-gray-500 mt-2">
            {notification.timestamp.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  )
}

const NotificationPanel: React.FC<{
  notifications: Notification[]
  onClose: () => void
  onClearAll: () => void
  onRemoveNotification: (id: string) => void
  onNotificationClick: (notification: Notification) => void
}> = ({
  notifications,
  onClose,
  onClearAll,
  onRemoveNotification,
  onNotificationClick,
}) => {
  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-blue-darkest border-l border-divider/10 shadow-xl z-50">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-divider/10">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-cyan" />
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="text-sm text-gray-400 hover:text-white"
              onClick={onClearAll}
            >
              Clear all
            </button>
            <button
              className="p-1 hover:bg-gray-500/10 rounded-full transition-colors"
              onClick={onClose}
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Bell className="w-12 h-12 mb-2" />
              <p>No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-divider/10">
              {notifications.map((notification) => (
                <NotificationItem
                  inPanel
                  key={notification.id}
                  notification={notification}
                  onClose={() => onRemoveNotification(notification.id)}
                  onNotificationClick={onNotificationClick}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false)
  const [selectedUpdateModal, setSelectedUpdateModal] = useState<any>(null)
  const notificationTimers = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({})

  const addNotification = (notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newNotification = {
      ...notification,
      id,
      timestamp: new Date(),
    }

    setNotifications((prev) => [...prev, newNotification])

    if (notification.autoClose) {
      const timer = setTimeout(() => {
        removeNotification(id)
      }, notification.autoClose)
      notificationTimers.current[id] = timer
    }

    return id
  }

  const removeNotification = (id: string) => {
    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== id)
    )

    if (notificationTimers.current[id]) {
      clearTimeout(notificationTimers.current[id])
      delete notificationTimers.current[id]
    }

    const notification = notifications.find((n) => n.id === id)
    if (notification?.onClose) {
      notification.onClose()
    }
  }

  const clearNotifications = () => {
    setNotifications([])
    Object.values(notificationTimers.current).forEach(clearTimeout)
    notificationTimers.current = {}
  }

  const toggleNotificationPanel = () => {
    setIsNotificationPanelOpen((prev) => !prev)
  }

  const handleNotificationClick = (notification: Notification) => {
    if (notification.data?.update) {
      setSelectedUpdateModal(notification.data.update)
      setIsNotificationPanelOpen(false)
    }
  }

  useEffect(() => {
    return () => {
      Object.values(notificationTimers.current).forEach(clearTimeout)
    }
  }, [])

  return (
    <NotificationContext.Provider
      value={{
        addNotification,
        clearNotifications,
        isNotificationPanelOpen,
        notifications,
        removeNotification,
        toggleNotificationPanel,
      }}
    >
      {children}
      {createPortal(
        <>
          <div className="fixed bottom-4 right-4 z-50 space-y-4">
            {notifications
              .filter((n) => !n.autoClose || n.type === 'loading')
              .slice(-3)
              .map((notification) => (
                <div
                  className="transition-all duration-300 ease-in-out"
                  key={notification.id}
                >
                  <NotificationItem
                    notification={notification}
                    onClose={() => removeNotification(notification.id)}
                  />
                </div>
              ))}
          </div>
          {isNotificationPanelOpen && (
            <>
              <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                onClick={toggleNotificationPanel}
              />
              <NotificationPanel
                notifications={notifications}
                onClearAll={clearNotifications}
                onClose={toggleNotificationPanel}
                onNotificationClick={handleNotificationClick}
                onRemoveNotification={removeNotification}
              />
            </>
          )}
          {/* Update Modal */}
          {selectedUpdateModal && (
            <UpdateModal
              isOpen={true}
              onClose={() => setSelectedUpdateModal(null)}
              update={selectedUpdateModal}
            />
          )}
        </>,
        document.body
      )}
    </NotificationContext.Provider>
  )
}

export const useNotification = () => {
  const context = React.useContext(NotificationContext)
  if (!context) {
    throw new Error(
      'useNotification must be used within a NotificationProvider'
    )
  }
  return context
}
