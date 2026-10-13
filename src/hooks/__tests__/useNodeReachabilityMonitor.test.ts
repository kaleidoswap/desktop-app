import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useNodeReachabilityMonitor } from '../useNodeReachabilityMonitor'

const mocks = vi.hoisted(() => ({
  add: vi.fn(() => 'offline-notification'),
  dispatch: vi.fn(),
  query: {} as any,
  remove: vi.fn(),
  state: { node: { reachability: 'unknown' } },
  t: (key: string) => key,
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: mocks.t }) }))
vi.mock('../../app/store/hooks', () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: (select: any) => select(mocks.state),
}))
vi.mock('../../components/NotificationSystem', () => ({
  useNotification: () => ({
    addNotification: mocks.add,
    removeNotification: mocks.remove,
  }),
}))
vi.mock('../../slices/nodeApi/nodeApi.slice', () => ({
  nodeApi: { useNodeInfoQuery: () => mocks.query },
}))
const failure = (requestId: string) => ({
  error: { error: 'Request timeout', status: 'TIMEOUT_ERROR' },
  isError: true,
  isFetching: false,
  isSuccess: false,
  requestId,
})
const statuses = () =>
  mocks.dispatch.mock.calls.map(([action]) => action.payload.status)
beforeEach(() => {
  vi.clearAllMocks()
  mocks.state.node.reachability = 'unknown'
  mocks.query = { isFetching: true, requestId: 'initial' }
})
describe('node reachability', () => {
  it('counts each completed failed probe once, then recovers without manual retry', () => {
    const { rerender } = renderHook(() =>
      useNodeReachabilityMonitor({ accountKey: 'test', skip: false })
    )
    mocks.query = failure('one')
    rerender()
    expect(statuses()).not.toContain('unreachable')
    mocks.query = { ...failure('one'), error: { ...failure('one').error } }
    rerender()
    expect(statuses()).not.toContain('unreachable')
    mocks.query = failure('two')
    rerender()
    expect(statuses().at(-1)).toBe('unreachable')
    expect(mocks.add).toHaveBeenCalledTimes(1)
    mocks.state.node.reachability = 'unreachable'
    mocks.query = { isFetching: true, isSuccess: true, requestId: 'three' }
    rerender()
    expect(statuses().at(-1)).toBe('unreachable')
    mocks.query = { isFetching: false, isSuccess: true, requestId: 'three' }
    rerender()
    expect(statuses().at(-1)).toBe('reachable')
    expect(mocks.remove).toHaveBeenCalledWith('offline-notification')
    expect(mocks.add).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'success' })
    )
  })
  it('does not treat an HTTP validation response as a disconnected node', () => {
    mocks.query = {
      ...failure('one'),
      error: { data: { error: 'Invalid request' }, status: 400 },
    }
    renderHook(() =>
      useNodeReachabilityMonitor({ accountKey: 'test', skip: false })
    )
    expect(statuses().at(-1)).toBe('reachable')
    expect(mocks.add).not.toHaveBeenCalled()
  })
  it('does not carry failed probes across accounts', () => {
    const { rerender } = renderHook(
      ({ accountKey }) =>
        useNodeReachabilityMonitor({ accountKey, skip: false }),
      { initialProps: { accountKey: 'first' } }
    )
    mocks.query = failure('one')
    rerender({ accountKey: 'first' })
    mocks.query = { isFetching: true, requestId: 'two' }
    rerender({ accountKey: 'second' })
    mocks.query = failure('two')
    rerender({ accountKey: 'second' })
    expect(statuses()).not.toContain('unreachable')
  })
})
