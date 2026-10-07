import { act, render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn() }))
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))
// English fallbacks with {{var}} interpolation, as i18next renders them.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: string | Record<string, unknown>) => {
      const text =
        typeof opts === 'string'
          ? opts
          : typeof opts?.defaultValue === 'string'
            ? opts.defaultValue
            : key
      return text.replace(/\{\{(\w+)\}\}/g, (_, k) =>
        String((opts as Record<string, unknown>)?.[k] ?? '')
      )
    },
  }),
}))

import { NodeLogsPanel } from '../NodeLogsPanel'

const flush = () => act(() => Promise.resolve())

describe('NodeLogsPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.invoke.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('shows the newest page and keeps it on screen while polling', async () => {
    mocks.invoke.mockResolvedValue({ logs: ['line 98', 'line 99'], total: 100 })
    render(<NodeLogsPanel />)
    await flush()

    expect(mocks.invoke).toHaveBeenCalledWith('get_node_logs', {
      page: 1,
      pageSize: 200,
    })
    expect(screen.getByText('line 99')).toBeInTheDocument()

    mocks.invoke.mockResolvedValue({ logs: ['line 99', 'line 100'], total: 101 })
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    await flush()
    // No loading screen replaced the lines between polls.
    expect(screen.queryByText('settings.loadingLogs')).not.toBeInTheDocument()
    expect(screen.getByText('line 100')).toBeInTheDocument()
  })

  it('filters the visible lines', async () => {
    mocks.invoke.mockResolvedValue({
      logs: ['INFO sync done', 'ERROR peer lost', 'INFO tick'],
      total: 3,
    })
    render(<NodeLogsPanel />)
    await flush()

    fireEvent.change(screen.getByPlaceholderText('Filter lines…'), {
      target: { value: 'error' },
    })
    expect(screen.getByText('ERROR peer lost')).toBeInTheDocument()
    expect(screen.queryByText('INFO tick')).not.toBeInTheDocument()
  })

  it('explains why logs of a node on another machine are not visible', async () => {
    mocks.invoke.mockResolvedValue({
      available: false,
      container: null,
      logs: [],
      reason: 'remote_host',
      total: 0,
    })
    render(<NodeLogsPanel remoteUrl="https://node.example.com" />)
    await flush()

    expect(mocks.invoke).toHaveBeenCalledWith('get_remote_node_logs', {
      nodeUrl: 'https://node.example.com',
      page: 1,
      pageSize: 200,
    })
    expect(
      screen.getByText('Logs are not available for this node')
    ).toBeInTheDocument()
    expect(screen.getByText(/runs on another machine/)).toBeInTheDocument()
  })
})
