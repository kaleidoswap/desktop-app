import { invoke } from '@tauri-apps/api/core'

import type { ChannelOrderStatusLike } from './channelOrderUtils'

interface PersistChannelOrderParams {
  fallbackAccessToken?: string | null
  order: ChannelOrderStatusLike | null | undefined
  orderId: string
  orderPayload: unknown
}

export const persistChannelOrder = async ({
  fallbackAccessToken,
  order,
  orderId,
  orderPayload,
}: PersistChannelOrderParams): Promise<void> => {
  await invoke('insert_channel_order', {
    createdAt: order?.created_at || new Date().toISOString(),
    orderId,
    payload: JSON.stringify({
      ...(typeof orderPayload === 'object' && orderPayload !== null
        ? orderPayload
        : {}),
      access_token: order?.access_token ?? fallbackAccessToken,
    }),
    status: order?.order_state || 'paid',
  })
}
