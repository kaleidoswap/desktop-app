import { NostrAvatar } from '../NostrParticipants'
import { BadgeCheck, Radio } from 'lucide-react'
import { useEffect, useState } from 'react'

import { marketApi, type MakerProfile } from '../api'
import { fmtUnits, short } from '../format'
import { useTr } from './hooks'

export interface MakerShare {
  /** The short key the book shows. */
  maker: string
  /** The whole key, when the daemon gives it. */
  npub?: string
  amount: number
  away: boolean
}

/**
 * The makers that fill a swap, each with the name it gives itself and its NIP-05 address, marked
 * when the address's domain confirms the key. Profiles are asked for only when this list opens:
 * checking a NIP-05 address asks its domain, which then sees this computer.
 */
export function MakerList({
  assetId,
  network,
  makers,
  precision,
  ticker,
}: {
  assetId?: string
  network?: string
  makers: MakerShare[]
  precision: number
  ticker: string
}) {
  const tr = useTr()
  const [response, setResponse] = useState<{
    request: string
    profiles: Record<string, MakerProfile>
  } | null>(null)
  const npubs = makers.map((m) => m.npub).filter((n): n is string => !!n)
  const key = [...new Set(npubs)].slice(0, 20).join(',')
  const request = JSON.stringify([network, key])
  const profiles = response?.request === request ? response.profiles : undefined

  useEffect(() => {
    if (!key) return
    let live = true
    marketApi
      .makers(key.split(','))
      .then((list) => {
        if (live)
          setResponse({
            profiles: Object.fromEntries(list.map((p) => [p.npub, p])),
            request,
          })
      })
      .catch(() => {
        if (live) setResponse(null)
      })
    return () => {
      live = false
    }
  }, [key, request])

  return (
    <>
      {makers.map((m) => {
        const p = m.npub ? profiles?.[m.npub] : undefined
        return (
          <div
            className="col-span-2 flex flex-wrap items-center gap-2 rounded-lg bg-surface-elevated/60 px-3 py-2 text-xs"
            key={m.maker}
            title={m.npub}
          >
            <span
              aria-hidden
              className={`h-2 w-2 flex-none rounded-full ${m.away ? 'bg-content-tertiary' : 'bg-status-success'}`}
            />
            <NostrAvatar npub={m.npub ?? m.maker} />
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1">
                {p?.name ? (
                  <span className="truncate font-medium text-content-primary">
                    {p.name}
                  </span>
                ) : (
                  <span className="font-mono text-content-secondary">
                    {short(m.npub ?? m.maker, 6)}
                  </span>
                )}
                {p?.nip05_verified && (
                  <span
                    className="inline-flex items-center gap-0.5 text-status-success"
                    title={tr(
                      'swap.nip05Verified',
                      '{{domain}} confirms this key',
                      { domain: p.nip05?.split('@')[1] ?? '' }
                    )}
                  >
                    <BadgeCheck className="h-3.5 w-3.5" />
                  </span>
                )}
              </span>
              <span className="truncate text-content-tertiary">
                {p?.nip05 && (
                  <span
                    className={p.nip05_verified ? 'text-content-secondary' : ''}
                  >
                    {p.nip05.startsWith('_@') ? p.nip05.slice(2) : p.nip05}
                    {!p.nip05_verified &&
                      ` (${tr('swap.nip05Unconfirmed', 'not confirmed')})`}
                    {' · '}
                  </span>
                )}
                {m.away
                  ? tr('swap.makerAway', 'Away: may take a moment to answer')
                  : tr('swap.makerOnline', 'Online now')}
              </span>
            </span>
            <span className="ml-auto flex-none text-content-primary">
              {fmtUnits(m.amount, precision)} {ticker}
            </span>
            {network === 'signetcustom' && m.npub && profiles && (
              <MakerReputationPanel assetId={assetId} profile={p} />
            )}
          </div>
        )
      })}
      {profiles && Object.keys(profiles).length > 0 && (
        <p className="col-span-2 px-1 text-[11px] leading-relaxed text-content-tertiary">
          {tr(
            'swap.makerNamesNote',
            'Names are what each maker calls itself. A check mark means the named website confirms the maker’s key.'
          )}
        </p>
      )}
    </>
  )
}

function MakerReputationPanel({
  profile,
  assetId,
}: {
  profile?: MakerProfile
  assetId?: string
}) {
  const tr = useTr()
  const score = profile?.reputation
  const [expired, setExpired] = useState<string>()
  useEffect(() => {
    if (!score) return
    const remaining = score.expires_at * 1000 - Date.now()
    if (remaining <= 0) return
    const timer = window.setTimeout(() => setExpired(score.event_id), remaining)
    return () => window.clearTimeout(timer)
  }, [score])
  const current =
    score && score.expires_at * 1000 > Date.now() && expired !== score.event_id
  const issuer = !!assetId && profile?.issuer_assets?.includes(assetId)
  return (
    <div className="w-full border-t border-divider/20 pt-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Radio aria-hidden className="h-3.5 w-3.5 text-content-secondary" />
        <span className="font-medium text-content-primary">
          {tr('reputation.title', 'Mosaik reputation')}
        </span>
        {current && score.verified && (
          <span className="rounded bg-status-success/10 px-1.5 py-0.5 text-status-success">
            {tr('reputation.verified', 'Verified by Mosaik')}
          </span>
        )}
        {issuer && (
          <span className="text-content-secondary">
            {tr('reputation.issuer', 'Listed issuer of this asset')}
          </span>
        )}
      </div>
      {current ? (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-content-secondary">
          <dt>{tr('reputation.settled', 'Settled swaps · 30 days')}</dt>
          <dd className="text-right tabular-nums text-content-primary">
            {score.settled.toLocaleString()}
          </dd>
          <dt>{tr('reputation.peers', 'Distinct counterparties')}</dt>
          <dd className="text-right tabular-nums text-content-primary">
            {score.counterparties.toLocaleString()}
          </dd>
          <dt>{tr('reputation.volume', 'Volume in sats')}</dt>
          <dd className="text-right tabular-nums text-content-primary">
            {score.volume_sat.toLocaleString()}
          </dd>
        </dl>
      ) : (
        <p className="mt-1 text-content-tertiary">
          {tr(
            'reputation.unavailable',
            'No current signed report for this maker.'
          )}
        </p>
      )}
    </div>
  )
}
