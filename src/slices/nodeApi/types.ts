export type Channel = any;

// Alias Asset to NiaAsset for compatibility
export type NiaAsset = any;
export type Asset = any;

// Stub types for backwards compatibility (not in SDK)
export const Network = {
    Mainnet: 'mainnet',
    Testnet: 'testnet',
    Regtest: 'regtest',
    Signet: 'signet',
} as const;
export type Network = typeof Network[keyof typeof Network];

// Local types for Maker/Taker (not in SDK types)
export interface MakerInitRequest {
    qty_from: number;
    qty_to: number;
    from_asset?: string;
    to_asset?: string;
    timeout_sec: number;
}
export interface MakerInitResponse {
    swapstring: string;
    payment_secret: string;
}
export interface MakerExecuteRequest {
    payment_secret: string;
    swapstring: string;
    taker_pubkey: string;
}
export interface TakerRequest {
    swapstring: string;
}
export interface AssignmentFungible {
    type: 'Fungible';
    value: number;
}
export interface Assignment {
    type: 'Fungible' | 'InflationRight' | 'Any' | 'NonFungible' | 'ReplaceRight';
    value?: number;
}

export interface SwapDetails {
  from_asset?: string
  to_asset?: string
  qty_from?: number
  qty_to?: number
  status?: string
  payment_hash?: string
  created_at?: number
  completed_at?: number
  initiated_at?: number
  requested_at?: number
}

export enum SwapStatus {
  Succeeded = 'Succeeded',
  Failed = 'Failed',
  Expired = 'Expired',
  Pending = 'Pending',
  Waiting = 'Waiting',
}

export interface Transfer {
  status?: string
  kind?: 'Send' | 'ReceiveBlind' | 'ReceiveWitness' | 'Issuance' | 'Inflation'
  requested_assignment?: Assignment
  txid?: string
  idx?: number
  created_at?: number
  recipient_id?: string
}