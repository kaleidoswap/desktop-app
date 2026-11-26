import { ChevronDown, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAppDispatch } from '../../app/store/hooks'
import { LANGUAGES, type LanguageCode } from '../../i18n'
import { setLanguage } from '../../slices/settings/settings.slice'

export function LanguagePicker({ full = false }: { full?: boolean }) {
  const { i18n, t } = useTranslation()
  const dispatch = useAppDispatch()
  const language = (i18n.resolvedLanguage || 'en') as LanguageCode
  const label = t('settings.language')

  return (
    <label
      className="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-divider/20 bg-surface-overlay px-2 text-xs font-medium text-content-primary hover:border-primary/50 focus-within:ring-2 focus-within:ring-primary sm:px-3"
      title={label}
    >
      <Languages aria-hidden="true" size={16} />
      <span aria-hidden="true" lang={full ? language : undefined}>
        {full ? LANGUAGES[language]?.name : language.toUpperCase()}
      </span>
      <ChevronDown aria-hidden="true" className="hidden sm:block" size={13} />
      <select
        aria-label={label}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        onChange={(event) => dispatch(setLanguage(event.target.value))}
        value={language}
      >
        {Object.entries(LANGUAGES).map(([code, { name }]) => (
          <option
            className="bg-surface-elevated text-content-primary"
            key={code}
            lang={code}
            value={code}
          >
            {name}
          </option>
        ))}
      </select>
    </label>
  )
}
