import { useState, useEffect } from 'react'

const iconBaseUrl =
  'https://raw.githubusercontent.com/kaleidoswap/cryptocurrency-icons/master/32/color/'
const defaultIcon = `${iconBaseUrl}generic.png`

export function useAssetIcon(ticker: string): string {
  const [iconUrl, setIconUrl] = useState<string>(defaultIcon)

  useEffect(() => {
    const loadIcon = async () => {
      const tickerLower = ticker.toLowerCase()
      const url = `${iconBaseUrl}${tickerLower}.png`

      try {
        const response = await fetch(url, { method: 'HEAD' })
        if (response.ok) {
          setIconUrl(url)
        } else {
          console.warn(`Icon not found for ${ticker}, using default.`)
          setIconUrl(defaultIcon)
        }
      } catch (error) {
        console.error(`Error checking icon for ${ticker}:`, error)
        setIconUrl(defaultIcon)
      }
    }

    loadIcon()
  }, [ticker])

  return iconUrl
}
