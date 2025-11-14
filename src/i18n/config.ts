import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

// Import translation files
import de from './locales/de.json'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import it from './locales/it.json'
import ja from './locales/ja.json'
import zh from './locales/zh.json'

// Define available languages
export const LANGUAGES = {
  de: { flag: '🇩🇪', name: 'Deutsch' },
  en: { flag: '🇬🇧', name: 'English' },
  es: { flag: '🇪🇸', name: 'Español' },
  fr: { flag: '🇫🇷', name: 'Français' },
  it: { flag: '🇮🇹', name: 'Italiano' },
  ja: { flag: '🇯🇵', name: '日本語' },
  zh: { flag: '🇨🇳', name: '中文' },
} as const

export type LanguageCode = keyof typeof LANGUAGES

// Translation resources
const resources = {
  de: { translation: de },
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  it: { translation: it },
  ja: { translation: ja },
  zh: { translation: zh },
}

// Initialize i18n
i18n
  .use(LanguageDetector) // Detect system language
  .use(initReactI18next) // Integrate with React
  .init({
    // Enable debug mode in development
    debug: false,

    // List of supported languages
    // Language detection configuration
    detection: {
      // Cache the language in localStorage
      caches: ['localStorage'],

      // Lookup key in localStorage
      lookupLocalStorage: 'kaleidoswap_language',

      // Order of language detection
      order: ['localStorage', 'navigator'],
    },

    fallbackLng: 'en',

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    resources,

    // Fallback to English if translation not found
    supportedLngs: Object.keys(LANGUAGES),
  })

export { i18n }
