import { invoke } from '@tauri-apps/api/core'
import { ArrowRight, Bitcoin, FlaskConical, Layers3 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { P2P_BALANCE_PATH } from '../../app/router/paths'

type Status = 'checking' | 'not_bundled' | 'error'

/** This route never mounts the trading wallet, which holds funds on a different network. */
function MainnetPage({ activity = false }: { activity?: boolean }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<Status>('checking')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    invoke<unknown>('mainnet_wallet_status').then(
      (result) => {
        if (current) setStatus(result === 'not_bundled' ? result : 'error')
      },
      () => {
        if (current) setStatus('error')
      }
    )
    return () => {
      current = false
    }
  }, [attempt])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <p className="mb-1 text-xs font-medium tracking-wide text-content-secondary">
          Bitcoin Mainnet
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-content-primary">
          {activity
            ? t('unified.activity')
            : t('p2pShell.wallet', { defaultValue: 'Wallet' })}
        </h1>
      </header>
      <section
        aria-labelledby="mainnet-wallet-title"
        className="overflow-hidden rounded-2xl border border-divider/20 bg-surface-elevated"
      >
        <div className="flex flex-wrap items-center gap-4 border-b border-divider/15 bg-primary/5 px-6 py-6 sm:px-8">
          <span aria-hidden className="flex shrink-0 items-center">
            <span className="grid size-11 place-items-center rounded-full bg-status-warning/15 text-status-warning">
              <Bitcoin size={24} />
            </span>
            <span className="-ml-2 grid size-11 place-items-center rounded-full border-2 border-surface-elevated bg-surface-raised text-primary">
              <Layers3 size={20} />
            </span>
          </span>
          <div>
            <h2
              className="text-xl font-bold tracking-tight text-content-primary"
              id="mainnet-wallet-title"
            >
              {t('mainnetWallet.assets')}
            </h2>
            <p className="text-sm text-content-secondary">
              {t('p2pShell.onchain')}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 p-6 sm:p-8">
          <div aria-live="polite" className="max-w-xl">
            <h3 className="font-semibold text-content-primary">
              {status === 'checking'
                ? t('common.loading')
                : status === 'error'
                  ? t('mainnetWallet.checkFailed')
                  : t('mainnetWallet.unavailable')}
            </h3>
            {status === 'not_bundled' && (
              <p className="mt-1 text-sm text-content-secondary">
                {activity
                  ? t('mainnetWallet.historyHint')
                  : t('mainnetWallet.walletHint')}
              </p>
            )}
          </div>
          {status === 'error' && (
            <button
              className="rounded-lg border border-divider/30 px-4 py-2 text-sm font-medium text-content-primary"
              onClick={() => {
                setStatus('checking')
                setAttempt((previous) => previous + 1)
              }}
              type="button"
            >
              {t('mainnetWallet.retry')}
            </button>
          )}
        </div>
      </section>
      <Link
        className="group flex max-w-xl items-center gap-4 rounded-xl border border-divider/20 bg-surface-elevated px-5 py-4 transition-colors hover:border-primary/50"
        to={P2P_BALANCE_PATH}
      >
        <FlaskConical aria-hidden className="shrink-0 text-primary" size={20} />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-content-primary">
            {t('mainnetWallet.openTest')}
          </span>
          <span className="block text-sm text-content-secondary">
            {t('mainnetWallet.testHint')}
          </span>
        </span>
        <ArrowRight
          aria-hidden
          className="shrink-0 text-content-secondary group-hover:text-primary"
          size={18}
        />
      </Link>
    </div>
  )
}

export const Component = () => <MainnetPage />
export const Activity = () => <MainnetPage activity />
