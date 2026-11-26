import {
  Button,
  Card,
  CopyButton,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'kaleido-ui'
import { ArrowDownLeft, ArrowUpRight, Coins, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppDispatch } from '../../app/store/hooks'
import { UTXOManagementModal } from '../../components/UTXOManagementModal'
import { useSettings } from '../../hooks/useSettings'
import { uiSliceActions } from '../../slices/ui/ui.slice'
import { marketApi } from '../trade/nostr-p2p/api'
import {
  fmtSats,
  fmtUnits,
  networkLabel,
  short,
} from '../trade/nostr-p2p/format'
import { usePoll } from '../trade/nostr-p2p/market/hooks'
import { useP2pSession } from '../trade/nostr-p2p/session'
import { WalletSwitch } from '../trade/nostr-p2p/WalletSwitch'

import { IssueDialog } from './IssueDialog'
import { bitcoinSummary } from './summary'

/**
 * The trading wallet: which one is open, what it holds, what can be done with it, and its history
 * on the app's own wallet screens (while the P2P app is open they read the trading wallet).
 */
export const Component = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const { bitcoinUnit } = useSettings()
  const session = useP2pSession()
  const balance = usePoll(marketApi.balance, 5_000)
  const info = usePoll(marketApi.info, 60_000)
  const [coins, setCoins] = useState(false)
  const [issue, setIssue] = useState(false)

  const btc = bitcoinSummary(balance.data)
  const coinSizes = balance.data?.btc_coins ?? []
  const assets = [...(balance.data?.assets ?? [])].sort(
    (a, b) => b.total - a.total
  )

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        action={
          <WalletSwitch
            onCreate={session.addWallet}
            onSelect={session.chooseWallet}
            selectedId={session.walletId}
            wallets={session.wallets}
          />
        }
        description={
          session.config &&
          `${networkLabel(session.config.network)} · ${t('p2pShell.onchain', { defaultValue: 'on-chain RGB' })}`
        }
        title={t('p2pShell.wallet', { defaultValue: 'Wallet' })}
        variant="page"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card className="min-w-0 gap-4 p-4 sm:p-6">
          <div className="flex flex-col gap-1">
            <span className="text-caption font-semibold text-muted-foreground">
              {t('p2pWallet.bitcoin', { defaultValue: 'BITCOIN' })}
            </span>
            <span className="text-3xl font-bold tracking-tight text-content-primary">
              {balance.data ? `${fmtSats(btc.ready)} sats` : '–'}
            </span>
            {btc.pending > 0 && (
              <span className="text-sm text-status-warning">
                {t('p2pWallet.pending', {
                  defaultValue: '+ {{sats}} sats still confirming',
                  sats: fmtSats(btc.pending),
                })}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm text-content-secondary">
              {t('p2pWallet.coins', {
                count: coinSizes.length,
                defaultValue: '{{count}} coins free for swaps',
              })}
            </span>
            {coinSizes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {coinSizes.map((c, i) => (
                  <span
                    className="rounded-md bg-surface-base px-2 py-1 font-mono text-xs text-content-secondary"
                    key={i}
                  >
                    {fmtSats(c)}
                  </span>
                ))}
              </div>
            )}
            <span className="text-xs leading-relaxed text-content-tertiary">
              {t('p2pWallet.coinsWhy', {
                defaultValue:
                  'Each swap spends a coin of its own, so more coins means more swaps at once.',
              })}
            </span>
          </div>

          <div className="mt-auto flex flex-wrap gap-2">
            <Button
              onClick={() =>
                dispatch(
                  uiSliceActions.setModal({
                    assetId: undefined,
                    type: 'deposit',
                  })
                )
              }
              type="button"
              variant="surface"
            >
              <ArrowDownLeft aria-hidden size={16} />
              {t('p2pHome.receive', { defaultValue: 'Receive' })}
            </Button>
            <Button
              onClick={() =>
                dispatch(
                  uiSliceActions.setModal({
                    assetId: undefined,
                    type: 'withdraw',
                  })
                )
              }
              type="button"
              variant="surface"
            >
              <ArrowUpRight aria-hidden size={16} />
              {t('p2pHome.send', { defaultValue: 'Send' })}
            </Button>
            <Button
              onClick={() => setCoins(true)}
              type="button"
              variant="quiet"
            >
              <Coins aria-hidden size={16} />
              {t('p2pWallet.manageCoins', { defaultValue: 'Manage coins' })}
            </Button>
          </div>
        </Card>

        <Card className="min-w-0 gap-3 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-subhead font-bold">
              {t('p2pWallet.assets', { defaultValue: 'Assets' })}
            </h2>
            <Button
              onClick={() => setIssue(true)}
              size="sm"
              type="button"
              variant="surface"
            >
              <Plus aria-hidden size={16} />
              {t('p2pWallet.issue', { defaultValue: 'Issue an asset' })}
            </Button>
          </div>
          {assets.length === 0 ? (
            <p className="text-sm text-content-tertiary">
              {t('p2pHome.noAssets', {
                defaultValue:
                  'No assets yet. Buy one on the market or receive one with an RGB invoice.',
              })}
            </p>
          ) : (
            <Table className="max-sm:[&_td]:px-1 max-sm:[&_th]:px-1">
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t('p2pWallet.asset', { defaultValue: 'ASSET' })}
                  </TableHead>
                  <TableHead className="text-right">
                    {t('p2pWallet.total', { defaultValue: 'TOTAL' })}
                  </TableHead>
                  <TableHead className="text-right">
                    {t('p2pWallet.spendable', { defaultValue: 'SPENDABLE' })}
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">
                      {t('p2pWallet.actions', { defaultValue: 'Actions' })}
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((a) => (
                  <TableRow key={a.asset_id}>
                    <TableCell>
                      <span className="flex flex-col">
                        <span className="font-medium text-content-primary">
                          {a.ticker || a.name}
                        </span>
                        <span className="font-mono text-xs text-content-tertiary">
                          {a.name} · {short(a.asset_id, 6)}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtUnits(a.total, a.precision)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${a.spendable < a.total ? 'text-status-warning' : 'text-content-primary'}`}
                    >
                      {fmtUnits(a.spendable, a.precision)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        onClick={() =>
                          dispatch(
                            uiSliceActions.setModal({
                              assetId: a.asset_id,
                              type: 'deposit',
                            })
                          )
                        }
                        size="xs"
                        type="button"
                        variant="link"
                      >
                        {t('p2pHome.receive', { defaultValue: 'Receive' })}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {info.data && (
            <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-divider/10 pt-3 text-xs text-content-tertiary">
              <span>
                {t('p2pWallet.identity', {
                  defaultValue: 'Nostr identity of this wallet',
                })}
              </span>
              <span className="font-mono text-content-secondary">
                {short(info.data.npub, 10)}
              </span>
              <CopyButton
                copiedAnnouncement={t('p2pWallet.copied', {
                  defaultValue: 'Copied',
                })}
                copyLabel={t('p2pWallet.copyNpub', {
                  defaultValue: 'Copy the Nostr key',
                })}
                failedMessage={t('mnemonicViewer.copyFailed')}
                label={t('p2pWallet.identity', {
                  defaultValue: 'Nostr identity of this wallet',
                })}
                value={info.data.npub}
              />
            </div>
          )}
        </Card>
      </div>

      {coins && (
        <UTXOManagementModal
          bitcoinUnit={bitcoinUnit}
          onClose={() => {
            setCoins(false)
            balance.refresh()
          }}
        />
      )}
      <IssueDialog
        isOpen={issue}
        onClose={() => setIssue(false)}
        onIssued={() => balance.refresh()}
      />
    </div>
  )
}
