import { describe, it, expect } from 'vitest'
import { uiSlice, uiSliceActions, uiSliceSeletors } from '../ui.slice'

const reducer = uiSlice.reducer

const initialState = { modal: { type: 'none' as const } }

// ─── setModal ──────────────────────────────────────────────────────────────

describe('setModal', () => {
  it('sets a deposit modal', () => {
    const state = reducer(
      initialState,
      uiSliceActions.setModal({ assetId: 'rgb:abc', type: 'deposit' })
    )
    expect(state.modal).toEqual({ assetId: 'rgb:abc', type: 'deposit' })
  })

  it('sets a withdraw modal', () => {
    const state = reducer(
      initialState,
      uiSliceActions.setModal({ assetId: undefined, type: 'withdraw' })
    )
    expect(state.modal).toEqual({ assetId: undefined, type: 'withdraw' })
  })

  it('closes modal by setting type none', () => {
    const withModal = reducer(
      initialState,
      uiSliceActions.setModal({ assetId: 'rgb:abc', type: 'deposit' })
    )
    const closed = reducer(withModal, uiSliceActions.setModal({ type: 'none' }))
    expect(closed.modal.type).toBe('none')
  })
})

// ─── uiSliceSeletors.modal ────────────────────────────────────────────────

describe('uiSliceSeletors.modal', () => {
  it('returns the current modal from state', () => {
    const rootState = {
      ui: { modal: { assetId: 'rgb:xyz', type: 'deposit' as const } },
    }
    expect(uiSliceSeletors.modal(rootState)).toEqual({
      assetId: 'rgb:xyz',
      type: 'deposit',
    })
  })

  it('returns the initial none modal', () => {
    const rootState = { ui: initialState }
    expect(uiSliceSeletors.modal(rootState)).toEqual({ type: 'none' })
  })
})
