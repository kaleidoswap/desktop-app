import { configureStore } from '@reduxjs/toolkit'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { expect, it, vi } from 'vitest'

import { i18n } from '../../../i18n'
import { Component as MainnetSettings } from '../../../routes/mainnet-wallet/settings'
import { settingsReducer } from '../../../slices/settings/settings.slice'
import { I18nProvider } from '../../I18nProvider'
import { LanguagePicker } from '../LanguagePicker'

it('follows the system locale until the user chooses a language and syncs both settings controls', async () => {
  const system = vi
    .spyOn(navigator, 'languages', 'get')
    .mockReturnValue(['de-DE'])
  try {
    await i18n.changeLanguage()
    const store = configureStore({ reducer: { settings: settingsReducer } })
    render(
      <Provider store={store}>
        <I18nProvider>
          <header>
            <LanguagePicker />
          </header>
          <main>
            <MainnetSettings />
          </main>
        </I18nProvider>
      </Provider>
    )

    const header = within(screen.getByRole('banner'))
    const picker = header.getByRole('combobox', { name: 'Sprache' })
    expect(picker).toHaveValue('de')
    expect(localStorage.getItem('kaleidoswap_language')).toBeNull()
    expect(within(picker).getAllByRole('option')).toHaveLength(8)
    await userEvent.selectOptions(picker, '日本語')

    const main = within(screen.getByRole('main'))
    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute('lang', 'ja')
    )
    expect(
      main.getByRole('combobox', { name: i18n.t('settings.language') })
    ).toHaveValue('ja')
    expect(localStorage.getItem('kaleidoswap_language')).toBe('ja')
    await userEvent.selectOptions(
      main.getByRole('combobox', { name: i18n.t('settings.fiatCurrency') }),
      'eur'
    )
    expect(localStorage.getItem('kaleidoswap_fiat_currency')).toBe('eur')
  } finally {
    system.mockRestore()
    localStorage.clear()
  }
})
