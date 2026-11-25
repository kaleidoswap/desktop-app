import { act, renderHook, waitFor } from '@testing-library/react'
import { invoke } from '@tauri-apps/api/core'
import { beforeEach, expect, it, vi } from 'vitest'
import { useLocalNodeCapabilities } from './useLocalNodeCapabilities'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('../../utils/logger', () => ({ logger: { error: vi.fn() } }))
const mockedInvoke = vi.mocked(invoke)
beforeEach(() => vi.resetAllMocks())

it('detects Docker started after setup and clears a disconnected backend', async () => {
  mockedInvoke.mockResolvedValueOnce({ docker: false, native: false })
  const { result } = renderHook(useLocalNodeCapabilities)
  await waitFor(() => expect(result.current.capabilitiesLoaded).toBe(true))
  expect(result.current.localNodeMode).toBe(null)
  mockedInvoke.mockResolvedValueOnce({ docker: true, native: false })
  await act(() => result.current.checkCapabilities())
  expect(result.current.localNodeMode).toBe('docker')
  mockedInvoke.mockResolvedValueOnce({ docker: false, native: false })
  await act(() => result.current.checkCapabilities())
  expect(result.current.isDockerAvailable).toBe(false)
  expect(result.current.localNodeMode).toBe(null)
})

it('refreshes on focus without changing a valid native selection', async () => {
  mockedInvoke.mockResolvedValue({ docker: false, native: true })
  const { result } = renderHook(useLocalNodeCapabilities)
  await waitFor(() => expect(result.current.localNodeMode).toBe('native'))
  mockedInvoke.mockResolvedValue({ docker: true, native: true })
  act(() => window.dispatchEvent(new Event('focus')))
  await waitFor(() => expect(result.current.isDockerAvailable).toBe(true))
  expect(result.current.localNodeMode).toBe('native')
})

it('recovers after a failed check and prevents overlapping requests', async () => {
  mockedInvoke.mockRejectedValueOnce(new Error('offline'))
  const { result } = renderHook(useLocalNodeCapabilities)
  await waitFor(() => expect(result.current.capabilitiesLoaded).toBe(true))
  expect(result.current.checkingCapabilities).toBe(false)
  let resolve!: (value: unknown) => void
  mockedInvoke.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  let pending!: Promise<void>
  act(() => {
    pending = result.current.checkCapabilities()
  })
  await act(() => result.current.checkCapabilities())
  expect(mockedInvoke).toHaveBeenCalledTimes(2)
  await act(async () => {
    resolve({ docker: true, native: false })
    await pending
  })
  expect(result.current.checkingCapabilities).toBe(false)
  expect(result.current.isDockerAvailable).toBe(true)
})
