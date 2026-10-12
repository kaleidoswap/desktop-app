import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-toastify', () => ({
  toast: { dismiss: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))
vi.mock('../../../i18n', () => ({ i18n: { t: (key: string) => key } }))
vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

class FakeSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static instances: FakeSocket[] = []
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  send = vi.fn()
  close = vi.fn((code: number) => {
    if (code !== 1000 && (code < 3000 || code > 4999))
      throw new Error('Invalid close code')
    this.readyState = 3
  })
  constructor() {
    FakeSocket.instances.push(this)
  }
}

import { webSocketService } from '../websocketService'

describe('maker connection lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeSocket)
    window.history.replaceState({}, '', '/market-maker')
    FakeSocket.instances = []
  })
  afterEach(() => {
    webSocketService.close()
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
  const connect = () => {
    webSocketService.init('https://maker.example', 'test-client', vi.fn())
    return FakeSocket.instances.at(-1)!
  }
  it('cancels queued reconnects and ignores late socket events after leaving trading', async () => {
    const socket = connect()
    const lateClose = socket.onclose!
    lateClose(new CloseEvent('close', { code: 1006, wasClean: false }))
    window.history.replaceState({}, '', '/channels')
    webSocketService.close()
    lateClose(new CloseEvent('close', { code: 1006, wasClean: false }))
    await vi.advanceTimersByTimeAsync(30000)
    expect(FakeSocket.instances).toHaveLength(1)
    expect(webSocketService.connectionInitialized).toBe(false)
  })
  it('closes connecting sockets immediately and never closes a replacement from an old timer', async () => {
    const old = connect()
    webSocketService.close()
    expect(old.close).toHaveBeenCalledWith(1000, expect.any(String))
    const replacement = connect()
    await vi.advanceTimersByTimeAsync(100)
    expect(replacement.close).not.toHaveBeenCalled()
  })
  it('waits for readiness after the socket opens and cancels readiness on close', async () => {
    const socket = connect()
    socket.readyState = 1
    socket.onopen!()
    const ready = webSocketService.waitForConnection()
    await vi.advanceTimersByTimeAsync(500)
    expect(await ready).toBe(true)
    webSocketService.close()
    expect(webSocketService.isConnectionReadyForCommunication()).toBe(false)
  })
  it('uses a valid application close code on connection timeout', async () => {
    const socket = connect()
    await vi.advanceTimersByTimeAsync(5000)
    expect(socket.close).toHaveBeenCalledWith(4000, 'Connection timeout')
  })
  it.each(['from', 'to'] as const)(
    'requests Lightning settlement for %s quotes',
    async (direction) => {
      const socket = connect()
      socket.readyState = 1
      socket.onopen!()
      await vi.advanceTimersByTimeAsync(500)
      await webSocketService.requestQuote('BTC', 'rgb:test', 1231000, direction)
      await vi.advanceTimersByTimeAsync(500)
      const requests = socket.send.mock.calls.map(([data]) => JSON.parse(data))
      expect(requests).toContainEqual(
        expect.objectContaining({
          action: 'quote_request',
          from_asset: 'BTC',
          from_layer: 'BTC_LN',
          to_asset: 'rgb:test',
          to_layer: 'RGB_LN',
          [direction === 'from' ? 'from_amount' : 'to_amount']: 1231000,
        })
      )
    }
  )
  it('reports a missing quote instead of leaving the form waiting indefinitely', async () => {
    const dispatch = vi.fn()
    webSocketService.init('https://maker.example', 'test-client', dispatch)
    const socket = FakeSocket.instances.at(-1)!
    socket.readyState = 1
    socket.onopen!()
    await vi.advanceTimersByTimeAsync(500)
    await webSocketService.requestQuote('BTC', 'USDT', 1000000)
    await vi.advanceTimersByTimeAsync(10000)
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pairs/setQuoteError' })
    )
  })
  it('forwards quote rejection errors to the form', async () => {
    const dispatch = vi.fn()
    webSocketService.init('https://maker.example', 'test-client', dispatch)
    const socket = FakeSocket.instances.at(-1)!
    socket.readyState = 1
    socket.onopen!()
    socket.onmessage!(
      new MessageEvent('message', {
        data: JSON.stringify({
          action: 'quote_response',
          error: 'Quote unavailable',
        }),
      })
    )
    expect(dispatch).toHaveBeenCalledWith({
      payload: 'Quote unavailable',
      type: 'pairs/setQuoteError',
    })
  })
  it('surfaces maker pair-not-found errors even without an action field', async () => {
    const dispatch = vi.fn()
    webSocketService.init('https://maker.example', 'test-client', dispatch)
    const socket = FakeSocket.instances.at(-1)!
    socket.readyState = 1
    socket.onopen!()
    await vi.advanceTimersByTimeAsync(500)
    await webSocketService.requestQuote('BTC', 'USDT', 1000000)
    socket.onmessage!(
      new MessageEvent('message', {
        data: JSON.stringify({
          action: null,
          error: 'Trading pair not found for BTC/USDT',
        }),
      })
    )
    expect(dispatch).toHaveBeenCalledWith({
      payload: 'Trading pair not found for BTC/USDT',
      type: 'pairs/setQuoteError',
    })
  })
})
