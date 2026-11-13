/**
 * The maker section's link to Rust (`src-tauri/src/maker`): the signer, its policy, the pairing
 * with a maker, and the maker's tenant API (strategy, pause, usage). The preview harness swaps in
 * a backend of its own, see `setMakerBackend`.
 */

import { invoke } from '@tauri-apps/api/core'

import type { Balance, Info, Order, Trade } from '../api'

export type MakerMode = 'hosted' | 'self_hosted'

export interface Endpoint {
  url: string
  /** Empty for a self-hosted maker, which signs by itself. */
  maker_npub: string
}

export type Reference =
  | { kind: 'fixed'; sat_per_unit: number }
  | { kind: 'usd_peg'; usd_per_unit: number }

/** What the signer accepts for one asset (see `maker/policy.rs`). Amounts in base units. */
export interface MarketRule {
  asset_id: string
  ticker: string | null
  precision: number
  sell: boolean
  buy: boolean
  reference: Reference
  band_bps: number
  max_swap_units: number
  /** Most sats in one swap; null for no limit. */
  max_swap_sat: number | null
  max_daily_net_units: number
}

export interface SigningPolicy {
  version: 1
  network: string
  maker_npub: string
  markets: MarketRule[]
}

export interface SignedPolicy {
  policy: SigningPolicy
  signed_at: number
  signer: string
  sig: string
}

export interface SignerView {
  running: boolean
  started_at: number | null
  relays: number
  signed: number
  refused: number
  error: string | null
}

export interface MakerView {
  network: string
  mode: MakerMode | null
  endpoint: Endpoint | null
  has_token: boolean
  signer_npub: string
  signer_enabled: boolean
  policy: SignedPolicy | null
  policy_error: string | null
  signer: SignerView
  biometric: boolean
}

export type JournalStatus = 'signed' | 'refused'

/** One answer of the signer: a signed swap with the terms read from its PSBT, or a refusal. */
export interface JournalEntry {
  swap_id: string
  at: number
  status: JournalStatus
  side: 'sell' | 'buy' | null
  asset_id: string | null
  units: number
  sat: number
  reason: string | null
}

export interface JournalData {
  entries: JournalEntry[]
}

// ─── p2pd's bot config (docs/BOT.md on feat/maker-engine) ─────────────────────

export type PriceSource =
  | { source: 'fixed'; sat_per_unit: number }
  | { source: 'file'; path: string; max_age_secs?: number }

export interface Skew {
  target: number
  range: number
  max_bps: number
}

export interface CircuitBreaker {
  max_move_bps: number
  cooldown_secs?: number
}

export interface BotMarket {
  asset_id: string
  precision: number
  price: PriceSource
  spread_bps: number
  ask_amount: number
  bid_amount: number
  levels: number
  level_step_bps: number
  size_growth: number
  skew?: Skew | null
  circuit_breaker?: CircuitBreaker | null
  max_daily_net?: number | null
}

export interface BotConfig {
  refresh_secs?: number
  offer_ttl_secs?: number
  requote_bps?: number
  markets: BotMarket[]
}

export interface BotState {
  paused: boolean
  config: BotConfig
}

export interface UsageDay {
  date: string
  offers_posted: number
  swaps_settled: number
  volume_sat: number
}

export interface UsageReport {
  days: UsageDay[]
  total: Omit<UsageDay, 'date'>
}

// ─── the signer wallet (launch a token) ───────────────────────────────────────

export interface Sats {
  settled: number
  spendable: number
  future: number
}

export interface WalletAsset {
  asset_id: string
  ticker: string
  name: string
  precision: number
  issued_supply: number
  balance: Sats
  /** Coins carrying some of it: how many sales can run at once. */
  allocations: number
}

export interface SignerWallet {
  btc: Sats
  colored: Sats
  coins: number
  free_coins: number
  assets: WalletAsset[]
}

export interface MintRequest {
  ticker: string
  name: string
  precision: number
  /** Base units. */
  supply: number
  parts: number
}

/** An asset as the hosted maker reports it after an import (base units). */
export interface ImportedAsset {
  asset_id: string
  ticker: string | null
  total: number
  spendable: number
}

export interface StateHandoff {
  uploaded: boolean
  /** The host is scanning its address chains: `spendable` is 0 until it is done. */
  scanning: boolean
  assets: ImportedAsset[]
  file: string | null
  password: string | null
  detail: string | null
}

export type PairInput =
  | { code: string }
  | { endpoint: Endpoint; token: string }
  | Record<string, never>

export interface MakerBackend {
  view(): Promise<MakerView>
  setMode(mode: MakerMode | null): Promise<MakerView>
  pair(input: PairInput): Promise<MakerView>
  pairingRequest(): Promise<string>
  api<T>(
    method: 'GET' | 'PUT' | 'POST',
    path: string,
    body?: unknown
  ): Promise<T>
  signPolicy(policy: SigningPolicy): Promise<MakerView>
  startSigner(): Promise<MakerView>
  stopSigner(): Promise<MakerView>
  journal(): Promise<JournalData>
  btcUsd(): Promise<number>
  wallet(): Promise<SignerWallet>
  walletAddress(): Promise<string>
  createCoins(num: number, size: number, feeRate: number): Promise<number>
  mint(m: MintRequest): Promise<string>
  sendState(): Promise<StateHandoff>
}

export const tauriMakerBackend = (networkKey: string): MakerBackend => ({
  api: (method, path, body) =>
    invoke('maker_api', { body: body ?? null, method, networkKey, path }),
  btcUsd: () => invoke('maker_btc_usd'),
  createCoins: (num, size, feeRate) =>
    invoke('maker_wallet_create_coins', { feeRate, networkKey, num, size }),
  journal: () => invoke('maker_journal', { networkKey }),
  mint: (mint) => invoke('maker_wallet_mint', { mint, networkKey }),
  pair: (input) =>
    invoke('maker_pair', {
      code: 'code' in input ? input.code : null,
      endpoint: 'endpoint' in input ? input.endpoint : null,
      networkKey,
      token: 'token' in input ? input.token : null,
    }),
  pairingRequest: () => invoke('maker_pairing_request', { networkKey }),
  sendState: () => invoke('maker_send_state', { networkKey }),
  setMode: (mode) => invoke('maker_set_mode', { mode, networkKey }),
  signPolicy: (policy) => invoke('maker_sign_policy', { networkKey, policy }),
  startSigner: () => invoke('maker_signer_start', { networkKey }),
  stopSigner: () => invoke('maker_signer_stop', { networkKey }),
  view: () => invoke('maker_view', { networkKey }),
  wallet: () => invoke('maker_wallet', { networkKey }),
  walletAddress: () => invoke('maker_wallet_address', { networkKey }),
})

let factory: (networkKey: string) => MakerBackend = tauriMakerBackend

/** The preview harness runs without Rust and brings its own backend. */
export const setMakerBackend = (f: (networkKey: string) => MakerBackend) => {
  factory = f
}

export const makerBackend = (networkKey: string): MakerBackend =>
  factory(networkKey)

/** The maker's tenant API, through whichever backend is in use. */
export const tenant = (b: MakerBackend) => ({
  balance: () => b.api<Balance>('GET', '/api/balance'),
  book: () => b.api<Order[]>('GET', '/api/book'),
  bot: () => b.api<BotState>('GET', '/api/bot'),
  info: () => b.api<Info>('GET', '/api/info'),
  orders: () => b.api<Order[]>('GET', '/api/orders'),
  pause: () => b.api<BotState>('POST', '/api/bot/pause'),
  putBot: (config: BotConfig) => b.api<BotState>('PUT', '/api/bot', config),
  resume: () => b.api<BotState>('POST', '/api/bot/resume'),
  trades: () => b.api<Trade[]>('GET', '/api/trades'),
  usage: () => b.api<UsageReport>('GET', '/api/usage'),
})

/** Maker mode is offered on Mutinynet (and the local regtest stack), never on mainnet. */
export const makerAvailableOn = (network: string): boolean =>
  network === 'signetcustom' || network === 'regtest'
