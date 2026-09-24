export type LimitOrderSide = 'buy' | 'sell'

/**
 * Whether a limit order's trigger condition is already satisfied at this market
 * price. Buy fills at or below the limit, sell at or above it — both inclusive,
 * so an order placed at the market price is immediately executable.
 *
 * Shared by the scheduler (to decide when to execute) and the create form (to
 * warn that an order would fill on the next tick) so the two cannot drift.
 */
export const isLimitPriceTriggered = (
  side: LimitOrderSide,
  limitPrice: number,
  marketPrice: number
): boolean =>
  side === 'buy' ? marketPrice <= limitPrice : marketPrice >= limitPrice
