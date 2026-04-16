import { TFunction } from 'i18next'
import {
  FileText,
  HelpCircle,
  MessageCircle,
  Github,
  Plus,
  ShoppingCart,
  Activity,
  Settings,
  Store,
  Zap,
  Home,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  HardDriveDownload,
  Target,
  TrendingUp,
} from 'lucide-react'
import React from 'react'

import {
  TRADE_PATH,
  TRADE_MARKET_MAKER_PATH,
  TRADE_MANUAL_PATH,
  TRADE_DCA_PATH,
  TRADE_LIMIT_PATH,
  WALLET_HISTORY_DEPOSITS_PATH,
  WALLET_HISTORY_WITHDRAWALS_PATH,
  WALLET_HISTORY_TRADES_PATH,
  WALLET_HISTORY_ASSETS_PATH,
  WALLET_HISTORY_CHANNEL_ORDERS_PATH,
  WALLET_HISTORY_PATH,
  WALLET_SETUP_PATH,
  WALLET_RESTORE_PATH,
  WALLET_UNLOCK_PATH,
  WALLET_REMOTE_PATH,
  WALLET_INIT_PATH,
  WALLET_DASHBOARD_PATH,
  SETTINGS_PATH,
  CHANNELS_PATH,
  CREATE_NEW_CHANNEL_PATH,
  ORDER_CHANNEL_PATH,
} from '../../app/router/paths'

// Define types for navigation items
export interface NavItem {
  label: string
  icon: React.ReactNode
  to?: string
  matchPath?: string
  action?: string
  url?: string
  subMenu?: {
    icon: React.ReactNode
    label: string
    to?: string
    mode?: string
    disabled?: boolean
  }[]
}

// Define main navigation items with icons
export const getMainNavItems = (t: TFunction) => [
  {
    icon: <Home className="w-5 h-5" />,
    label: t('navigation.dashboard'),
    matchPath: WALLET_DASHBOARD_PATH,
    to: WALLET_DASHBOARD_PATH,
  },
  {
    icon: <Zap className="w-5 h-5" />,
    label: t('navigation.trade'),
    matchPath: TRADE_PATH,
    to: TRADE_MARKET_MAKER_PATH,
  },
  {
    icon: <Clock className="w-5 h-5" />,
    label: t('navigation.history'),
    matchPath: WALLET_HISTORY_PATH,
    to: WALLET_HISTORY_PATH,
  },
  {
    icon: <TrendingUp className="h-6 w-6" />,
    label: t('navigation.dca', 'DCA'),
    matchPath: TRADE_DCA_PATH,
    to: TRADE_DCA_PATH,
  },
  {
    icon: <Activity className="w-5 h-5" />,
    label: t('navigation.channels'),
    matchPath: CHANNELS_PATH,
    to: CHANNELS_PATH,
  },
]

// Keep the old export for backward compatibility (will be deprecated)
export const MAIN_NAV_ITEMS = getMainNavItems(
  ((key: string) => key.split('.').pop() || key) as any
)

// Channel menu items
export const getChannelMenuItems = (t: TFunction) => [
  {
    icon: <Plus className="w-4 h-4" />,
    label: t('channels.createNewChannel'),
    to: CREATE_NEW_CHANNEL_PATH,
  },
  {
    icon: <ShoppingCart className="w-4 h-4" />,
    label: t('channels.buyAChannel'),
    to: ORDER_CHANNEL_PATH,
  },
  {
    icon: <Settings className="w-4 h-4" />,
    label: t('channels.manageChannels'),
    to: CHANNELS_PATH,
  },
]

export const CHANNEL_MENU_ITEMS = getChannelMenuItems(
  ((key: string) => key.split('.').pop() || key) as any
)

// Transaction menu items
export const getTransactionMenuItems = (t: TFunction) => [
  {
    action: 'deposit',
    icon: (
      <div className="p-1 rounded-full bg-primary/10 text-primary">
        <ArrowDownLeft className="w-4 h-4" />
      </div>
    ),
    label: t('actions.deposit'),
  },
  {
    action: 'withdraw',
    icon: (
      <div className="p-1 rounded-full bg-purple/10 text-purple">
        <ArrowUpRight className="w-4 h-4" />
      </div>
    ),
    label: t('actions.withdraw'),
  },
]

export const TRANSACTION_MENU_ITEMS = getTransactionMenuItems(
  ((key: string) => key.split('.').pop() || key) as any
)

// User settings menu items
export const getUserMenuItems = (t: TFunction) => [
  {
    icon: <Settings className="w-4 h-4" />,
    label: t('navigation.settings'),
    to: SETTINGS_PATH,
  },
  {
    action: 'backup',
    icon: <HardDriveDownload className="w-4 h-4" />,
    label: t('settings.backupWallet'),
  },
  {
    action: 'support',
    icon: <HelpCircle className="w-4 h-4" />,
    label: t('navigation.helpSupport'),
  },
]

export const USER_MENU_ITEMS = getUserMenuItems(
  ((key: string) => key.split('.').pop() || key) as any
)

// Support resources for the Help menu
export const getSupportResources = (t: TFunction) => [
  {
    description: t('support.documentationDesc'),
    icon: <FileText className="w-4 h-4" />,
    name: t('support.documentation'),
    url: 'https://docs.kaleidoswap.com',
  },
  {
    description: t('support.faqDesc'),
    icon: <HelpCircle className="w-4 h-4" />,
    name: t('support.faq'),
    url: 'https://docs.kaleidoswap.com/desktop-app/faq',
  },
  {
    description: t('support.telegramGroupDesc'),
    icon: <MessageCircle className="w-4 h-4" />,
    name: t('support.telegramGroup'),
    url: 'https://t.me/kaleidoswap',
  },
  {
    description: t('support.githubIssuesDesc'),
    icon: <Github className="w-4 h-4" />,
    name: t('support.githubIssues'),
    url: 'https://github.com/kaleidoswap/desktop-app',
  },
]

export const SUPPORT_RESOURCES = getSupportResources(
  ((key: string) => key.split('.').pop() || key) as any
)

// Page configuration mapping
export const getPageConfig = (t: TFunction) => ({
  [CHANNELS_PATH]: {
    icon: <Activity className="w-5 h-5" />,
    title: t('navigation.channels'),
  },
  [CREATE_NEW_CHANNEL_PATH]: {
    icon: <Plus className="w-5 h-5" />,
    title: t('channels.createNewChannel'),
  },
  [ORDER_CHANNEL_PATH]: {
    icon: <ShoppingCart className="w-5 h-5" />,
    title: t('channels.buyAChannel'),
  },
  [SETTINGS_PATH]: {
    icon: <Settings className="w-5 h-5" />,
    title: t('navigation.settings'),
  },
  [TRADE_DCA_PATH]: {
    icon: <TrendingUp className="h-9 w-9" />,
    title: t('navigation.dca', 'DCA'),
  },
  [TRADE_LIMIT_PATH]: {
    icon: <Target className="w-5 h-5" />,
    title: t('navigation.limitOrders', 'Limit Orders'),
  },
  [TRADE_MANUAL_PATH]: {
    icon: <Zap className="w-5 h-5" />,
    title: t('navigation.manualSwaps'),
  },
  [TRADE_MARKET_MAKER_PATH]: {
    icon: <Store className="w-5 h-5" />,
    title: t('navigation.marketMaker'),
  },
  [TRADE_PATH]: {
    icon: <Zap className="w-5 h-5" />,
    title: t('navigation.trade'),
  },
  [WALLET_DASHBOARD_PATH]: {
    icon: <Home className="w-5 h-5" />,
    title: t('navigation.dashboard'),
  },
  [WALLET_HISTORY_ASSETS_PATH]: {
    icon: <Activity className="w-5 h-5" />,
    title: t('navigation.history'),
  },
  [WALLET_HISTORY_CHANNEL_ORDERS_PATH]: {
    icon: <ShoppingCart className="w-5 h-5" />,
    title: t('navigation.history'),
  },
  [WALLET_HISTORY_DEPOSITS_PATH]: {
    icon: <ArrowDownLeft className="w-5 h-5" />,
    title: t('navigation.history'),
  },
  [WALLET_HISTORY_PATH]: {
    icon: <Clock className="w-5 h-5" />,
    title: t('navigation.history'),
  },
  [WALLET_HISTORY_TRADES_PATH]: {
    icon: <Zap className="w-5 h-5" />,
    title: t('navigation.history'),
  },
  [WALLET_HISTORY_WITHDRAWALS_PATH]: {
    icon: <ArrowUpRight className="w-5 h-5" />,
    title: t('navigation.history'),
  },
})

export const PAGE_CONFIG = getPageConfig(
  ((key: string) => key.split('.').pop() || key) as any
)

export const HIDE_NAVBAR_PATHS = [
  WALLET_SETUP_PATH,
  WALLET_RESTORE_PATH,
  WALLET_UNLOCK_PATH,
  WALLET_REMOTE_PATH,
  WALLET_INIT_PATH,
]
