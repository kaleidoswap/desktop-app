import { CopyButton } from 'kaleido-ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useNavigate } from 'react-router-dom'

import { P2P_TRADE_PATH } from '../../app/router/paths'
import {
  WalletOverview,
  WalletPage,
} from '../../components/Wallet/WalletOverview'
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

import { FaucetCard } from './FaucetCard'
import { IssueDialog } from './IssueDialog'
import { bitcoinSummary } from './summary'

/**
 * The trading wallet: which one is open, what it holds, what can be done with it, and its history
 * on the app's own wallet screens (while the P2P app is open they read the trading wallet).
 */
export const Component = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { bitcoinUnit } = useSettings()
  const session = useP2pSession()
  const balance = usePoll(marketApi.balance, 5_000)
  const info = usePoll(marketApi.info, 60_000)
  const [coins, setCoins] = useState(false)
  const [issue, setIssue] = useState(false)

  const btc = bitcoinSummary(balance.data)
  const coinSizes = balance.data?.btc_coins
  const assetList = balance.data?.assets
  const assets = [...(assetList ?? [])].sort((a, b) => b.total - a.total)

  return (
    <WalletPage
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
        `${networkLabel(session.config.network)} · ${t('p2pShell.onchain')}`
      }
    >
      <WalletOverview
        assets={assets.map((a) => ({
          amounts: [
            a.total == null ? null : fmtUnits(a.total, a.precision),
            a.spendable == null ? null : fmtUnits(a.spendable, a.precision),
          ],
          description: [a.ticker && a.name, a.schema, short(a.asset_id, 6)]
            .filter(Boolean)
            .join(' · '),
          id: a.asset_id,
          ticker: a.ticker || a.name,
        }))}
        assetsState={
          assetList
            ? 'ready'
            : balance.data || balance.error
              ? 'unavailable'
              : 'loading'
        }
        balance={
          balance.data && btc.ready != null
            ? `${fmtSats(btc.ready)} sats`
            : null
        }
        balanceDetails={
          <>
            {balance.data && btc.pending > 0 && (
              <span className="text-sm text-status-warning">
                {t('p2pWallet.pending', { sats: fmtSats(btc.pending) })}
              </span>
            )}
            {coinSizes && (
              <div className="flex flex-col gap-2">
                <span className="text-sm text-content-secondary">
                  {t('p2pWallet.coins', { count: coinSizes.length })}
                </span>
                {coinSizes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {coinSizes.map((coin, i) => (
                      <span
                        className="rounded-md bg-surface-base px-2 py-1 font-mono text-xs text-content-secondary"
                        key={i}
                      >
                        {fmtSats(coin)}
                      </span>
                    ))}
                  </div>
                )}
                <span className="text-xs text-content-tertiary">
                  {t('p2pWallet.coinsWhy')}
                </span>
              </div>
            )}
          </>
        }
        balanceLabel={t('p2pWallet.bitcoin')}
        balanceLoading={!balance.data && !balance.error}
        columns={[t('p2pWallet.total'), t('p2pWallet.spendable')]}
        emptyMessage={t('p2pHome.noAssets')}
        error={balance.error ?? info.error ?? undefined}
        footer={
          info.data?.npub && (
            <>
              <span>{t('p2pWallet.identity')}</span>
              <span className="font-mono text-content-secondary">
                {short(info.data.npub, 10)}
              </span>
              <CopyButton
                copiedAnnouncement={t('p2pWallet.copied')}
                copyLabel={t('p2pWallet.copyNpub')}
                failedMessage={t('mnemonicViewer.copyFailed')}
                label={t('p2pWallet.identity')}
                value={info.data.npub}
              />
            </>
          )
        }
        marketAction={{
          label: t('unified.market'),
          onClick: () => navigate(P2P_TRADE_PATH),
        }}
        onIssue={() => setIssue(true)}
        onManageCoins={() => setCoins(true)}
        onReceive={(assetId) =>
          dispatch(uiSliceActions.setModal({ assetId, type: 'deposit' }))
        }
        onRefresh={() => {
          balance.refresh()
          info.refresh()
        }}
        onSend={(assetId) =>
          dispatch(uiSliceActions.setModal({ assetId, type: 'withdraw' }))
        }
      />
      {session.config?.faucet_url &&
        assetList &&
        !balance.error &&
        btc.ready + btc.pending === 0 &&
        assets.every((a) => a.total === 0) && (
          <FaucetCard
            address={info.data?.address}
            faucetUrl={session.config.faucet_url}
            networkLabel={networkLabel(session.config.network)}
          />
        )}

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
    </WalletPage>
  )
}
