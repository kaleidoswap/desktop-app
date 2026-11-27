import { invoke } from '@tauri-apps/api/core'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

import {
  WALLET_DASHBOARD_PATH,
  WALLET_SETUP_PATH,
} from '../../app/router/paths'
import { store } from '../../app/store'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { nodeSettingsActions } from '../../slices/nodeSettings/nodeSettings.slice'
import { Toolbar } from '.'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({ listen: async () => () => {} }))

beforeEach(() => {
  vi.restoreAllMocks()
  vi.mocked(invoke).mockReset()
  store.dispatch(nodeApi.util.resetApiState())
  store.dispatch(nodeSettingsActions.resetNodeSettings())
})

function renderAccounts() {
  const router = createMemoryRouter(
    [
      { element: <Toolbar />, path: WALLET_SETUP_PATH },
      { element: <p>Node dashboard</p>, path: WALLET_DASHBOARD_PATH },
    ],
    { initialEntries: [WALLET_SETUP_PATH + '?account=Alpha'] }
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  )
  return router
}

it('opens the last chosen node once and requires confirmation before switching', async () => {
  const alpha = { ...store.getState().nodeSettings.data, name: 'Alpha' }
  const beta = { ...alpha, name: 'Beta' }
  let finishAlpha!: (account: typeof alpha) => void
  vi.mocked(invoke).mockImplementation(async (cmd, args) => {
    if (cmd === 'get_accounts') return [alpha, beta]
    if (cmd === 'get_account_by_name') {
      return (args as { name: string }).name === 'Alpha'
        ? new Promise((resolve) => {
            finishAlpha = resolve
          })
        : beta
    }
    throw new Error('Unexpected native call ' + cmd)
  })
  const router = renderAccounts()
  await screen.findByText('Alpha')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  for (const name of ['Alpha', 'Beta']) {
    await act(async () => {
      await router.navigate(WALLET_SETUP_PATH, {
        state: { selectNodeAccount: name, walletContext: 'mainnet' },
      })
    })
  }
  let modal = await screen.findByRole('dialog')
  expect(within(modal).getByText('Beta')).toBeInTheDocument()
  await act(async () => finishAlpha(alpha))
  modal = screen.getByRole('dialog')
  expect(within(modal).getByText('Beta')).toBeInTheDocument()
  expect(router.state.location.state).toEqual({ walletContext: 'mainnet' })
  expect(vi.mocked(invoke).mock.calls).toEqual([
    ['get_accounts'],
    ['get_account_by_name', { name: 'Alpha' }],
    ['get_account_by_name', { name: 'Beta' }],
  ])
})

it('reopens the active unlocked account without switching or restarting a node', async () => {
  const alpha = {
    ...store.getState().nodeSettings.data,
    name: 'Alpha',
    node_url: 'http://127.0.0.1:3001',
  }
  store.dispatch(nodeSettingsActions.setNodeSettings(alpha))
  vi.mocked(invoke).mockResolvedValue([alpha])
  const getNodeInfo = vi.fn().mockResolvedValue({ isSuccess: true })
  vi.spyOn(nodeApi.endpoints.nodeInfo, 'useLazyQuery').mockReturnValue([
    getNodeInfo,
  ] as unknown as ReturnType<typeof nodeApi.endpoints.nodeInfo.useLazyQuery>)

  const router = renderAccounts()
  await screen.findByText('Alpha')
  await act(async () => {
    await router.navigate(WALLET_SETUP_PATH, {
      state: { selectNodeAccount: 'Alpha' },
    })
  })
  await waitFor(() =>
    expect(router.state.location.pathname).toBe(WALLET_DASHBOARD_PATH)
  )
  expect(getNodeInfo).toHaveBeenCalledTimes(1)
  expect(vi.mocked(invoke).mock.calls).toEqual([['get_accounts']])
})
