import { open } from '@tauri-apps/plugin-dialog'
import {
  ArrowLeft,
  CheckCircle2,
  Coins,
  Copy,
  Gem,
  ImageIcon,
  Sprout,
  TrendingUp,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { P2P_TRADE_PATH } from '../../app/router/paths'
import { Modal } from '../../components/ui'
import { fmtUnits, toBase } from '../trade/nostr-p2p/format'
import { AssetMark } from '../trade/nostr-p2p/market/AssetSelect'
import { Picker } from '../trade/nostr-p2p/market/Picker'
import { transport } from '../trade/nostr-p2p/transport'

import {
  checkForm,
  emptyForm,
  issueRequest,
  MAX_PARTS,
  needs,
  splitSupply,
  type AssetKind,
  type IssueForm,
} from './issue'

interface Props {
  isOpen: boolean
  onClose: () => void
  onIssued: () => void
}

type Step = 'kind' | 'details' | 'done'

const input =
  'min-h-11 w-full rounded-xl border border-divider/30 bg-surface-base px-3 text-sm text-content-primary outline-none focus:border-primary/60'

const Field = ({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-sm text-content-secondary">{label}</span>
    {children}
    {hint && <span className="text-xs text-content-tertiary">{hint}</span>}
  </label>
)

/** Issuing a new RGB asset from the trading wallet: pick its kind, describe it, issue it. */
export function IssueDialog({ isOpen, onClose, onIssued }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('kind')
  const [form, setForm] = useState<IssueForm>(emptyForm())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const set = (patch: Partial<IssueForm>) =>
    setForm((f) => ({ ...f, ...patch }))
  const n = needs(form.kind)
  const problem = checkForm(form)

  const close = () => {
    setStep('kind')
    setForm(emptyForm())
    setError(null)
    setIssued(null)
    onClose()
  }

  const kinds: {
    kind: AssetKind
    icon: ReactNode
    title: string
    body: string
  }[] = [
    {
      body: t('p2pIssue.nia', {
        defaultValue:
          'A fungible token with a fixed supply, like a stablecoin or a share. The usual choice.',
      }),
      icon: <Coins className="h-5 w-5" />,
      kind: 'NIA',
      title: t('p2pIssue.niaTitle', { defaultValue: 'Token' }),
    },
    {
      body: t('p2pIssue.ifa', {
        defaultValue:
          'A fungible token you can mint more of later, up to a cap you set now.',
      }),
      icon: <TrendingUp className="h-5 w-5" />,
      kind: 'IFA',
      title: t('p2pIssue.ifaTitle', { defaultValue: 'Inflatable token' }),
    },
    {
      body: t('p2pIssue.cfa', {
        defaultValue:
          'A fungible collectible with an image and a description, without a ticker.',
      }),
      icon: <Sprout className="h-5 w-5" />,
      kind: 'CFA',
      title: t('p2pIssue.cfaTitle', { defaultValue: 'Collectible' }),
    },
    {
      body: t('p2pIssue.uda', {
        defaultValue:
          'One unique item (an NFT) with its media: exactly one exists.',
      }),
      icon: <Gem className="h-5 w-5" />,
      kind: 'UDA',
      title: t('p2pIssue.udaTitle', { defaultValue: 'Unique item' }),
    },
  ]
  const kindTitle = kinds.find((k) => k.kind === form.kind)?.title ?? ''

  const problemText: Record<NonNullable<typeof problem>, string> = {
    inflation: t('p2pIssue.badInflation', {
      defaultValue: 'The extra supply must be a whole amount, or empty.',
    }),
    media: t('p2pIssue.needMedia', {
      defaultValue: 'A unique item needs its media file.',
    }),
    name: t('p2pIssue.badName', {
      defaultValue: 'Give it a name of up to 40 characters.',
    }),
    supply: t('p2pIssue.badSupply', {
      defaultValue: 'Set how many to issue.',
    }),
    ticker: t('p2pIssue.badTicker', {
      defaultValue:
        'The ticker is 1 to 8 capital letters or digits, starting with a letter.',
    }),
    too_big: t('p2pIssue.tooBig', {
      defaultValue: 'That supply is too large for these decimals.',
    }),
  }

  const chooseMedia = async () => {
    const path = await open({
      filters: [
        {
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
          name: t('p2pIssue.images', { defaultValue: 'Images' }),
        },
      ],
      multiple: false,
    })
    if (typeof path === 'string') set({ mediaPath: path })
  }

  const issue = async () => {
    setBusy(true)
    setError(null)
    try {
      const { path, body } = issueRequest(form)
      const res = await transport().request<{
        asset?: { asset_id?: string }
      }>('POST', path, body)
      setIssued(res?.asset?.asset_id ?? '')
      setStep('done')
      onIssued()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const supplyBase = toBase(form.supply, form.precision)
  const coins = splitSupply(supplyBase, form.parts)
  const previewTicker = form.ticker || (form.kind === 'CFA' ? '◆' : '???')

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      size="md"
      title={
        step === 'kind'
          ? t('p2pIssue.title', { defaultValue: 'Issue an asset' })
          : step === 'details'
            ? t('p2pIssue.titleKind', {
                defaultValue: 'New {{kind}}',
                kind: kindTitle.toLowerCase(),
              })
            : t('p2pIssue.titleDone', { defaultValue: 'Asset issued' })
      }
      viewport
    >
      <div className="flex flex-col gap-5 p-5">
        {step === 'kind' && (
          <>
            <p className="text-sm text-content-secondary">
              {t('p2pIssue.intro', {
                defaultValue:
                  'Issuing writes a new RGB contract and puts the whole supply in this wallet. It costs a small on-chain fee.',
              })}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {kinds.map((k) => (
                <button
                  className="flex flex-col gap-2 rounded-2xl border border-divider/20 bg-surface-elevated/40 p-4 text-left transition-colors hover:border-primary/50"
                  key={k.kind}
                  onClick={() => {
                    setForm(emptyForm(k.kind))
                    setStep('details')
                  }}
                  type="button"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      {k.icon}
                    </span>
                    <span className="font-semibold text-content-primary">
                      {k.title}
                    </span>
                    <span className="ml-auto rounded-full bg-surface-base px-2 py-0.5 font-mono text-[11px] text-content-tertiary">
                      {k.kind}
                    </span>
                  </span>
                  <span className="text-sm leading-relaxed text-content-tertiary">
                    {k.body}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'details' && (
          <>
            <div className="flex items-center gap-3 rounded-2xl border border-divider/10 bg-surface-base p-4">
              <AssetMark
                asset={{
                  assetId: form.name + form.ticker,
                  ticker: previewTicker,
                }}
                size={44}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold text-content-primary">
                  {form.name ||
                    t('p2pIssue.unnamed', { defaultValue: 'Your asset' })}
                </span>
                <span className="text-xs text-content-tertiary">
                  {kindTitle}
                  {n.supply && supplyBase > 0
                    ? ` · ${fmtUnits(supplyBase, form.precision)} ${form.ticker}`
                    : ''}
                </span>
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {n.ticker && (
                <Field
                  hint={t('p2pIssue.tickerHint', {
                    defaultValue: 'Up to 8 capital letters or digits.',
                  })}
                  label={t('p2pIssue.ticker', { defaultValue: 'Ticker' })}
                >
                  <input
                    className={`${input} font-mono uppercase`}
                    maxLength={8}
                    onChange={(e) =>
                      set({
                        ticker: e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, ''),
                      })
                    }
                    placeholder="USDX"
                    value={form.ticker}
                  />
                </Field>
              )}
              <Field label={t('p2pIssue.name', { defaultValue: 'Name' })}>
                <input
                  className={input}
                  maxLength={40}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder={t('p2pIssue.namePlaceholder', {
                    defaultValue: 'Demo Dollar',
                  })}
                  value={form.name}
                />
              </Field>
              {n.supply && (
                <Field
                  hint={
                    supplyBase > 0
                      ? t('p2pIssue.supplyHint', {
                          amount: fmtUnits(supplyBase, form.precision),
                          defaultValue: 'Issued: {{amount}}',
                        })
                      : undefined
                  }
                  label={t('p2pIssue.supply', { defaultValue: 'Supply' })}
                >
                  <input
                    className={input}
                    inputMode="decimal"
                    onChange={(e) =>
                      set({ supply: e.target.value.replace(',', '.') })
                    }
                    placeholder="1000000"
                    value={form.supply}
                  />
                </Field>
              )}
              {n.supply && (
                <Field
                  hint={t('p2pIssue.decimalsHint', {
                    defaultValue:
                      'How finely it divides. 2 like cents, 8 like sats.',
                  })}
                  label={t('p2pIssue.decimals', { defaultValue: 'Decimals' })}
                >
                  <Picker
                    label={t('p2pIssue.decimals', { defaultValue: 'Decimals' })}
                    onChange={(v) => set({ precision: Number(v) })}
                    options={[0, 2, 4, 6, 8].map((p) => ({
                      subtitle: p === 0 ? '1' : `0.${'0'.repeat(p - 1)}1`,
                      title: String(p),
                      value: String(p),
                    }))}
                    value={String(form.precision)}
                  />
                </Field>
              )}
              {n.inflation && (
                <Field
                  hint={t('p2pIssue.inflationHint', {
                    defaultValue:
                      'The most you can mint later, on top of the supply. Leave empty for none.',
                  })}
                  label={t('p2pIssue.inflation', {
                    defaultValue: 'Can mint later',
                  })}
                >
                  <input
                    className={input}
                    inputMode="decimal"
                    onChange={(e) =>
                      set({ inflation: e.target.value.replace(',', '.') })
                    }
                    placeholder="0"
                    value={form.inflation}
                  />
                </Field>
              )}
              {n.supply && (
                <Field
                  hint={t('p2pIssue.partsHint', {
                    defaultValue:
                      'The supply lands in this many coins. Each one can be sold in its own swap at the same time.',
                  })}
                  label={t('p2pIssue.parts', {
                    defaultValue: 'Split into coins',
                  })}
                >
                  <div className="flex items-center gap-2">
                    <button
                      aria-label="−"
                      className="h-11 w-11 rounded-xl border border-divider/30 text-content-primary disabled:opacity-40"
                      disabled={form.parts <= 1}
                      onClick={() => set({ parts: form.parts - 1 })}
                      type="button"
                    >
                      −
                    </button>
                    <span className="w-10 text-center font-semibold text-content-primary">
                      {form.parts}
                    </span>
                    <button
                      aria-label="+"
                      className="h-11 w-11 rounded-xl border border-divider/30 text-content-primary disabled:opacity-40"
                      disabled={form.parts >= MAX_PARTS}
                      onClick={() => set({ parts: form.parts + 1 })}
                      type="button"
                    >
                      +
                    </button>
                    {supplyBase > 0 && (
                      <span className="text-xs text-content-tertiary">
                        {t('p2pIssue.each', {
                          amount: fmtUnits(
                            coins[coins.length - 1],
                            form.precision
                          ),
                          defaultValue: '≈ {{amount}} each',
                        })}
                      </span>
                    )}
                  </div>
                </Field>
              )}
            </div>

            {n.details && (
              <Field
                label={t('p2pIssue.details', { defaultValue: 'Description' })}
              >
                <textarea
                  className={`${input} min-h-20 py-2`}
                  maxLength={500}
                  onChange={(e) => set({ details: e.target.value })}
                  value={form.details}
                />
              </Field>
            )}

            {n.media && (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-divider/30 p-3">
                <ImageIcon className="h-5 w-5 text-content-tertiary" />
                <span className="min-w-0 flex-1 truncate text-sm text-content-secondary">
                  {form.mediaPath
                    ? form.mediaPath.split(/[\\/]/).pop()
                    : form.kind === 'UDA'
                      ? t('p2pIssue.mediaNeeded', {
                          defaultValue: 'The item’s image (required)',
                        })
                      : t('p2pIssue.mediaOptional', {
                          defaultValue: 'An image (optional)',
                        })}
                </span>
                <button
                  className="text-sm font-medium text-primary hover:underline"
                  onClick={() => void chooseMedia()}
                  type="button"
                >
                  {form.mediaPath
                    ? t('p2pIssue.change', { defaultValue: 'Change' })
                    : t('p2pIssue.chooseFile', {
                        defaultValue: 'Choose a file',
                      })}
                </button>
              </div>
            )}

            {problem && (form.name || form.ticker || form.supply) && (
              <p className="text-sm text-status-warning">
                {problemText[problem]}
              </p>
            )}
            {error && <p className="text-sm text-status-danger">{error}</p>}

            <div className="flex items-center justify-between gap-3">
              <button
                className="flex items-center gap-1.5 text-sm text-content-secondary hover:text-content-primary"
                onClick={() => setStep('kind')}
                type="button"
              >
                <ArrowLeft className="h-4 w-4" />
                {t('p2pIssue.back', { defaultValue: 'Another kind' })}
              </button>
              <button
                className="min-h-11 rounded-lg bg-primary px-6 font-bold text-surface-base transition-opacity hover:opacity-90 disabled:opacity-40"
                disabled={!!problem || busy}
                onClick={() => void issue()}
                type="button"
              >
                {busy
                  ? t('p2pIssue.issuing', { defaultValue: 'Issuing…' })
                  : t('p2pIssue.issue', { defaultValue: 'Issue' })}
              </button>
            </div>
          </>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <CheckCircle2 className="h-12 w-12 text-status-success" />
            <p className="text-content-primary">
              {t('p2pIssue.doneBody', {
                defaultValue:
                  '{{name}} is in your wallet. It shows as spendable once the issuance confirms.',
                name: form.name,
              })}
            </p>
            {issued && (
              <button
                className="flex max-w-full items-center gap-2 rounded-lg bg-surface-base px-3 py-2 font-mono text-xs text-content-secondary hover:text-content-primary"
                onClick={() => {
                  void navigator.clipboard.writeText(issued).then(() => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  })
                }}
                type="button"
              >
                <span className="truncate">{issued}</span>
                <Copy className="h-3.5 w-3.5 flex-none" />
                {copied && t('p2pWallet.copied', { defaultValue: 'Copied' })}
              </button>
            )}
            <p className="text-xs text-content-tertiary">
              {t('p2pIssue.listingNote', {
                defaultValue:
                  'Others see it as “not listed” until a curator lists it. Share the asset ID with your buyers.',
              })}
            </p>
            <div className="flex gap-2">
              <button
                className="min-h-11 rounded-lg border border-divider/30 px-5 font-medium text-content-primary"
                onClick={close}
                type="button"
              >
                {t('p2pIssue.close', { defaultValue: 'Done' })}
              </button>
              <button
                className="min-h-11 rounded-lg bg-primary px-5 font-bold text-surface-base"
                onClick={() => {
                  close()
                  navigate(P2P_TRADE_PATH)
                }}
                type="button"
              >
                {t('p2pIssue.sell', { defaultValue: 'Sell it on the market' })}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
