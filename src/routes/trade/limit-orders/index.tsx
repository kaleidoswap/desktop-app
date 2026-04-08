import { Navigate } from 'react-router-dom'

import { TRADE_MARKET_MAKER_PATH } from '../../../app/router/paths'

export const Component = () => (
  <Navigate replace to={`${TRADE_MARKET_MAKER_PATH}?tab=limit-orders`} />
)
