import { TFunction } from 'i18next'
import {
  FileText,
  HelpCircle,
  MessageCircle,
  MessageSquare,
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
  Link as LinkIcon,
  Bot,
  Brain,
  Droplets,
  Tag,
  ArrowLeftRight,
  Radio,
  LayoutDashboard,
} from 'lucide-react'
import React from 'react'

import { DcaBagIcon } from '../icons/DcaBagIcon'

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
  KALEIDO_MIND_AGENT_PATH,
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
            icon: <Radio className="w-4 h-4" />,
            label: t('navigation.nostrP2P', 'Nostr P2P'),
            to: TRADE_NOSTR_P2P_PATH,
          },
          {
            icon: <DcaBagIcon className="h-4 w-4" />,
            label: t('navigation.dca', 'DCA'),
            to: TRADE_DCA_PATH,
          },
          {
            icon: <Target className="w-4 h-4" />,
            label: t('navigation.limitOrders', 'Limit Orders'),
            to: TRADE_LIMIT_PATH,
          },
        ],
        to: TRADE_MARKET_MAKER_PATH,
      },
      {
        icon: <Clock className="w-5 h-5" />,
        label: t('navigation.history'),
        matchPath: WALLET_HISTORY_PATH,
        to: WALLET_HISTORY_PATH,
      },
      {
        icon: <Droplets className="w-5 h-5" />,
        label: t('navigation.liquidity', 'Liquidity'),
        matchPath: CHANNELS_PATH,
        subMenu: [
          {
            icon: <Activity className="w-4 h-4" />,
            label: t('channels.manageChannels'),
            to: CHANNELS_PATH,
          },
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
            disabled: true,
            icon: <Tag className="w-4 h-4" />,
            label: t('liquidity.sell', 'Sell'),
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
            icon: <Bot className="w-4 h-4" />,
            label: t('navigation.agent', 'Agent'),
            to: KALEIDO_MIND_AGENT_PATH,
          },
          {
            // Brain hosts Models + Skills management inline.
            icon: <LayoutDashboard className="w-4 h-4" />,
            label: t('navigation.brain', 'Brain'),
            to: KALEIDO_MIND_BRAIN_PATH,
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
    label: t('navigation.nwc', 'App Connections (NWC)'),
    to: NWC_PATH,
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
  [NWC_PATH]: {
    icon: <LinkIcon className="w-5 h-5" />,
    title: t('navigation.nwc', 'App Connections (NWC)'),
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
    icon: <DcaBagIcon className="h-9 w-9" />,
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
