import { Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button, Input, Modal } from '../../../components/ui'

import { useTr } from './market/hooks'
import { p2pRelaysGet, p2pRelaysSet, type P2pRelaySettings } from './p2p'

interface Props {
  isOpen: boolean
  networkKey: string
  onClose: () => void
  /** The list changed: the trading wallet restarts to use it. */
  onSaved: () => void
}

const same = (a: string[], b: string[]) =>
  a.length === b.length && a.every((r, i) => r === b[i])

/**
 * The Nostr relays the market uses. Offers are published to all of them and the book is read from
 * all of them, so the market does not depend on any single one. The app checks each address.
 */
export function RelaysModal({ isOpen, networkKey, onClose, onSaved }: Props) {
  const tr = useTr()
  const [settings, setSettings] = useState<P2pRelaySettings | null>(null)
  const [list, setList] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    p2pRelaysGet(networkKey)
      .then((s) => {
        if (cancelled) return
        setSettings(s)
        setList(s.custom ?? s.defaults)
        setDraft('')
        setError(null)
      })
      .catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [isOpen, networkKey])

  const current = settings ? (settings.custom ?? settings.defaults) : []
  const changed = settings !== null && !same(list, current)
  const isDefault = settings !== null && same(list, settings.defaults)

  const add = () => {
    const r = draft.trim().replace(/\/+$/, '')
    if (!r) return
    if (!list.includes(r)) setList([...list, r])
    setDraft('')
    setError(null)
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const saved = await p2pRelaysSet(networkKey, isDefault ? null : list)
      setSettings(saved)
      onSaved()
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={tr('relays.title', 'Relays')}
      viewport
    >
      <div className="flex flex-col gap-4 p-5">
        <p className="text-caption text-content-secondary">
          {tr(
            'relays.body',
            'Offers and messages travel over Nostr relays. Your offers are published to every relay in this list and the order book is read from all of them, so the market keeps working if one goes down. Relays never hold your funds.'
          )}
        </p>
        <ul className="flex flex-col gap-1.5">
          {list.map((r) => (
            <li
              className="flex items-center justify-between gap-2 rounded-lg bg-surface-raised px-3 py-2"
              key={r}
            >
              <span className="truncate font-mono text-caption text-content-primary">
                {r}
              </span>
              <button
                aria-label={tr('relays.remove', 'Remove {{relay}}', {
                  relay: r,
                })}
                className="rounded p-1 text-content-tertiary hover:text-status-danger disabled:opacity-40"
                disabled={list.length === 1}
                onClick={() => setList(list.filter((x) => x !== r))}
                type="button"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <Input
            aria-label={tr('relays.add', 'Add a relay')}
            className="flex-1"
            onChange={(e) => setDraft(e.target.value)}
            placeholder="wss://"
            spellCheck={false}
            value={draft}
          />
          <Button
            disabled={!draft.trim()}
            icon={<Plus size={14} />}
            type="submit"
            variant="outline"
          >
            {tr('relays.addButton', 'Add')}
          </Button>
        </form>
        {error && <p className="text-caption text-status-danger">{error}</p>}
        <div className="flex flex-wrap justify-between gap-2">
          <Button
            disabled={isDefault || busy}
            onClick={() => settings && setList(settings.defaults)}
            variant="ghost"
          >
            {tr('relays.defaults', 'Use the defaults')}
          </Button>
          <Button disabled={!changed || busy} onClick={() => void save()}>
            {tr('relays.save', 'Save and restart')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
