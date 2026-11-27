import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { expect, it, vi } from 'vitest'

import { i18n } from '../../../i18n'
import { settingsReducer } from '../../../slices/settings/settings.slice'
import { Component } from '../settings'

const api = vi.hoisted(() => ({ getRelays: vi.fn(), session: vi.fn() }))
vi.mock('../../trade/nostr-p2p/session', () => ({ useP2pSession: api.session }))
vi.mock('../../trade/nostr-p2p/p2p', () => ({ p2pRelaysGet: api.getRelays }))

it('keeps app settings available before wallet setup and shows maintenance for the running wallet', async () => {
  await i18n.changeLanguage('en')
  const store = configureStore({ reducer: { settings: settingsReducer } })
  const session = {
    account: 'demo',
    config: { key: 'SignetCustom' },
    phase: 'setup',
  }
  api.session.mockReturnValue(session)
  api.getRelays.mockResolvedValue({
    custom: null,
    defaults: ['wss://relay.example.test'],
  })
  const page = (
    <Provider store={store}>
      <Component />
    </Provider>
  )
  const view = render(page)
  expect(
    screen.getByRole('combobox', { name: i18n.t('settings.fiatCurrency') })
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: i18n.t('p2pSettings.showRecovery') })
  ).toBeNull()
  expect(api.getRelays).not.toHaveBeenCalled()

  api.session.mockReturnValue({ ...session, phase: 'running' })
  view.rerender(
    <Provider store={store}>
      <Component />
    </Provider>
  )
  expect(await screen.findByText(/wss:\/\/relay.example.test/)).toBeVisible()
  expect(
    screen.getByRole('button', { name: i18n.t('p2pSettings.showRecovery') })
  ).toBeVisible()
  expect(api.getRelays).toHaveBeenCalledWith('SignetCustom')
})
