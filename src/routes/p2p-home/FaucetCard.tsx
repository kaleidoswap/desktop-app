import { openUrl } from '@tauri-apps/plugin-opener'
import { Droplets } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * For an empty wallet on a test network: where to get free test coins. Copies the wallet's address
 * and opens the network's faucet in the browser, where the user pastes it.
 */
export function FaucetCard({
  address,
  faucetUrl,
  networkLabel,
}: {
  address: string | undefined
  faucetUrl: string
  networkLabel: string
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const go = async () => {
    if (address) {
      try {
        await navigator.clipboard.writeText(address)
        setCopied(true)
      } catch {
        // the faucet page still opens; the address is on the Receive screen
      }
    }
    await openUrl(faucetUrl)
  }

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Droplets className="h-5 w-5" />
      </span>
      <div className="flex min-w-[220px] flex-1 flex-col gap-1">
        <span className="font-semibold text-content-primary">
          {t('p2pHome.faucetTitle', {
            defaultValue: 'Get free test coins',
            network: networkLabel,
          })}
        </span>
        <span className="text-sm text-content-secondary">
          {copied
            ? t('p2pHome.faucetCopied', {
                defaultValue:
                  'Your address is copied: paste it on the faucet page. Coins arrive in a minute or two.',
              })
            : t('p2pHome.faucetBody', {
                defaultValue:
                  '{{network}} is a test network: its coins have no value. A faucet sends you some to try swaps with.',
                network: networkLabel,
              })}
        </span>
      </div>
      <button
        className="min-h-11 rounded-lg bg-primary px-5 font-bold text-surface-base transition-opacity hover:opacity-90"
        onClick={() => void go()}
        type="button"
      >
        {t('p2pHome.faucetButton', {
          defaultValue: 'Copy address and open faucet',
        })}
      </button>
    </section>
  )
}
