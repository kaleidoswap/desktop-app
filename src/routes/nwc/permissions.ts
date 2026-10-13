export type Capability = 'view' | 'receive' | 'spend'

export interface MethodDef {
  id: string
  label: string
  group: 'lightning' | 'rgb'
  capability: Capability
}

/** All methods the Rust service implements. */
export const ALL_METHODS: MethodDef[] = [
  // Standard NIP-47 (Bitcoin Lightning)
  {
    capability: 'view',
    group: 'lightning',
    id: 'get_info',
    label: 'Node info',
  },
  {
    capability: 'view',
    group: 'lightning',
    id: 'get_balance',
    label: 'Balance',
  },
  {
    capability: 'receive',
    group: 'lightning',
    id: 'make_invoice',
    label: 'Create invoices',
  },
  {
    capability: 'view',
    group: 'lightning',
    id: 'lookup_invoice',
    label: 'Look up invoices',
  },
  {
    capability: 'view',
    group: 'lightning',
    id: 'list_transactions',
    label: 'Transaction history',
  },
  {
    capability: 'spend',
    group: 'lightning',
    id: 'pay_invoice',
    label: 'Pay invoices',
  },
  {
    capability: 'spend',
    group: 'lightning',
    id: 'pay_keysend',
    label: 'Send keysend',
  },
  // KaleidoSwap RLN extensions (RGB + node)
  {
    capability: 'view',
    group: 'rgb',
    id: 'rln_node_info',
    label: 'RGB node info',
  },
  {
    capability: 'view',
    group: 'rgb',
    id: 'rln_list_assets',
    label: 'List RGB assets',
  },
  {
    capability: 'view',
    group: 'rgb',
    id: 'rln_asset_balance',
    label: 'RGB balances',
  },
  {
    capability: 'receive',
    group: 'rgb',
    id: 'rln_rgb_invoice',
    label: 'Create RGB invoices',
  },
  {
    capability: 'receive',
    group: 'rgb',
    id: 'rln_ln_invoice',
    label: 'Create RGB Lightning invoices',
  },
  {
    capability: 'view',
    group: 'rgb',
    id: 'rln_decode_rgb_invoice',
    label: 'Decode RGB invoices',
  },
  {
    capability: 'spend',
    group: 'rgb',
    id: 'rln_send_asset',
    label: 'Send RGB assets',
  },
  {
    capability: 'view',
    group: 'rgb',
    id: 'rln_list_channels',
    label: 'List channels',
  },
  {
    capability: 'receive',
    group: 'rgb',
    id: 'rln_get_address',
    label: 'On-chain address',
  },
]

export const METHOD_BY_ID = Object.fromEntries(
  ALL_METHODS.map((m) => [m.id, m])
)

export const methodsWith = (caps: Capability[], exclude: string[] = []) =>
  ALL_METHODS.filter(
    (m) => caps.includes(m.capability) && !exclude.includes(m.id)
  ).map((m) => m.id)

export type PresetId = 'view' | 'receive' | 'full' | 'custom'

// "full" keeps the previous default: everything except keysend, so wallets
// such as Rate detect an RGB Lightning Node and can transact assets.
export const PRESETS: Record<Exclude<PresetId, 'custom'>, string[]> = {
  full: methodsWith(['view', 'receive', 'spend'], ['pay_keysend']),
  receive: methodsWith(['view', 'receive']),
  view: methodsWith(['view']),
}

export const capabilitiesOf = (methods: string[]) => {
  const caps = new Set(methods.map((m) => METHOD_BY_ID[m]?.capability))
  return {
    receive: caps.has('receive'),
    spend: caps.has('spend'),
    view: caps.has('view'),
  }
}
