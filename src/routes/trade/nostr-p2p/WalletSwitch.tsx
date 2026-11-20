import { Plus } from 'lucide-react'
import { useState } from 'react'

import { Button, Modal } from '../../../components/ui'

import { useTr } from './market/hooks'
import { Picker } from './market/Picker'
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
      <Picker
        footer={(close) => (
          <button
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-primary hover:bg-surface-overlay/60"
            onClick={() => {
              close()
              setOpen(true)
            }}
            type="button"
          >
            <Plus className="h-4 w-4" />
            {tr('walletSwitch.new', 'New wallet')}
          </button>
        )}
        label={tr('walletSwitch.label', 'Trading wallet')}
        onChange={onSelect}
        options={wallets.map((w) => ({
          leading: (
            <span
              aria-hidden
              className="h-6 w-6 flex-none rounded-md bg-gradient-to-br from-primary to-purple"
            />
          ),
          subtitle: w.id
            ? undefined
            : tr('walletSwitch.original', 'The first wallet on this computer'),
          title: w.label,
          value: w.id,
        }))}
        value={selectedId}
        variant="pill"
      />
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
