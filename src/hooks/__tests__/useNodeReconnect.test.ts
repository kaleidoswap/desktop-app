import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useNodeReconnect } from '../useNodeReconnect'
const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  initiate: vi.fn(() => 'probe'),
}))
vi.mock('../../app/store/hooks', () => ({
  useAppDispatch: () => mocks.dispatch,
}))
vi.mock('../../slices/nodeApi/nodeApi.slice', () => ({
  nodeApi: { endpoints: { nodeInfo: { initiate: mocks.initiate } } },
}))
beforeEach(() => vi.clearAllMocks())
it('shows pending feedback, prevents duplicate retries and reports a slow node', async () => {
  let resolve!: (value: unknown) => void
  mocks.dispatch.mockImplementation((value) =>
    value === 'probe'
      ? new Promise((done) => {
          resolve = done
        })
      : value
  )
  const { result } = renderHook(useNodeReconnect)
  let pending!: Promise<boolean>
  act(() => {
    pending = result.current.reconnect()
  })
  expect(result.current.isReconnecting).toBe(true)
  await act(() => result.current.reconnect())
  expect(mocks.initiate).toHaveBeenCalledTimes(1)
  await act(async () => {
    resolve({
      error: {
        error: 'timeout after 5000 milliseconds',
        status: 'TIMEOUT_ERROR',
      },
    })
    await pending
  })
  expect(result.current.isReconnecting).toBe(false)
  expect(result.current.lastResult).toBe('slow')
  expect(mocks.dispatch).toHaveBeenLastCalledWith(
    expect.objectContaining({
      payload: expect.objectContaining({ status: 'slow' }),
    })
  )
})
it('ends the pending state after unexpected failures and allows recovery', async () => {
  mocks.dispatch.mockImplementation((value) =>
    value === 'probe' ? Promise.reject(new Error('transport failure')) : value
  )
  const { result } = renderHook(useNodeReconnect)
  await act(() => result.current.reconnect())
  expect(result.current.lastResult).toBe('unreachable')
  expect(result.current.isReconnecting).toBe(false)
  mocks.dispatch.mockImplementation((value) =>
    value === 'probe' ? Promise.resolve({ data: {} }) : value
  )
  await act(() => result.current.reconnect())
  expect(result.current.lastResult).toBe('reachable')
})
