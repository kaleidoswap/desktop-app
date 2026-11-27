import { fireEvent, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { expect, it, vi } from 'vitest'
import { store } from '../../../../../app/store'
import { i18n } from '../../../../../i18n'
import { nodeSettingsActions } from '../../../../../slices/nodeSettings/nodeSettings.slice'
import { Step1 } from '../Step1'

const queries = vi.hoisted(() => ({ assets: vi.fn(), session: vi.fn() }))
vi.mock('../../../../../slices/nodeApi/nodeApi.slice', async (original) => {
  const module =
    await original<
      typeof import('../../../../../slices/nodeApi/nodeApi.slice')
    >()
  return {
    ...module,
    nodeApi: { ...module.nodeApi, useListAssetsQuery: queries.assets },
  }
})
vi.mock('../../../../../routes/trade/nostr-p2p/session', () => ({
  useOptionalP2pSession: queries.session,
}))
vi.mock('../../../../../helpers/utils', async (original) => ({
  ...(await original<typeof import('../../../../../helpers/utils')>()),
  useAssetIcon: (_ticker: string, fallback: string) => [fallback, vi.fn()],
}))

it('pins the current wallet’s USDT contract and can receive its first BFA using an open invoice', async () => {
  await i18n.changeLanguage('en')
  const signet = 'rgb:uVMNCuVU-U00Y_wv-6~7ZbW7-tEuUMcE-pB0wDzC-nt7Qsdc'
  const mutiny = 'rgb:2FB8lVZA-dnFf4ci-wdU9xin-Rjm72L1-LSOyAq3-KAICMoI'
  const asset = (id: string, name: string) => ({
    asset_id: id,
    name,
    ticker: 'USDT',
  })
  const counterfeit = asset('rgb:unlisted', 'Tether USD')
  store.dispatch(
    nodeSettingsActions.setNodeSettings({
      name: 'Node',
      network: 'SignetCustom',
    })
  )
  queries.session.mockReturnValue({ config: { key: 'Signet' } })
  queries.assets.mockReturnValue({
    data: {
      bfa: [asset(mutiny, 'Mutinynet BFA'), asset(signet, 'Public Signet BFA')],
      nia: [counterfeit],
    },
  })
  const next = vi.fn()
  const page = (
    <Provider store={store}>
      <Step1 onClose={vi.fn()} onNext={next} />
    </Provider>
  )
  const view = render(page)
  fireEvent.click(screen.getByRole('button', { name: /Public Signet BFA/ }))
  fireEvent.click(screen.getByRole('button', { name: /continue with usdt/i }))
  expect(next).toHaveBeenLastCalledWith(signet)
  queries.session.mockReturnValue(null)
  view.rerender(
    <Provider store={store}>
      <Step1 onClose={vi.fn()} onNext={next} />
    </Provider>
  )
  fireEvent.click(screen.getByRole('button', { name: /Mutinynet BFA/ }))
  fireEvent.click(screen.getByRole('button', { name: /continue with usdt/i }))
  expect(next).toHaveBeenLastCalledWith(mutiny)

  queries.assets.mockReturnValue({ data: { nia: [counterfeit] } })
  view.rerender(
    <Provider store={store}>
      <Step1 onClose={vi.fn()} onNext={next} />
    </Provider>
  )
  fireEvent.click(
    screen.getByRole('button', { name: /new rgb asset|new asset/i })
  )
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  expect(next).toHaveBeenLastCalledWith(undefined)
})
