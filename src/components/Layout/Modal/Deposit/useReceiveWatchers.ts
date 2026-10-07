import { useEffect, useRef, useState } from 'react'

import { isBtcWalletTx } from '../../../../helpers/walletHistoryUtils'
import { nodeApi } from '../../../../slices/nodeApi/nodeApi.slice'
import { logger } from '../../../../utils/logger'

const POLL_MS = 8_000

export interface DetectedDeposit {
  txid?: string
  // Base units: sats for BTC, raw asset units for RGB.
  amount?: number
  confirmed: boolean
}

// Watches the BTC wallet for an on-chain deposit that shows up while the
// receive screen is open. Every txid already known when the screen opened is
// ignored, so the first new incoming tx (mempool included) is the deposit.
export const useOnchainDepositWatcher = (
  enabled: boolean
): DetectedDeposit | undefined => {
  const [mountedAt] = useState(() => Date.now())
  const baseline = useRef<Set<string>>()
  const [txid, setTxid] = useState<string>()

  const { data, fulfilledTimeStamp } = nodeApi.useListTransactionsQuery(
    undefined,
    {
      pollingInterval: POLL_MS,
      refetchOnMountOrArgChange: true,
      skip: !enabled,
    }
  )

  useEffect(() => {
    const txs = data?.transactions
    if (!txs || !fulfilledTimeStamp || fulfilledTimeStamp < mountedAt) return
    if (!baseline.current) {
      baseline.current = new Set(txs.map((tx) => tx.txid))
      return
    }
    if (txid) return
    const incoming = txs.find(
      (tx) =>
        !baseline.current!.has(tx.txid) &&
        isBtcWalletTx(tx.transaction_type) &&
        tx.received - tx.sent > 0
    )
    if (incoming) setTxid(incoming.txid)
  }, [data, fulfilledTimeStamp, mountedAt, txid])

  const tx = txid ? data?.transactions?.find((t) => t.txid === txid) : undefined
  if (!tx) return undefined
  return {
    amount: tx.received - tx.sent,
    confirmed: !!tx.confirmation_time,
    txid: tx.txid,
  }
}

// Watches an RGB receive (blinded or witness) by its recipient id. The node
// only advances incoming transfers on `refreshtransfers`, so refresh before
// each poll.
export const useRgbReceiveWatcher = (
  assetId: string | undefined,
  recipientId: string | undefined,
  enabled: boolean
): DetectedDeposit | undefined => {
  const active = enabled && !!assetId && !!recipientId
  const [refresh] = nodeApi.useRefreshMutation()
  const { data, refetch } = nodeApi.useListTransfersQuery(assetId ?? '', {
    skip: !active,
  })

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const tick = async () => {
      try {
        await refresh({}).unwrap()
      } catch (err) {
        logger.warn('refreshTransfers failed while watching receive:', err)
      }
      if (!cancelled) refetch()
    }
    const id = setInterval(tick, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [active, refresh, refetch])

  if (!active) return undefined
  const transfer = data?.transfers?.find((t) => t.recipient_id === recipientId)
  if (
    !transfer ||
    (transfer.status !== 'WaitingConfirmations' &&
      transfer.status !== 'Settled')
  ) {
    return undefined
  }
  const assigned = transfer.assignments?.find((a) => a.type === 'Fungible')
  return {
    amount:
      assigned && 'value' in assigned ? Number(assigned.value) : undefined,
    confirmed: transfer.status === 'Settled',
    txid: transfer.txid ?? undefined,
  }
}
