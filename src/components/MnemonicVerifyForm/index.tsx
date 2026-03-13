import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react'
import React, { useState } from 'react'
import { SubmitHandler, UseFormReturn } from 'react-hook-form'
import { toast } from 'react-toastify'

import wordlistRaw from '../../assets/bip39-english.txt?raw'
import { Button } from '../ui/Button'

export interface MnemonicVerifyFields {
  mnemonic: string
}

interface MnemonicVerifyFormProps {
  form: UseFormReturn<MnemonicVerifyFields>
  onSubmit: SubmitHandler<MnemonicVerifyFields>
  errors: string[]
}

export const MnemonicVerifyForm = ({
  form,
  onSubmit,
  errors,
}: MnemonicVerifyFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [wordlist] = useState(() => wordlistRaw.split('\n').filter(Boolean))
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [_, setCurrentWord] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)

  const updateSuggestions = (text: string, position: number) => {
    const words = text.slice(0, position).split(' ')
    const currentWordInput = words[words.length - 1].toLowerCase()
    setCurrentWord(currentWordInput)

    if (words.length > 12) {
      setSuggestions([])
      return
    }

    if (currentWordInput.length > 0) {
      const matches = wordlist
        .filter((word) => word.startsWith(currentWordInput))
        .slice(0, 5)
      setSuggestions(matches)
    } else {
      setSuggestions([])
    }
  }

  const handleSuggestionClick = (word: string) => {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    const text = textarea.value
    const beforeCursor = text.slice(0, cursorPosition)
    const afterCursor = text.slice(cursorPosition)

    const words = beforeCursor.split(' ')
    words[words.length - 1] = word

    const newText = words.join(' ') + ' ' + afterCursor.trim()
    form.setValue('mnemonic', newText)
    setSuggestions([])

    textarea.focus()
    const newPosition = words.join(' ').length + 1
    textarea.setSelectionRange(newPosition, newPosition)
    setCursorPosition(newPosition)
  }

  // Handle key down event to select the first suggestion with Tab
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault()
      handleSuggestionClick(suggestions[0])
    }
  }

  const handleSubmit: SubmitHandler<MnemonicVerifyFields> = async (data) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      await onSubmit(data)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Helper function to split and display words
  const displayWords = (text: string) => {
    return text
      .trim()
      .split(/\s+/)
      .map((word, index) => (
        <span
          className="inline-block bg-surface-overlay/50 text-content-secondary px-2.5 py-1 
                     rounded-md border border-border-default/50 text-xs font-medium m-0.5
                     transition-colors hover:border-border-default"
          key={index}
        >
          {word}
        </span>
      ))
  }

  React.useEffect(() => {
    errors.forEach((error) => {
      toast.error(error)
    })
  }, [errors])

  return (
    <div className="w-full">
      <p className="text-content-secondary mb-6 leading-relaxed">
        For your security, please enter your recovery phrase to confirm you've
        saved it correctly. This step cannot be skipped.
      </p>

      {/* Form Section */}
      <form
        className="bg-surface-elevated/40 p-6 rounded-xl border border-white/5"
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1.5">
              Recovery Phrase
            </label>
            <div className="relative">
              <textarea
                className="w-full min-h-[100px] rounded-lg border-2 border-border-default/50 
                          bg-surface-overlay/30 px-4 py-2.5 text-content-secondary font-mono text-sm
                          focus:border-cyan focus:ring-2 focus:ring-cyan/20 
                          outline-none transition-all placeholder:text-content-tertiary"
                placeholder="Enter your recovery phrase..."
                {...form.register('mnemonic', {
                  required: 'Recovery phrase is required',
                })}
                onChange={(e) => {
                  form.register('mnemonic').onChange(e)
                  updateSuggestions(e.target.value, e.target.selectionStart)
                }}
                onClick={(e) => {
                  setCursorPosition(e.currentTarget.selectionStart)
                  updateSuggestions(
                    e.currentTarget.value,
                    e.currentTarget.selectionStart
                  )
                }}
                onKeyDown={handleKeyDown}
                onKeyUp={(e) => {
                  setCursorPosition(e.currentTarget.selectionStart)
                  updateSuggestions(
                    e.currentTarget.value,
                    e.currentTarget.selectionStart
                  )
                }}
                onPaste={() => {
                  // Clear suggestions on paste
                  setTimeout(() => {
                    setSuggestions([])
                    // Get the current value and ensure it ends with a space
                    const currentValue = form.getValues('mnemonic')
                    if (currentValue && !currentValue.endsWith(' ')) {
                      form.setValue('mnemonic', currentValue + ' ')
                    }
                  }, 0)
                }}
              />

              {/* Word Suggestions */}
              {suggestions.length > 0 && (
                <div
                  className="absolute left-0 right-0 mt-1 bg-surface-overlay 
                               border border-border-default rounded-lg overflow-hidden z-10"
                >
                  {suggestions.map((word, index) => (
                    <button
                      className="w-full px-3 py-1.5 text-left text-content-secondary text-sm
                                hover:bg-surface-high/50 transition-colors
                                flex items-center justify-between"
                      key={word}
                      onClick={(e) => {
                        e.preventDefault()
                        handleSuggestionClick(word)
                      }}
                      type="button"
                    >
                      <span>{word}</span>
                      {index === 0 && (
                        <span className="text-xs text-content-tertiary">
                          Tab ↹
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Word Display */}
              <div className="mt-3 min-h-[40px]">
                {form.watch('mnemonic') && (
                  <div className="flex flex-wrap gap-1">
                    {displayWords(form.watch('mnemonic'))}
                  </div>
                )}
              </div>

              {/* Word Counter */}
              <div
                className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md 
                             bg-surface-overlay/80 text-xs text-content-secondary"
              >
                {form.watch('mnemonic')?.split(/\s+/).filter(Boolean).length ||
                  0}{' '}
                words
              </div>
            </div>

            {/* Error Display */}
            {(form.formState.errors.mnemonic || errors.length > 0) && (
              <div
                className="mt-4 p-3 bg-red-500/10 border border-red-500/20 
                             rounded-lg flex items-start gap-3"
              >
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  {form.formState.errors.mnemonic && (
                    <p className="text-red-400 text-xs mb-2">
                      {form.formState.errors.mnemonic.message}
                    </p>
                  )}
                  {errors.length > 0 && (
                    <ul className="text-red-400 text-xs space-y-1">
                      {errors.map((error, index) => (
                        <li className="flex items-center gap-2" key={index}>
                          <span>•</span> {error}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <Button
            className="w-full mt-4"
            disabled={isSubmitting}
            icon={
              isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )
            }
            iconPosition="right"
            size="lg"
            type="submit"
            variant="primary"
          >
            {isSubmitting ? 'Verifying...' : 'Confirm Recovery Phrase'}
          </Button>
        </div>
      </form>
    </div>
  )
}
