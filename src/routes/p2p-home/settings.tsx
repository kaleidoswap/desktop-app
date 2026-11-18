import { KeyRound, RadioTower, RefreshCw, ScanSearch } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../components/ui'
import { p2pRelaysGet, type P2pRelaySettings } from '../trade/nostr-p2p/p2p'
import { RecoveryPhraseModal } from '../trade/nostr-p2p/RecoveryPhraseModal'
import { RelaysModal } from '../trade/nostr-p2p/RelaysModal'
import { useP2pSession } from '../trade/nostr-p2p/session'

const Section = ({
  title,
  body,
  children,
}: {
  title: string
  body: string
  children: ReactNode
}) => (
  <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-divider/10 bg-surface-elevated/40 p-5">
    <div className="flex min-w-[260px] flex-1 flex-col gap-1">
      <h2 className="text-base font-medium text-content-primary">{title}</h2>
      <p className="text-sm leading-relaxed text-content-tertiary">{body}</p>
    </div>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </section>
)

/** The trading wallet's settings: its network, relays, recovery phrase and upkeep. */
export const Component = () => {
  const { t } = useTranslation()
  const session = useP2pSession()
  const { config, networks, networkKey, setNetworkKey, restart, rescan } =
    session
  const [relays, setRelays] = useState<P2pRelaySettings | null>(null)
  const [editRelays, setEditRelays] = useState(false)
  const [recovery, setRecovery] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!config || editRelays) return
    p2pRelaysGet(config.key)
      .then(setRelays)
      .catch(() => setRelays(null))
  }, [config, editRelays])

  if (!config) return null
  const relayList = relays ? (relays.custom ?? relays.defaults) : []

  const run = async (f: () => Promise<void>) => {
    setBusy(true)
    try {
      await f()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-content-primary">
        {t('p2pShell.settings', { defaultValue: 'Settings' })}
      </h1>

      {networks.length > 1 && (
        <Section
          body={t('p2pSettings.networkBody', {
            defaultValue:
              'Each network has wallets of its own. Switching restarts the trading wallet.',
          })}
          title={t('p2pSettings.network', { defaultValue: 'Network' })}
        >
          <select
            aria-label={t('p2pSettings.network', { defaultValue: 'Network' })}
            className="min-h-11 rounded-lg bg-surface-inset px-3 text-sm text-content-primary outline-none"
            onChange={(e) => setNetworkKey(e.target.value)}
            value={networkKey || config.key}
          >
            {networks.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </Section>
      )}

      <Section
        body={
          relays
            ? `${relayList.join(' · ')}${relays.custom ? '' : ` (${t('p2pSettings.defaults', { defaultValue: 'the defaults' })})`}`
            : t('p2pSettings.relaysBody', {
                defaultValue:
                  'Offers and messages travel over Nostr relays you choose.',
              })
        }
        title={t('p2pSettings.relays', {
          count: relayList.length,
          defaultValue: 'Relays',
        })}
      >
        <Button
          icon={<RadioTower size={14} />}
          onClick={() => setEditRelays(true)}
          variant="outline"
        >
          {t('p2pSettings.editRelays', { defaultValue: 'Edit relays' })}
        </Button>
      </Section>

      <Section
        body={t('p2pSettings.recoveryBody', {
          defaultValue:
            'The 12 words restore your bitcoin. RGB assets also need the wallet data on this computer.',
        })}
        title={t('p2pSettings.recovery', { defaultValue: 'Recovery phrase' })}
      >
        <Button
          icon={<KeyRound size={14} />}
          onClick={() => setRecovery(true)}
          variant="outline"
        >
          {t('p2pSettings.showRecovery', { defaultValue: 'Show the phrase' })}
        </Button>
      </Section>

      <Section
        body={t('p2pSettings.upkeepBody', {
          defaultValue:
            'Restart takes your open offers off the market and puts them back. A full scan finds a deposit the quick sync missed; it takes longer.',
        })}
        title={t('p2pSettings.upkeep', { defaultValue: 'Trading wallet' })}
      >
        <Button
          disabled={busy}
          icon={<ScanSearch size={14} />}
          onClick={() => void run(rescan)}
          variant="outline"
        >
          {t('p2pSettings.rescan', { defaultValue: 'Full scan' })}
        </Button>
        <Button
          disabled={busy}
          icon={<RefreshCw size={14} />}
          onClick={() => void run(restart)}
          variant="outline"
        >
          {t('p2pSettings.restart', { defaultValue: 'Restart' })}
        </Button>
      </Section>

      <RelaysModal
        isOpen={editRelays}
        networkKey={config.key}
        onClose={() => setEditRelays(false)}
        onSaved={() => void restart()}
      />
      <RecoveryPhraseModal
        isOpen={recovery}
        onClose={() => setRecovery(false)}
      />
    </div>
  )
}
