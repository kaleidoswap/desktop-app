const TX_EXPLORERS: Record<string, string> = {
  Mainnet: 'https://mempool.space/tx/',
  Signet: 'https://mempool.space/signet/tx/',
  // The app's default Signet network is Mutinynet.
  SignetCustom: 'https://mutinynet.com/tx/',
  Testnet: 'https://mempool.space/testnet/tx/',
  Testnet4: 'https://mempool.space/testnet4/tx/',
}

const TXID_RE = /^[0-9a-f]{64}$/i

/** Block explorer URL for an on-chain txid, or null (Regtest, bad txid). */
export const getTxExplorerUrl = (
  network: string | null | undefined,
  txid: string | null | undefined
): string | null => {
  const base = network ? TX_EXPLORERS[network] : undefined
  if (!base || !txid || !TXID_RE.test(txid)) return null
  return `${base}${txid.toLowerCase()}`
}
