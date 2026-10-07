interface WalletTx {
  txid: string
  sent: number
  received: number
  confirmation_time?: { timestamp?: number } | null
}

/**
 * The txid of an outgoing transaction that appeared between two snapshots of
 * the wallet's transactions. Used when the node client does not return the
 * txid of a BTC send. Prefers the unconfirmed one (the send just broadcast).
 */
export const findNewOutgoingTxid = (
  beforeTxids: Iterable<string>,
  after: WalletTx[]
): string | undefined => {
  const known = new Set(beforeTxids)
  const fresh = after.filter(
    (tx) => !known.has(tx.txid) && tx.sent > tx.received
  )
  const pending = fresh.filter((tx) => !tx.confirmation_time)
  const pick =
    pending.length === 1
      ? pending[0]
      : fresh.length === 1
        ? fresh[0]
        : undefined
  return pick?.txid
}
