import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MindEvent } from '../../api/mind'
import { useMind } from '../useMind'

const mock = vi.hoisted(() => ({
  client: {
    downloadModel: vi.fn(),
    getStatus: vi.fn(async () => ({ on: false })),
    installRuntime: vi.fn(),
    on: vi.fn(),
    onRuntimeProgress: vi.fn(() => () => {}),
    runtimeInstalled: vi.fn(async () => false),
    runtimeStale: vi.fn(async () => false),
    startProvider: vi.fn(),
  },
  handler: (_event: MindEvent) => {},
}))
vi.mock('../../api/mind', () => ({ mindClient: mock.client }))
vi.mock('../../api/mindCatalog', () => ({ loadModelCatalog: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks()
  mock.client.on.mockImplementation((handler) => {
    mock.handler = handler
    return () => {}
  })
})
describe('Mind error recovery', () => {
  it('unlocks runtime installation when the command rejects without a progress event', async () => {
    mock.client.installRuntime.mockRejectedValueOnce(
      new Error('network unavailable')
    )
    const { result } = renderHook(useMind)
    await act(async () => {
      await result.current.installRuntime()
    })
    expect(result.current.runtimeProgress).toMatchObject({
      message: 'network unavailable',
      phase: 'error',
    })
  })
  it('clears a model download that cannot be started', async () => {
    const { result } = renderHook(useMind)
    await act(async () => {
      await result.current.downloadModel('missing')
    })
    expect(result.current.downloads).toEqual({})
    expect(result.current.actionError).toContain('Model not found')
  })
  it('clears loading on failed startup so a retry is possible', async () => {
    mock.client.startProvider.mockImplementationOnce(async () => {
      mock.handler({ phase: 'loading_model', type: 'provider_loading' })
      throw new Error('not enough memory')
    })
    const { result } = renderHook(useMind)
    await act(async () => {
      await expect(result.current.startProvider('test')).rejects.toThrow(
        'not enough memory'
      )
    })
    expect(result.current.loading).toBeNull()
    expect(result.current.starting).toBe(false)
    await waitFor(() => expect(result.current.runtimeInstalled).toBe(false))
  })
})
