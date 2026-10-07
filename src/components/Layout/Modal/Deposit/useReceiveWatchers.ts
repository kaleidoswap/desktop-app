import { useEffect, useRef, useState } from 'react'

import { isBtcWalletTx } from '../../../../helpers/walletHistoryUtils'
import { nodeApi } from '../../../../slices/nodeApi/nodeApi.slice'
import { logger } from '../../../../utils/logger'

const POLL_MS = 8_000

// BTC is spendable after one confirmation and RGB invoices are created with
// `min_confirmations: 1` (see NodeApiWrapper.createRgbInvoice).
export const REQUIRED_CONFIRMATIONS = 1

export interface DetectedDeposit {
  txid?: string
  // Base units: sats for BTC, raw asset units for RGB.
  amount?: number
  confirmed: boolean
}

// Watches the BTC wallet for an on-chain deposit while the receive screen is
// showing an address. rgb-lib returns mempool txs with no confirmation_time,
// so the deposit is reported as soon as it is broadcast. Every txid known when
// watching started is ignored; polling stops once the deposit confirms.
export const useOnchainDepositWatcher = (
  enabled: boolean
): DetectedDeposit | undefined => {
  const [startedAt] = useState(() => Date.now())
  const baseline = useRef<Set<string>>()
  const [deposit, setDeposit] = useState<DetectedDeposit>()

  const { data, fulfilledTimeStamp } = nodeApi.useListTransactionsQuery(
    undefined,
    {
      pollingInterval: POLL_MS,
      refetchOnMountOrArgChange: true,
      skip: !enabled || !!deposit?.confirmed,
    }
  )

  useEffect(() => {
    const txs = data?.transactions
    if (!enabled || !txs || !fulfilledTimeStamp) return
    if (fulfilledTimeStamp < startedAt) return
    if (!baseline.current) {
      baseline.current = new Set(txs.map((tx) => tx.txid))
      return
    }
    const tx = deposit?.txid
      ? txs.find((t) => t.txid === deposit.txid)
      : txs.find(
          (t) =>
            !baseline.current!.has(t.txid) &&
            isBtcWalletTx(t.transaction_type) &&
            t.received - t.sent > 0
        )
    if (!tx) return
    const next = {
      amount: tx.received - tx.sent,
      confirmed: !!tx.confirmation_time,
      txid: tx.txid,
    }
    if (next.txid !== deposit?.txid || next.confirmed !== deposit?.confirmed) {
      setDeposit(next)
    }
  }, [data, fulfilledTimeStamp, startedAt, enabled, deposit])

  return deposit
}

// Watches an RGB receive (blinded or witness) by its recipient id. The node
// only advances incoming transfers on `refreshtransfers`, so refresh before
// each poll. `WaitingConfirmations` means the consignment was accepted and the
// transfer is pending on-chain; `Settled` means it reached the confirmations.
export const useRgbReceiveWatcher = (
  assetId: string | undefined,
  recipientId: string | undefined,
  enabled: boolean
): DetectedDeposit | undefined => {
  const [refresh] = nodeApi.useRefreshMutation()
  const { data, refetch } = nodeApi.useListTransfersQuery(assetId ?? '', {
    skip: !enabled || !assetId || !recipientId,
  })
  const transfer = recipientId
    ? data?.transfers?.find((t) => t.recipient_id === recipientId)
    : undefined
  const isSettled = transfer?.status === 'Settled'
  const active = enabled && !!assetId && !!recipientId && !isSettled

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

  if (
    !enabled ||
    !transfer ||
    (transfer.status !== 'WaitingConfirmations' && !isSettled)
  ) {
    return undefined
  }
  const assigned = transfer.assignments?.find((a) => a.type === 'Fungible')
  return {
    amount:
      assigned && 'value' in assigned ? Number(assigned.value) : undefined,
    confirmed: isSettled,
    txid: transfer.txid ?? undefined,
  }
}
