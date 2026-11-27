import { openUrl } from '@tauri-apps/plugin-opener'
import { Button } from 'kaleido-ui'
import { ArrowUpRight } from 'lucide-react'
import { useState } from 'react'

import { useTr } from './hooks'

const PREVIEW = 'https://kaleido-edge.mole-pangolin.ts.net:8444/'

export function MosaikBridge({ network }: { network: string }) {
  const tr = useTr()
  const [failed, setFailed] = useState(false)
  if (network !== 'signetcustom') return null

  async function openMarket() {
    try {
      await openUrl(PREVIEW)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
      <Button
        onClick={() => void openMarket()}
        size="sm"
        type="button"
        variant="outline"
      >
        {tr('offers.openMosaik', 'Open Mosaik')}
        <ArrowUpRight aria-hidden size={15} />
      </Button>
      <p className="text-caption text-content-secondary">
        {tr(
          'offers.mosaikAccess',
          'The preview requires the beta Tailscale VPN and uses a separate extension wallet.'
        )}
      </p>
      {failed && (
        <p className="text-caption text-status-warning" role="alert">
          {tr(
            'offers.mosaikOpenError',
            'Connect to the beta Tailscale VPN and try opening Mosaik again.'
          )}
        </p>
      )}
    </div>
  )
}
