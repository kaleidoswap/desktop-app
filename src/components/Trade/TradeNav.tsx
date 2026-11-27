import { useTranslation } from 'react-i18next'
import {
  TRADE_MARKET_MAKER_PATH,
  TRADE_MANUAL_PATH,
  TRADE_DCA_PATH,
  TRADE_LIMIT_PATH,
} from '../../app/router/paths'
import { RouteTabs, type RouteTab } from '../Layout/RouteTabs'

const tabs: RouteTab[] = [
  {
    icon: 'apps',
    labelKey: 'p2pMarket.market.swap.title',
    to: TRADE_MARKET_MAKER_PATH,
  },
  {
    icon: 'swap_horiz',
    labelKey: 'navigation.manualSwaps',
    to: TRADE_MANUAL_PATH,
  },
  { icon: 'trending_up', labelKey: 'navigation.dca', to: TRADE_DCA_PATH },
  { icon: 'tune', labelKey: 'navigation.limitOrders', to: TRADE_LIMIT_PATH },
]

export function TradeNav() {
  const { t } = useTranslation()
  return <RouteTabs label={t('navigation.trade')} tabs={tabs} />
}
