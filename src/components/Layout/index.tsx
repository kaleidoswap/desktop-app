import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import Decimal from 'decimal.js'
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ArrowDownLeft,
  Activity,
  Bell,
  HelpCircle,
  User,
} from 'lucide-react'
import React, { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'

import { WALLET_SETUP_PATH } from '../../app/router/paths'
import { useAppDispatch, useAppSelector } from '../../app/store/hooks'
import logo from '../../assets/logo.svg'
import logoFull from '../../assets/logo-full.svg'
import { useOnClickOutside } from '../../hooks/useOnClickOutside'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { nodeSettingsActions } from '../../slices/nodeSettings/nodeSettings.slice'
import { uiSliceActions } from '../../slices/ui/ui.slice'
import { AppVersion } from '../AppVersion'
import { LogoutModal, LogoutButton } from '../LogoutModal'
import { useNotification } from '../NotificationSystem'
import { ShutdownAnimation } from '../ShutdownAnimation'
import { SupportModal } from '../SupportModal'

import 'react-toastify/dist/ReactToastify.min.css'
import {
  getMainNavItems,
  getChannelMenuItems,
  getTransactionMenuItems,
  getUserMenuItems,
  getSupportResources,
  getPageConfig,
  HIDE_NAVBAR_PATHS,
  NavItem,
} from './config'
import { openUrl } from '@tauri-apps/plugin-opener'

import { LayoutModal } from './Modal'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface Props {
  className?: string
  children: React.ReactNode
}

// Define types for modal actions
type ModalActionType = 'deposit' | 'withdraw' | 'none'

// Define types for dropdown menu props
interface DropdownMenuProps {
  menuRef: React.RefObject<HTMLDivElement>
  isOpen: boolean
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
  title: string
  icon: React.ReactNode
  items: NavItem[]
  onItemClick?: (item: NavItem | string) => void
}

// Define types for NavItem component props
interface NavItemProps {
  item: NavItem & { to: string }
  isCollapsed: boolean
  isActive: boolean
}

// Define types for UserProfile component props
interface UserProfileProps {
  isCollapsed: boolean
  onSupportClick: () => void
  onLogout: () => void
}

// NavItem component for sidebar
const SidebarNavItem = ({ item, isCollapsed }: NavItemProps) => {
  const { t } = useTranslation()
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  // Check if this is the Trade section and if we have a trading mode in the URL
  const hasSubMenu = item.subMenu && item.subMenu.length > 0

  const handleClick = (e: React.MouseEvent) => {
    // If sidebar is collapsed and this is the Trade item, navigate directly to Market Maker page
    if (
      isCollapsed &&
      item.label === 'Trade' &&
      item.subMenu &&
      item.subMenu.length > 0
    ) {
      e.preventDefault()
      // Find the Market Maker submenu item and navigate to its path
      const marketMakerItem = item.subMenu.find(
        (subItem) => subItem.label === 'Market Maker'
      )
      if (marketMakerItem && marketMakerItem.to) {
        navigate(marketMakerItem.to)
      }
      return
    }

    // Normal behavior for expanded sidebar
    if (hasSubMenu) {
      e.preventDefault()
      setIsSubMenuOpen(!isSubMenuOpen)
    }
  }

  const handleSubMenuClick = (subItem: any) => {
    if (subItem.disabled) return
    if (subItem.to) {
      navigate(subItem.to)
    }
  }

  return (
    <div
      className="relative group"
      title={isCollapsed ? item.label : undefined}
    >
      <NavLink
        className={({ isActive }) => `
          flex items-center py-3.5 px-4 rounded-xl transition-all duration-300
          ${
            isActive
              ? 'bg-primary/10 text-white font-semibold border-l-2 border-cyan'
              : 'text-content-secondary hover:text-white hover:bg-surface-overlay/80 hover:shadow-md'
          }
          ${isCollapsed ? 'justify-center' : hasSubMenu ? 'justify-between' : 'justify-start space-x-4'}
          transform hover:translate-x-1 active:scale-[0.98]
        `}
        onClick={handleClick}
        to={item.to}
      >
        <div className={`flex items-center ${!isCollapsed && 'space-x-4'}`}>
          <div className="transition-transform duration-300 group-hover:scale-110">
            {item.icon}
          </div>
          {!isCollapsed && (
            <span className="font-semibold text-base">{item.label}</span>
          )}
        </div>
        {hasSubMenu && !isCollapsed && (
          <ChevronRight
            className={`w-4 h-4 transition-all duration-300 ${isSubMenuOpen ? 'rotate-90 text-primary' : ''}`}
          />
        )}
      </NavLink>

      {hasSubMenu && isSubMenuOpen && !isCollapsed && (
        <div className="pl-4 mt-2 space-y-1.5 animate-fadeInUp">
          {item.subMenu &&
            item.subMenu.map((subItem, index) => (
              <div
                className={`
                flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm cursor-pointer
                transition-all duration-200
                ${subItem.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-overlay/80 hover:text-white hover:translate-x-1'}
                ${location.pathname === subItem.to ? 'bg-gradient-to-r from-primary/15 to-transparent text-primary font-semibold border-l-2 border-primary/50' : 'text-content-secondary'}
              `}
                key={index}
                onClick={() => handleSubMenuClick(subItem)}
              >
                <div className="transition-transform duration-200 hover:scale-110">
                  {subItem.icon}
                </div>
                <span className="font-medium">{subItem.label}</span>
                {subItem.disabled && (
                  <span className="text-[0.6rem] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full ml-auto font-semibold">
                    {t('labels.soon')}
                  </span>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

// Dropdown menu component
const DropdownMenu = ({
  menuRef,
  isOpen,
  setIsOpen,
  title,
  icon,
  items,
  onItemClick,
}: DropdownMenuProps) => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const handleItemClick = (item: NavItem) => {
    setIsOpen(false)

    if (item.action) {
      if (item.action === 'support') {
        // Handle support modal action
        if (onItemClick) onItemClick('support')
      } else {
        dispatch(
          uiSliceActions.setModal({
            assetId: undefined,
            type: item.action as ModalActionType,
          })
        )
      }
    } else if (item.to) {
      navigate(item.to)
    }

    if (onItemClick && item.action !== 'support') {
      onItemClick(item)
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <div
        className="px-3 py-2 rounded-lg cursor-pointer flex items-center space-x-2
                  text-content-secondary hover:text-white hover:bg-surface-elevated/50 transition-all duration-300
                  transform hover:scale-[1.02] active:scale-[0.98]"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="text-primary transition-transform duration-300 hover:scale-110">
          {icon}
        </div>
        <span className="font-medium">{title}</span>
        <ChevronRight
          className={`w-4 h-4 transition-all duration-300 ${isOpen ? 'rotate-90 text-primary' : ''}`}
        />
      </div>

      {isOpen && (
        <div
          className="absolute top-full right-0 mt-2 bg-surface-elevated/95 backdrop-blur-xl border border-divider/30
                       rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50 w-56 animate-scaleIn"
        >
          <div className="py-1">
            {items.map((item, index) => (
              <div
                className="px-4 py-3 flex items-center space-x-3 cursor-pointer
                          hover:bg-gradient-to-r hover:from-primary/10 hover:to-transparent
                          transition-all duration-200 group"
                key={item.label || index}
                onClick={() => handleItemClick(item)}
              >
                <div className="text-primary transition-transform duration-200 group-hover:scale-110">
                  {item.icon}
                </div>
                <span className="text-sm font-medium group-hover:text-white">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// User profile component
const UserProfile = ({
  isCollapsed,
  onSupportClick,
  onLogout,
}: UserProfileProps) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()
  const nodeInfo = nodeApi.endpoints.nodeInfo.useQueryState()
  const accountName = useAppSelector((state) => state.nodeSettings.data.name)

  // Get translated menu items
  const USER_MENU_ITEMS = getUserMenuItems(t)

  useOnClickOutside(menuRef, () => setIsOpen(false))

  const handleMenuItemClick = (item: NavItem) => {
    setIsOpen(false)

    if (item.action === 'support') {
      onSupportClick()
    } else if (item.to) {
      navigate(item.to)
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <div
        className={`flex items-center p-3 cursor-pointer rounded-xl hover:bg-gradient-to-r hover:from-surface-overlay hover:to-surface-overlay/50
          transition-all duration-300 group
          ${isCollapsed ? 'justify-center' : 'justify-between space-x-2'}
          transform hover:scale-[1.02] active:scale-[0.98]`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className={`flex items-center ${!isCollapsed && 'space-x-2'}`}>
          <div className="relative flex-shrink-0">
            <div
              className="w-8 h-8 bg-gradient-to-br from-purple via-purple/80 to-cyan/50 rounded-full flex items-center justify-center
                          shadow-lg shadow-purple/20 ring-2 ring-purple/10 transition-all duration-300
                          group-hover:shadow-xl group-hover:shadow-purple/30 group-hover:ring-purple/20"
            >
              <User className="w-4 h-4 text-white" />
            </div>
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-base
              transition-all duration-300
              ${nodeInfo.isSuccess ? 'bg-green shadow-lg shadow-green/50 animate-pulse' : 'bg-red shadow-lg shadow-red/50'}`}
            ></div>
          </div>

          {!isCollapsed && (
            <>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white group-hover:text-primary transition-colors duration-300">
                  {accountName || t('userProfile.myWallet')}
                </span>
                <span className="text-xs text-content-secondary group-hover:text-content-secondary transition-colors duration-300">
                  {nodeInfo.isSuccess
                    ? t('userProfile.connected')
                    : t('userProfile.disconnected')}
                </span>
              </div>
              <ChevronRight
                className={`w-4 h-4 transition-all duration-300 ${isOpen ? 'rotate-90 text-primary' : 'text-content-secondary group-hover:text-primary'}`}
              />
            </>
          )}
        </div>
      </div>

      {isOpen && (
        <div
          className="absolute bottom-full left-0 mb-2 bg-surface-elevated/95 backdrop-blur-xl border border-divider/30
                      rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50 w-56 animate-scaleIn"
        >
          <div className="p-3 border-b border-divider/20 bg-gradient-to-br from-surface-overlay/50 to-transparent">
            <div className="flex items-center space-x-2">
              <div
                className="w-10 h-10 bg-gradient-to-br from-purple via-purple/80 to-cyan/50 rounded-full flex items-center justify-center
                            shadow-lg shadow-purple/30 ring-2 ring-purple/20"
              >
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">
                  {accountName || t('userProfile.myWallet')}
                </div>
                <div className="text-xs text-content-secondary flex items-center space-x-1">
                  <div
                    className={`w-2 h-2 rounded-full ${nodeInfo.isSuccess ? 'bg-green animate-pulse' : 'bg-red'}`}
                  ></div>
                  <span>
                    {nodeInfo.isSuccess
                      ? t('userProfile.connected')
                      : t('userProfile.disconnected')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="py-1">
            {USER_MENU_ITEMS.map((item) => (
              <div
                className="px-4 py-3 flex items-center space-x-3 cursor-pointer
                          hover:bg-gradient-to-r hover:from-primary/10 hover:to-transparent
                          transition-all duration-200 group"
                key={item.label}
                onClick={() => handleMenuItemClick(item)}
              >
                <div className="text-primary transition-transform duration-200 group-hover:scale-110">
                  {item.icon}
                </div>
                <span className="text-sm font-medium group-hover:text-white">
                  {item.label}
                </span>
              </div>
            ))}

            <div className="border-t border-divider/20 mt-1">
              <LogoutButton onClick={onLogout} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const Layout = (props: Props) => {
  const { t } = useTranslation()
  const [lastDeposit, setLastDeposit] = useState<number | undefined>(undefined)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => localStorage.getItem('sidebarCollapsed') === 'true'
  )
  const [isShuttingDown, setIsShuttingDown] = useState(false)
  const [shutdownStatus, setShutdownStatus] = useState<string>('')
  const [isChannelMenuOpen, setIsChannelMenuOpen] = useState(false)
  const [isTransactionMenuOpen, setIsTransactionMenuOpen] = useState(false)
  const [isSupportMenuOpen, setIsSupportMenuOpen] = useState(false)

  const [showSupportModal, setShowSupportModal] = useState(false)

  const channelMenuRef = useRef(null)
  const transactionMenuRef = useRef(null)
  const supportMenuRef = useRef(null)

  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  // Get translated menu items
  const MAIN_NAV_ITEMS = getMainNavItems(t)
  const CHANNEL_MENU_ITEMS = getChannelMenuItems(t)
  const TRANSACTION_MENU_ITEMS = getTransactionMenuItems(t)
  const SUPPORT_RESOURCES = getSupportResources(t)
  const PAGE_CONFIG = getPageConfig(t)

  const [lock] = nodeApi.endpoints.lock.useMutation()

  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const { toggleNotificationPanel, notifications, addNotification } =
    useNotification()

  useOnClickOutside(channelMenuRef, () => setIsChannelMenuOpen(false))
  useOnClickOutside(transactionMenuRef, () => setIsTransactionMenuOpen(false))
  useOnClickOutside(supportMenuRef, () => setIsSupportMenuOpen(false))

  const nodeInfo = nodeApi.endpoints.nodeInfo.useQueryState()
  const shouldPoll = nodeInfo.isSuccess

  const { data, isFetching, error } = nodeApi.useListTransactionsQuery(
    undefined,
    {
      pollingInterval: 30_000,
      skip: isRetrying || !shouldPoll,
    }
  )

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true)
      const lockResponse = await lock().unwrap()
      await invoke('stop_node')

      if (lockResponse !== undefined || lockResponse === null) {
        dispatch(nodeSettingsActions.resetNodeSettings())
        addNotification({
          autoClose: 3000,
          message: t('modals.logoutSuccessMessage'),
          title: t('modals.logoutSuccess'),
          type: 'success',
        })
        navigate(WALLET_SETUP_PATH)
      } else {
        throw new Error('Node lock unsuccessful')
      }
    } catch (error) {
      addNotification({
        autoClose: 5000,
        message: t('modals.logoutFailedMessage', {
          error: error instanceof Error ? error.message : '',
        }),
        title: t('modals.logoutFailed'),
        type: 'error',
      })
      navigate(WALLET_SETUP_PATH)
    } finally {
      setIsLoggingOut(false)
      setShowLogoutModal(false)
    }
  }

  const openExternalLink = (url: string) => {
    openUrl(url)
  }

  useEffect(() => {
    const checkDeposits = async () => {
      if (!shouldPoll) return
      if (isFetching) return

      if (error && (error as any).status === 403) {
        setIsRetrying(true)
        await sleep(3000)
        setIsRetrying(false)
        return
      }

      const filteredTransactions =
        (data?.transactions || [])
          .filter(
            (tx) =>
              tx.transaction_type === 'User' &&
              new Decimal(tx.received ?? 0).minus(tx.sent ?? 0).gt(0)
          )
          .map((tx) => ({
            amount: new Decimal(tx.received ?? 0)
              .minus(tx.sent ?? 0)
              .toString(),
            asset: 'BTC',
            confirmation_time: tx.confirmation_time,
            txId: tx.txid ?? '',
            type: 'on-chain' as const,
          })) || []

      const highestBlockDeposit =
        filteredTransactions && filteredTransactions.length > 0
          ? filteredTransactions?.reduce((prev, current) =>
              (prev?.confirmation_time?.height ?? 0) >
              (current?.confirmation_time?.height ?? 0)
                ? prev
                : current
            )
          : undefined

      if (lastDeposit === undefined) {
        if (highestBlockDeposit) {
          setLastDeposit(highestBlockDeposit?.confirmation_time?.height ?? 0)
        } else {
          setLastDeposit(0)
        }
        return
      }

      if (
        lastDeposit !== undefined &&
        highestBlockDeposit &&
        (highestBlockDeposit?.confirmation_time?.height ?? 0) > lastDeposit
      ) {
        addNotification({
          autoClose: 5000,
          message: t('notifications.depositReceivedMessage'),
          title: t('notifications.depositReceived'),
          type: 'success',
        })
        setLastDeposit(highestBlockDeposit?.confirmation_time?.height ?? 0)
      }
    }

    checkDeposits()
  }, [data, error, shouldPoll, lastDeposit, isFetching, addNotification])

  useEffect(() => {
    const handleBeforeUnload = () => {
      setIsShuttingDown(true)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    // Listen for Tauri shutdown events
    const setupShutdownListeners = async () => {
      const unlistenTrigger = await listen<string>(
        'trigger-shutdown',
        (event) => {
          setIsShuttingDown(true)
          setShutdownStatus(event.payload)
        }
      )

      const unlistenStatus = await listen<string>(
        'update-shutdown-status',
        (event) => {
          setShutdownStatus(event.payload)
        }
      )

      return () => {
        unlistenTrigger()
        unlistenStatus()
      }
    }

    const cleanup = setupShutdownListeners()

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      cleanup.then((unsubscribe) => unsubscribe())
    }
  }, [])

  const shouldHideNavbar = HIDE_NAVBAR_PATHS.includes(location.pathname)

  const handleTransactionAction = (type: string) => {
    dispatch(
      uiSliceActions.setModal({
        assetId: undefined,
        type: type as ModalActionType,
      })
    )
  }

  return (
    <div className={props.className}>
      <ShutdownAnimation isVisible={isShuttingDown} status={shutdownStatus} />

      {!shouldHideNavbar ? (
        <div className="min-h-screen flex m-0 p-0">
          {/* Sidebar Navigation */}
          <div
            className={`flex flex-col fixed left-0 top-0 h-screen bg-surface-base border-r border-divider/30
                        transition-all duration-300 ease-in-out z-30 shadow-2xl shadow-black/30
                        ${isSidebarCollapsed ? 'w-20' : 'w-72'}`}
          >
            {/* Logo and collapse button */}
            <div className="flex items-center justify-between py-5 px-4 border-b border-divider/20 bg-surface-base">
              <img
                alt="KaleidoSwap"
                className={`cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95
                          ${isSidebarCollapsed ? 'w-10 h-10' : 'h-10 w-auto'}`}
                onClick={() => {
                  navigate(WALLET_SETUP_PATH)
                }}
                src={isSidebarCollapsed ? logo : logoFull}
              />

              <button
                className="p-2 rounded-lg text-content-secondary hover:text-primary
                           hover:bg-surface-overlay/50 transition-all duration-300
                           transform hover:scale-110 active:scale-95
                           ring-1 ring-transparent hover:ring-primary/20 flex-shrink-0"
                onClick={() => {
                  const next = !isSidebarCollapsed
                  setIsSidebarCollapsed(next)
                  localStorage.setItem('sidebarCollapsed', String(next))
                }}
              >
                {isSidebarCollapsed ? (
                  <ChevronRight size={18} />
                ) : (
                  <ChevronLeft size={18} />
                )}
              </button>
            </div>

            {/* Main navigation */}
            <div className="flex-1 overflow-y-auto pt-6 px-4">
              <div className={`space-y-2 ${isSidebarCollapsed ? '' : 'mb-8'}`}>
                {MAIN_NAV_ITEMS.map((item) => {
                  const isActive = location.pathname.startsWith(item.to)
                  return (
                    <SidebarNavItem
                      isActive={isActive}
                      isCollapsed={isSidebarCollapsed}
                      item={item}
                      key={item.to}
                    />
                  )
                })}
              </div>

              {/* Quick action buttons */}
              {!isSidebarCollapsed && (
                <>
                  <div className="mb-8">
                    <h3 className="px-4 text-xs font-bold text-content-tertiary uppercase tracking-wider mb-4">
                      {t('actions.quickActions')}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        className="flex items-center justify-center space-x-2
                                   bg-gradient-to-br from-surface-overlay to-surface-overlay/80 hover:from-cyan/20 hover:to-cyan/5
                                   text-white rounded-xl py-3 px-3 transition-all duration-300
                                   border border-primary/20 hover:border-primary/40 group
                                   shadow-lg shadow-primary/5 hover:shadow-xl hover:shadow-primary/10
                                   transform hover:scale-[1.02] active:scale-[0.98]"
                        onClick={() => handleTransactionAction('deposit')}
                      >
                        <div
                          className="p-1.5 rounded-full bg-primary/10 text-primary group-hover:bg-primary/20
                                      transition-all duration-300 group-hover:scale-110 shadow-lg shadow-primary/20"
                        >
                          <ArrowDownLeft className="w-4 h-4" />
                        </div>
                        <span className="font-semibold text-sm group-hover:text-primary transition-colors duration-300">
                          {t('actions.deposit')}
                        </span>
                      </button>
                      <button
                        className="flex items-center justify-center space-x-2
                                   bg-gradient-to-br from-surface-overlay to-surface-overlay/80 hover:from-purple/20 hover:to-purple/5
                                   text-white rounded-xl py-3 px-3 transition-all duration-300
                                   border border-purple/20 hover:border-purple/40 group
                                   shadow-lg shadow-purple/5 hover:shadow-xl hover:shadow-purple/10
                                   transform hover:scale-[1.02] active:scale-[0.98]"
                        onClick={() => handleTransactionAction('withdraw')}
                      >
                        <div
                          className="p-1.5 rounded-full bg-purple/10 text-purple group-hover:bg-purple/20
                                      transition-all duration-300 group-hover:scale-110 shadow-lg shadow-purple/20"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </div>
                        <span className="font-semibold text-sm group-hover:text-purple transition-colors duration-300">
                          {t('actions.withdraw')}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Channel management section */}
                  <div className="mb-6">
                    <h3 className="px-4 text-xs font-bold text-content-tertiary uppercase tracking-wider mb-4">
                      {t('navigation.channels')}
                    </h3>
                    <div className="space-y-1.5">
                      {CHANNEL_MENU_ITEMS.map((item) => (
                        <NavLink
                          className={({ isActive }) => `
                              flex items-center space-x-4 px-4 py-3 rounded-xl text-sm group
                              ${
                                isActive
                                  ? 'bg-gradient-to-r from-primary/15 to-transparent text-primary font-semibold border-l-2 border-cyan shadow-lg shadow-primary/5'
                                  : 'text-content-secondary hover:text-white hover:bg-surface-overlay/80 hover:translate-x-1'
                              }
                              transition-all duration-300 transform active:scale-[0.98]
                            `}
                          key={item.to}
                          to={item.to}
                        >
                          <div className="transition-transform duration-300 group-hover:scale-110">
                            {item.icon}
                          </div>
                          <span className="font-medium">{item.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User profile section */}
            <div className="p-4 border-t border-divider/20 bg-surface-base">
              <UserProfile
                isCollapsed={isSidebarCollapsed}
                onLogout={() => setShowLogoutModal(true)}
                onSupportClick={() => setShowSupportModal(true)}
              />
            </div>

            {/* App version info */}
            <div className="px-4 pb-4 relative bg-surface-base">
              <AppVersion
                className="border-t border-divider/10 pt-3"
                isCollapsed={isSidebarCollapsed}
              />
            </div>
          </div>

          {/* Main content */}
          <main
            className={`flex-1 flex flex-col min-h-screen bg-surface-raised transition-all duration-300
                        ${isSidebarCollapsed ? 'ml-20' : 'ml-72'}`}
          >
            {/* Top bar with page title and notifications */}
            <div
              className="sticky top-0 z-30 bg-surface-base border-b border-divider/20 px-6 py-4
                          shadow-lg shadow-black/20"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4 animate-fadeInUp">
                  {(() => {
                    // Get the current page icon and title
                    const mainNavItem = MAIN_NAV_ITEMS.find((item) =>
                      location.pathname.startsWith(item.to)
                    )

                    const pageConfig = PAGE_CONFIG[location.pathname]
                    const icon = pageConfig?.icon || mainNavItem?.icon
                    const title =
                      pageConfig?.title || mainNavItem?.label || 'Dashboard'

                    return (
                      <>
                        <div
                          className="p-3 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl text-primary
                                      shadow-lg shadow-primary/10 ring-1 ring-primary/20"
                        >
                          {icon}
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">
                          {title}
                        </h1>
                      </>
                    )
                  })()}
                </div>

                <div className="flex items-center space-x-2">
                  {/* Support button in header */}
                  <button
                    aria-label="Support"
                    className="p-3 text-content-secondary hover:text-primary rounded-xl hover:bg-surface-overlay/50
                             transition-all duration-300 transform hover:scale-110 active:scale-95
                             ring-1 ring-divider/10 hover:ring-primary/30"
                    onClick={() => setShowSupportModal(true)}
                  >
                    <HelpCircle className="w-5 h-5" />
                  </button>

                  {/* Manual update check button */}
                  {/* <button
                    aria-label="Check for updates"
                    className={`relative p-2 rounded-lg hover:bg-surface-overlay transition-colors ${
                      hasUpdateNotification
                        ? 'text-amber-400 hover:text-amber-300'
                        : 'text-content-secondary hover:text-white'
                    }`}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      console.log(
                        `[${new Date().toISOString()}] Update button clicked, hasSkippedUpdate =`,
                        ', hasUpdateNotification =',
                        hasUpdateNotification
                      )
                      checkForUpdates()
                    }}
                    title={
                      hasUpdateNotification
                        ? 'Update available - check notifications'
                        : 'Check for updates'
                    }
                  >
                    <RefreshCw className="w-5 h-5" />
                    {hasUpdateNotification && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                    )}
                  </button> */}

                  {/* Notifications bell */}
                  <button
                    aria-label="Toggle notifications"
                    className="relative p-3 text-content-secondary hover:text-primary rounded-xl hover:bg-surface-overlay/50
                             transition-all duration-300 transform hover:scale-110 active:scale-95
                             ring-1 ring-divider/10 hover:ring-primary/30"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      toggleNotificationPanel()
                    }}
                  >
                    <Bell className="w-5 h-5" />
                    {notifications.length > 0 && (
                      <span
                        className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-gradient-to-br from-cyan to-cyan/80
                                   text-white text-xs font-bold flex items-center justify-center rounded-full
                                   shadow-lg shadow-primary/30 animate-pulse ring-2 ring-surface-base"
                      >
                        {notifications.length}
                      </span>
                    )}
                  </button>

                  {/* Quick action dropdown menus - only show on smaller screens */}
                  <div className="md:hidden flex items-center space-x-2">
                    <DropdownMenu
                      icon={<Activity className="w-5 h-5" />}
                      isOpen={isChannelMenuOpen}
                      items={CHANNEL_MENU_ITEMS}
                      menuRef={channelMenuRef}
                      onItemClick={() => {}} // Add empty function to satisfy the type
                      setIsOpen={setIsChannelMenuOpen}
                      title={t('navigation.channels')}
                    />

                    <DropdownMenu
                      icon={<ArrowDownLeft className="w-5 h-5" />}
                      isOpen={isTransactionMenuOpen}
                      items={TRANSACTION_MENU_ITEMS}
                      menuRef={transactionMenuRef}
                      onItemClick={(item: any) =>
                        handleTransactionAction(item.action)
                      }
                      setIsOpen={setIsTransactionMenuOpen}
                      title={t('actions.quickActions')}
                    />

                    {/* Support dropdown for mobile */}
                    <DropdownMenu
                      icon={<HelpCircle className="w-5 h-5" />}
                      isOpen={isSupportMenuOpen}
                      items={[
                        {
                          action: 'support',
                          icon: <HelpCircle className="w-4 h-4" />,
                          label: t('navigation.getHelpSupport'),
                        },
                        ...SUPPORT_RESOURCES.map((resource) => ({
                          icon: resource.icon,
                          label: resource.name,
                          to: '#', // Placeholder - we'll handle this in the click handler
                          url: resource.url, // Custom property to store the URL
                        })),
                      ]}
                      menuRef={supportMenuRef}
                      onItemClick={(item: NavItem | string) => {
                        if (item === 'support') {
                          setShowSupportModal(true)
                        } else if (typeof item !== 'string' && item.url) {
                          openExternalLink(item.url)
                        }
                      }}
                      setIsOpen={setIsSupportMenuOpen}
                      title={t('navigation.helpSupport')}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Main content area */}
            <div className="flex-1 overflow-hidden p-6">{props.children}</div>
          </main>
        </div>
      ) : (
        // For setup and other paths that hide the navbar
        <div className="min-h-screen">{props.children}</div>
      )}

      {/* Support Modal */}
      <SupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />

      {/* Logout Modal */}
      <LogoutModal
        isLoggingOut={isLoggingOut}
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
      />

      <ToastContainer
        autoClose={5000}
        closeOnClick={false}
        draggable={false}
        hideProgressBar={false}
        newestOnTop={false}
        pauseOnFocusLoss={false}
        pauseOnHover={true}
        position="bottom-right"
        rtl={false}
        theme="dark"
      />

      {/* Add LayoutModal for deposit/withdraw functionality */}
      <LayoutModal />
    </div>
  )
}
