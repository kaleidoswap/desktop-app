import { describe, expect, it } from 'vitest'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  CreateChannelStep2Schema,
  OrderChannelStep2Schema,
} from '../channelFormSchemas'

describe('channel form validation with Zod 4', () => {
  it('accepts an unselected asset and the custom fee choice shown by the create form', () => {
    const value = CreateChannelStep2Schema.parse({
      capacitySat: '100000',
      pubKeyAndAddress: '',
      assetAmount: 0,
      assetAmountDisplay: '',
      assetId: '',
      assetTicker: '',
      fee: 'custom',
      public: true,
    })
    expect(value.fee).toBe('custom')
    expect(value.assetAmount).toBe(0)
  })
  it('returns field errors through the actual form resolver for invalid amounts', async () => {
    const result = await zodResolver(CreateChannelStep2Schema)(
      {
        capacitySat: '100000',
        pubKeyAndAddress: '',
        assetAmount: -1,
        assetAmountDisplay: '',
        assetId: '',
        assetTicker: '',
        fee: 'medium',
        public: true,
      },
      undefined,
      { fields: {}, shouldUseNativeValidation: false }
    )
    expect(result.errors.assetAmount).toBeDefined()
    expect(result.values).toEqual({})
  })
  it('validates the order form defaults without converting displayed quantities', async () => {
    const values = {
      assetId: '',
      capacitySat: '100000',
      channelExpireBlocks: 12960,
      clientAssetAmount: '0',
      clientBalanceSat: '20000',
      lspAssetAmount: '',
    }
    const result = await zodResolver(OrderChannelStep2Schema)(
      values,
      undefined,
      { fields: {}, shouldUseNativeValidation: false }
    )
    expect(result.errors).toEqual({})
    expect(result.values).toEqual(values)
  })
})
