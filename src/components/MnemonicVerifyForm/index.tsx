import { Button, buttonVariants, cn } from 'kaleido-ui'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  phrase: string
  wordCount?: 'three' | 'all'
  onBack: () => void
  /** Resolve false if the caller displayed an error and wants to allow retry. */
  onVerified: () => boolean | void | Promise<boolean | void>
  submitLabel?: string
}

function randomIndex(length: number): number {
  const sample = new Uint32Array(1)
  const range = 0x100000000
  const limit = range - (range % length)
  do {
    crypto.getRandomValues(sample)
  } while (sample[0] >= limit)
  return sample[0] % length
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

function createQuestions(phrase: string, wordCount: Props['wordCount']) {
  const words = phrase.split(' ').filter(Boolean)
  const distinctWords = [...new Set(words)]
  if (distinctWords.length < 3) return []

  const positions = words.map((_, position) => position)
  const selected =
    wordCount === 'all'
      ? positions
      : shuffle(positions)
          .slice(0, 3)
          .sort((a, b) => a - b)
  return selected.map((position) => {
    const answer = words[position]
    const otherWords = shuffle(distinctWords.filter((word) => word !== answer))
    const choices = shuffle([answer, ...otherWords.slice(0, 2)])
    return { answer, choices, position }
  })
}

function WordChoices({
  phrase,
  wordCount,
  onBack,
  onVerified,
  submitLabel,
}: Props) {
  const { t } = useTranslation()
  const groupId = useId()
  const [questions] = useState(() => createQuestions(phrase, wordCount))
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [error, setError] = useState<'mismatch' | 'failure' | null>(null)
  const [locked, setLocked] = useState(false)
  const submitted = useRef(false)
  const complete =
    questions.length > 0 && questions.every(({ position }) => answers[position])

  async function verify() {
    if (!complete || submitted.current) return
    if (
      questions.some(({ answer, position }) => answer !== answers[position])
    ) {
      setError('mismatch')
      return
    }
    submitted.current = true
    setLocked(true)
    setError(null)
    try {
      if ((await onVerified()) !== false) return
    } catch {
      setError('failure')
    }
    submitted.current = false
    setLocked(false)
  }

  return (
    <div className="flex flex-col gap-4">
      {questions.length ? (
        <p className="text-body text-content-secondary">
          {t('mnemonicCheck.instruction')}
        </p>
      ) : (
        <p className="text-body text-status-danger" role="alert">
          {t('mnemonicCheck.unavailable')}
        </p>
      )}
      {questions.map(({ choices, position }) => (
        <fieldset className="min-w-0" disabled={locked} key={position}>
          <legend className="mb-2 text-body font-semibold text-content-primary">
            {t('mnemonicCheck.word', { number: position + 1 })}
          </legend>
          <div className="flex flex-wrap gap-2">
            {choices.map((word) => (
              <label className="relative" key={word}>
                <input
                  checked={answers[position] === word}
                  className="peer sr-only"
                  name={groupId + '-' + position}
                  onChange={() => {
                    setAnswers((prev) => ({ ...prev, [position]: word }))
                    setError(null)
                  }}
                  type="radio"
                />
                <span
                  className={cn(
                    buttonVariants({ size: 'sm', variant: 'surface' }),
                    'cursor-pointer peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:cursor-default'
                  )}
                >
                  {word}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {error && (
        <p className="text-body text-status-danger" role="alert">
          {t(
            error === 'mismatch'
              ? 'mnemonicCheck.mismatch'
              : 'walletInit.verifyStep.unexpectedError'
          )}
        </p>
      )}
      <div className="flex flex-wrap justify-between gap-2">
        <Button
          disabled={locked}
          onClick={onBack}
          type="button"
          variant="outline"
        >
          {t('common.back')}
        </Button>
        <Button
          disabled={!complete || locked}
          onClick={() => void verify()}
          type="button"
        >
          {submitLabel ?? t('common.confirm')}
        </Button>
      </div>
    </div>
  )
}

export function MnemonicVerifyForm(props: Props) {
  const phrase = props.phrase.trim().split(/\s+/).join(' ')
  const wordCount = props.wordCount ?? 'three'
  // A new phrase gets a fresh challenge without putting recovery words in a React key.
  const [session, setSession] = useState({ generation: 0, phrase, wordCount })
  if (session.phrase !== phrase || session.wordCount !== wordCount) {
    setSession({ generation: session.generation + 1, phrase, wordCount })
    return null
  }
  return <WordChoices {...props} key={session.generation} phrase={phrase} />
}
