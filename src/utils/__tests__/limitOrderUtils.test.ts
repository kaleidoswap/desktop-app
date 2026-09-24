import { describe, it, expect } from 'vitest'

import { isLimitPriceTriggered } from '../limitOrderUtils'

describe('isLimitPriceTriggered', () => {
  describe('buy', () => {
    it('triggers when the market falls below the limit', () => {
      expect(isLimitPriceTriggered('buy', 100_000, 99_000)).toBe(true)
    })

    it('does not trigger while the market is above the limit', () => {
      expect(isLimitPriceTriggered('buy', 100_000, 101_000)).toBe(false)
    })

    it('triggers at exactly the limit price', () => {
      expect(isLimitPriceTriggered('buy', 100_000, 100_000)).toBe(true)
    })
  })

  describe('sell', () => {
    it('triggers when the market rises above the limit', () => {
      expect(isLimitPriceTriggered('sell', 100_000, 101_000)).toBe(true)
    })

    it('does not trigger while the market is below the limit', () => {
      expect(isLimitPriceTriggered('sell', 100_000, 99_000)).toBe(false)
    })

    it('triggers at exactly the limit price', () => {
      expect(isLimitPriceTriggered('sell', 100_000, 100_000)).toBe(true)
    })
  })

  // The create form pre-filled the limit price with the market price, so the
  // order below was already triggered the moment it was placed and filled on
  // the next scheduler tick (#92). The form now warns instead of pre-filling.
  describe('an order placed at the market price (#92)', () => {
    it('is already triggered on both sides', () => {
      const market = 100_000
      expect(isLimitPriceTriggered('buy', market, market)).toBe(true)
      expect(isLimitPriceTriggered('sell', market, market)).toBe(true)
    })

    it('is not triggered once the price is moved away from the market', () => {
      const market = 100_000
      expect(isLimitPriceTriggered('buy', market * 0.99, market)).toBe(false)
      expect(isLimitPriceTriggered('sell', market * 1.01, market)).toBe(false)
    })
  })
})
