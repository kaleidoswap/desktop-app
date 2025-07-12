import { z } from 'zod'

import { MAX_CHANNEL_CAPACITY } from '../../constants'

export const NewChannelFormSchema = z.object({
  assetAmount: z.number().gte(0),
  assetId: z.string().optional(),
  assetTicker: z.string().optional(),
  capacitySat: z
    .number()
    .max(MAX_CHANNEL_CAPACITY, 'Maximum amount is 100000000 satoshis'),
  fee: z.enum(['slow', 'medium', 'fast']),
  pubKeyAndAddress: z.string().refine((value) => {
    // Allow pubkey-only format (66 hex chars) OR full format pubkey@host:port
    const isPubkeyOnly = value.length === 66 && /^[0-9a-fA-F]{66}$/.test(value)
    const isFullFormat = /^([0-9a-fA-F]{66})@([^\s]+):(\d+)$/.test(value)
    return isPubkeyOnly || isFullFormat
  }, 'Invalid format. Expected: 66-char hex pubkey OR pubkey@host:port'),
  public: z.boolean().default(true),
})

export type TNewChannelForm = z.infer<typeof NewChannelFormSchema>
