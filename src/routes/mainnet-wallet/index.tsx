import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  OnchainNetworkIcon,
  PageHeader,
  RgbNetworkIcon,
} from 'kaleido-ui'
import { ArrowRight, FlaskConical } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { P2P_BALANCE_PATH } from '../../app/router/paths'
import { OnchainSetup } from './OnchainSetup'
import { readWallet, type WalletStatus } from './onchain'

type Status = WalletStatus | 'checking' | 'not_bundled' | 'error'

/** This route never mounts the trading wallet, which holds funds on a different network. */
function MainnetPage({ activity = false }: { activity?: boolean }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<Status>('checking')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    readWallet().then(
      (result) => {
        if (!current) return
        if (
          result === 'not_bundled' ||
          result?.state === 'empty' ||
          (result?.state === 'ready' && result.wallet?.fingerprint)
        ) {
          setStatus(result)
        } else {
          setStatus('error')
        }
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
      <PageHeader
        description="Bitcoin Mainnet"
        title={
          activity
            ? t('unified.activity')
            : t('p2pShell.wallet', { defaultValue: 'Wallet' })
        }
        variant="page"
      />
      <Card aria-labelledby="mainnet-wallet-title" role="region">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex shrink-0 items-center">
              <span className="grid size-10 place-items-center rounded-full bg-warning/10">
                <OnchainNetworkIcon className="size-5" />
              </span>
              <span className="-ml-2 grid size-10 place-items-center rounded-full bg-card shadow-raised">
                <RgbNetworkIcon alt="" className="size-5" />
              </span>
            </span>
            <div>
              <h2 className="text-subhead font-bold" id="mainnet-wallet-title">
                {t('mainnetWallet.assets')}
              </h2>
              <CardDescription>{t('p2pShell.onchain')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {typeof status === 'object' ? (
            activity ? (
              <CardDescription>{t('onchainSetup.offline')}</CardDescription>
            ) : (
              <OnchainSetup
                onReady={(wallet) => setStatus({ state: 'ready', wallet })}
                wallet={status.wallet}
              />
            )
          ) : (
            <div aria-live="polite" className="max-w-xl">
              <h3 className="text-body font-semibold">
                {status === 'checking'
                  ? t('common.loading')
                  : status === 'error'
                    ? t('mainnetWallet.checkFailed')
                    : t('mainnetWallet.unavailable')}
              </h3>
              {status === 'not_bundled' && (
                <CardDescription className="mt-1">
                  {activity
                    ? t('mainnetWallet.historyHint')
                    : t('mainnetWallet.walletHint')}
                </CardDescription>
              )}
            </div>
          )}
          {status === 'error' && (
            <Button
              className="mt-3"
              onClick={() => {
                setStatus('checking')
                setAttempt((previous) => previous + 1)
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              {t('mainnetWallet.retry')}
            </Button>
          )}
        </CardContent>
        <CardFooter className="flex-wrap gap-3">
          <Button asChild variant="surface">
            <Link aria-describedby="test-wallet-hint" to={P2P_BALANCE_PATH}>
              <FlaskConical aria-hidden size={18} />
              {t('mainnetWallet.openTest')}
              <ArrowRight aria-hidden size={16} />
            </Link>
          </Button>
          <CardDescription id="test-wallet-hint">
            {t('mainnetWallet.testHint')}
          </CardDescription>
        </CardFooter>
      </Card>
    </div>
  )
}

export const Component = () => <MainnetPage />
export const Activity = () => <MainnetPage activity />
