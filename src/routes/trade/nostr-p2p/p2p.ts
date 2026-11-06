/**
 * The desktop side of the P2P market: starting and stopping the `p2pd` daemon, and moving funds
 * between the RGB Lightning node (savings) and the daemon's trading wallet (what is on offer).
 *
 * The daemon is a separate hot wallet. Funds only go there when the user moves them, so the node
 * keeps everything else. The moving logic takes the node and the daemon as parameters so it can be
 * tested without either.
 */

import { invoke } from '@tauri-apps/api/core'

import type { P2pNetworkConfig } from '../../../constants/p2p'

import { transport } from './transport'

export interface P2pStatus {
  running: boolean
  port: number | null
  url: string | null
}

export interface P2pStartConfig {
  account: string
  network: string
  indexer_url: string
  proxy_url: string
  relays: string[]
  fee_address: string
  fee_bps?: number
  min_fee_sat?: number
  verified_assets_path?: string
  /** The recovery phrase to create the wallet from. First start only; never replaces a wallet. */
  seed_mnemonic?: string
  /** Scan every address once at start, to find a deposit the quick sync missed. */
  rescan?: boolean
}

export const p2pStatus = () => invoke<P2pStatus>('p2p_status')
export const p2pStart = (config: P2pStartConfig) =>
  invoke<P2pStatus>('p2p_start', { config })
export const p2pStop = () => invoke<void>('p2p_stop')

/** Where the daemon can run on this system: its bundled binary, or under Docker; or what is in the way. */
export interface P2pAvailability {
  backend: 'native' | 'docker' | null
  hint: 'docker_missing' | 'docker_stopped' | 'image_unpublished' | null
}

export const p2pAvailability = () => invoke<P2pAvailability>('p2p_available')

/** A new recovery phrase. Nothing is created until a wallet is started from it. */
export const p2pGenerateSeed = (network: string) =>
  invoke<string>('p2p_generate_seed', { network })

/** What the app remembers about a trading wallet it set up (the keys themselves stay in the keychain). */
export interface WalletProfile {
  version: 1
  created_at: number
  /** The phrase was shown and the user confirmed it, or typed it in to restore. */
  backed_up: boolean
}

export const p2pProfileGet = (account: string) =>
  invoke<WalletProfile | null>('p2p_profile_get', { account })
export const p2pProfileSet = (account: string, profile: WalletProfile) =>
  invoke<void>('p2p_profile_set', { account, profile })

/** The wallet's recovery phrase, read back from the daemon when the user asks for it. */
export const recoveryPhrase = () =>
  transport()
    .request<{ mnemonic: string }>('POST', '/api/recovery-phrase', {})
    .then((r) => r.mnemonic)

/**
 * The daemon keeps its data and its keychain entry under the account name, so it takes letters,
 * digits, `-` and `_` only; an account called "My Bitcoin Wallet" becomes "My-Bitcoin-Wallet".
 */
export const daemonAccountName = (name: string): string =>
  name
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'account'

export const startConfigFor = (
  account: string,
  cfg: P2pNetworkConfig
): P2pStartConfig => ({
  account: daemonAccountName(account),
  fee_address: cfg.feeAddress,
  indexer_url: cfg.indexerUrl,
  network: cfg.network,
  proxy_url: cfg.proxyUrl,
  relays: cfg.relays,
})

/** What the daemon exposes to the app: the funds endpoints, called through Rust. */
export interface Daemon {
  address(): Promise<string>
  invoice(
    amount: number
  ): Promise<{ recipient_id: string; transport_endpoints: string[] }>
  sendToInvoice(invoice: string, assetId: string): Promise<{ txid: string }>
  sendBtc(address: string, amountSat: number): Promise<{ txid: string }>
}

const call = <T>(method: 'GET' | 'POST', path: string, body?: unknown) =>
  transport().request<T>(method, path, body)

export const tauriDaemon: Daemon = {
  address: async () =>
    (await call<{ address: string }>('GET', '/api/info')).address,
  invoice: (amount) => call('POST', '/api/rgb/invoice', { amount }),
  sendBtc: (address, amountSat) =>
    call('POST', '/api/btc/send', { address, amount_sat: amountSat }),
  sendToInvoice: (invoice, assetId) =>
    call('POST', '/api/rgb/send', { asset_id: assetId, invoice }),
}

/** What the funds logic needs from the RGB Lightning node. */
export interface NodeWallet {
  address(): Promise<string>
  /** An RGB invoice for `amount` of `assetId`. */
  invoice(assetId: string, amount: number): Promise<string>
  /** Pay to an RGB recipient (the daemon's invoice has no asset, so the node names it). */
  sendRgb(args: {
    assetId: string
    amount: number
    recipientId: string
    transportEndpoints: string[]
  }): Promise<void>
  sendBtc(address: string, amountSat: number): Promise<void>
}

export class FundsError extends Error {}

const wholePositive = (n: number, what: string) => {
  if (!Number.isInteger(n) || n <= 0)
    throw new FundsError(`Enter ${what} above zero.`)
}

/** Node → trading wallet: the daemon says where, the node pays. */
export async function assetToTrading(
  node: NodeWallet,
  daemon: Daemon,
  p: { assetId: string; amount: number; nodeBalance: number }
) {
  wholePositive(p.amount, 'an amount')
  if (p.amount > p.nodeBalance)
    throw new FundsError('That is more than the node holds.')
  const inv = await daemon.invoice(p.amount)
  await node.sendRgb({
    amount: p.amount,
    assetId: p.assetId,
    recipientId: inv.recipient_id,
    transportEndpoints: inv.transport_endpoints,
  })
}

/** Trading wallet → node: the node makes an invoice, the daemon pays it. */
export async function assetToNode(
  node: NodeWallet,
  daemon: Daemon,
  p: { assetId: string; amount: number; tradingBalance: number }
) {
  wholePositive(p.amount, 'an amount')
  if (p.amount > p.tradingBalance)
    throw new FundsError('That is more than the trading wallet holds.')
  const invoice = await node.invoice(p.assetId, p.amount)
  await daemon.sendToInvoice(invoice, p.assetId)
}

/** The most parts a transfer may be sent in, and the least a part may be. */
export const MAX_PARTS = 10
export const MIN_PART_SAT = 10_000

/**
 * Cut an amount into `parts` that add up to it, the remainder spread over the first ones, so that
 * no part differs from another by more than a sat.
 */
export function splitAmount(amountSat: number, parts: number): number[] {
  const base = Math.floor(amountSat / parts)
  const extra = amountSat - base * parts
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0))
}

/** Some parts were sent and the rest were not: the money is split between the two wallets. */
export class PartialSend extends FundsError {
  constructor(
    readonly sent: number,
    readonly total: number,
    cause: unknown
  ) {
    super(cause instanceof Error ? cause.message : String(cause))
  }
}

/**
 * Node → trading wallet. Each swap spends a coin of its own, so a wallet with one coin runs one
 * swap at a time; sending in `parts` makes that many coins. Each part is its own transaction from
 * the node, to a fresh address of the trading wallet.
 */
export async function btcToTrading(
  node: NodeWallet,
  daemon: Daemon,
  p: { amountSat: number; nodeBalance: number; parts?: number }
) {
  const parts = p.parts ?? 1
  wholePositive(p.amountSat, 'an amount')
  if (!Number.isInteger(parts) || parts < 1 || parts > MAX_PARTS)
    throw new FundsError(`Send it in between 1 and ${MAX_PARTS} parts.`)
  if (parts > 1 && Math.floor(p.amountSat / parts) < MIN_PART_SAT)
    throw new FundsError(`Each part needs at least ${MIN_PART_SAT} sats.`)
  if (p.amountSat > p.nodeBalance)
    throw new FundsError('That is more than the node holds.')
  let sent = 0
  for (const part of splitAmount(p.amountSat, parts)) {
    try {
      await node.sendBtc(await daemon.address(), part)
    } catch (e) {
      if (sent === 0) throw e
      throw new PartialSend(sent, parts, e)
    }
    sent += 1
  }
}

export async function btcToNode(
  node: NodeWallet,
  daemon: Daemon,
  p: { amountSat: number; tradingBalance: number }
) {
  wholePositive(p.amountSat, 'an amount')
  if (p.amountSat > p.tradingBalance)
    throw new FundsError('That is more than the trading wallet holds.')
  await daemon.sendBtc(await node.address(), p.amountSat)
}

/** Whole units typed by the user → base units, without float drift. */
export function toBaseUnits(input: string, precision: number): number {
  const t = input.trim()
  if (!/^\d*\.?\d*$/.test(t) || t === '' || t === '.') return 0
  const [whole = '0', frac = ''] = t.split('.')
  const fraction = (frac + '0'.repeat(precision)).slice(0, precision)
  return Number(whole || '0') * 10 ** precision + Number(fraction || '0')
}

/** An RGB invoice a sender can pay. `assetId` empty accepts whatever asset the sender picks. */
export const createReceiveInvoice = (amount: number, assetId?: string) =>
  call<{ invoice: string; expiration_timestamp: number }>(
    'POST',
    '/api/rgb/invoice',
    { amount, ...(assetId ? { asset_id: assetId } : {}) }
  )

export interface DaemonBalance {
  btc_spendable_sat: number
  assets: {
    asset_id: string
    ticker: string
    name: string
    precision: number
    total: number
    spendable: number
  }[]
}

export const daemonBalance = () => call<DaemonBalance>('GET', '/api/balance')
