import { ArrowDown, ArrowUp } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import { useAppSelector } from '../../../app/store/hooks'
import { Button, Modal } from '../../../components/ui'
import { getAllRgbAssets } from '../../../utils/rgbUtils'
import { nodeApi } from '../../../slices/nodeApi/nodeApi.slice'

import { Slider, cx } from './market/ui'
import {
  assetToNode,
  assetToTrading,
  btcToNode,
  btcToTrading,
  daemonBalance,
  MAX_PARTS,
  MIN_PART_SAT,
  PartialSend,
  splitAmount,
  tauriDaemon,
  toBaseUnits,
  type DaemonBalance,
  type NodeWallet,
} from './p2p'

// The SDK types the assignment type as an enum it does not export.
const fungible = (value: number): any => ({ type: 'Fungible', value })

export type Direction = 'toTrading' | 'toNode'

const BTC = 'btc'

interface Props {
  isOpen: boolean
  onClose: () => void
  /** Which way the dialog opens: deposit into the trading wallet, or withdraw to the node. */
  initialDirection?: Direction
}

/** Move bitcoin or an RGB asset between the node and the trading wallet that backs the market. */
export const FundsModal = ({
  isOpen,
  onClose,
  initialDirection = 'toTrading',
}: Props) => {
  const { t: translate } = useTranslation()
  const t = (
    key: string,
    defaultValue: string,
    vars?: Record<string, unknown>
  ) => translate(key, { defaultValue, ...vars }) as string
  const proxyEndpoint = useAppSelector(
    (s) => s.nodeSettings.data.proxy_endpoint
  )
  const [direction, setDirection] = useState<Direction>('toTrading')
  const [asset, setAsset] = useState(BTC)
  const [amount, setAmount] = useState('')
  const [parts, setParts] = useState(1)
  const [busy, setBusy] = useState(false)
  const [trading, setTrading] = useState<DaemonBalance | null>(null)

  const assetsQuery = nodeApi.endpoints.listAssets.useQuery()
  const btcQuery = nodeApi.endpoints.btcBalance.useQuery()
  const [getAddress] = nodeApi.useLazyAddressQuery()
  const [getAssetBalance] = nodeApi.useLazyAssetBalanceQuery()
  const [rgbInvoice] = nodeApi.useRgbInvoiceMutation()
  const [sendRgb] = nodeApi.useSendRgbMutation()
  const [sendBtc] = nodeApi.useSendBtcMutation()
  const [nodeAssetBalance, setNodeAssetBalance] = useState<number | null>(null)

  const assets = useMemo(
    () => (assetsQuery.data ? getAllRgbAssets(assetsQuery.data) : []),
    [assetsQuery.data]
  )
  const selected = assets.find((a) => a.asset_id === asset)
  const precision = asset === BTC ? 0 : (selected?.precision ?? 0)

  const refreshTrading = useCallback(async () => {
    try {
      setTrading(await daemonBalance())
    } catch {
      setTrading(null)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isOpen) void refreshTrading()
  }, [isOpen, refreshTrading])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isOpen) setDirection(initialDirection)
  }, [isOpen, initialDirection])

  useEffect(() => {
    if (!isOpen || asset === BTC) return
    void getAssetBalance({ asset_id: asset })
      .unwrap()
      .then((b) => setNodeAssetBalance(b.spendable))
      .catch(() => setNodeAssetBalance(null))
  }, [isOpen, asset, getAssetBalance])

  // a node that is not connected has no balance to show: say so instead of showing zero
  const nodeReady = btcQuery.data !== undefined
  const nodeBalance =
    asset === BTC
      ? (btcQuery.data?.vanilla.spendable ?? 0)
      : (nodeAssetBalance ?? 0)
  const tradingBalance =
    asset === BTC
      ? (trading?.btc_spendable_sat ?? 0)
      : (trading?.assets.find((a) => a.asset_id === asset)?.spendable ?? 0)

  const node: NodeWallet = useMemo(
    () => ({
      address: async () => (await getAddress().unwrap()).address,
      invoice: async (assetId, amt) =>
        (
          await rgbInvoice({
            asset_id: assetId,
            assignment: fungible(amt),
            transport_endpoints: [proxyEndpoint],
            witness: false,
          }).unwrap()
        ).invoice,
      sendBtc: async (address, amountSat) => {
        await sendBtc({ address, amount: amountSat, fee_rate: 2 }).unwrap()
      },
      sendRgb: async ({
        assetId,
        amount: amt,
        recipientId,
        transportEndpoints,
      }) => {
        await sendRgb({
          donation: false,
          expiration_timestamp: Math.floor(Date.now() / 1000) + 86400,
          fee_rate: 2,
          min_confirmations: 1,
          recipient_map: {
            [assetId]: [
              {
                assignment: fungible(amt),
                recipient_id: recipientId,
                transport_endpoints: transportEndpoints,
              },
            ],
          },
        }).unwrap()
      },
    }),
    [getAddress, proxyEndpoint, rgbInvoice, sendBtc, sendRgb]
  )

  const units =
    asset === BTC
      ? Math.round(Number(amount) || 0)
      : toBaseUnits(amount, precision)

  const submit = async () => {
    setBusy(true)
    try {
      if (asset === BTC) {
        const run = direction === 'toTrading' ? btcToTrading : btcToNode
        await run(node, tauriDaemon, {
          amountSat: units,
          nodeBalance,
          parts: direction === 'toTrading' ? parts : undefined,
          tradingBalance,
        })
      } else if (direction === 'toTrading') {
        await assetToTrading(node, tauriDaemon, {
          amount: units,
          assetId: asset,
          nodeBalance,
        })
      } else {
        await assetToNode(node, tauriDaemon, {
          amount: units,
          assetId: asset,
          tradingBalance,
        })
      }
      toast.success(
        t(
          'p2pMarket.funds.sent',
          'Funds sent. They show up after the transaction is seen.'
        )
      )
      setAmount('')
      void refreshTrading()
    } catch (e) {
      if (e instanceof PartialSend) {
        toast.error(
          t(
            'p2pMarket.funds.partial',
            '{{sent}} of {{total}} parts were sent, then it stopped: {{reason}}',
            { reason: e.message, sent: e.sent, total: e.total }
          )
        )
        void refreshTrading()
      } else {
        toast.error(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setBusy(false)
    }
  }

  const splitting = asset === BTC && direction === 'toTrading'
  const each = units > 0 ? splitAmount(units, parts)[0] : 0

  const unit = asset === BTC ? 'sat' : (selected?.ticker ?? '')
  const fmt = (base: number) =>
    asset === BTC
      ? base.toLocaleString('en-US')
      : (base / 10 ** precision).toLocaleString('en-US', {
          maximumFractionDigits: precision,
        })

  const deposit = direction === 'toTrading'
  const source = deposit ? nodeBalance : tradingBalance
  // sending every sat would leave nothing for the miner fee of each transaction
  const reserve = asset === BTC ? 1_000 * (deposit ? parts : 1) : 0
  const cap = Math.max(0, source - reserve)
  const pctNow = cap > 0 ? Math.min(100, Math.round((units / cap) * 100)) : 0
  const setPct = (p: number) => {
    const base = Math.floor((cap * p) / 100)
    setAmount(
      base > 0
        ? String(Number((base / 10 ** precision).toFixed(precision)))
        : ''
    )
  }
  const tooMuch = units > source
  const assetChoices = [
    { id: BTC, label: 'BTC' },
    ...assets.map((a) => ({ id: a.asset_id, label: a.ticker })),
  ]

  const Balance = ({
    title,
    sub,
    value,
    active,
    unknown,
  }: {
    title: string
    sub: string
    value: number
    active: boolean
    unknown?: boolean
  }) => (
    <div
      className={cx(
        'flex flex-1 flex-col gap-0.5 rounded-xl p-3',
        active ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-surface-inset'
      )}
    >
      <span className="text-caption font-medium text-content-primary">
        {title}
      </span>
      <span className="text-tiny text-content-tertiary">{sub}</span>
      <strong className="pt-1 text-subhead tabular-nums text-content-primary">
        {unknown ? '–' : fmt(value)}{' '}
        <span className="text-caption font-normal text-content-tertiary">
          {unit}
        </span>
      </strong>
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={t('p2pMarket.funds.title2', 'Move funds')}
      viewport
    >
      <div className="space-y-4 p-5">
        <p className="text-caption text-content-secondary">
          {t(
            'p2pMarket.funds.explain2',
            'Your node holds your savings. The trading wallet is a separate wallet for the market: only what you deposit here can be traded, and you can withdraw it back at any time.'
          )}
        </p>

        <div
          className="grid grid-cols-2 gap-1 rounded-xl bg-surface-inset p-1"
          role="tablist"
        >
          {(['toTrading', 'toNode'] as const).map((d) => (
            <button
              aria-selected={direction === d}
              className={cx(
                'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-body font-medium transition-colors',
                direction === d
                  ? 'bg-primary text-text-on-accent'
                  : 'text-content-secondary hover:text-content-primary'
              )}
              key={d}
              onClick={() => {
                setDirection(d)
                setAmount('')
              }}
              role="tab"
              type="button"
            >
              {d === 'toTrading' ? (
                <ArrowDown aria-hidden size={14} />
              ) : (
                <ArrowUp aria-hidden size={14} />
              )}
              {d === 'toTrading'
                ? t('p2pMarket.funds.depositTab', 'Deposit to trading wallet')
                : t('p2pMarket.funds.withdrawTab', 'Withdraw to node')}
            </button>
          ))}
        </div>

        {!nodeReady && (
          <p className="rounded-xl bg-status-warning-subtle p-3 text-caption text-content-primary">
            {btcQuery.isLoading
              ? t('p2pMarket.funds.nodeLoading', 'Reading your node…')
              : t(
                  'p2pMarket.funds.nodeMissing',
                  'No node is connected, so its balance cannot be shown. Connect and unlock your node to deposit from it. Your trading wallet below works on its own.'
                )}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <Balance
            active={deposit}
            sub={t('p2pMarket.funds.nodeSub', 'your savings')}
            title={t('p2pMarket.funds.nodeTitle', 'Node')}
            unknown={!nodeReady}
            value={nodeBalance}
          />
          <Balance
            active={!deposit}
            sub={t('p2pMarket.funds.tradingSub', 'used for the market')}
            title={t('p2pMarket.funds.tradingTitle', 'Trading wallet')}
            value={tradingBalance}
          />
        </div>

        <div>
          <p className="pb-1.5 text-caption text-content-secondary">
            {t('p2pMarket.funds.assetLabel', 'What to move')}
          </p>
          <div className="flex flex-wrap gap-2" role="group">
            {assetChoices.map((a) => (
              <button
                aria-pressed={asset === a.id}
                className={cx(
                  'rounded-full px-3 py-1 text-caption font-medium transition-colors',
                  asset === a.id
                    ? 'bg-primary/15 text-primary'
                    : 'bg-surface-raised text-content-secondary hover:text-content-primary'
                )}
                key={a.id}
                onClick={() => {
                  setAsset(a.id)
                  setAmount('')
                }}
                type="button"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            className="flex items-baseline justify-between text-caption text-content-secondary"
            htmlFor="p2p-funds-amount"
          >
            <span>{t('p2pMarket.funds.amountLabel', 'Amount')}</span>
            <button
              className="font-medium text-primary hover:underline"
              onClick={() => setPct(100)}
              type="button"
            >
              {t('p2pMarket.funds.max', 'Max')} {fmt(cap)}
            </button>
          </label>
          <div
            className={cx(
              'flex items-center gap-2 rounded-xl bg-surface-inset px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/40',
              tooMuch && 'ring-2 ring-status-danger/50'
            )}
          >
            <input
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-subhead font-medium tabular-nums text-content-primary outline-none placeholder:text-content-tertiary"
              id="p2p-funds-amount"
              inputMode="decimal"
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              spellCheck={false}
              value={amount}
            />
            <span className="shrink-0 text-caption text-content-tertiary">
              {unit}
            </span>
          </div>
          {tooMuch && (
            <p className="text-caption text-status-danger">
              {deposit
                ? t(
                    'p2pMarket.funds.tooMuchNode',
                    'That is more than the node holds.'
                  )
                : t(
                    'p2pMarket.funds.tooMuchTrading',
                    'That is more than the trading wallet holds.'
                  )}
            </p>
          )}
        </div>

        <Slider
          disabled={cap <= 0}
          label={t('p2pMarket.funds.share', 'Share of the balance')}
          marks={[0, 25, 50, 75, 100].map((v) => ({
            label: `${v}%`,
            value: v,
          }))}
          onChange={setPct}
          readout={cap > 0 ? `${pctNow}%` : undefined}
          value={pctNow}
        />

        {splitting && (
          <div className="rounded-xl bg-surface-inset p-3">
            <Slider
              label={t(
                'p2pMarket.funds.parts',
                'Split into separate coins (one swap each)'
              )}
              marks={[1, 2, 3, 5, 10].map((v) => ({
                label: String(v),
                value: v,
              }))}
              max={MAX_PARTS}
              min={1}
              onChange={(n) => {
                const ok =
                  n === 1 ||
                  units === 0 ||
                  Math.floor(units / n) >= MIN_PART_SAT
                if (ok) setParts(n)
              }}
              readout={t(
                'p2pMarket.funds.partsReadout',
                '{{n}} × {{each}} sat',
                {
                  each: each > 0 ? each.toLocaleString() : '–',
                  n: parts,
                }
              )}
              value={parts}
            />
            <p className="pt-2 text-caption text-content-tertiary">
              {t(
                'p2pMarket.funds.partsHint2',
                'Each swap spends a coin of its own. One coin means one swap at a time; split it to run several at once.'
              )}
            </p>
          </div>
        )}

        <Button
          disabled={busy || units <= 0 || tooMuch || (deposit && !nodeReady)}
          fullWidth
          isLoading={busy}
          onClick={submit}
        >
          {units > 0
            ? t(
                deposit
                  ? 'p2pMarket.funds.depositNow'
                  : 'p2pMarket.funds.withdrawNow',
                deposit
                  ? 'Deposit {{amount}} {{unit}}'
                  : 'Withdraw {{amount}} {{unit}}',
                { amount: fmt(units), unit }
              )
            : t('p2pMarket.funds.enterAmount', 'Enter an amount')}
        </Button>
      </div>
    </Modal>
  )
}
