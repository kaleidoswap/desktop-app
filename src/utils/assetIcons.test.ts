import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { useAssetIcon } from './assetIcons'

// Mock global fetch
global.fetch = vi.fn()

describe('useAssetIcon', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns default icon initially', () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
    } as Response)

    const { result } = renderHook(() => useAssetIcon('BTC'))

    expect(result.current).toContain('generic.png')
  })

  it('loads icon when ticker exists', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
    } as Response)

    const { result } = renderHook(() => useAssetIcon('BTC'))

    await waitFor(() => {
      expect(result.current).toContain('btc.png')
    })
  })

  it('uses default icon when ticker does not exist', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
    } as Response)

    const { result } = renderHook(() => useAssetIcon('UNKNOWN'))

    await waitFor(() => {
      expect(result.current).toContain('generic.png')
    })
  })

  it('converts ticker to lowercase', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
    } as Response)

    renderHook(() => useAssetIcon('ETH'))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('eth.png'), {
        method: 'HEAD',
      })
    })
  })

  it('handles fetch errors gracefully', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useAssetIcon('BTC'))

    await waitFor(() => {
      expect(result.current).toContain('generic.png')
    })
  })

  it('updates icon when ticker changes', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
    } as Response)

    const { result, rerender } = renderHook(
      ({ ticker }) => useAssetIcon(ticker),
      { initialProps: { ticker: 'BTC' } }
    )

    await waitFor(() => {
      expect(result.current).toContain('btc.png')
    })

    rerender({ ticker: 'ETH' })

    await waitFor(() => {
      expect(result.current).toContain('eth.png')
    })
  })
})
