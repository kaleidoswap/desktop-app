import {
  Icon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'kaleido-ui'
import { useTranslation } from 'react-i18next'

import { useAppDispatch } from '../../app/store/hooks'
import { LANGUAGES, type LanguageCode } from '../../i18n'
import { setLanguage } from '../../slices/settings/settings.slice'

export function LanguagePicker({ full = false }: { full?: boolean }) {
  const { i18n, t } = useTranslation()
  const dispatch = useAppDispatch()
  const resolved = i18n.resolvedLanguage as LanguageCode | undefined
  const language = resolved && resolved in LANGUAGES ? resolved : 'en'
  const label = t('settings.language')

  return (
    <Select
      onValueChange={(code) => dispatch(setLanguage(code))}
      value={language}
    >
      <SelectTrigger
        aria-label={label}
        className="min-h-9 shrink-0"
        compact
        title={label}
      >
        <Icon name="language" size="sm" />
        <SelectValue>
          {full ? (
            <span lang={language}>{LANGUAGES[language].name}</span>
          ) : (
            <>
              <span aria-hidden>{language.toUpperCase()}</span>
              <span className="sr-only" lang={language}>
                {LANGUAGES[language].name}
              </span>
            </>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        align="end"
        className="max-h-[var(--radix-select-content-available-height)]"
      >
        {Object.entries(LANGUAGES).map(([code, { name }]) => (
          <SelectItem key={code} lang={code} textValue={name} value={code}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
