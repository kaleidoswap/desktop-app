import { describe, it, expect } from 'vitest'
import {
  nodeReducer,
  addLog,
  clearLogs,
  setLifecycleState,
  setError,
  setLoading,
  setNodeRunning,
} from '../node.slice'

// Derive the state shape from the reducer so TypeScript uses the correct type
const initialState = nodeReducer(undefined, { type: '@@INIT' })

// ─── addLog ────────────────────────────────────────────────────────────────

describe('addLog', () => {
  it('appends a log entry', () => {
    const state = nodeReducer(initialState, addLog('hello'))
    expect(state.logs).toEqual(['hello'])
  })

  it('caps logs at 100 entries', () => {
    let state = {
      ...initialState,
      logs: Array.from({ length: 100 }, (_, i) => `log-${i}`),
    }
    state = nodeReducer(state, addLog('new-entry'))
    expect(state.logs).toHaveLength(100)
    expect(state.logs[99]).toBe('new-entry')
    expect(state.logs[0]).toBe('log-1') // oldest dropped
  })
})

// ─── clearLogs ─────────────────────────────────────────────────────────────

describe('clearLogs', () => {
  it('empties the logs array', () => {
    const state = nodeReducer(
      { ...initialState, logs: ['a', 'b'] },
      clearLogs()
    )
    expect(state.logs).toEqual([])
  })
})

// ─── setLifecycleState ─────────────────────────────────────────────────────

describe('setLifecycleState', () => {
  it('sets Running → isRunning=true, isLoading=false', () => {
    const state = nodeReducer(
      initialState,
      setLifecycleState({ status: 'Running' })
    )
    expect(state.isRunning).toBe(true)
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('sets Starting → isRunning=true, isLoading=true', () => {
    const state = nodeReducer(
      initialState,
      setLifecycleState({ status: 'Starting' })
    )
    expect(state.isRunning).toBe(true)
    expect(state.isLoading).toBe(true)
  })

  it('sets Stopping → isRunning=false, isLoading=true', () => {
    const state = nodeReducer(
      initialState,
      setLifecycleState({ status: 'Stopping' })
    )
    expect(state.isRunning).toBe(false)
    expect(state.isLoading).toBe(true)
  })

  it('sets Stopped → isRunning=false, isLoading=false', () => {
    const state = nodeReducer(
      { ...initialState, isRunning: true, isLoading: true },
      setLifecycleState({ status: 'Stopped' })
    )
    expect(state.isRunning).toBe(false)
    expect(state.isLoading).toBe(false)
  })

  it('sets Failed → captures error message', () => {
    const state = nodeReducer(
      initialState,
      setLifecycleState({ status: 'Failed', message: 'boom' })
    )
    expect(state.error).toBe('boom')
    expect(state.isRunning).toBe(false)
  })

  it('clears error when transitioning away from Failed', () => {
    const withError = { ...initialState, error: 'previous error' }
    const state = nodeReducer(
      withError,
      setLifecycleState({ status: 'Running' })
    )
    expect(state.error).toBeNull()
  })
})

// ─── setError ──────────────────────────────────────────────────────────────

describe('setError', () => {
  it('sets the error field', () => {
    const state = nodeReducer(initialState, setError('something went wrong'))
    expect(state.error).toBe('something went wrong')
  })

  it('clears the error when null is passed', () => {
    const state = nodeReducer({ ...initialState, error: 'err' }, setError(null))
    expect(state.error).toBeNull()
  })
})

// ─── setLoading ────────────────────────────────────────────────────────────

describe('setLoading', () => {
  it('sets isLoading to true', () => {
    expect(nodeReducer(initialState, setLoading(true)).isLoading).toBe(true)
  })

  it('sets isLoading to false', () => {
    expect(
      nodeReducer({ ...initialState, isLoading: true }, setLoading(false))
        .isLoading
    ).toBe(false)
  })
})

// ─── setNodeRunning ────────────────────────────────────────────────────────

describe('setNodeRunning', () => {
  it('sets isRunning to true', () => {
    expect(nodeReducer(initialState, setNodeRunning(true)).isRunning).toBe(true)
  })

  it('sets isRunning to false', () => {
    expect(
      nodeReducer({ ...initialState, isRunning: true }, setNodeRunning(false))
        .isRunning
    ).toBe(false)
  })
})
