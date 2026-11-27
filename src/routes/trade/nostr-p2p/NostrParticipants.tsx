import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { short } from './format'
import { canonicalNpub, robotParts } from './nostrPublicKey'

const sprites = import.meta.glob<string>('../../../assets/robohash/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
})

function Robot({ npub, size }: { npub: string; size: number }) {
  const [parts, setParts] = useState<Awaited<ReturnType<typeof robotParts>>>()
  useEffect(() => {
    let current = true
    void robotParts(npub)
      .then((result) => {
        if (current) setParts(result)
      })
      .catch(() => {})
    return () => {
      current = false
    }
  }, [npub])
  const sprite =
    parts && sprites[`../../../assets/robohash/${parts.color}.webp`]
  return (
    <span
      aria-hidden
      className="relative inline-block shrink-0 overflow-hidden rounded-full bg-surface-overlay"
      style={{ height: size, width: size }}
    >
      {parts &&
        sprite &&
        parts.layers.map(({ column, row }) => (
          <span
            className="absolute inset-0"
            key={row}
            style={{
              backgroundImage: `url("${sprite}")`,
              backgroundPosition: `${-column * size}px ${-row * size}px`,
              backgroundSize: `${size * 10}px ${size * 5}px`,
            }}
          />
        ))}
    </span>
  )
}

export function NostrAvatar({
  npub,
  size = 24,
}: {
  npub?: string | null
  size?: number
}) {
  const key = canonicalNpub(npub)
  return key ? <Robot key={key} npub={key} size={size} /> : null
}

/** Omit roles for which the daemon hasn't supplied a full public key. */
export function NostrParticipants({
  makers = [],
  taker,
}: {
  makers?: (string | null | undefined)[]
  taker?: string | null
}) {
  const { t } = useTranslation()
  const makerKeys = [
    ...new Set(
      makers.map(canonicalNpub).filter((key): key is string => Boolean(key))
    ),
  ]
  const takerKey = canonicalNpub(taker)
  const people = [
    ...makerKeys.map((npub) => ({ npub, role: 'maker' })),
    ...(takerKey ? [{ npub: takerKey, role: 'taker' }] : []),
  ]
  if (!people.length) return null
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {people.map(({ npub, role }) => (
        <span
          className="inline-flex min-w-0 items-center gap-1.5 text-caption text-content-secondary"
          key={`${role}-${npub}`}
          title={npub}
        >
          <NostrAvatar npub={npub} />
          <span>
            {t(`p2pMarket.profiles.${role}`)}{' '}
            <span className="font-mono">{short(npub, 5)}</span>
          </span>
        </span>
      ))}
    </span>
  )
}
