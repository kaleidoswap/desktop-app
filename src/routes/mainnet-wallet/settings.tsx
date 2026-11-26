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
    <section className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-divider/20 bg-surface-elevated">
      <h2 className="border-b border-divider/15 px-5 py-4 text-lg font-semibold text-content-primary">
        {t('settings.applicationSettings')}
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-divider/15 px-5 py-4">
        <span className="text-sm font-medium text-content-primary">
          {t('settings.language')}
        </span>
        <LanguagePicker full />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div>
          <label
            className="text-sm font-medium text-content-primary"
            htmlFor="fiat-currency"
          >
            {t('settings.fiatCurrency')}
          </label>
          <p className="text-xs text-content-secondary" id="fiat-description">
            {t('settings.fiatCurrencyDescription')}
          </p>
        </div>
        <select
          aria-describedby="fiat-description"
          className="h-9 rounded-lg border border-divider/20 bg-surface-overlay px-3 text-sm text-content-primary focus:ring-2 focus:ring-primary"
          id="fiat-currency"
          onChange={(event) => dispatch(setFiatCurrency(event.target.value))}
          value={currency}
        >
          {SUPPORTED_CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {CURRENCY_LABELS[code]}
            </option>
          ))}
        </select>
      </div>
    </section>
  )
}
