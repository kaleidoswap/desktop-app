import {
  ArrowDownLeft,
  ArrowLeftRight,
  BadgeCheck,
  KeyRound,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppDispatch } from '../../app/store/hooks'
import { Modal } from '../../components/ui'
import { uiSliceActions } from '../../slices/ui/ui.slice'

const SEEN_KEY = 'p2p-guide.seen.v1'
const OPEN_EVENT = 'p2p-guide-open'

export type GuideStep = 'wallet' | 'fund' | 'swap' | 'safety'
const ORDER: GuideStep[] = ['wallet', 'fund', 'swap', 'safety']

/** Open the guide from anywhere in the P2P app, at a given step. */
export const openGuide = (step: GuideStep = 'wallet') =>
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: step }))

const seen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return true
  }
}

const markSeen = () => {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // shown again next time; harmless
  }
}

/**
 * The P2P app explained in four steps: the wallet, funding it, how a swap works, and how to tell a
 * listed asset from an imitation. It opens by itself the first time and from the Guide button after.
 */
export function P2pGuide() {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!seen()) setOpen(true)
    const onOpen = (e: Event) => {
      const at = ORDER.indexOf((e as CustomEvent<GuideStep>).detail)
      setStep(Math.max(0, at))
      setOpen(true)
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  const close = () => {
    markSeen()
    setOpen(false)
    setStep(0)
  }

  const steps: {
    icon: LucideIcon
    title: string
    points: string[]
    action?: { label: string; run: () => void }
  }[] = [
    {
      icon: KeyRound,
      points: [
        t('p2pGuide.wallet1', {
          defaultValue:
            'This wallet is yours alone: its keys stay on this computer, locked behind Touch ID.',
        }),
        t('p2pGuide.wallet2', {
          defaultValue:
            'The 12-word recovery phrase brings back your bitcoin. Keep it written down, offline. (Settings → Recovery phrase)',
        }),
        t('p2pGuide.wallet3', {
          defaultValue:
            'No node and no account: the app talks to other traders directly over Nostr relays.',
        }),
      ],
      title: t('p2pGuide.walletTitle', {
        defaultValue: 'A trading wallet of your own',
      }),
    },
    {
      action: {
        label: t('p2pGuide.receive', { defaultValue: 'Receive bitcoin' }),
        run: () => {
          close()
          dispatch(
            uiSliceActions.setModal({ assetId: undefined, type: 'deposit' })
          )
        },
      },
      icon: ArrowDownLeft,
      points: [
        t('p2pGuide.fund1', {
          defaultValue:
            'Send bitcoin to the wallet’s address. It can trade once the deposit has 3 confirmations.',
        }),
        t('p2pGuide.fund2', {
          defaultValue:
            'Each swap spends a bitcoin coin of its own, big enough to pay for it. One large deposit is one coin: split it into a few (Wallet → Manage coins) to buy from several makers at once.',
        }),
        t('p2pGuide.fund3', {
          defaultValue:
            'On a test network the coins have no value: use a faucet to get some.',
        }),
      ],
      title: t('p2pGuide.fundTitle', { defaultValue: 'Put bitcoin in it' }),
    },
    {
      icon: ArrowLeftRight,
      points: [
        t('p2pGuide.swap1', {
          defaultValue:
            'Offers come from independent makers. Type what you pay or what you get: the swap takes the best offers and shows the price, the fees and who fills it.',
        }),
        t('p2pGuide.swap2', {
          defaultValue:
            'Offers fill whole, so you may get a little less than you asked. You see the exact amounts before signing anything.',
        }),
        t('p2pGuide.swap3', {
          defaultValue:
            'Each maker settles in one Bitcoin transaction holding both sides: you get the asset, or your bitcoin never leaves. It counts as done after its confirmations.',
        }),
      ],
      title: t('p2pGuide.swapTitle', {
        defaultValue: 'Swap directly with other people',
      }),
    },
    {
      icon: BadgeCheck,
      points: [
        t('p2pGuide.safety1', {
          defaultValue:
            'Anyone can issue an asset with any name. A green check means KaleidoSwap lists it: it is the asset its ticker names.',
        }),
        t('p2pGuide.safety2', {
          defaultValue:
            'A red warning means an asset copies a listed ticker: almost certainly an imitation.',
        }),
        t('p2pGuide.safety3', {
          defaultValue:
            'Unlisted assets stay folded away until you ask for them. Check the asset ID with whoever you trade with.',
        }),
      ],
      title: t('p2pGuide.safetyTitle', {
        defaultValue: 'Know what you are buying',
      }),
    },
  ]
  const s = steps[step]
  const last = step === steps.length - 1

  return (
    <Modal
      isOpen={open}
      onClose={close}
      size="md"
      title={t('p2pGuide.title', { defaultValue: 'How P2P trading works' })}
      viewport
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <s.icon className="h-6 w-6" />
          </span>
          <div className="flex flex-col">
            <span className="text-xs tracking-wider text-content-tertiary">
              {t('p2pGuide.step', {
                defaultValue: 'STEP {{n}} OF {{total}}',
                n: step + 1,
                total: steps.length,
              })}
            </span>
            <h2 className="text-xl font-bold tracking-tight text-content-primary">
              {s.title}
            </h2>
          </div>
        </div>
        <ul className="flex flex-col gap-3">
          {s.points.map((p) => (
            <li
              className="flex gap-3 text-sm leading-relaxed text-content-secondary"
              key={p}
            >
              <span
                aria-hidden
                className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-primary"
              />
              {p}
            </li>
          ))}
        </ul>
        {s.action && (
          <button
            className="self-start rounded-lg border border-primary/40 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
            onClick={s.action.run}
            type="button"
          >
            {s.action.label}
          </button>
        )}
        <div className="flex items-center justify-between gap-3 pt-2">
          <div aria-hidden className="flex gap-1.5">
            {steps.map((_, i) => (
              <span
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-6 bg-primary' : 'w-1.5 bg-divider/40'
                }`}
                key={i}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 ? (
              <button
                className="min-h-10 rounded-lg px-4 text-sm text-content-secondary hover:text-content-primary"
                onClick={() => setStep(step - 1)}
                type="button"
              >
                {t('p2pGuide.back', { defaultValue: 'Back' })}
              </button>
            ) : (
              <button
                className="min-h-10 rounded-lg px-4 text-sm text-content-secondary hover:text-content-primary"
                onClick={close}
                type="button"
              >
                {t('p2pGuide.skip', { defaultValue: 'Skip' })}
              </button>
            )}
            <button
              className="min-h-10 rounded-lg bg-primary px-5 text-sm font-bold text-surface-base hover:opacity-90"
              onClick={() => (last ? close() : setStep(step + 1))}
              type="button"
            >
              {last
                ? t('p2pGuide.done', { defaultValue: 'Start trading' })
                : t('p2pGuide.next', { defaultValue: 'Next' })}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
