import * as z from 'zod'

import { MAX_CHANNEL_CAPACITY } from '../../constants'

export const OrderChannelFormSchema = z.object({
  assetId: z.string(),
  capacitySat: z
    .number()
    .max(MAX_CHANNEL_CAPACITY, 'Maximum amount is 100000000 satoshis'),
  channelExpireBlocks: z.number().gte(0),
  // LSP-side asset amount for receiving
  clientAssetAmount: z.number().gte(0).optional(),

  clientBalanceSat: z.number().gte(0),
  lspAssetAmount: z.number().gte(0).optional(),
  rfqId: z.string().optional(),
})

export type TChannelRequestForm = z.infer<typeof OrderChannelFormSchema>
