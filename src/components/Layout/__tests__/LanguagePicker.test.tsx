import { configureStore } from '@reduxjs/toolkit'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { expect, it, vi } from 'vitest'

import { i18n } from '../../../i18n'
import { Component as MainnetSettings } from '../../../routes/mainnet-wallet/settings'
import { memoryWalletStore } from '../../../routes/trade/nostr-p2p/__tests__/memoryWalletStore'
import { settingsReducer } from '../../../slices/settings/settings.slice'
import { I18nProvider } from '../../I18nProvider'
import { LanguagePicker } from '../LanguagePicker'

it('follows the system locale until the user chooses a language and syncs both settings controls', async () => {
  vi.stubGlobal('localStorage', memoryWalletStore())
  const system = vi
    .spyOn(navigator, 'languages', 'get')
    .mockReturnValue(['de-DE'])
  try {
    await i18n.changeLanguage()
    const store = configureStore({ reducer: { settings: settingsReducer } })
    render(
      <Provider store={store}>
        <I18nProvider>
          <header aria-label="Desktop">
            <LanguagePicker />
          </header>
          <main>
            <MainnetSettings />
          </main>
        </I18nProvider>
      </Provider>
    )

    const header = within(screen.getByRole('banner', { name: 'Desktop' }))
    const picker = header.getByRole('combobox', { name: 'Sprache' })
    expect(picker).toHaveTextContent('Deutsch')
    expect(localStorage.getItem('kaleidoswap_language')).toBeNull()
    await userEvent.click(picker)
    const languages = within(await screen.findByRole('listbox'))
    expect(languages.getAllByRole('option')).toHaveLength(8)
    await userEvent.click(languages.getByRole('option', { name: '日本語' }))

    const main = within(screen.getByRole('main'))
    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute('lang', 'ja')
    )
    expect(
      main.getByRole('combobox', { name: i18n.t('settings.language') })
    ).toHaveTextContent('日本語')
    expect(localStorage.getItem('kaleidoswap_language')).toBe('ja')
    await userEvent.click(
      main.getByRole('combobox', { name: i18n.t('settings.fiatCurrency') })
    )
    await userEvent.click(await screen.findByRole('option', { name: 'EUR' }))
    expect(localStorage.getItem('kaleidoswap_fiat_currency')).toBe('eur')
  } finally {
    system.mockRestore()
    vi.unstubAllGlobals()
  }
})
