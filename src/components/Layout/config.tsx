import { TFunction } from 'i18next'
import { Icon } from 'kaleido-ui'
import React from 'react'

import {
  CHANNELS_PATH,
  CREATE_NEW_CHANNEL_PATH,
  KALEIDO_MIND_AGENT_PATH,
  KALEIDO_MIND_BRAIN_PATH,
  KALEIDO_MIND_CHAT_PATH,
  KALEIDO_MIND_MODELS_PATH,
  KALEIDO_MIND_PATH,
  KALEIDO_MIND_SKILLS_PATH,
  NWC_PATH,
  ORDER_CHANNEL_PATH,
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
}

export function matchesSectionLink(link: SectionLink, pathname: string) {
  return pathname === link.to || link.otherPaths?.includes(pathname)
}

export const getNodeLinks = (t: TFunction): SectionLink[] => [
  {
    icon: <Icon name="hub" size="sm" />,
    label: t('navigation.channels'),
    otherPaths: [CREATE_NEW_CHANNEL_PATH, ORDER_CHANNEL_PATH],
    to: CHANNELS_PATH,
  },
  {
    icon: <Icon name="link" size="sm" />,
    label: t('navigation.nwc'),
    to: NWC_PATH,
  },
]

export const getMindLinks = (t: TFunction): SectionLink[] => [
  {
    icon: <Icon name="chat_bubble" size="sm" />,
    label: t('navigation.chat'),
    otherPaths: [KALEIDO_MIND_CHAT_PATH],
    to: KALEIDO_MIND_PATH,
  },
  {
    icon: <Icon name="psychology" size="sm" />,
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
