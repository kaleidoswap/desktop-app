import i18n from 'i18next'

/**
 * Get the locale code for date formatting based on the current language
 */
export const getDateLocale = (): string => {
  const language = i18n.language || 'en'

  // Map language codes to locale codes for date formatting
  const localeMap: Record<string, string> = {
    de: 'de-DE',
    en: 'en-US',
    es: 'es-ES',
    fr: 'fr-FR',
    it: 'it-IT',
    ja: 'ja-JP',
    zh: 'zh-CN',
  }

  return localeMap[language] || 'en-US'
}

export const formatDate = (
  timestamp: number,
  use24h: boolean = true
): string => {
  const locale = getDateLocale()
  const date = new Date(timestamp)
  return date.toLocaleString(locale, {
    day: 'numeric',
    hour: '2-digit',
    hour12: !use24h,
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
