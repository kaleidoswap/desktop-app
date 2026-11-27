import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SettingsSelectorRow,
} from 'kaleido-ui'
import { Bitcoin, Coins, SlidersHorizontal } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppDispatch, useAppSelector } from '../../app/store/hooks'
import {
  CURRENCY_LABELS,
  SUPPORTED_CURRENCIES,
} from '../../slices/priceApi/priceApi.slice'
import {
  setAppMode,
  setBitcoinUnit,
  setFiatCurrency,
  type AppMode,
} from '../../slices/settings/settings.slice'

const capabilities: AppMode[] = ['both', 'node', 'mind']

export function ApplicationPreferences() {
  const { t } = useTranslation()
  const fiatDescriptionId = useId()
  const dispatch = useAppDispatch()
  const { appMode, bitcoinUnit, fiatCurrency } = useAppSelector(
    (state) => state.settings
  )
  const modeLabel = (mode: AppMode) => t(`launcher.modes.${mode}.title`)

  return (
    <div className="flex flex-col gap-3">
      <SettingsSelectorRow
        className="flex-col sm:flex-row sm:items-center"
        control={
          <Select
            onValueChange={(value) => dispatch(setBitcoinUnit(value))}
            value={bitcoinUnit}
          >
            <SelectTrigger aria-label={t('settings.bitcoinUnit')} compact>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="SAT">
                {t('settings.bitcoinUnitSat')}
              </SelectItem>
              <SelectItem value="BTC">
                {t('settings.bitcoinUnitBtc')}
              </SelectItem>
            </SelectContent>
          </Select>
        }
        icon={<Bitcoin aria-hidden size={20} />}
        title={t('settings.bitcoinUnit')}
      />
      <SettingsSelectorRow
        className="flex-col sm:flex-row sm:items-center"
        control={
          <Select
            onValueChange={(value) => dispatch(setFiatCurrency(value))}
            value={fiatCurrency}
          >
            <SelectTrigger
              aria-describedby={fiatDescriptionId}
              aria-label={t('settings.fiatCurrency')}
              compact
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
          <span id={fiatDescriptionId}>
            {t('settings.fiatCurrencyDescription')}
          </span>
        }
        icon={<Coins aria-hidden size={20} />}
        title={t('settings.fiatCurrency')}
      />
      <SettingsSelectorRow
        className="flex-col sm:flex-row sm:items-center"
        control={
          <Select
            onValueChange={(value) => dispatch(setAppMode(value))}
            value={appMode}
          >
            <SelectTrigger aria-label={t('settings.capabilities')} compact>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {capabilities.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {modeLabel(mode)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        icon={<SlidersHorizontal aria-hidden size={20} />}
        title={t('settings.capabilities')}
      />
    </div>
  )
}
