import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Poll `fn` every `ms`; keeps the last good value when a poll fails. */
export function usePoll<T>(
  fn: () => Promise<T>,
  ms: number
): { data: T | undefined; error: string | null; refresh: () => void } {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string | null>(null)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const tick = useCallback(async () => {
    try {
      setData(await fnRef.current())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])
  useEffect(() => {
    void tick()
    const id = setInterval(() => void tick(), ms)
    return () => clearInterval(id)
  }, [tick, ms])
  return { data, error, refresh: () => void tick() }
}

/** `tr('key', 'English text', { n: 3 })` looks up `p2pMarket.market.key`. */
export function useTr() {
  const { t } = useTranslation()
  return useCallback(
    (
      key: string,
      defaultValue: string,
      vars?: Record<string, string | number>
    ) => t(`p2pMarket.market.${key}`, { defaultValue, ...vars }),
    [t]
  )
}
