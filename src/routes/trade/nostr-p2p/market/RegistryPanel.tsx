import type { AssetFacts, RegistryNote } from '../api'
import { short } from '../format'

import { useTr } from './hooks'
import { registryFacts, type Fact, type FactTone } from './registry'
import { cx } from './ui'

const dot: Record<FactTone, string> = {
  danger: 'bg-status-danger',
  default: 'bg-content-secondary',
  muted: 'bg-content-tertiary/50',
  success: 'bg-status-success',
  warning: 'bg-status-warning',
}

const text: Record<FactTone, string> = {
  danger: 'text-status-danger',
  default: 'text-content-primary',
  muted: 'text-content-tertiary',
  success: 'text-content-primary',
  warning: 'text-content-primary',
}

/** What the asset registry published about an asset, as plain facts. Not a verdict. */
export function RegistryPanel({
  note,
  facts,
}: {
  note: RegistryNote | null
  /** `undefined` while it is being asked for; `null` when the daemon reads no registry. */
  facts: AssetFacts | null | undefined
}) {
  const tr = useTr()
  const list = registryFacts(note, facts)
  if (!list.length) return null

  const line = (f: Fact): string => {
    const v = f.vars ?? {}
    switch (f.id) {
      case 'listing':
        return f.tone === 'muted'
          ? tr('registry.notListed', 'Not in the registry')
          : v.by
            ? tr('registry.listedBy', 'Listed in the registry by {{by}}', {
                by: String(v.by),
              })
            : tr('registry.listed', 'Listed in the registry')
      case 'tickerDiffers':
        return tr(
          'registry.tickerDiffers',
          'The maker calls it something else. The registry lists it as {{ticker}}.',
          { ticker: String(v.ticker) }
        )
      case 'contract':
        return f.tone === 'danger'
          ? tr(
              'registry.contractBad',
              'The contract does not validate against its genesis'
            )
          : tr(
              'registry.contractOk',
              'The contract validates against its genesis'
            )
      case 'declaration':
        return f.tone === 'muted'
          ? tr('registry.noDeclaration', 'Nobody has declared this asset')
          : tr('registry.declared', 'A declaration was signed by {{address}}', {
              address: short(String(v.address), 6),
            })
      case 'proof':
        return f.tone === 'success'
          ? tr(
              'registry.proofOk',
              'A proof that the signer is the issuer was checked'
            )
          : tr('registry.noProof', 'No proof that the signer is the issuer')
      case 'sameTicker':
        return tr(
          'registry.sameTicker',
          'Contracts with the same ticker: {{n}}',
          { n: Number(v.n) }
        )
      case 'impersonation':
        return tr(
          'registry.impersonation',
          'The registry flags this asset as an imitation'
        )
      case 'dispute':
        return tr('registry.dispute', 'A dispute is open on this asset')
      case 'contested':
        return tr('registry.contested', 'Contests filed: {{n}}', {
          n: Number(v.n),
        })
    }
  }

  return (
    <section
      aria-label={tr('registry.title', 'What the registry says')}
      className="flex flex-col gap-2 rounded-xl bg-surface-inset p-3"
    >
      <h4 className="text-caption font-medium text-content-primary">
        {tr('registry.title', 'What the registry says')}
      </h4>
      <ul className="flex flex-col gap-1.5">
        {list.map((f, i) => (
          <li
            className="flex items-start gap-2 text-caption"
            key={`${f.id}-${i}`}
          >
            <span
              aria-hidden
              className={cx(
                'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                dot[f.tone]
              )}
            />
            <span className={text[f.tone]}>{line(f)}</span>
          </li>
        ))}
        {facts === undefined && (
          <li className="text-caption text-content-tertiary">
            {tr('registry.asking', 'Asking the registry…')}
          </li>
        )}
      </ul>
      <p className="text-tiny text-content-tertiary">
        {tr(
          'registry.footnote',
          'These are facts the registry publishes. None of them says an asset is safe.'
        )}
      </p>
    </section>
  )
}
