import { TFunction } from 'i18next'
import {
  FileText,
  HelpCircle,
  MessageCircle,
  MessageSquare,
  Github,
  Plus,
  PlusCircle,
  ShoppingCart,
  SlidersHorizontal,
  Settings,
  Store,
  Zap,
  Home,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  HardDriveDownload,
  Target,
  Link as LinkIcon,
  Bot,
  Brain,
  Droplets,
  Tag,
  TrendingUp,
  ArrowLeftRight,
  Radio,
  LayoutDashboard,
  Download,
  Upload,
  Coins,
  ArrowDownUp,
} from 'lucide-react'
import React from 'react'

import {
  TRADE_PATH,
  TRADE_MARKET_MAKER_PATH,
  TRADE_MANUAL_PATH,
  TRADE_NOSTR_P2P_PATH,
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
  NWC_PATH,
  CHANNELS_PATH,
  CREATE_NEW_CHANNEL_PATH,
  ORDER_CHANNEL_PATH,
  KALEIDO_MIND_PATH,
  KALEIDO_MIND_BRAIN_PATH,
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

// A labeled group of nav items shown as a category in the sidebar.
export interface NavSection {
  key: 'node' | 'mind'
  label: string
  items: NavItem[]
}

// Sidebar navigation, grouped into the two co-equal sections: Node and Mind.
export const getNavSections = (t: TFunction): NavSection[] => [
  {
    items: [
      {
        icon: <Home className="w-5 h-5" />,
        label: t('navigation.dashboard'),
        to: WALLET_DASHBOARD_PATH,
      },
      {
        icon: <Zap className="w-5 h-5" />,
        label: t('navigation.trade'),
        matchPath: TRADE_PATH,
        subMenu: [
          {
            icon: <Store className="w-4 h-4" />,
            label: t('navigation.marketMaker'),
            to: TRADE_MARKET_MAKER_PATH,
          },
          {
            icon: <ArrowLeftRight className="w-4 h-4" />,
            label: t('navigation.manualSwaps'),
            to: TRADE_MANUAL_PATH,
          },
          {
            icon: <TrendingUp className="h-4 w-4" />,
            label: t('navigation.dca', 'DCA'),
            to: TRADE_DCA_PATH,
          },
          {
            icon: <Target className="w-4 h-4" />,
            label: t('navigation.limitOrders', 'Limit Orders'),
            to: TRADE_LIMIT_PATH,
          },
          {
            disabled: true,
            icon: <Radio className="w-4 h-4" />,
            label: t('navigation.nostrP2P', 'Nostr P2P'),
          },
        ],
        to: TRADE_MARKET_MAKER_PATH,
      },
      {
        icon: <Clock className="w-5 h-5" />,
        label: t('navigation.history'),
        matchPath: WALLET_HISTORY_PATH,
        subMenu: [
          {
            icon: <Download className="w-4 h-4" />,
            label: t('history.deposits'),
            to: WALLET_HISTORY_DEPOSITS_PATH,
          },
          {
            icon: <Upload className="w-4 h-4" />,
            label: t('history.paymentsWithdrawals'),
            to: WALLET_HISTORY_WITHDRAWALS_PATH,
          },
          {
            icon: <ArrowLeftRight className="w-4 h-4" />,
            label: t('history.swaps'),
            to: WALLET_HISTORY_TRADES_PATH,
          },
          {
            icon: <Coins className="w-4 h-4" />,
            label: t('history.assets'),
            to: WALLET_HISTORY_ASSETS_PATH,
          },
          {
            icon: <ArrowDownUp className="w-4 h-4" />,
            label: t('history.channelOrders'),
            to: WALLET_HISTORY_CHANNEL_ORDERS_PATH,
          },
        ],
        to: WALLET_HISTORY_DEPOSITS_PATH,
      },
      {
        icon: <Droplets className="w-5 h-5" />,
        label: t('navigation.liquidity', 'Liquidity'),
        matchPath: CHANNELS_PATH,
        subMenu: [
          {
            icon: <SlidersHorizontal className="w-4 h-4" />,
            label: t('channels.manageChannels'),
            to: CHANNELS_PATH,
          },
          {
            icon: <PlusCircle className="w-4 h-4" />,
            label: t('channels.createNewChannel'),
            to: CREATE_NEW_CHANNEL_PATH,
          },
          {
            icon: <ShoppingCart className="w-4 h-4" />,
            label: t('channels.buyAChannel'),
            to: ORDER_CHANNEL_PATH,
          },
          {
            disabled: true,
            icon: <Tag className="w-4 h-4" />,
            label: t('liquidity.sellChannels', 'Sell Channels'),
          },
        ],
        to: CHANNELS_PATH,
      },
    ],
    key: 'node',
    label: t('navigation.node', 'Node'),
  },
  {
    items: [
      {
        icon: <Brain className="w-5 h-5" />,
        label: t('navigation.kaleidoMind', 'KaleidoMind'),
        matchPath: KALEIDO_MIND_PATH,
        subMenu: [
          {
            icon: <MessageSquare className="w-4 h-4" />,
            label: t('navigation.chat', 'Chat'),
            to: KALEIDO_MIND_PATH,
          },
          {
            // Brain hosts Models + Skills management inline.
            icon: <LayoutDashboard className="w-4 h-4" />,
            label: t('navigation.brain', 'Brain'),
            to: KALEIDO_MIND_BRAIN_PATH,
          },
          {
            disabled: true,
            icon: <Bot className="w-4 h-4" />,
            label: t('navigation.agent', 'Agent'),
          },
        ],
        to: KALEIDO_MIND_PATH,
      },
    ],
    key: 'mind',
    label: t('navigation.mind', 'Mind'),
  },
]

// Flattened nav items — used for page-title resolution in the header.
export const getMainNavItems = (t: TFunction): NavItem[] =>
  getNavSections(t).flatMap((section) => section.items)

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
    icon: <LinkIcon className="w-4 h-4" />,
    label: t('navigation.nwc', 'App Connections'),
    to: NWC_PATH,
  },
  {
    action: 'backup',
    icon: <HardDriveDownload className="w-4 h-4" />,
    label: t('settings.backupWallet'),
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
    icon: <Droplets className="w-5 h-5" />,
    title: t('navigation.liquidity', 'Liquidity'),
  },
  [CREATE_NEW_CHANNEL_PATH]: {
    icon: <Droplets className="w-5 h-5" />,
    title: t('navigation.liquidity', 'Liquidity'),
  },
  [NWC_PATH]: {
    icon: <LinkIcon className="w-5 h-5" />,
    title: t('navigation.nwc', 'App Connections'),
  },
  [ORDER_CHANNEL_PATH]: {
    icon: <Droplets className="w-5 h-5" />,
    title: t('navigation.liquidity', 'Liquidity'),
  },
  [SETTINGS_PATH]: {
    icon: <Settings className="w-5 h-5" />,
    title: t('navigation.settings'),
  },
  [TRADE_DCA_PATH]: {
    icon: <Zap className="w-5 h-5" />,
    title: t('navigation.trading', 'Trading'),
  },
  [TRADE_LIMIT_PATH]: {
    icon: <Zap className="w-5 h-5" />,
    title: t('navigation.trading', 'Trading'),
  },
  [TRADE_MANUAL_PATH]: {
    icon: <Zap className="w-5 h-5" />,
    title: t('navigation.trading', 'Trading'),
  },
  [TRADE_MARKET_MAKER_PATH]: {
    icon: <Zap className="w-5 h-5" />,
    title: t('navigation.trading', 'Trading'),
  },
  [TRADE_NOSTR_P2P_PATH]: {
    icon: <Zap className="w-5 h-5" />,
    title: t('navigation.trading', 'Trading'),
  },
  [TRADE_PATH]: {
    icon: <Zap className="w-5 h-5" />,
    title: t('navigation.trading', 'Trading'),
  },
  [WALLET_DASHBOARD_PATH]: {
    icon: <Home className="w-5 h-5" />,
    title: t('navigation.dashboard'),
  },
  [WALLET_HISTORY_ASSETS_PATH]: {
    icon: <Clock className="w-5 h-5" />,
    title: t('navigation.history'),
  },
  [WALLET_HISTORY_CHANNEL_ORDERS_PATH]: {
    icon: <Clock className="w-5 h-5" />,
    title: t('navigation.history'),
  },
  [WALLET_HISTORY_DEPOSITS_PATH]: {
    icon: <Clock className="w-5 h-5" />,
    title: t('navigation.history'),
  },
  [WALLET_HISTORY_PATH]: {
    icon: <Clock className="w-5 h-5" />,
    title: t('navigation.history'),
  },
  [WALLET_HISTORY_TRADES_PATH]: {
    icon: <Clock className="w-5 h-5" />,
    title: t('navigation.history'),
  },
  [WALLET_HISTORY_WITHDRAWALS_PATH]: {
    icon: <Clock className="w-5 h-5" />,
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
