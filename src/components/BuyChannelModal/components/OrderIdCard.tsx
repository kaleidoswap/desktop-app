import { Copy } from 'lucide-react'
import CopyToClipboard from 'react-copy-to-clipboard'

interface OrderIdCardProps {
  copyLabel: string
  onCopy?: () => void
  orderId?: string | null
}

export const OrderIdCard = ({
  copyLabel,
  onCopy,
  orderId,
}: OrderIdCardProps) => {
  return (
    <div className="rounded-[16px] border border-border-subtle bg-surface-base/80 p-3 shadow-md">
      <div className="flex h-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.26em] text-content-tertiary">
            Order ID
          </p>
          <p className="mt-1.5 break-all font-mono text-xs text-content-primary">
            {orderId || 'Pending'}
          </p>
        </div>

        {orderId && (
          <CopyToClipboard onCopy={onCopy} text={orderId}>
            <button className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-surface-overlay/60 px-2 py-1 text-[11px] font-medium text-content-primary transition-colors hover:border-cyan-400/40 hover:text-cyan-200">
              <Copy className="h-3 w-3" />
              {copyLabel}
            </button>
          </CopyToClipboard>
        )}
      </div>
    </div>
  )
}
