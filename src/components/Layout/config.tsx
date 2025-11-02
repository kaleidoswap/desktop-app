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
  Users,
  Home,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react'
import React from 'react'

import {
  TRADE_PATH,
  TRADE_MARKET_MAKER_PATH,
  TRADE_MANUAL_PATH,
  TRADE_NOSTR_P2P_PATH,
  TRADE_AMM_PATH,
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
export const MAIN_NAV_ITEMS = [
  {
    icon: <Home className="w-5 h-5" />,
    label: 'Dashboard',
    matchPath: WALLET_DASHBOARD_PATH,
    to: WALLET_DASHBOARD_PATH,
  },
  {
    icon: <Zap className="w-5 h-5" />,
    label: 'Trade',
    matchPath: TRADE_PATH,
    subMenu: [
      {
        icon: <Store className="w-4 h-4" />,
        label: 'Market Maker',
        to: TRADE_MARKET_MAKER_PATH,
      },
      {
        icon: <Zap className="w-4 h-4" />,
        label: 'Manual Swaps',
        to: TRADE_MANUAL_PATH,
      },
      {
        icon: <Activity className="w-4 h-4" />,
        label: 'AMM (Spark)',
        to: TRADE_AMM_PATH,
      },
      {
        disabled: true,
        icon: <Users className="w-4 h-4" />,
        label: 'Nostr P2P',
        to: TRADE_NOSTR_P2P_PATH,
      },
    ],
    to: TRADE_PATH,
  },
  {
    icon: <Clock className="w-5 h-5" />,
    label: 'History',
    matchPath: WALLET_HISTORY_PATH,
    to: WALLET_HISTORY_PATH,
  },
  {
    icon: <Activity className="w-5 h-5" />,
    label: 'Channels',
    matchPath: CHANNELS_PATH,
    to: CHANNELS_PATH,
  },
]

// Channel menu items
export const CHANNEL_MENU_ITEMS = [
  {
    icon: <Plus className="w-4 h-4" />,
    label: 'Create New Channel',
    to: CREATE_NEW_CHANNEL_PATH,
  },
  {
    icon: <ShoppingCart className="w-4 h-4" />,
    label: 'Buy a Channel',
    to: ORDER_CHANNEL_PATH,
  },
  {
    icon: <Settings className="w-4 h-4" />,
    label: 'Manage Channels',
    to: CHANNELS_PATH,
  },
]

// Transaction menu items
export const TRANSACTION_MENU_ITEMS = [
  {
    action: 'deposit',
    icon: (
      <div className="p-1 rounded-full bg-cyan/10 text-cyan">
        <ArrowDownLeft className="w-4 h-4" />
      </div>
    ),
    label: 'Deposit',
  },
  {
    action: 'withdraw',
    icon: (
      <div className="p-1 rounded-full bg-purple/10 text-purple">
        <ArrowUpRight className="w-4 h-4" />
      </div>
    ),
    label: 'Withdraw',
  },
]

// User settings menu items
export const USER_MENU_ITEMS = [
  {
    icon: <Settings className="w-4 h-4" />,
    label: 'Settings',
    to: SETTINGS_PATH,
  },
  {
    action: 'support',
    icon: <HelpCircle className="w-4 h-4" />,
    label: 'Help & Support',
  },
]

// Support resources for the Help menu
export const SUPPORT_RESOURCES = [
  {
    description: 'Read our comprehensive guides and tutorials',
    icon: <FileText className="w-4 h-4" />,
    name: 'Documentation',
    url: 'https://docs.kaleidoswap.com',
  },
  {
    description: 'Frequently asked questions',
    icon: <HelpCircle className="w-4 h-4" />,
    name: 'FAQ',
    url: 'https://docs.kaleidoswap.com/desktop-app/faq',
  },
  {
    description: 'Join our community for support',
    icon: <MessageCircle className="w-4 h-4" />,
    name: 'Telegram Group',
    url: 'https://t.me/kaleidoswap',
  },
  {
    description: 'Report bugs or request features',
    icon: <Github className="w-4 h-4" />,
    name: 'GitHub Issues',
    url: 'https://github.com/kaleidoswap/desktop-app',
  },
]

// Page configuration mapping
export const PAGE_CONFIG = {
  [CHANNELS_PATH]: {
    icon: <Activity className="w-5 h-5" />,
    title: 'Channels',
  },
  [CHANNELS_PATH]: {
    icon: <Activity className="w-5 h-5" />,
    title: 'Channels',
  },
  [CREATE_NEW_CHANNEL_PATH]: {
    icon: <Plus className="w-5 h-5" />,
    title: 'Create New Channel',
  },
  [ORDER_CHANNEL_PATH]: {
    icon: <ShoppingCart className="w-5 h-5" />,
    title: 'Buy a Channel',
  },
  [SETTINGS_PATH]: {
    icon: <Settings className="w-5 h-5" />,
    title: 'Settings',
  },
  [TRADE_AMM_PATH]: {
    icon: <Activity className="w-5 h-5" />,
    title: 'AMM (Spark)',
  },
  [TRADE_MANUAL_PATH]: {
    icon: <Zap className="w-5 h-5" />,
    title: 'Manual Swaps',
  },
  [TRADE_MARKET_MAKER_PATH]: {
    icon: <Store className="w-5 h-5" />,
    title: 'Market Maker',
  },
  [TRADE_PATH]: {
    icon: <Zap className="w-5 h-5" />,
    title: 'Trade',
  },
  [WALLET_DASHBOARD_PATH]: {
    icon: <Home className="w-5 h-5" />,
    title: 'Dashboard',
  },
  [WALLET_HISTORY_ASSETS_PATH]: {
    icon: <Clock className="w-5 h-5" />,
    title: 'History',
  },
  [WALLET_HISTORY_CHANNEL_ORDERS_PATH]: {
    icon: <Clock className="w-5 h-5" />,
    title: 'History',
  },
  [WALLET_HISTORY_DEPOSITS_PATH]: {
    icon: <Clock className="w-5 h-5" />,
    title: 'History',
  },
  [WALLET_HISTORY_PATH]: {
    icon: <Clock className="w-5 h-5" />,
    title: 'History',
  },
  [WALLET_HISTORY_TRADES_PATH]: {
    icon: <Clock className="w-5 h-5" />,
    title: 'History',
  },
  [WALLET_HISTORY_WITHDRAWALS_PATH]: {
    icon: <Clock className="w-5 h-5" />,
    title: 'History',
  },
}

export const HIDE_NAVBAR_PATHS = [
  WALLET_SETUP_PATH,
  WALLET_RESTORE_PATH,
  WALLET_UNLOCK_PATH,
  WALLET_REMOTE_PATH,
  WALLET_INIT_PATH,
]
