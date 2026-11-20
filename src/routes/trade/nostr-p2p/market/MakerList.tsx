import { BadgeCheck } from 'lucide-react'
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
  makers,
  precision,
  ticker,
}: {
  makers: MakerShare[]
  precision: number
  ticker: string
}) {
  const tr = useTr()
  const [profiles, setProfiles] = useState<Record<string, MakerProfile>>({})
  const npubs = makers
    .map((m) => m.npub)
    .filter((n): n is string => !!n)
    .slice(0, 20)
  const key = npubs.join(',')

  useEffect(() => {
    if (!key) return
    let live = true
    marketApi
      .makers(key.split(','))
      .then((list) => {
        if (live) setProfiles(Object.fromEntries(list.map((p) => [p.npub, p])))
      })
      .catch(() => {
        // an older daemon or no relay answer: the keys alone still show
      })
    return () => {
      live = false
    }
  }, [key])

  return (
    <>
      {makers.map((m) => {
        const p = m.npub ? profiles[m.npub] : undefined
        return (
          <div
            className="col-span-2 flex items-center gap-2 rounded-lg bg-surface-elevated/60 px-3 py-2 text-xs"
            key={m.maker}
            title={m.npub}
          >
            <span
              aria-hidden
              className={`h-2 w-2 flex-none rounded-full ${m.away ? 'bg-content-tertiary' : 'bg-status-success'}`}
            />
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
          </div>
        )
      })}
      {Object.keys(profiles).length > 0 && (
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
