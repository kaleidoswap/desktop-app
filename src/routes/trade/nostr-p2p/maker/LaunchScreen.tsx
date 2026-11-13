import {
  CheckCircle2,
  Coins,
  RefreshCw,
  Rocket,
  Send,
  Wallet,
} from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { Button } from '../../../../components/ui'
import { fmtSats, fmtUnits, short } from '../format'
import { EmptyState, Panel, Pill } from '../market/ui'

import type {
  MakerBackend,
  MakerView,
  SignerWallet,
  StateHandoff,
  WalletAsset,
} from './makerApi'
import {
  CopyBox,
  errorText,
  NumField,
  SectionTitle,
  TextField,
  useMk,
} from './parts'
import { toBase } from './strategy'

/** The supply spread over `parts` coins, as the signer wallet will mint it (base units). */
export function splitSupply(supply: number, parts: number): number[] {
  const n = Math.max(1, Math.floor(parts))
  const each = Math.floor(supply / n)
  const out = Array<number>(n).fill(each)
  out[0] += supply - each * n
  return out
}

/** A ticker an NIA asset takes: 1 to 8 capital letters or digits, starting with a letter. */
export const tickerOk = (t: string) => /^[A-Z][A-Z0-9]{0,7}$/.test(t)

const Step = ({
  n,
  title,
  hint,
  done,
  children,
}: {
  n: number
  title: string
  hint?: string
  done?: boolean
  children: ReactNode
}) => (
  <Panel>
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span
          className={
            done
              ? 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-text-on-accent'
              : 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-raised text-tiny text-content-secondary'
          }
        >
          {done ? <CheckCircle2 size={14} /> : n}
        </span>
        <SectionTitle hint={hint}>{title}</SectionTitle>
      </div>
      <div className="flex flex-col gap-3 pl-9">{children}</div>
    </div>
  </Panel>
)

/**
 * Launch a token (hosted maker): fund the signer wallet in this app, make coins for the asset,
 * mint it here so the signer holds its RGB state from genesis, hand that state to the hosted
 * maker, then set a sell-only strategy and policy for it.
 */
export function LaunchScreen({
  backend,
  view,
  onView,
  onStrategy,
}: {
  backend: MakerBackend
  view: MakerView
  onView: (v: MakerView) => void
  onStrategy: (a: WalletAsset) => void
}) {
  const tm = useMk()
  const [wallet, setWallet] = useState<SignerWallet | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [coins, setCoins] = useState({ feeRate: 2, num: 6, size: 2_000 })
  const [mint, setMint] = useState({
    name: '',
    parts: 6,
    precision: 2,
    supply: 1_000_000,
    ticker: '',
  })
  const [handoff, setHandoff] = useState<StateHandoff | null>(null)
  const running = view.signer.running

  const run = useCallback(async (what: string, f: () => Promise<unknown>) => {
    setBusy(what)
    setError(null)
    try {
      await f()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(null)
    }
  }, [])

  const refresh = useCallback(
    () => run('refresh', async () => setWallet(await backend.wallet())),
    [backend, run]
  )

  useEffect(() => {
    if (running) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh, running])

  if (running) {
    return (
      <Panel>
        <EmptyState
          action={
            <Button
              isLoading={busy === 'stop'}
              onClick={() =>
                void run('stop', async () => onView(await backend.stopSigner()))
              }
              variant="outline"
            >
              {tm('live.stopSigner')}
            </Button>
          }
          description={tm('launch.signerRunningHint')}
          title={tm('launch.signerRunning')}
        />
      </Panel>
    )
  }

  const supplyBase = toBase(mint.supply, mint.precision)
  const parts = Math.max(1, Math.min(mint.parts, wallet?.free_coins ?? 0))
  const amounts = splitSupply(supplyBase, parts)
  const mintProblem = !tickerOk(mint.ticker)
    ? tm('launch.errors.ticker')
    : !mint.name.trim()
      ? tm('launch.errors.name')
      : !(supplyBase >= parts)
        ? tm('launch.errors.supply')
        : (wallet?.free_coins ?? 0) === 0
          ? tm('launch.errors.coins')
          : null
  const funded = (wallet?.btc.spendable ?? 0) > 0 || (wallet?.coins ?? 0) > 0
  const minted = (wallet?.assets.length ?? 0) > 0

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:gap-3">
          <Rocket className="shrink-0 text-primary" size={28} />
          <div className="flex flex-col gap-1">
            <h3 className="text-subhead font-semibold text-content-primary">
              {tm('launch.title')}
            </h3>
            <p className="text-body text-content-secondary">
              {tm('launch.explain')}
            </p>
          </div>
          <Button
            className="md:ml-auto"
            disabled={busy !== null}
            icon={<RefreshCw size={14} />}
            onClick={() => void refresh()}
            size="sm"
            variant="ghost"
          >
            {tm('launch.refresh')}
          </Button>
        </div>
      </Panel>

      <Step
        done={funded}
        hint={tm('launch.fundHint')}
        n={1}
        title={tm('launch.fund')}
      >
        <div className="flex flex-wrap gap-4 text-caption text-content-secondary">
          <span>
            <Wallet className="mr-1 inline" size={14} />
            {tm('launch.btc')}{' '}
            <span className="tabular-nums text-content-primary">
              {fmtSats(wallet?.btc.spendable ?? 0)} sat
            </span>
            {wallet && wallet.btc.future !== wallet.btc.settled && (
              <span className="ml-1 text-content-tertiary">
                (
                {tm('launch.incoming', {
                  sat: fmtSats(wallet.btc.future - wallet.btc.settled),
                })}
                )
              </span>
            )}
          </span>
        </div>
        {address ? (
          <CopyBox label={tm('launch.address')} value={address} />
        ) : (
          <div>
            <Button
              disabled={busy !== null}
              isLoading={busy === 'address'}
              onClick={() =>
                void run('address', async () =>
                  setAddress(await backend.walletAddress())
                )
              }
              size="sm"
              variant="outline"
            >
              {tm('launch.showAddress')}
            </Button>
          </div>
        )}
      </Step>

      <Step
        done={(wallet?.free_coins ?? 0) > 0 || minted}
        hint={tm('launch.coinsHint')}
        n={2}
        title={tm('launch.coins')}
      >
        <p className="text-caption text-content-secondary">
          <Coins className="mr-1 inline" size={14} />
          {tm('launch.coinsNow', {
            free: wallet?.free_coins ?? 0,
            total: wallet?.coins ?? 0,
          })}
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <NumField
            id="launch-coins-num"
            label={tm('launch.coinsNum')}
            onChange={(v) => setCoins((c) => ({ ...c, num: Math.round(v) }))}
            value={coins.num}
          />
          <NumField
            id="launch-coins-size"
            label={tm('launch.coinsSize')}
            onChange={(v) => setCoins((c) => ({ ...c, size: Math.round(v) }))}
            suffix="sat"
            value={coins.size}
          />
          <NumField
            id="launch-coins-fee"
            label={tm('launch.feeRate')}
            onChange={(v) =>
              setCoins((c) => ({ ...c, feeRate: Math.round(v) }))
            }
            suffix="sat/vB"
            value={coins.feeRate}
          />
        </div>
        <div>
          <Button
            disabled={busy !== null || !funded}
            isLoading={busy === 'coins'}
            onClick={() =>
              void run('coins', async () => {
                await backend.createCoins(coins.num, coins.size, coins.feeRate)
                setWallet(await backend.wallet())
              })
            }
            size="sm"
          >
            {tm('launch.makeCoins')}
          </Button>
        </div>
      </Step>

      <Step
        done={minted}
        hint={tm('launch.mintHint')}
        n={3}
        title={tm('launch.mint')}
      >
        <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
          <TextField
            id="launch-ticker"
            label={tm('launch.ticker')}
            onChange={(v) =>
              setMint((m) => ({ ...m, ticker: v.toUpperCase().trim() }))
            }
            placeholder="LAUNCH"
            value={mint.ticker}
          />
          <TextField
            id="launch-name"
            label={tm('launch.name')}
            onChange={(v) => setMint((m) => ({ ...m, name: v }))}
            value={mint.name}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <NumField
            id="launch-supply"
            label={tm('launch.supply')}
            onChange={(v) => setMint((m) => ({ ...m, supply: v }))}
            suffix={mint.ticker || tm('common.units')}
            value={mint.supply}
          />
          <NumField
            id="launch-precision"
            label={tm('launch.precision')}
            onChange={(v) =>
              setMint((m) => ({
                ...m,
                precision: Math.max(0, Math.min(18, Math.round(v))),
              }))
            }
            value={mint.precision}
          />
          <NumField
            hint={tm('launch.partsHint', { free: wallet?.free_coins ?? 0 })}
            id="launch-parts"
            label={tm('launch.parts')}
            onChange={(v) =>
              setMint((m) => ({ ...m, parts: Math.max(1, Math.round(v)) }))
            }
            value={mint.parts}
          />
        </div>
        {!mintProblem && (
          <p className="text-caption text-content-tertiary">
            {tm('launch.split', {
              each: amounts
                .slice(0, 3)
                .map((a) => fmtUnits(a, mint.precision))
                .join(' + '),
              more: amounts.length > 3 ? ` + … (${amounts.length})` : '',
            })}
          </p>
        )}
        {mintProblem && mint.ticker && (
          <p className="text-caption text-status-warning">{mintProblem}</p>
        )}
        <div>
          <Button
            disabled={busy !== null || !!mintProblem}
            isLoading={busy === 'mint'}
            onClick={() =>
              void run('mint', async () => {
                await backend.mint({
                  name: mint.name.trim(),
                  parts,
                  precision: mint.precision,
                  supply: supplyBase,
                  ticker: mint.ticker,
                })
                setHandoff(null)
                setMint((m) => ({ ...m, name: '', ticker: '' }))
                setWallet(await backend.wallet())
              })
            }
            size="sm"
          >
            {tm('launch.mintButton')}
          </Button>
        </div>
        {minted && (
          <ul className="flex flex-col divide-y divide-border-subtle">
            {wallet?.assets.map((a) => (
              <li
                className="flex flex-wrap items-center gap-2 py-2"
                key={a.asset_id}
              >
                <span className="text-body font-medium text-content-primary">
                  {a.ticker}
                </span>
                <span className="font-mono text-tiny text-content-tertiary">
                  {short(a.asset_id, 12)}
                </span>
                <span className="text-caption text-content-secondary">
                  {fmtUnits(a.balance.future, a.precision)} ·{' '}
                  {tm('launch.allocations', { n: a.allocations })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Step>

      <Step
        done={!!handoff?.uploaded}
        hint={tm('launch.handoffHint')}
        n={4}
        title={tm('launch.handoff')}
      >
        <div>
          <Button
            disabled={busy !== null || !minted}
            icon={<Send size={14} />}
            isLoading={busy === 'state'}
            onClick={() =>
              void run('state', async () =>
                setHandoff(await backend.sendState())
              )
            }
            size="sm"
          >
            {tm('launch.sendState')}
          </Button>
        </div>
        {handoff?.uploaded && (
          <Pill tone="success">{tm('launch.stateSent')}</Pill>
        )}
        {handoff && !handoff.uploaded && (
          <div className="flex flex-col gap-2 rounded-xl bg-status-warning-subtle p-3 text-caption text-status-warning">
            <span>{tm('launch.stateManual')}</span>
            {handoff.detail && (
              <span className="text-content-tertiary">{handoff.detail}</span>
            )}
            {handoff.file && (
              <CopyBox label={tm('launch.stateFile')} value={handoff.file} />
            )}
            {handoff.password && (
              <CopyBox
                label={tm('launch.statePassword')}
                value={handoff.password}
              />
            )}
          </div>
        )}
      </Step>

      <Step hint={tm('launch.nextHint')} n={5} title={tm('launch.next')}>
        {minted ? (
          <div className="flex flex-wrap gap-2">
            {wallet?.assets.map((a) => (
              <Button
                key={a.asset_id}
                onClick={() => onStrategy(a)}
                size="sm"
                variant="outline"
              >
                {tm('launch.setStrategy', { ticker: a.ticker })}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-caption text-content-tertiary">
            {tm('launch.nextLater')}
          </p>
        )}
      </Step>

      {error && <p className="text-caption text-status-danger">{error}</p>}
    </div>
  )
}
