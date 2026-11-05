import { afterEach, describe, expect, it, vi } from 'vitest'

import { createP2pWalletClient } from '../walletClient'
import { setTransport, tauriTransport, type Transport } from '../transport'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

function fake(answers: Record<string, unknown> = {}) {
  const calls: { method: string; path: string; body: unknown }[] = []
  const t: Transport = {
    request: async <T>(method: string, path: string, body?: unknown) => {
      calls.push({ body, method, path })
      return answers[path] as T
    },
  }
  setTransport(t)
  return calls
}

afterEach(() => setTransport(tauriTransport))

describe('the trading wallet as a node client', () => {
  it('reads balances, assets and transactions from the wallet half of the daemon', async () => {
    const calls = fake()
    const c = createP2pWalletClient() as any
    await c.getBtcBalance()
    await c.listAssets()
    await c.listTransactions()
    await c.listUnspents()
    expect(calls.map((x) => x.path)).toEqual([
      '/api/rln/btcbalance',
      '/api/rln/listassets',
      '/api/rln/listtransactions',
      '/api/rln/listunspents',
    ])
  })

  it('asks for the transfers of one asset in the daemon’s terms', async () => {
    const calls = fake()
    const c = createP2pWalletClient() as any
    await c.listTransfers({ asset_filter: { type: 'Id', value: 'rgb:abc' } })
    expect(calls[0]).toMatchObject({
      body: { asset_id: 'rgb:abc' },
      path: '/api/rln/listtransfers',
    })
  })

  it('turns a node-style bitcoin send into the daemon’s', async () => {
    const calls = fake()
    const c = createP2pWalletClient() as any
    await c.sendBtc({ address: 'tb1q', amount: 5000, fee_rate: 3 })
    expect(calls[0]).toMatchObject({
      body: { address: 'tb1q', amount_sat: 5000, fee_rate: 3 },
      path: '/api/btc/send',
    })
  })

  it('turns an RGB invoice request into the amount and lifetime the daemon takes', async () => {
    const calls = fake({
      '/api/rgb/invoice': {
        expiration_timestamp: 9,
        invoice: 'rgb:~/~/~',
        recipient_id: 'r',
      },
    })
    const c = createP2pWalletClient() as any
    const soon = Math.floor(Date.now() / 1000) + 600
    const out = await c.createRgbInvoice({
      asset_id: 'rgb:abc',
      assignment: { type: 'Fungible', value: 42 },
      expiration_timestamp: soon,
    })
    expect(calls[0]!.body).toMatchObject({ amount: 42, asset_id: 'rgb:abc' })
    expect((calls[0]!.body as any).duration_secs).toBeGreaterThanOrEqual(590)
    expect(out).toMatchObject({ batch_transfer_idx: 0, recipient_id: 'r' })
  })

  it('answers Lightning questions with nothing, and says so for anything else', async () => {
    fake()
    const c = createP2pWalletClient() as any
    expect(await c.listChannels()).toEqual({ channels: [] })
    expect(await c.listPayments()).toEqual({ payments: [] })
    expect(await c.listPeers()).toEqual({ peers: [] })
    await expect(c.openChannel({})).rejects.toThrow(/not available/)
  })
})
