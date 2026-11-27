import { openUrl } from '@tauri-apps/plugin-opener'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { afterEach, expect, it, vi } from 'vitest'

import { setWalletOverride } from '../../../../../api/wallet-override'
import { store } from '../../../../../app/store'
import { i18n } from '../../../../../i18n'
import {
  setTransport,
  tauriTransport,
} from '../../../../../routes/trade/nostr-p2p/transport'
import { createP2pWalletWrapper } from '../../../../../routes/trade/nostr-p2p/walletClient'
import { nodeApi } from '../../../../../slices/nodeApi/nodeApi.slice'
import { Step2 } from '../Step2'

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }))
vi.mock('qrcode.react', () => ({ QRCodeCanvas: () => null }))

afterEach(() => {
  setWalletOverride(null)
  setTransport(tauriTransport)
  store.dispatch(nodeApi.util.resetApiState())
  vi.clearAllMocks()
})

it.each(['signetcustom', 'signet'])(
  'receives a first asset on %s using a witness invoice',
  async (network) => {
    await i18n.changeLanguage('en')
    const invoice = 'rgb:example+invoice?endpoints=rpcs://proxy'
    const answers: Record<string, unknown> = {
      '/api/info': { network },
      '/api/rgb/invoice': { invoice, recipient_id: 'test-recipient' },
      '/api/rln/listassets': {},
      '/api/rln/listtransfers': { transfers: [] },
    }
    const request = vi.fn()
    setTransport({
      async request<T>(method: string, path: string, body?: unknown) {
        request(method, path, body)
        return answers[path] as T
      },
    })
    setWalletOverride(createP2pWalletWrapper())
    const view = render(
      <Provider store={store}>
        <Step2 onBack={vi.fn()} onClose={vi.fn()} onNext={vi.fn()} />
      </Provider>
    )
    try {
      await waitFor(
        () =>
          expect(request).toHaveBeenCalledWith('POST', '/api/rgb/invoice', {
            amount: 0,
            duration_secs: expect.any(Number),
            witness: true,
          }),
        { timeout: 3000 }
      )
      const label = i18n.t('depositModal.step2.networkInfo.usdtFaucet')
      if (network === 'signetcustom') {
        fireEvent.click(await screen.findByRole('button', { name: label }))
        expect(openUrl).toHaveBeenCalledWith(
          'https://faucet.mutinynet.kaleidoswap.com/?invoice=' +
            encodeURIComponent(invoice)
        )
      } else {
        expect(screen.queryByRole('button', { name: label })).toBeNull()
      }
    } finally {
      view.unmount()
    }
  }
)
