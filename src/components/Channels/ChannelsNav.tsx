import { useTranslation } from 'react-i18next'
import {
  CHANNELS_PATH,
  CREATE_NEW_CHANNEL_PATH,
  ORDER_CHANNEL_PATH,
} from '../../app/router/paths'
import { RouteTabs, type RouteTab } from '../Layout/RouteTabs'

const tabs: RouteTab[] = [
  { icon: 'tune', labelKey: 'channels.manageChannels', to: CHANNELS_PATH },
  {
    icon: 'add_circle',
    labelKey: 'channels.openChannel',
    to: CREATE_NEW_CHANNEL_PATH,
  },
  { icon: 'payments', labelKey: 'channels.buyChannel', to: ORDER_CHANNEL_PATH },
]

export function ChannelsNav() {
  const { t } = useTranslation()
  return <RouteTabs label={t('navigation.channels')} tabs={tabs} />
}
