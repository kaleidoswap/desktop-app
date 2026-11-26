import { TFunction } from 'i18next'
import {
  Clock,
  Droplets,
  Home,
  LayoutDashboard,
  Link as LinkIcon,
  MessageSquare,
  Zap,
} from 'lucide-react'
import React from 'react'

import {
  CHANNELS_PATH,
  CREATEUTXOS_PATH,
  CREATE_NEW_CHANNEL_PATH,
  KALEIDO_MIND_AGENT_PATH,
  KALEIDO_MIND_BRAIN_PATH,
  KALEIDO_MIND_CHAT_PATH,
  KALEIDO_MIND_MODELS_PATH,
  KALEIDO_MIND_PATH,
  KALEIDO_MIND_SKILLS_PATH,
  NWC_PATH,
  ORDER_CHANNEL_PATH,
  TRADE_DCA_PATH,
  TRADE_LIMIT_PATH,
  TRADE_MANUAL_PATH,
  TRADE_MARKET_MAKER_PATH,
  TRADE_NOSTR_P2P_PATH,
  TRADE_PATH,
  WALLET_DASHBOARD_PATH,
  WALLET_HISTORY_DEPOSITS_PATH,
  WALLET_HISTORY_PATH,
  WALLET_INIT_PATH,
  WALLET_REMOTE_PATH,
  WALLET_RESTORE_PATH,
  WALLET_SETUP_PATH,
  WALLET_UNLOCK_PATH,
} from '../../app/router/paths'

interface SectionLink {
  label: string
  icon: React.ReactNode
  to: string
  otherPaths?: string[]
  parentPath?: string
}

export function matchesSectionLink(link: SectionLink, pathname: string) {
  return (
    pathname === link.to ||
    link.otherPaths?.includes(pathname) ||
    (link.parentPath !== undefined &&
      (pathname === link.parentPath ||
        pathname.startsWith(`${link.parentPath}/`)))
  )
}

export const getNodeLinks = (t: TFunction): SectionLink[] => [
  {
    icon: <Home />,
    label: t('navigation.dashboard'),
    otherPaths: [CREATEUTXOS_PATH],
    to: WALLET_DASHBOARD_PATH,
  },
  {
    icon: <Zap />,
    label: t('navigation.trade'),
    otherPaths: [
      TRADE_PATH,
      TRADE_MANUAL_PATH,
      TRADE_DCA_PATH,
      TRADE_LIMIT_PATH,
      TRADE_NOSTR_P2P_PATH,
    ],
    to: TRADE_MARKET_MAKER_PATH,
  },
  {
    icon: <Clock />,
    label: t('navigation.history'),
    parentPath: WALLET_HISTORY_PATH,
    to: WALLET_HISTORY_DEPOSITS_PATH,
  },
  {
    icon: <Droplets />,
    label: t('navigation.channels'),
    otherPaths: [CREATE_NEW_CHANNEL_PATH, ORDER_CHANNEL_PATH],
    to: CHANNELS_PATH,
  },
  {
    icon: <LinkIcon />,
    label: t('navigation.nwc'),
    to: NWC_PATH,
  },
]

export const getMindLinks = (t: TFunction): SectionLink[] => [
  {
    icon: <MessageSquare />,
    label: t('navigation.chat'),
    otherPaths: [KALEIDO_MIND_CHAT_PATH],
    to: KALEIDO_MIND_PATH,
  },
  {
    icon: <LayoutDashboard />,
    label: t('navigation.brain'),
    otherPaths: [
      KALEIDO_MIND_MODELS_PATH,
      KALEIDO_MIND_SKILLS_PATH,
      KALEIDO_MIND_AGENT_PATH,
    ],
    to: KALEIDO_MIND_BRAIN_PATH,
  },
]

export const SETUP_PATHS = [
  WALLET_SETUP_PATH,
  WALLET_RESTORE_PATH,
  WALLET_UNLOCK_PATH,
  WALLET_REMOTE_PATH,
  WALLET_INIT_PATH,
]
