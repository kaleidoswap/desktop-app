import { useState, useCallback } from 'react'

export const useCopyToClipboard = (duration = 2000) => {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(
    async (text: string) => {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), duration)
    },
    [duration]
  )

  return { copied, copy }
}
