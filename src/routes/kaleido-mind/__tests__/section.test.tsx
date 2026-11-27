import { invoke } from '@tauri-apps/api/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, expect, it, vi } from 'vitest'

import { store } from '../../../app/store'
import { useMind } from '../../../hooks/useMind'
import { i18n } from '../../../i18n'
import { nodeSettingsActions } from '../../../slices/nodeSettings/nodeSettings.slice'
import { setAppMode } from '../../../slices/settings/settings.slice'
import { Component } from '..'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('../../../api/mind', () => ({
  mindClient: { on: () => () => {} },
}))
vi.mock('../../../hooks/useMind', () => ({
  useMind: vi.fn(() => ({ runtimeInstalled: null })),
}))

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

it('activates Mind from node-only mode without replacing the selected node', () => {
  store.dispatch(
    nodeSettingsActions.setNodeSettings({
      ...store.getState().nodeSettings.data,
      name: 'Test node',
    })
  )
  store.dispatch(setAppMode('node'))
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/kaleido-mind']}>
        <Component />
      </MemoryRouter>
    </Provider>
  )

  expect(useMind).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Activate KaleidoMind' }))

  expect(store.getState().settings.appMode).toBe('both')
  expect(store.getState().nodeSettings.data.name).toBe('Test node')
  expect(useMind).toHaveBeenCalled()
  expect(invoke).not.toHaveBeenCalled()
})
