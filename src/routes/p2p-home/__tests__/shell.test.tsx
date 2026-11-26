import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'

import { i18n } from '../../../i18n'
import { Component } from '..'
import { P2pSessionProvider } from '../../trade/nostr-p2p/session'

vi.mock('../../../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('../../../components/Layout/DesktopFrame', () => ({
  DesktopFrame: ({ title }: { title: string }) => <h1>{title}</h1>,
}))
vi.mock('../../trade/nostr-p2p/session', () => ({
  P2pSessionProvider: vi.fn(
    ({ children }: { children: ReactNode }) => children
  ),
  useOptionalP2pSession: () => null,
}))

it('opens direct links to the node chooser without starting a trading wallet session', async () => {
  await i18n.changeLanguage('en')
  render(
    <MemoryRouter initialEntries={['/P2P/NODE/']}>
      <Component />
    </MemoryRouter>
  )
  expect(screen.getByRole('heading', { name: 'Lightning node' })).toBeVisible()
  expect(P2pSessionProvider).not.toHaveBeenCalled()
})
