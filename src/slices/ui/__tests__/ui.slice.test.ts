import { describe, it, expect } from 'vitest'
import { uiSlice, uiSliceActions, uiSliceSeletors } from '../ui.slice'

const reducer = uiSlice.reducer

const initialState = { modal: { type: 'none' as const } }

// ─── setModal ──────────────────────────────────────────────────────────────

describe('setModal', () => {
  it('sets a deposit modal', () => {
    const state = reducer(
      initialState,
      uiSliceActions.setModal({ type: 'deposit', assetId: 'rgb:abc' })
    )
    expect(state.modal).toEqual({ type: 'deposit', assetId: 'rgb:abc' })
  })

  it('sets a withdraw modal', () => {
    const state = reducer(
      initialState,
      uiSliceActions.setModal({ type: 'withdraw', assetId: undefined })
    )
    expect(state.modal).toEqual({ type: 'withdraw', assetId: undefined })
  })

  it('closes modal by setting type none', () => {
    const withModal = reducer(
      initialState,
      uiSliceActions.setModal({ type: 'deposit', assetId: 'rgb:abc' })
    )
    const closed = reducer(withModal, uiSliceActions.setModal({ type: 'none' }))
    expect(closed.modal.type).toBe('none')
  })
})

// ─── uiSliceSeletors.modal ────────────────────────────────────────────────

describe('uiSliceSeletors.modal', () => {
  it('returns the current modal from state', () => {
    const rootState = {
      ui: { modal: { type: 'deposit' as const, assetId: 'rgb:xyz' } },
    }
    expect(uiSliceSeletors.modal(rootState)).toEqual({
      type: 'deposit',
      assetId: 'rgb:xyz',
    })
  })

  it('returns the initial none modal', () => {
    const rootState = { ui: initialState }
    expect(uiSliceSeletors.modal(rootState)).toEqual({ type: 'none' })
  })
})
