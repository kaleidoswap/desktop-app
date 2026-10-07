import { ChevronDown, Database, Server } from 'lucide-react'
import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface BitcoindRpcFieldProps {
  /** The input element bound to the RPC URL by the caller's form. */
  children: ReactNode
  inputId: string
  value: string
  error?: string
  className?: string
}

/**
 * Optional bitcoind RPC URL. Empty means LDK follows the chain through the
 * indexer (TransactionSync); a URL switches it to BlockSync from bitcoind.
 */
export const BitcoindRpcField = ({
  children,
  inputId,
  value,
  error,
  className = '',
}: BitcoindRpcFieldProps) => {
  const { t } = useTranslation()
  const usesBitcoind = !!value?.trim()

  return (
    <div
      className={`space-y-2 rounded-lg border border-border-default/40 bg-surface-overlay/20 p-3 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <label
          className="block text-sm font-medium text-content-secondary"
          htmlFor={inputId}
        >
          {t('chainSync.label')}
        </label>
        <span className="rounded-md border border-border-default/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-content-tertiary">
          {t('chainSync.optionalBadge')}
        </span>
      </div>

      {children}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <p className="flex items-center gap-1.5 text-xs text-content-tertiary">
        {usesBitcoind ? (
          <Server className="h-3.5 w-3.5 shrink-0 text-secondary" />
        ) : (
          <Database className="h-3.5 w-3.5 shrink-0 text-primary" />
        )}
        {usesBitcoind
          ? t('chainSync.activeBitcoind')
          : t('chainSync.activeIndexer')}
      </p>

      <details className="group text-xs">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-primary hover:underline [&::-webkit-details-marker]:hidden">
          {t('chainSync.learnMore')}
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          <div
            className={`rounded-md border p-2.5 ${
              usesBitcoind
                ? 'border-border-default/40'
                : 'border-primary/40 bg-primary/5'
            }`}
          >
            <p className="mb-1 font-semibold text-white">
              {t('chainSync.indexerTitle')}
            </p>
            <p className="text-content-secondary">
              {t('chainSync.indexerBody')}
            </p>
          </div>
          <div
            className={`rounded-md border p-2.5 ${
              usesBitcoind
                ? 'border-secondary/40 bg-secondary/5'
                : 'border-border-default/40'
            }`}
          >
            <p className="mb-1 font-semibold text-white">
              {t('chainSync.bitcoindTitle')}
            </p>
            <p className="text-content-secondary">
              {t('chainSync.bitcoindBody')}
            </p>
          </div>
        </div>
      </details>
    </div>
  )
}
