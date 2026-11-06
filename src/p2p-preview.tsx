/**
 * Development harness for the P2P market: mounts it in a plain browser against a daemon on
 * loopback (`?daemon=<name>` through the dev server proxy in vite.preview.config.ts, `?daemon=<url>`,
 * or `VITE_P2P_DEV_URL`). Not part of the app or its build. Open /p2p-preview.html.
 */
import { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'

import { store } from './app/store'
import { I18nProvider } from './components/I18nProvider'
import { ThemeProvider } from './components/ThemeProvider'
import { setWalletOverride } from './api/wallet-override'
import { Component as AssetsHistory } from './routes/wallet-history/assets'
import { Component as DepositsHistory } from './routes/wallet-history/deposits'
import { Component as WithdrawalsHistory } from './routes/wallet-history/withdrawals'
import { createP2pWalletWrapper } from './routes/trade/nostr-p2p/walletClient'
import { DepositModal } from './routes/trade/nostr-p2p/DepositModal'
import { Market } from './routes/trade/nostr-p2p/market/Market'
import { httpTransport, setTransport } from './routes/trade/nostr-p2p/transport'
import { WalletSetup } from './routes/trade/nostr-p2p/WalletSetup'
import { WithdrawModal } from './routes/trade/nostr-p2p/WithdrawModal'

import './i18n/config'
import 'react-toastify/dist/ReactToastify.min.css'
import './styles.css'

const named = new URLSearchParams(window.location.search).get('daemon')
const daemon = named
  ? /^[a-z]+$/.test(named)
    ? `/p2p-api/${named}`
    : named
  : (import.meta.env.VITE_P2P_DEV_URL ?? '')
setTransport(httpTransport(daemon))

const PHRASE =
  'abandon ability able about above absent absorb abstract absurd abuse access accident'

// ?tab=assets|deposits|withdrawals shows the app's own wallet history pages over the trading wallet
const tabParam = new URLSearchParams(window.location.search).get('tab')
if (tabParam) setWalletOverride(createP2pWalletWrapper())

function Page() {
  const [deposit, setDeposit] = useState(false)
  const [withdraw, setWithdraw] = useState(false)
  if (tabParam) {
    const View =
      tabParam === 'deposits'
        ? DepositsHistory
        : tabParam === 'withdrawals'
          ? WithdrawalsHistory
          : AssetsHistory
    return (
      <div className="min-h-screen bg-surface-base p-4 text-content-primary">
        <View />
      </div>
    )
  }
  // ?setup=1 shows the wallet setup with a fixed phrase instead of the market
  if (new URLSearchParams(window.location.search).get('setup')) {
    return (
      <div className="min-h-screen bg-surface-base p-4 text-content-primary">
        <WalletSetup
          generate={async () => PHRASE}
          networkLabel="Mutinynet"
          onComplete={async () => undefined}
        />
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-surface-base p-4 text-content-primary">
      <div className="mx-auto w-full max-w-screen-xl">
        <Market
          onOpenFunds={(d) =>
            d === 'toNode' ? setWithdraw(true) : setDeposit(true)
          }
        />
      </div>
      <DepositModal isOpen={deposit} onClose={() => setDeposit(false)} />
      <WithdrawModal isOpen={withdraw} onClose={() => setWithdraw(false)} />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <Provider store={store}>
    <ThemeProvider>
      <I18nProvider>
        <BrowserRouter>
          <Page />
        </BrowserRouter>
        <ToastContainer position="bottom-right" theme="dark" />
      </I18nProvider>
    </ThemeProvider>
  </Provider>
)
