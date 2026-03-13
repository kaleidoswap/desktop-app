import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type BackendNodeState =
  | { status: 'Stopped' }
  | { status: 'Starting' }
  | { status: 'Running' }
  | { status: 'Stopping' }
  | { status: 'Failed'; message: string }

interface NodeState {
  lifecycle: BackendNodeState
  isRunning: boolean
  logs: string[]
  isLoading: boolean
  error: string | null
}

const initialState: NodeState = {
  error: null,
  isLoading: false,
  isRunning: false,
  lifecycle: { status: 'Stopped' },
  logs: [],
}

const nodeSlice = createSlice({
  initialState,
  name: 'node',
  reducers: {
    addLog: (state, action: PayloadAction<string>) => {
      state.logs.push(action.payload)
      // Keep only last 100 logs
      if (state.logs.length > 100) {
        state.logs = state.logs.slice(-100)
      }
    },
    clearLogs: (state) => {
      state.logs = []
    },
    setLifecycleState: (state, action: PayloadAction<BackendNodeState>) => {
      state.lifecycle = action.payload
      state.isRunning =
        action.payload.status === 'Running' ||
        action.payload.status === 'Starting'
      state.isLoading =
        action.payload.status === 'Starting' ||
        action.payload.status === 'Stopping'

      if (action.payload.status === 'Failed') {
        state.error = action.payload.message
        return
      }

      state.error = null
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    setNodeRunning: (state, action: PayloadAction<boolean>) => {
      state.isRunning = action.payload
    },
  },
})

export const {
  setNodeRunning,
  addLog,
  clearLogs,
  setLoading,
  setError,
  setLifecycleState,
} = nodeSlice.actions
export const nodeReducer = nodeSlice.reducer
