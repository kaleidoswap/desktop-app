import { configureStore } from '@reduxjs/toolkit'
import { act, renderHook } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { Provider } from 'react-redux'
import { afterEach, expect, it, vi } from 'vitest'

import { setWalletOverride } from '../../../../../api/wallet-override'
import {
  setTransport,
  tauriTransport,
} from '../../../../../routes/trade/nostr-p2p/transport'
import { createP2pWalletWrapper } from '../../../../../routes/trade/nostr-p2p/walletClient'
import { nodeApi } from '../../../../../slices/nodeApi/nodeApi.slice'
import { getAllRgbAssets } from '../../../../../utils/rgbUtils'
import { useRgbReceiveWatcher } from '../useReceiveWatchers'

afterEach(() => {
  setWalletOverride(null)
  setTransport(tauriTransport)
  vi.useRealTimers()
})

it('recognizes the open invoice by recipient and only uses metadata from its contract', async () => {
  vi.useFakeTimers()
  let status = 'WaitingCounterparty'
  const requests: { path: string; body: unknown }[] = []
  setTransport({
    async request<T>(_method: string, path: string, body?: unknown) {
      requests.push({ body, path })
      if (path === '/api/refresh') return undefined as T
      if (path !== '/api/rln/listtransfers') throw new Error(path)
      return {
        transfers: [
          {
            recipient_id: 'someone-else',
            status: 'Settled',
            txid: 'another-payment',
          },
          {
            assignments: [{ type: 'Fungible', value: 1200 }],
            recipient_id: 'invoice',
            status,
            txid: 'payment',
          },
        ],
      } as T
    },
  })
  setWalletOverride(createP2pWalletWrapper())
  const store = configureStore({
    middleware: (defaults) => defaults().concat(nodeApi.middleware),
    reducer: { [nodeApi.reducerPath]: nodeApi.reducer },
  })
  const assets = getAllRgbAssets({
    nia: [
      { asset_id: 'rgb:other', precision: 8, ticker: 'USD' },
      { asset_id: 'rgb:received', precision: 2, ticker: 'USD' },
      { asset_id: 'rgb:ambiguous', precision: 3, ticker: 'USD' },
      { asset_id: 'rgb:ambiguous', precision: 4, ticker: 'USD' },
    ],
  })
  const hook = renderHook(
    (assetId: string | undefined) =>
      useRgbReceiveWatcher(assetId, 'invoice', true, assets),
    {
      initialProps: undefined as string | undefined,
      wrapper: ({ children }: PropsWithChildren) => (
        <Provider store={store}>{children}</Provider>
      ),
    }
  )
  const advance = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })
  await advance(25)
  expect(requests).toEqual([{ body: {}, path: '/api/rln/listtransfers' }])
  expect(hook.result.current).toBeUndefined()
  status = 'WaitingConfirmations'
  await advance(8100)
  expect(hook.result.current).toEqual({
    amount: undefined,
    asset: undefined,
    confirmed: false,
    txid: 'payment',
  })
  status = 'Settled'
  await advance(8100)
  expect(hook.result.current?.confirmed).toBe(true)
  const settledRequests = requests.length
  await advance(8100)
  expect(requests).toHaveLength(settledRequests)

  hook.rerender('rgb:received')
  await advance(25)
  expect(requests.at(-1)).toEqual({
    body: { asset_id: 'rgb:received' },
    path: '/api/rln/listtransfers',
  })
  expect(hook.result.current).toMatchObject({
    amount: 1200,
    asset: { asset_id: 'rgb:received', precision: 2 },
  })
  hook.rerender('rgb:ambiguous')
  await advance(25)
  expect(hook.result.current?.amount).toBeUndefined()
  expect(hook.result.current?.txid).toBe('payment')
  hook.unmount()
  store.dispatch(nodeApi.util.resetApiState())
})
