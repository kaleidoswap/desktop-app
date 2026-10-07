import {
  Check,
  CircleCheckBig,
  Copy,
  Link as ChainIcon,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useCopyToClipboard } from '../../../../../hooks/useCopyToClipboard'
import { ExplorerLink } from '../../../../ExplorerLink'

export interface SentSummary {
  kind: 'lightning' | 'onchain' | 'rgb'
  amountLabel?: string
  destination?: string
  /** Payment hash (Lightning) or txid (on-chain / RGB). */
  reference?: string
}

const shorten = (value: string, edge = 12) =>
  value.length > edge * 2 + 1
    ? `${value.slice(0, edge)}…${value.slice(-edge)}`
    : value

const CopyRow = ({ label, value }: { label: string; value: string }) => {
  const { t } = useTranslation()
  const { copied, copy } = useCopyToClipboard(1500)
  return (
    <button
      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-high/40"
      onClick={() => copy(value)}
      title={t('depositModal.step2.actions.copy')}
      type="button"
    >
      <span className="text-xs text-content-tertiary">{label}</span>
      <span className="flex min-w-0 items-center gap-2 font-mono text-xs text-content-secondary">
        <span className="truncate">{shorten(value)}</span>
        {copied ? (
          <Check className="h-3.5 w-3.5 flex-shrink-0 text-status-success" />
        ) : (
          <Copy className="h-3.5 w-3.5 flex-shrink-0" />
        )}
      </span>
    </button>
  )
}

export const SentPanel = ({
  summary,
  onDone,
}: {
  summary: SentSummary
  onDone: () => void
}) => {
  const { t } = useTranslation()

  const method =
    summary.kind === 'lightning'
      ? {
          icon: <Zap className="h-3.5 w-3.5 text-network-lightning" />,
          label: t('withdrawModal.sent.lightning', 'Lightning'),
        }
      : {
          icon: <ChainIcon className="h-3.5 w-3.5 text-network-bitcoin" />,
          label:
            summary.kind === 'rgb'
              ? t('withdrawModal.sent.rgbOnchain', 'RGB on-chain')
              : t('withdrawModal.sent.onchain', 'On-chain'),
        }

  const body = {
    lightning: t(
      'withdrawModal.sent.lightningBody',
      'The payment settled over Lightning.'
    ),
    onchain: t(
      'withdrawModal.sent.onchainBody',
      'The transaction was broadcast. It confirms in the next blocks.'
    ),
    rgb: t(
      'withdrawModal.sent.rgbBody',
      'The transfer was sent. The recipient receives it once the transaction confirms.'
    ),
  }[summary.kind]

  return (
    <div className="flex animate-fadeIn flex-col items-center py-4 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-status-success-subtle">
        <span className="absolute inset-0 animate-ping rounded-full border-2 border-status-success/30 [animation-iteration-count:2]" />
        <CircleCheckBig className="h-10 w-10 text-status-success" />
      </div>

      <h4 className="mt-5 text-lg font-bold text-white">
        {t('withdrawModal.sent.title', 'Payment sent')}
      </h4>
      {summary.amountLabel && (
        <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
          −{summary.amountLabel}
        </p>
      )}
      <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border-default px-2.5 py-1 text-xs text-content-secondary">
        {method.icon}
        {method.label}
      </span>
      <p className="mt-3 max-w-xs text-sm text-content-secondary">{body}</p>

      {(summary.destination || summary.reference) && (
        <div className="mt-5 w-full divide-y divide-divider/10 overflow-hidden rounded-xl border border-border-default bg-surface-overlay/40">
          {summary.destination && (
            <CopyRow
              label={t('withdrawModal.sent.to', 'To')}
              value={summary.destination}
            />
          )}
          {summary.reference && (
            <CopyRow
              label={
                summary.kind === 'lightning'
                  ? t('withdrawModal.sent.paymentHash', 'Payment hash')
                  : t('withdrawModal.sent.txid', 'Transaction ID')
              }
              value={summary.reference}
            />
          )}
        </div>
      )}
      {summary.kind !== 'lightning' && (
        <ExplorerLink className="mt-3" txid={summary.reference} withLabel />
      )}

      <button
        className="mt-6 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-emphasis"
        onClick={onDone}
        type="button"
      >
        {t('depositModal.common.done', 'Done')}
      </button>
    </div>
  )
}
