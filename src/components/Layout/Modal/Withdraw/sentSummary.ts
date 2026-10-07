import { BTC_ASSET_ID } from '../../../../constants'

import type { SentSummary } from './components/SentPanel'

export interface SentInput {
  address?: string | null
  amount?: number | string | null
  asset_id?: string | null
  decodedInvoice?: { asset_id?: string | null; amt_msat?: number | null } | null
}

/** What the "Payment sent" screen shows for a completed send. */
export const buildSentSummary = (
  data: SentInput | null,
  kind: SentSummary['kind'],
  reference: string | null | undefined,
  bitcoinUnit: string,
  assets: { asset_id?: string | null; ticker?: string | null }[]
): SentSummary => {
  if (!data) return { kind, reference: reference ?? undefined }
  const assetForLabel = data.decodedInvoice?.asset_id || data.asset_id
  const isBtc = !assetForLabel || assetForLabel === BTC_ASSET_ID
  const unit = isBtc
    ? bitcoinUnit === 'SAT'
      ? 'SATS'
      : bitcoinUnit
    : (assets.find((a) => a.asset_id === assetForLabel)?.ticker ?? '')
  const entered = Number(String(data.amount ?? '').replace(/,/g, ''))
  let amount =
    entered > 0
      ? entered.toLocaleString(undefined, { maximumFractionDigits: 8 })
      : undefined
  const invoiceMsat = data.decodedInvoice?.amt_msat
  if (!amount && isBtc && invoiceMsat) {
    const sats = invoiceMsat / 1000
    amount =
      bitcoinUnit === 'SAT' ? sats.toLocaleString() : (sats / 1e8).toFixed(8)
  }
  return {
    amountLabel: amount ? `${amount} ${unit}`.trim() : undefined,
    destination: data.address || undefined,
    kind,
    reference: reference ?? undefined,
  }
}
