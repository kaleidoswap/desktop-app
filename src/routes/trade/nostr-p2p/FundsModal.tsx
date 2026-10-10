import { ArrowLeftRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import { useAppSelector } from '../../../app/store/hooks'
import { Alert, Button, Modal } from '../../../components/ui'
import { getAllRgbAssets } from '../../../utils/rgbUtils'
import { nodeApi } from '../../../slices/nodeApi/nodeApi.slice'

import {
  assetToNode,
  assetToTrading,
  btcToNode,
  btcToTrading,
  daemonBalance,
  tauriDaemon,
  toBaseUnits,
  type DaemonBalance,
  type NodeWallet,
} from './p2p'

// The SDK types the assignment type as an enum it does not export.
const fungible = (value: number): any => ({ type: 'Fungible', value })

type Direction = 'toTrading' | 'toNode'

const BTC = 'btc'

interface Props {
  isOpen: boolean
  onClose: () => void
}

/** Move bitcoin or an RGB asset between the node and the trading wallet that backs the market. */
export const FundsModal = ({ isOpen, onClose }: Props) => {
  const { t } = useTranslation()
  const proxyEndpoint = useAppSelector(
    (s) => s.nodeSettings.data.proxy_endpoint
  )
  const [direction, setDirection] = useState<Direction>('toTrading')
  const [asset, setAsset] = useState(BTC)
  const [amount, setAmount] = useState('')
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
    if (!isOpen || asset === BTC) return
    void getAssetBalance({ asset_id: asset })
      .unwrap()
      .then((b) => setNodeAssetBalance(b.spendable))
      .catch(() => setNodeAssetBalance(null))
  }, [isOpen, asset, getAssetBalance])

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
      toast.success(t('p2pMarket.funds.sent'))
      setAmount('')
      void refreshTrading()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const unit = asset === BTC ? 'sat' : (selected?.ticker ?? '')
  const shown = (base: number) =>
    asset === BTC ? base : base / 10 ** precision

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={t('p2pMarket.funds.title')}
    >
      <div className="space-y-4">
        <Alert variant="info">{t('p2pMarket.funds.explain')}</Alert>

        <div className="flex gap-2">
          <Button
            onClick={() => setDirection('toTrading')}
            variant={direction === 'toTrading' ? 'primary' : 'outline'}
          >
            {t('p2pMarket.funds.toTrading')}
          </Button>
          <Button
            icon={<ArrowLeftRight size={14} />}
            onClick={() => setDirection('toNode')}
            variant={direction === 'toNode' ? 'primary' : 'outline'}
          >
            {t('p2pMarket.funds.toNode')}
          </Button>
        </div>

        <label className="block text-sm text-content-secondary">
          {t('p2pMarket.funds.asset')}
          <select
            className="mt-1 w-full rounded-md border border-border-default bg-surface-base p-2 text-content-primary"
            onChange={(e) => {
              setAsset(e.target.value)
              setAmount('')
            }}
            value={asset}
          >
            <option value={BTC}>BTC</option>
            {assets.map((a) => (
              <option key={a.asset_id} value={a.asset_id}>
                {a.ticker}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-content-secondary">
          {t('p2pMarket.funds.amount')}
          <input
            className="mt-1 w-full rounded-md border border-border-default bg-surface-base p-2 text-content-primary"
            inputMode="decimal"
            onChange={(e) => setAmount(e.target.value)}
            placeholder={unit}
            value={amount}
          />
        </label>

        <dl className="grid grid-cols-2 gap-1 text-sm text-content-secondary">
          <dt>{t('p2pMarket.funds.nodeBalance')}</dt>
          <dd className="text-right">
            {shown(nodeBalance)} {unit}
          </dd>
          <dt>{t('p2pMarket.funds.tradingBalance')}</dt>
          <dd className="text-right">
            {shown(tradingBalance)} {unit}
          </dd>
        </dl>

        <Button
          disabled={busy || units <= 0}
          fullWidth
          isLoading={busy}
          onClick={submit}
        >
          {t('p2pMarket.funds.move')}
        </Button>
      </div>
    </Modal>
  )
}
