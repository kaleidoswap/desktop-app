import { openUrl } from '@tauri-apps/plugin-opener'
import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAppSelector } from '../app/store/hooks'
import { getTxExplorerUrl } from '../helpers/explorer'

interface ExplorerLinkProps {
  /** On-chain txid only — not a Lightning payment hash. */
  txid?: string | null
  /** Show the "View in explorer" label next to the icon. */
  withLabel?: boolean
  className?: string
}

/** Opens an on-chain transaction in the block explorer of the account's network. */
export const ExplorerLink = ({
  txid,
  withLabel = false,
  className = '',
}: ExplorerLinkProps) => {
  const { t } = useTranslation()
  const network = useAppSelector((state) => state.nodeSettings.data.network)
  const url = getTxExplorerUrl(network, txid)
  if (!url) return null
  const label = t('common.viewInExplorer', 'View in explorer')

  return (
    <button
      aria-label={label}
      className={`inline-flex items-center gap-1 text-xs text-content-tertiary transition-colors hover:text-primary ${className}`}
      onClick={(e) => {
        e.stopPropagation()
        openUrl(url)
      }}
      title={label}
      type="button"
    >
      <ExternalLink className="h-3.5 w-3.5" />
      {withLabel && label}
    </button>
  )
}
