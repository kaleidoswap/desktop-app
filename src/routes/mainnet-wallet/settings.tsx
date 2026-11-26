import {
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SettingsSelectorRow,
} from 'kaleido-ui'
import { Coins, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAppDispatch, useAppSelector } from '../../app/store/hooks'
import { LanguagePicker } from '../../components/Layout/LanguagePicker'
import {
  CURRENCY_LABELS,
  SUPPORTED_CURRENCIES,
} from '../../slices/priceApi/priceApi.slice'
import { setFiatCurrency } from '../../slices/settings/settings.slice'

export function Component() {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const currency = useAppSelector((state) => state.settings.fiatCurrency)

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <PageHeader title={t('settings.applicationSettings')} variant="page" />
      <SettingsSelectorRow
        className="flex-col sm:flex-row sm:items-center"
        control={<LanguagePicker full />}
        icon={<Languages aria-hidden size={20} />}
        title={t('settings.language')}
      />
      <SettingsSelectorRow
        className="flex-col sm:flex-row sm:items-center"
        control={
          <Select
            onValueChange={(value) => dispatch(setFiatCurrency(value))}
            value={currency}
          >
            <SelectTrigger
              aria-describedby="fiat-description"
              aria-label={t('settings.fiatCurrency')}
              className="min-h-9"
              compact
              id="fiat-currency"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {SUPPORTED_CURRENCIES.map((code) => (
                <SelectItem key={code} value={code}>
                  {CURRENCY_LABELS[code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        description={
          <span id="fiat-description">
            {t('settings.fiatCurrencyDescription')}
          </span>
        }
        icon={<Coins aria-hidden size={20} />}
        title={t('settings.fiatCurrency')}
      />
    </section>
  )
}
