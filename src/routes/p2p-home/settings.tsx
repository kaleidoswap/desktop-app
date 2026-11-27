import { PageHeader } from 'kaleido-ui'
import { KeyRound, RadioTower, RefreshCw, ScanSearch } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../components/ui'
import { ApplicationPreferences } from '../settings/ApplicationPreferences'
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

function TradingWalletPreferences({ networkKey }: { networkKey: string }) {
  const { t } = useTranslation()
  const { rescan, restart } = useP2pSession()
  const [relays, setRelays] = useState<P2pRelaySettings | null>(null)
  const [editRelays, setEditRelays] = useState(false)
  const [recovery, setRecovery] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (editRelays) return
    let current = true
    p2pRelaysGet(networkKey)
      .then((result) => {
        if (current) setRelays(result)
      })
      .catch(() => {
        if (current) setRelays(null)
      })
    return () => {
      current = false
    }
  }, [networkKey, editRelays])
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
    <>
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
        title={t('p2pSettings.recovery', {
          defaultValue: 'Recovery phrase',
        })}
      >
        <Button
          icon={<KeyRound size={14} />}
          onClick={() => setRecovery(true)}
          variant="outline"
        >
          {t('p2pSettings.showRecovery', {
            defaultValue: 'Show the phrase',
          })}
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
        networkKey={networkKey}
        onClose={() => setEditRelays(false)}
        onSaved={() => void restart()}
      />
      <RecoveryPhraseModal
        isOpen={recovery}
        onClose={() => setRecovery(false)}
      />
    </>
  )
}

export function Component() {
  const { t } = useTranslation()
  const { account, config, phase } = useP2pSession()
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('settings.applicationSettings')} variant="page" />
      <ApplicationPreferences />
      {phase === 'running' && config && (
        <TradingWalletPreferences key={account} networkKey={config.key} />
      )}
    </div>
  )
}
