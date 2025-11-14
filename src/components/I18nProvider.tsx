import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'

import { RootState } from '../app/store'
import { setLanguage } from '../slices/settings/settings.slice'

interface I18nProviderProps {
  children: React.ReactNode
}

export const I18nProvider = ({ children }: I18nProviderProps) => {
  const { i18n } = useTranslation()
  const dispatch = useDispatch()
  const settingsLanguage = useSelector(
    (state: RootState) => state.settings.language
  )
  const accountLanguage = useSelector(
    (state: RootState) => state.nodeSettings.data.language
  )

  useEffect(() => {
    // Priority: account language > settings language
    const preferredLanguage = accountLanguage || settingsLanguage || 'en'

    // Sync Redux state with account language if account language is different
    if (accountLanguage && accountLanguage !== settingsLanguage) {
      dispatch(setLanguage(accountLanguage))
    }

    // Sync i18n language with preferred language
    if (preferredLanguage && i18n.language !== preferredLanguage) {
      i18n.changeLanguage(preferredLanguage)
    }
  }, [accountLanguage, settingsLanguage, i18n, dispatch])

  return <>{children}</>
}
