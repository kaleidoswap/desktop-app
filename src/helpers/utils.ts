import { useState, useEffect } from 'react'

import defaultRgbIcon from '../assets/rgb-symbol-color.svg'
import { COIN_ICON_URL } from '../constants'

// Cache for asset icons to prevent repeated downloads
const iconCache = new Map<string, string>()

export const parseRpcUrl = (url: string) => {
  try {
    const [credentials, hostPort] = url.split('@')
    const [username, password] = credentials.split(':')
    const [host, port] = hostPort.split(':')
    return { host, password, port: parseInt(port, 10), username }
  } catch {
    return {
      host: 'localhost',
      password: 'password',
      port: 18443,
      username: 'user',
    }
  }
}

export const loadAssetIcon = async (
  assetTicker: string,
  defaultIcon = defaultRgbIcon
): Promise<string> => {
  try {
    if (!assetTicker || assetTicker === 'None') {
      return defaultIcon
    }
    if (assetTicker === 'SAT') {
      assetTicker = 'BTC'
    }

    // Check if icon is already in cache
    const cachedIcon = iconCache.get(assetTicker)
    if (cachedIcon) {
      return cachedIcon
    }

    const iconUrl = `${COIN_ICON_URL}${assetTicker.toLowerCase()}.png`
    const response = await fetch(iconUrl)
    if (response.ok) {
      // Cache the successful icon URL
      iconCache.set(assetTicker, iconUrl)
      return iconUrl
    }
    throw new Error('Icon not found')
  } catch (error) {
    return defaultIcon
  }
}

export const useAssetIcon = (ticker: string, defaultIcon = defaultRgbIcon) => {
  const [imgSrc, setImgSrc] = useState<string>(defaultIcon)

  useEffect(() => {
    if (!ticker || ticker === 'None') {
      setImgSrc(defaultIcon)
      return
    }

    // Check cache first
    const cachedIcon = iconCache.get(ticker)
    if (cachedIcon) {
      setImgSrc(cachedIcon)
      return
    }

    loadAssetIcon(ticker, defaultIcon)
      .then(setImgSrc)
      .catch(() => setImgSrc(defaultIcon))
  }, [ticker, defaultIcon])

  return [imgSrc, setImgSrc] as const
}

// Generate random wallet names
const adjectives = [
  'swift',
  'bright',
  'cosmic',
  'digital',
  'electric',
  'quantum',
  'stellar',
  'crypto',
  'lunar',
  'solar',
  'atomic',
  'dynamic',
  'plasma',
  'cyber',
  'neural',
  'quantum',
]

const nouns = [
  'wallet',
  'vault',
  'node',
  'beacon',
  'portal',
  'nexus',
  'circuit',
  'matrix',
  'pulse',
  'core',
  'sphere',
  'prism',
  'vector',
  'cipher',
  'token',
  'chain',
]

export const generateWalletName = (): string => {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  return `${adjective}-${noun}-${Math.floor(Math.random() * 1000)}`
}
