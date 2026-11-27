import { invoke } from '@tauri-apps/api/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  WALLET_DASHBOARD_PATH,
  WALLET_UNLOCK_PATH,
} from '../../app/router/paths'
import { Component } from './index'

const { dispatch, navigate } = vi.hoisted(() => ({
  dispatch: vi.fn(),
  navigate: vi.fn(),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('react-router-dom', async (load) => ({
  ...(await load<typeof import('react-router-dom')>()),
  useLocation: () => ({ state: null }),
  useNavigate: () => navigate,
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('../../app/store/hooks', () => ({ useAppDispatch: () => dispatch }))
vi.mock('../../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('../../components/TermsWarningModal', () => ({
  TermsWarningModal: ({
    isOpen,
    onAccept,
  }: {
    isOpen: boolean
    onAccept: () => void
  }) => (isOpen ? <button onClick={onAccept}>Accept terms</button> : null),
}))
vi.mock('../../components/AppVersion', () => ({ AppVersion: () => null }))
vi.mock('../../components/Toolbar', () => ({ Toolbar: () => null }))
vi.mock('../../components/SupportModal', () => ({ SupportModal: () => null }))
vi.mock('../../components/NotificationSystem', () => ({
  useNotification: () => ({ notifications: [] }),
}))

describe('remote node onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(invoke).mockResolvedValue(false)
  })
  afterEach(() => vi.unstubAllGlobals())

  async function connect(status: number, body: object) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json(body, { status }))
    )
    const { container } = render(<Component />)
    fireEvent.submit(container.querySelector('form')!)
    fireEvent.click(await screen.findByText('Accept terms'))
  }

  it.each([
    [403, { name: 'LockedNode' }, WALLET_UNLOCK_PATH],
    [200, { pubkey: 'node' }, WALLET_DASHBOARD_PATH],
  ] as const)(
    'selects the saved account before navigating on HTTP %i',
    async (status, body, route) => {
      let selectAccount!: () => void
      const selected = new Promise<void>((resolve) => {
        selectAccount = resolve
      })
      vi.mocked(invoke).mockImplementation(async (command) =>
        command === 'set_current_account' ? selected : false
      )
      await connect(status, body)
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith(
          'set_current_account',
          expect.anything()
        )
      )
      expect(navigate).not.toHaveBeenCalled()
      // Only the saved account list is refreshed until native selection completes.
      expect(dispatch.mock.calls.map(([action]) => action.type)).toEqual([
        'nodeApi/invalidateTags',
      ])
      selectAccount()
      await waitFor(() => expect(navigate).toHaveBeenCalledWith(route))
      expect(navigate).toHaveBeenCalledTimes(1)
    }
  )

  it('keeps the form available when account creation fails', async () => {
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === 'insert_account') throw new Error('cannot save')
      return false
    })
    await connect(200, { pubkey: 'node' })
    await screen.findByText('walletRemote.failedToCreateAccount')
    expect(navigate).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })
})
