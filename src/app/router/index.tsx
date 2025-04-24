import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'

import { RootRoute } from '../../routes/root'

import {
  CHANNELS_PATH,
  CREATE_NEW_CHANNEL_PATH,
  ORDER_CHANNEL_PATH,
  WALLET_INIT_PATH,
  ROOT_PATH,
  SETTINGS_PATH,
  TRADE_PATH,
  TRADE_MARKET_MAKER_PATH,
  TRADE_MANUAL_PATH,
  TRADE_NOSTR_P2P_PATH,
  WALLET_REMOTE_PATH,
  WALLET_SETUP_PATH,
  WALLET_RESTORE_PATH,
  WALLET_UNLOCK_PATH,
  WALLET_DASHBOARD_PATH,
  WALLET_HISTORY_DEPOSITS_PATH,
  WALLET_HISTORY_PATH,
  WALLET_HISTORY_TRADES_PATH,
  WALLET_HISTORY_WITHDRAWALS_PATH,
  WALLET_HISTORY_ASSETS_PATH,
  CREATEUTXOS_PATH,
} from './paths'

export const router = createBrowserRouter([
  {
    lazy: () => import('../../routes/wallet-setup'),
    path: WALLET_SETUP_PATH,
  },
  {
    lazy: () => import('../../routes/wallet-init'),
    path: WALLET_INIT_PATH,
  },
  {
    lazy: () => import('../../routes/wallet-remote'),
    path: WALLET_REMOTE_PATH,
  },
  {
    lazy: () => import('../../routes/wallet-restore'),
    path: WALLET_RESTORE_PATH,
  },
  {
    lazy: () => import('../../routes/wallet-unlock'),
    path: WALLET_UNLOCK_PATH,
  },
  {
    children: [
      {
        lazy: () => import('../../routes/trade'),
        path: TRADE_PATH,
      },
      {
        lazy: () => import('../../routes/trade/market-maker'),
        path: TRADE_MARKET_MAKER_PATH,
      },
      {
        lazy: () => import('../../routes/trade/manual'),
        path: TRADE_MANUAL_PATH,
      },
      {
        lazy: () => import('../../routes/trade/nostr-p2p'),
        path: TRADE_NOSTR_P2P_PATH,
      },
      {
        lazy: () => import('../../routes/settings'),
        path: SETTINGS_PATH,
      },
      {
        lazy: () => import('../../routes/wallet-dashboard'),
        path: WALLET_DASHBOARD_PATH,
      },
      {
        children: [
          {
            element: <Navigate replace to={WALLET_HISTORY_DEPOSITS_PATH} />,
            index: true,
          },
          {
            lazy: () => import('../../routes/wallet-history/deposits'),
            path: WALLET_HISTORY_DEPOSITS_PATH,
          },
          {
            lazy: () => import('../../routes/wallet-history/withdrawals'),
            path: WALLET_HISTORY_WITHDRAWALS_PATH,
          },
          {
            lazy: () => import('../../routes/wallet-history/swaps'),
            path: WALLET_HISTORY_TRADES_PATH,
          },
          {
            lazy: () => import('../../routes/wallet-history/assets'),
            path: WALLET_HISTORY_ASSETS_PATH,
          },
        ],
        lazy: () => import('../../routes/wallet-history'),
        path: WALLET_HISTORY_PATH,
      },
      {
        lazy: () => import('../../routes/create-new-channel'),
        path: CREATE_NEW_CHANNEL_PATH,
      },
      {
        lazy: () => import('../../routes/createutxos'),
        path: CREATEUTXOS_PATH,
      },
      {
        lazy: () => import('../../routes/channels'),
        path: CHANNELS_PATH,
      },
      {
        lazy: () => import('../../routes/order-new-channel'),
        path: ORDER_CHANNEL_PATH,
      },
    ],
    element: <RootRoute />,
    path: ROOT_PATH,
  },
])

export const Router = () => <RouterProvider router={router} />
