import { z } from 'zod'
import { NewChannelFormSchema } from './channel.slice'

// UI defaults are supplied by react-hook-form. Keep its input/output types equal.
export const CreateChannelStep2Schema = NewChannelFormSchema.omit({
  channelExpireBlocks: true,
  capacitySat: true,
  pubKeyAndAddress: true,
}).extend({
  assetAmountDisplay: z.string(),
  assetId: z.string(),
  assetTicker: z.string(), // Display amount with proper precision
  fee: z.enum(['slow', 'medium', 'fast', 'custom']),
  capacitySat: z.string(),
  pubKeyAndAddress: z.string(),
  public: z.boolean(),
})

export const OrderChannelStep2Schema = z.object({
  assetId: z.string(),
  capacitySat: z.string(),
  channelExpireBlocks: z.number(),
  clientAssetAmount: z.string(),
  clientBalanceSat: z.string(),
  lspAssetAmount: z.string(),
})
