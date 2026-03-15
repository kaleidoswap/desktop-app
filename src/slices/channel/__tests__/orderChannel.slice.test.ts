import { describe, it, expect } from 'vitest'
import {
  orderChannelSlice,
  orderChannelSliceActions,
} from '../orderChannel.slice'

const reducer = orderChannelSlice.reducer

const getInitialState = () => reducer(undefined, { type: '@@INIT' })

// ─── setChannelRequestForm ─────────────────────────────────────────────────

describe('setChannelRequestForm', () => {
  it('merges partial updates into the form', () => {
    const state = reducer(
      getInitialState(),
      orderChannelSliceActions.setChannelRequestForm({ assetId: 'rgb:test-id' })
    )
    expect(state.forms.request.assetId).toBe('rgb:test-id')
    // Other fields remain at initial values
    expect(state.forms.request.channelExpireBlocks).toBe(4320)
  })

  it('updates capacitySat', () => {
    const state = reducer(
      getInitialState(),
      orderChannelSliceActions.setChannelRequestForm({ capacitySat: 200_000 })
    )
    expect(state.forms.request.capacitySat).toBe(200_000)
  })

  it('updates clientBalanceSat', () => {
    const state = reducer(
      getInitialState(),
      orderChannelSliceActions.setChannelRequestForm({
        clientBalanceSat: 50_000,
      })
    )
    expect(state.forms.request.clientBalanceSat).toBe(50_000)
  })

  it('updates optional lspAssetAmount', () => {
    const state = reducer(
      getInitialState(),
      orderChannelSliceActions.setChannelRequestForm({
        lspAssetAmount: 1_000_000,
      })
    )
    expect(state.forms.request.lspAssetAmount).toBe(1_000_000)
  })

  it('updates rfqId', () => {
    const state = reducer(
      getInitialState(),
      orderChannelSliceActions.setChannelRequestForm({ rfqId: 'rfq-123' })
    )
    expect(state.forms.request.rfqId).toBe('rfq-123')
  })

  it('applies multiple partial updates sequentially', () => {
    let state = getInitialState()
    state = reducer(
      state,
      orderChannelSliceActions.setChannelRequestForm({ capacitySat: 300_000 })
    )
    state = reducer(
      state,
      orderChannelSliceActions.setChannelRequestForm({
        clientBalanceSat: 100_000,
      })
    )
    expect(state.forms.request.capacitySat).toBe(300_000)
    expect(state.forms.request.clientBalanceSat).toBe(100_000)
  })
})

// ─── initial state ─────────────────────────────────────────────────────────

describe('initial state', () => {
  it('has the correct default channelExpireBlocks', () => {
    expect(getInitialState().forms.request.channelExpireBlocks).toBe(4320)
  })

  it('has empty assetId by default', () => {
    expect(getInitialState().forms.request.assetId).toBe('')
  })

  it('has clientBalanceSat of 0 by default', () => {
    expect(getInitialState().forms.request.clientBalanceSat).toBe(0)
  })
})
