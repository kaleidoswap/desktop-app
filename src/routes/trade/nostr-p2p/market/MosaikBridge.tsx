import { openUrl } from '@tauri-apps/plugin-opener'
import { ArrowUpRight, Monitor, Globe } from 'lucide-react'
import { useState } from 'react'

const PREVIEW = 'https://kaleido-edge.mole-pangolin.ts.net:8444/'

/** The private preview is a separate wallet and origin, never a wallet export. */
export function MosaikBridge({ network }: { network: string }) {
  const [error, setError] = useState('')
  if (network !== 'signetcustom') return null
  async function openMarket() {
    try {
      await openUrl(PREVIEW)
      setError('')
    } catch {
      setError(
        'Could not open your browser. Connect to the beta Tailscale VPN and try again.'
      )
    }
  }
  return (
    <section
      className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-surface-card p-5"
      aria-label="Desktop and Mosaik"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-caption font-semibold uppercase tracking-widest text-primary">
            One market · two ways to trade
          </p>
          <h2 className="mt-1 text-xl font-semibold text-content-primary">
            Your offers, on Mosaik.
          </h2>
        </div>
        <button
          type="button"
          onClick={() => void openMarket()}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-text-on-accent"
        >
          Open Mosaik <ArrowUpRight size={16} aria-hidden />
        </button>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="flex gap-3">
          <Monitor className="shrink-0 text-primary" size={20} aria-hidden />
          <div>
            <h3 className="text-sm font-semibold text-content-primary">
              Make an offer here
            </h3>
            <p className="mt-1 text-caption text-content-secondary">
              Fund your trading wallet → choose Limit → set your price. Keep
              desktop online until the swap completes.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Globe className="shrink-0 text-primary" size={20} aria-hidden />
          <div>
            <h3 className="text-sm font-semibold text-content-primary">
              Explore in your browser
            </h3>
            <p className="mt-1 text-caption text-content-secondary">
              Mosaik shows offers on the same network. Accept one with the
              KaleidoSwap extension.
            </p>
          </div>
        </div>
      </div>
      <details className="mt-4 text-caption text-content-secondary">
        <summary className="cursor-pointer">
          Wallets & private preview access
        </summary>
        <p className="mt-2">
          Desktop and the browser extension use separate wallets. Balances do
          not sync between them. Fund each using its own receive address; never
          copy a recovery phrase into Mosaik. The Signet preview needs the beta
          Tailscale VPN. Test coins only.
        </p>
      </details>
      {error && (
        <p role="alert" className="mt-3 text-caption text-status-warning">
          {error}
        </p>
      )}
    </section>
  )
}
