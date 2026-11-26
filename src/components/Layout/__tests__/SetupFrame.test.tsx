import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeAll, expect, it, vi } from 'vitest'

import { store } from '../../../app/store'
import { i18n } from '../../../i18n'
import { SetupFrame } from '../SetupFrame'

vi.mock('../../AppVersion', () => ({ AppVersion: () => null }))

beforeAll(() => i18n.changeLanguage('en'))

function Wizard() {
  const [busy, setBusy] = useState(true)
  return (
    <SetupFrame setupBusy={busy}>
      <button onClick={() => setBusy(false)} type="button">
        Complete recovery step
      </button>
    </SetupFrame>
  )
}

function renderWizard(path: string) {
  const router = createMemoryRouter(
    [
      { element: <Wizard />, path },
      { element: <h1>Node dashboard</h1>, path: '/wallet-dashboard' },
      { element: <h1>Unlock node</h1>, path: '/wallet-unlock' },
    ],
    { initialEntries: ['/wallet-dashboard', path] }
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  )
  return router
}

it('keeps the recovery step open across Back until it completes', async () => {
  const router = renderWizard('/init')
  const nav = screen.getByRole('navigation', { name: 'Main' })
  expect(
    within(nav).getByRole('link', { name: 'Lightning node' })
  ).toHaveAttribute('aria-current', 'page')
  await act(() => router.navigate(-1))
  expect(router.state.location.pathname).toBe('/init')
  await userEvent.click(
    screen.getByRole('button', { name: 'Complete recovery step' })
  )
  await act(() => router.navigate(-1))
  expect(
    await screen.findByRole('heading', { name: 'Node dashboard' })
  ).toBeVisible()
})

it('allows a completed remote connection to hand off to unlock', async () => {
  const router = renderWizard('/wallet-config')
  await act(() => router.navigate('/wallet-unlock'))
  expect(
    await screen.findByRole('heading', { name: 'Unlock node' })
  ).toBeVisible()
})
