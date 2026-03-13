import { Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { ClipLoader } from 'react-spinners'

interface WalletBalanceStat {
  label: string
  value: string
}

interface WalletFundsCardProps {
  actionLabel: string
  balances: WalletBalanceStat[]
  description: string
  icon?: ReactNode
  isLoading: boolean
  loadingLabel: string
  onAction: () => void
  title: string
}

export const WalletFundsCard = ({
  actionLabel,
  balances,
  description,
  icon,
  isLoading,
  loadingLabel,
  onAction,
  title,
}: WalletFundsCardProps) => {
  return (
    <div className="rounded-[22px] border border-border-subtle bg-surface-overlay/50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/12 text-emerald-200">
          {icon || <Wallet className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-content-tertiary">
            {title}
          </p>
          <p className="mt-2 text-sm text-content-secondary">{description}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl border border-border-subtle bg-surface-base/45 px-4 py-6">
          <ClipLoader color="#3B82F6" size={20} />
          <span className="text-sm text-content-secondary">{loadingLabel}</span>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {balances.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {balances.map((balance) => (
                <div
                  key={balance.label}
                  className="rounded-2xl border border-border-subtle bg-surface-base/45 px-4 py-3"
                >
                  <p className="text-[11px] uppercase tracking-[0.26em] text-content-tertiary">
                    {balance.label}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-content-primary">
                    {balance.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-[#12131C] transition-colors hover:bg-primary-emphasis"
            onClick={onAction}
            type="button"
          >
            <Wallet className="h-4 w-4" />
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  )
}
