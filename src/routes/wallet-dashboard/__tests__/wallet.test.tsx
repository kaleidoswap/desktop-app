import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'

import { store } from '../../../app/store'
import { BTC_ASSET_ID } from '../../../constants'
import { i18n } from '../../../i18n'
import { nodeSettingsActions } from '../../../slices/nodeSettings/nodeSettings.slice'
import { Component } from '..'

const wrapper = vi.hoisted(() => vi.fn())
vi.mock('../../../api/client', () => ({
  getNodeApiWrapper: wrapper,
  getNodeHealthApiWrapper: wrapper,
}))
vi.mock('../../../hooks/useBitcoinPrice', () => ({
  useBitcoinPrice: () => ({ formatFiat: () => null }),
}))
vi.mock('../../../helpers/utils', async (original) => ({
  ...(await original<typeof import('../../../helpers/utils')>()),
  useAssetIcon: () => ['test-icon.svg', vi.fn()],
}))

it('renders node balances and keeps an earlier account response out of the selected wallet', async () => {
  await i18n.changeLanguage('en')
  const rgbId = 'rgb:shared'
  const first = { ...store.getState().nodeSettings.data, name: 'First' }
  const second = { ...first, name: 'Second' }
  const frozen = (value: number) => ({
    data: { future: value, offchain_outbound: 0, spendable: value },
  })
  let resolveFirst!: (result: ReturnType<typeof frozen>) => void
  const firstRead = vi.fn(
    () =>
      new Promise<ReturnType<typeof frozen>>((resolve) => {
        resolveFirst = resolve
      })
  )
  wrapper.mockImplementation((state: ReturnType<typeof store.getState>) => ({
    getAssetBalance:
      state.nodeSettings.data.name === first.name
        ? firstRead
        : async () => frozen(220),
    getBtcBalance: async () => ({
      data: {
        colored: { spendable: 0 },
        vanilla: { future: 40, spendable: 40 },
      },
    }),
    getNetworkInfo: async () => ({ data: {} }),
    getNodeInfo: async () => ({ data: {} }),
    listAssets: async () => ({
      data: {
        nia: [
          {
            asset_id: rgbId,
            name: 'Shared asset',
            precision: 1,
            ticker: 'TEST',
          },
        ],
      },
    }),
    listChannels: async () => ({ data: { channels: [] } }),
    refreshTransfers: async () => ({ data: null }),
  }))
  store.dispatch(nodeSettingsActions.setNodeSettings(first))
  render(
    <Provider store={store}>
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    </Provider>
  )
  await waitFor(() => expect(firstRead).toHaveBeenCalled())
  expect(
    screen.getByRole('heading', { level: 1, name: 'Wallet' })
  ).toBeVisible()
  const assetRows = within(
    screen.getByRole('region', { name: i18n.t('dashboard.assets') })
  )
  const btc = within(assetRows.getByRole('row', { name: /Bitcoin/ }))
  fireEvent.click(btc.getByRole('button', { name: 'Receive · BTC' }))
  expect(store.getState().ui.modal).toEqual({
    assetId: BTC_ASSET_ID,
    type: 'deposit',
  })
  fireEvent.click(btc.getByRole('button', { name: 'Send · BTC' }))
  expect(store.getState().ui.modal).toEqual({
    assetId: BTC_ASSET_ID,
    type: 'withdraw',
  })

  act(() => {
    store.dispatch(nodeSettingsActions.setNodeSettings(second))
  })
  expect(await screen.findByRole('cell', { name: '22' })).toBeVisible()
  await act(async () => resolveFirst(frozen(990)))
  expect(screen.queryByRole('cell', { name: '99' })).toBeNull()
  const asset = within(screen.getByRole('row', { name: /Shared asset/ }))
  expect(asset.getByRole('cell', { name: '0' })).toBeVisible()
  expect(asset.getByRole('cell', { name: '22' })).toBeVisible()
  fireEvent.click(asset.getByRole('button', { name: 'Receive · TEST' }))
  expect(store.getState().ui.modal).toEqual({ assetId: rgbId, type: 'deposit' })
})
