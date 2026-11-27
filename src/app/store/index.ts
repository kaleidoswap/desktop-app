import {
  combineReducers,
  configureStore,
  createListenerMiddleware,
} from '@reduxjs/toolkit'

import { makerApi } from '../../slices/makerApi/makerApi.slice.ts'
import { pairsSlice } from '../../slices/makerApi/pairs.slice.ts'
import { dcaSlice } from '../../slices/dcaSlice'
import { limitOrderSlice } from '../../slices/limitOrderSlice'
import { nodeReducer } from '../../slices/node/node.slice'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { nodeSettingsSlice } from '../../slices/nodeSettings/nodeSettings.slice.ts'
import { priceApi } from '../../slices/priceApi/priceApi.slice'
import { settingsSlice } from '../../slices/settings/settings.slice'
import { uiSlice } from '../../slices/ui/ui.slice'

const rootReducer = combineReducers({
  [nodeApi.reducerPath]: nodeApi.reducer,
  [makerApi.reducerPath]: makerApi.reducer,
  [priceApi.reducerPath]: priceApi.reducer,
  dca: dcaSlice.reducer,
  limitOrders: limitOrderSlice.reducer,
  node: nodeReducer,
  nodeSettings: nodeSettingsSlice.reducer,
  pairs: pairsSlice.reducer,
  settings: settingsSlice.reducer,
  ui: uiSlice.reducer,
})

export type RootState = ReturnType<typeof rootReducer>

// Node endpoints share query arguments across accounts, even for the same RGB
// contract. Drop those entries before components subscribe to a different node.
const nodeConnection = createListenerMiddleware<RootState>()
nodeConnection.startListening({
  effect: (_action, api) => {
    api.dispatch(nodeApi.util.resetApiState())
  },
  predicate: (_action, current, previous) => {
    const before = previous.nodeSettings.data
    const after = current.nodeSettings.data
    return (
      before.name !== after.name ||
      before.network !== after.network ||
      before.node_url !== after.node_url ||
      before.bearer_token !== after.bearer_token
    )
  },
})

export const store = configureStore({
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .prepend(nodeConnection.middleware)
      .concat(nodeApi.middleware)
      .concat(makerApi.middleware)
      .concat(priceApi.middleware),
  reducer: rootReducer,
})

export type AppDispatch = typeof store.dispatch
