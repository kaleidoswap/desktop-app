import { combineReducers, configureStore } from '@reduxjs/toolkit'

import { makerApi } from '../../slices/makerApi/makerApi.slice.ts'
import { pairsSlice } from '../../slices/makerApi/pairs.slice.ts'
import { nodeReducer } from '../../slices/node/node.slice'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { nodeSettingsSlice } from '../../slices/nodeSettings/nodeSettings.slice.ts'
import { settingsSlice } from '../../slices/settings/settings.slice'
import { sparkSliceReducer } from '../../slices/spark/spark.slice'
import { sparkApi } from '../../slices/spark/sparkApi.slice'
import { uiSlice } from '../../slices/ui/ui.slice'

const rootReducer = combineReducers({
  [nodeApi.reducerPath]: nodeApi.reducer,
  [makerApi.reducerPath]: makerApi.reducer,
  [sparkApi.reducerPath]: sparkApi.reducer,
  node: nodeReducer,
  nodeSettings: nodeSettingsSlice.reducer,
  pairs: pairsSlice.reducer,
  settings: settingsSlice.reducer,
  spark: sparkSliceReducer,
  ui: uiSlice.reducer,
})

export const store = configureStore({
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(nodeApi.middleware)
      .concat(makerApi.middleware)
      .concat(sparkApi.middleware),
  reducer: rootReducer,
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
