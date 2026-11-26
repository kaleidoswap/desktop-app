import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'

import { RootState } from '../app/store'

interface I18nProviderProps {
  children: React.ReactNode
}

export const I18nProvider = ({ children }: I18nProviderProps) => {
  const { i18n } = useTranslation()
  const settingsLanguage = useSelector(
    (state: RootState) => state.settings.language
  )

  useEffect(() => {
    if (settingsLanguage && i18n.language !== settingsLanguage) {
      void i18n.changeLanguage(settingsLanguage)
    }
  }, [settingsLanguage, i18n])

  const language = i18n.resolvedLanguage
  useEffect(() => {
    if (language) document.documentElement.lang = language
  }, [language])

  return <>{children}</>
}
