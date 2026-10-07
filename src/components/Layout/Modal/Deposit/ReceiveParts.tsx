import { Check, CircleCheckBig, Clock, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useCopyToClipboard } from '../../../../hooks/useCopyToClipboard'

import { REQUIRED_CONFIRMATIONS } from './useReceiveWatchers'

// Long payloads (LN / RGB invoices) keep both ends visible so they can still be
// checked by eye; addresses are short enough to show in full.
const FULL_DISPLAY_MAX = 90
const EDGE_CHARS = 32

const displayValue = (value: string) => {
  if (value.length > FULL_DISPLAY_MAX) {
    return `${value.slice(0, EDGE_CHARS)}…${value.slice(-EDGE_CHARS)}`
  }
  // Group short values in blocks of four for readability; copy stays raw.
  return value.match(/.{1,4}/g)?.join(' ') ?? value
}

interface AddressFieldProps {
  icon: string
  label: string
  value: string
}

export const AddressField = ({ icon, label, value }: AddressFieldProps) => {
  const { t } = useTranslation()
  const { copied, copy } = useCopyToClipboard(1500)

  return (
    <button
      className="w-full text-left p-3 bg-surface-overlay/50 rounded-xl border border-border-default
                 hover:border-primary/50 transition-colors duration-200 group"
      onClick={() => copy(value)}
      title={t('depositModal.step2.actions.copy')}
      type="button"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <img alt="" className="w-4 h-4 flex-shrink-0" src={icon} />
        <span className="text-xs font-medium text-content-secondary flex-1">
          {label}
        </span>
        <span
          className={`flex items-center gap-1 text-xs font-medium transition-colors ${
            copied
              ? 'text-status-success'
              : 'text-content-tertiary group-hover:text-primary'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              {t('depositModal.step2.actions.copied', 'Copied')}
            </>
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </span>
      </div>
      <p
        className={`font-mono text-xs leading-relaxed text-white ${
          value.length > FULL_DISPLAY_MAX ? 'break-all' : 'break-words'
        }`}
      >
        {displayValue(value)}
      </p>
    </button>
  )
}

export const WaitingIndicator = ({ label }: { label: string }) => (
  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-overlay/50 border border-border-default text-xs text-content-secondary">
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
    </span>
    {label}
  </span>
)

interface ReceivedPanelProps {
  confirmed: boolean
  kind: 'btc' | 'rgb'
  amountLabel?: string
  txid?: string
  onDone: () => void
}

export const ReceivedPanel = ({
  confirmed,
  kind,
  amountLabel,
  txid,
  onDone,
}: ReceivedPanelProps) => {
  const { t } = useTranslation()
  const { copied, copy } = useCopyToClipboard(1500)

  return (
    <div className="flex flex-col items-center text-center py-4 animate-fadeIn">
      <div
        className={`relative w-20 h-20 rounded-full flex items-center justify-center ${
          confirmed ? 'bg-status-success-subtle' : 'bg-status-warning-subtle'
        }`}
      >
        {!confirmed && (
          <span className="absolute inset-0 rounded-full border-2 border-status-warning/40 animate-ping" />
        )}
        {confirmed ? (
          <CircleCheckBig className="w-10 h-10 text-status-success" />
        ) : (
          <Clock className="w-10 h-10 text-status-warning" />
        )}
      </div>

      <h4 className="mt-5 text-lg font-bold text-white">
        {confirmed
          ? t('depositModal.step2.received.title', 'Payment received')
          : t('depositModal.step2.received.detectedTitle', 'Payment detected')}
      </h4>

      {amountLabel && (
        <p className="mt-1 text-2xl font-semibold text-white tabular-nums">
          +{amountLabel}
        </p>
      )}

      {!confirmed && (
        <span className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-status-warning-subtle text-xs font-medium text-status-warning">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-status-warning opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-status-warning" />
          </span>
          {t('depositModal.step2.received.confirmations', {
            count: 0,
            defaultValue: '{{count}}/{{required}} confirmations',
            required: REQUIRED_CONFIRMATIONS,
          })}
        </span>
      )}

      <p className="mt-3 text-sm text-content-secondary max-w-xs">
        {confirmed
          ? t(
              'depositModal.step2.received.confirmedBody',
              'The funds are now in your wallet.'
            )
          : kind === 'rgb'
            ? t(
                'depositModal.step2.received.pendingBodyRgb',
                'The transfer was accepted and is waiting for on-chain confirmation. The assets become spendable once it confirms — you can close this window.'
              )
            : t(
                'depositModal.step2.received.pendingBody',
                'The transaction is in the mempool. Funds become spendable once it confirms — you can close this window.'
              )}
      </p>

      {txid && (
        <button
          className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-overlay/50 border border-border-default
                     text-xs font-mono text-content-secondary hover:text-white hover:border-primary/50 transition-colors"
          onClick={() => copy(txid)}
          title={t('depositModal.step2.actions.copy')}
          type="button"
        >
          <span>
            {txid.slice(0, 10)}…{txid.slice(-10)}
          </span>
          {copied ? (
            <Check className="w-3.5 h-3.5 text-status-success" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      )}

      <button
        className="mt-6 w-full py-2.5 px-4 bg-primary hover:bg-primary-emphasis text-primary-foreground
                   rounded-xl font-semibold transition-colors text-sm"
        onClick={onDone}
        type="button"
      >
        {t('depositModal.common.done', 'Done')}
      </button>
    </div>
  )
}
