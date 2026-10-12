import { describe, expect, it, vi } from 'vitest'

import type { P2pNetworkConfig } from '../../../../constants/p2p'
import {
  assetToNode,
  assetToTrading,
  btcToNode,
  btcToTrading,
  FundsError,
  MAX_PARTS,
  MIN_PART_SAT,
  PartialSend,
  splitAmount,
  startConfigFor,
  toBaseUnits,
  type Daemon,
  type NodeWallet,
} from '../p2p'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

function fakes() {
  const calls: string[] = []
  const node: NodeWallet = {
    address: async () => 'bcrt1-node-address',
    invoice: async (assetId, amount) => {
      calls.push(`node.invoice ${assetId} ${amount}`)
      return 'rgb:node-invoice'
    },
    sendBtc: async (address, amountSat) => {
      calls.push(`node.sendBtc ${address} ${amountSat}`)
    },
    sendRgb: async (a) => {
      calls.push(
        `node.sendRgb ${a.assetId} ${a.amount} ${a.recipientId} ${a.transportEndpoints.join(',')}`
      )
    },
  }
  const daemon: Daemon = {
    address: async () => 'bcrt1-trading-address',
    invoice: async (amount) => {
      calls.push(`daemon.invoice ${amount}`)
      return {
        recipient_id: 'bcrt:utxob:abc',
        transport_endpoints: ['rpc://127.0.0.1:3000/json-rpc'],
      }
    },
    sendBtc: async (address, amountSat) => {
      calls.push(`daemon.sendBtc ${address} ${amountSat}`)
      return { txid: 'tx' }
    },
    sendToInvoice: async (invoice, assetId) => {
      calls.push(`daemon.send ${invoice} ${assetId}`)
      return { txid: 'tx' }
    },
  }
  return { calls, daemon, node }
}

describe('moving funds between the node and the trading wallet', () => {
  it('node → trading: the daemon invoices, the node pays that recipient', async () => {
    const { calls, daemon, node } = fakes()
    await assetToTrading(node, daemon, {
      amount: 120,
      assetId: 'rgb:A',
      nodeBalance: 500,
    })
    expect(calls).toEqual([
      'daemon.invoice 120',
      'node.sendRgb rgb:A 120 bcrt:utxob:abc rpc://127.0.0.1:3000/json-rpc',
    ])
  })

  it('trading → node: the node invoices, the daemon pays it', async () => {
    const { calls, daemon, node } = fakes()
    await assetToNode(node, daemon, {
      amount: 40,
      assetId: 'rgb:A',
      tradingBalance: 100,
    })
    expect(calls).toEqual([
      'node.invoice rgb:A 40',
      'daemon.send rgb:node-invoice rgb:A',
    ])
  })

  it("BTC goes to the other wallet's address", async () => {
    const { calls, daemon, node } = fakes()
    await btcToTrading(node, daemon, { amountSat: 50_000, nodeBalance: 90_000 })
    await btcToNode(node, daemon, { amountSat: 20_000, tradingBalance: 30_000 })
    expect(calls).toEqual([
      'node.sendBtc bcrt1-trading-address 50000',
      'daemon.sendBtc bcrt1-node-address 20000',
    ])
  })

  it.each([0, -1, 1.5, NaN])(
    'refuses the amount %s before asking either side',
    async (amount) => {
      const { calls, daemon, node } = fakes()
      await expect(
        assetToTrading(node, daemon, {
          amount,
          assetId: 'rgb:A',
          nodeBalance: 10,
        })
      ).rejects.toBeInstanceOf(FundsError)
      await expect(
        btcToNode(node, daemon, { amountSat: amount, tradingBalance: 10 })
      ).rejects.toBeInstanceOf(FundsError)
      expect(calls).toEqual([])
    }
  )

  it('refuses more than the source holds', async () => {
    const { calls, daemon, node } = fakes()
    await expect(
      assetToTrading(node, daemon, {
        amount: 11,
        assetId: 'rgb:A',
        nodeBalance: 10,
      })
    ).rejects.toThrow(/more than the node/)
    await expect(
      assetToNode(node, daemon, {
        amount: 11,
        assetId: 'rgb:A',
        tradingBalance: 10,
      })
    ).rejects.toThrow(/more than the trading wallet/)
    await expect(
      btcToTrading(node, daemon, { amountSat: 11, nodeBalance: 10 })
    ).rejects.toThrow(/more than the node/)
    expect(calls).toEqual([])
  })

  it('does not send if the daemon cannot make the invoice', async () => {
    const { calls, daemon, node } = fakes()
    daemon.invoice = async () => {
      throw new Error('the P2P daemon is not running')
    }
    await expect(
      assetToTrading(node, daemon, {
        amount: 1,
        assetId: 'rgb:A',
        nodeBalance: 10,
      })
    ).rejects.toThrow(/not running/)
    expect(calls).toEqual([])
  })
})

describe('sending bitcoin in parts', () => {
  it('cuts an amount into parts that add up to it', () => {
    expect(splitAmount(90_000, 3)).toEqual([30_000, 30_000, 30_000])
    expect(splitAmount(100_000, 3)).toEqual([33_334, 33_333, 33_333])
    expect(splitAmount(50_000, 1)).toEqual([50_000])
    for (const [amount, parts] of [
      [123_457, 4],
      [1_000_001, 10],
    ] as const) {
      const cut = splitAmount(amount, parts)
      expect(cut.reduce((a, b) => a + b, 0)).toBe(amount)
      expect(Math.max(...cut) - Math.min(...cut)).toBeLessThanOrEqual(1)
    }
  })

  it('makes one transfer per part, each to a fresh address of the trading wallet', async () => {
    const { calls, daemon, node } = fakes()
    let n = 0
    daemon.address = async () => `bcrt1-trading-${++n}`
    await btcToTrading(node, daemon, {
      amountSat: 90_000,
      nodeBalance: 1_000_000,
      parts: 3,
    })
    expect(calls).toEqual([
      'node.sendBtc bcrt1-trading-1 30000',
      'node.sendBtc bcrt1-trading-2 30000',
      'node.sendBtc bcrt1-trading-3 30000',
    ])
  })

  it('refuses parts that are too many, too few or too small before sending anything', async () => {
    const { calls, daemon, node } = fakes()
    const go = (parts: number, amountSat = 1_000_000) =>
      btcToTrading(node, daemon, { amountSat, nodeBalance: 10_000_000, parts })
    await expect(go(0)).rejects.toBeInstanceOf(FundsError)
    await expect(go(MAX_PARTS + 1)).rejects.toBeInstanceOf(FundsError)
    await expect(go(2.5)).rejects.toBeInstanceOf(FundsError)
    await expect(go(3, MIN_PART_SAT * 3 - 1)).rejects.toThrow(/at least/)
    expect(calls).toEqual([])
  })

  it('says how many parts went out when one fails, and nothing is hidden when the first fails', async () => {
    const { calls, daemon, node } = fakes()
    let sends = 0
    node.sendBtc = async (address, amountSat) => {
      sends += 1
      if (sends === 3) throw new Error('the node is busy')
      calls.push(`node.sendBtc ${address} ${amountSat}`)
    }
    const err = await btcToTrading(node, daemon, {
      amountSat: 100_000,
      nodeBalance: 1_000_000,
      parts: 4,
    }).catch((e) => e)
    expect(err).toBeInstanceOf(PartialSend)
    expect(err).toMatchObject({
      message: 'the node is busy',
      sent: 2,
      total: 4,
    })
    expect(calls).toHaveLength(2)

    sends = 2 // the next call to sendBtc is the third, which fails, as the first of a new transfer
    const first = await btcToTrading(node, daemon, {
      amountSat: 50_000,
      nodeBalance: 1_000_000,
      parts: 2,
    }).catch((e) => e)
    expect(first).not.toBeInstanceOf(PartialSend)
    expect(first.message).toBe('the node is busy')
  })

  it('a single part is the plain transfer', async () => {
    const { calls, daemon, node } = fakes()
    await btcToTrading(node, daemon, { amountSat: 50_000, nodeBalance: 90_000 })
    expect(calls).toEqual(['node.sendBtc bcrt1-trading-address 50000'])
  })
})

describe('amounts and config', () => {
  it('turns typed amounts into base units without float drift', () => {
    expect(toBaseUnits('1.5', 2)).toBe(150)
    expect(toBaseUnits('0.1', 8)).toBe(10_000_000)
    expect(toBaseUnits('100', 0)).toBe(100)
    expect(toBaseUnits('1.999', 2)).toBe(199)
    expect(toBaseUnits('', 2)).toBe(0)
    expect(toBaseUnits('1e3', 2)).toBe(0)
    expect(toBaseUnits('-1', 2)).toBe(0)
  })

  it('builds the daemon config from a network entry', () => {
    const cfg: P2pNetworkConfig = {
      feeAddress: 'tb1qfee',
      indexerUrl: 'https://esplora.example/api',
      network: 'signet',
      proxyUrl: 'https://proxy.example/json-rpc',
      relays: ['wss://relay.example'],
    }
    expect(startConfigFor('alice', cfg)).toEqual({
      account: 'alice',
      fee_address: 'tb1qfee',
      indexer_url: 'https://esplora.example/api',
      network: 'signet',
      proxy_url: 'https://proxy.example/json-rpc',
      relays: ['wss://relay.example'],
    })
  })
})
