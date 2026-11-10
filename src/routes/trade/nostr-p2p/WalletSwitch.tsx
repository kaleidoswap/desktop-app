import { useState } from 'react'

import { Button, Modal } from '../../../components/ui'

import { useTr } from './market/hooks'
import type { TradingWallet } from './wallets'

interface Props {
  wallets: TradingWallet[]
  selectedId: string
  onSelect: (id: string) => void
  onCreate: (name: string) => void
}

/**
 * Pick which trading wallet is running, or name another one.
 * A second wallet gets its own files and keychain entry, so two clients on
 * this computer can trade with each other.
 */
export function WalletSwitch({
  wallets,
  selectedId,
  onSelect,
  onCreate,
}: Props) {
  const tr = useTr()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  const create = () => {
    onCreate(name)
    setName('')
    setOpen(false)
  }

  return (
    <>
      <label className="sr-only" htmlFor="p2p-wallet">
        {tr('walletSwitch.label', 'Trading wallet')}
      </label>
      <select
        className="rounded-lg bg-surface-inset px-3 py-1.5 text-caption text-content-primary outline-none"
        id="p2p-wallet"
        onChange={(e) => onSelect(e.target.value)}
        value={selectedId}
      >
        {wallets.map((w) => (
          <option key={w.id || 'original'} value={w.id}>
            {w.label}
          </option>
        ))}
      </select>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        {tr('walletSwitch.new', 'New wallet')}
      </Button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        size="sm"
        title={tr('walletSwitch.title', 'New trading wallet')}
      >
        <form
          className="flex flex-col gap-4 p-5"
          onSubmit={(e) => {
            e.preventDefault()
            create()
          }}
        >
          <p className="text-caption text-content-secondary">
            {tr(
              'walletSwitch.body',
              'A second wallet keeps its own keys and files, so it can trade with the first one on this computer. The wallet you already have stays where it is.'
            )}
          </p>
          <label className="flex flex-col gap-1.5 text-caption text-content-secondary">
            {tr('walletSwitch.name', 'Name')}
            <input
              className="rounded-xl bg-surface-inset px-3 py-2.5 text-body text-content-primary outline-none focus:ring-2 focus:ring-primary/40"
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              placeholder={tr('walletSwitch.placeholder', 'For example, Bob')}
              value={name}
            />
          </label>
          <Button type="submit">{tr('walletSwitch.create', 'Create')}</Button>
        </form>
      </Modal>
    </>
  )
}
