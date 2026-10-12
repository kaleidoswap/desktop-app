import { Power } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import { useAppSelector } from '../../../app/store/hooks'
import { TradeNav } from '../../../components/Trade'
import { Alert, Button } from '../../../components/ui'
import { p2pConfigFor } from '../../../constants/p2p'

import { FundsModal } from './FundsModal'
import { Market } from './market/Market'
import {
  p2pStart,
  p2pStatus,
  p2pStop,
  startConfigFor,
  type P2pStatus,
} from './p2p'

const isTauri = () =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export const Component = () => {
  const { t } = useTranslation()
  const account = useAppSelector((s) => s.nodeSettings.data.name)
  const network = useAppSelector((s) => s.nodeSettings.data.network)
  const config = p2pConfigFor(network)

  const [status, setStatus] = useState<P2pStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [fundsOpen, setFundsOpen] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setStatus(await p2pStatus())
    } catch {
      setStatus(null)
    }
  }, [])

  useEffect(() => {
    if (isTauri()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void refresh()
    }
  }, [refresh])

  const toggle = async () => {
    if (!config) return
    setBusy(true)
    try {
      if (status?.running) {
        await p2pStop()
      } else {
        await p2pStart(startConfigFor(account, config))
      }
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  let body
  if (!isTauri()) {
    body = <Alert variant="info">{t('p2pMarket.desktopOnly')}</Alert>
  } else if (!config) {
    body = <Alert variant="info">{t('p2pMarket.noNetwork')}</Alert>
  } else if (!status?.running || !status.url) {
    body = (
      <div className="mx-auto flex max-w-xl flex-col gap-4 py-16 text-center">
        <h2 className="text-xl font-bold text-content-primary">
          {t('p2pMarket.startTitle')}
        </h2>
        <p className="text-content-secondary">{t('p2pMarket.startBody')}</p>
        <div>
          <Button icon={<Power size={16} />} isLoading={busy} onClick={toggle}>
            {t('p2pMarket.start')}
          </Button>
        </div>
      </div>
    )
  } else {
    body = (
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">
          <Button
            icon={<Power size={14} />}
            isLoading={busy}
            onClick={toggle}
            size="sm"
            variant="outline"
          >
            {t('p2pMarket.stop')}
          </Button>
        </div>
        <Market onOpenFunds={() => setFundsOpen(true)} />
        <FundsModal isOpen={fundsOpen} onClose={() => setFundsOpen(false)} />
      </div>
    )
  }

  return (
    <div className="w-full min-h-full">
      <div className="mx-auto w-full max-w-screen-xl px-4 pt-2">
        <TradeNav />
      </div>
      <div className="mx-auto w-full max-w-screen-xl px-4 py-4">{body}</div>
    </div>
  )
}
