import { useState } from 'react'

import { Button, Modal } from '../../../components/ui'

import { useTr } from './market/hooks'
import { recoveryPhrase } from './p2p'

interface Props {
  isOpen: boolean
  onClose: () => void
}

/** The wallet's recovery phrase, shown only when the user asks and only until the dialog closes. */
export function RecoveryPhraseModal({ isOpen, onClose }: Props) {
  const tr = useTr()
  const [phrase, setPhrase] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState(false)

  // the phrase does not outlive the dialog
  const close = () => {
    setPhrase(null)
    setShown(false)
    setError(null)
    onClose()
  }

  const reveal = async () => {
    try {
      setPhrase(await recoveryPhrase())
      setShown(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      size="sm"
      title={tr('recovery.title', 'Recovery phrase')}
      viewport
    >
      <div className="flex flex-col gap-4 p-5">
        <p className="text-caption text-content-secondary">
          {tr(
            'recovery.body',
            'Anyone who sees these words can take the funds in this wallet. Make sure nobody is looking, and never type them anywhere but this app.'
          )}
        </p>
        {error && <p className="text-caption text-status-danger">{error}</p>}
        {shown && phrase ? (
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {phrase.split(' ').map((w, i) => (
              <li
                className="flex items-baseline gap-2 rounded-lg bg-surface-raised px-3 py-2"
                key={i}
              >
                <span className="w-5 text-right text-tiny tabular-nums text-content-tertiary">
                  {i + 1}
                </span>
                <span className="text-body font-medium text-content-primary">
                  {w}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <Button onClick={() => void reveal()} variant="outline">
            {tr('recovery.show', 'Show the phrase')}
          </Button>
        )}
      </div>
    </Modal>
  )
}
