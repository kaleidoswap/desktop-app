import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const opener = vi.hoisted(() => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@tauri-apps/plugin-opener', () => opener)
import { MosaikBridge } from '../market/MosaikBridge'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
describe('private Mosaik handoff', () => {
  it('does not send other networks to the Signet preview', () => {
    render(<MosaikBridge network="bitcoin" />)
    expect(screen.queryByRole('button', { name: 'Open Mosaik' })).toBeNull()
    expect(opener.openUrl).not.toHaveBeenCalled()
  })
  it('opens only the VPN origin on an explicit click, with no wallet information', () => {
    render(<MosaikBridge network="signetcustom" />)
    expect(opener.openUrl).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Open Mosaik' }))
    expect(opener.openUrl).toHaveBeenCalledWith(
      'https://kaleido-edge.mole-pangolin.ts.net:8444/'
    )
    expect(screen.getByText(/Balances do not sync/)).toBeTruthy()
  })
  it('shows an actionable failure if the browser cannot open', async () => {
    opener.openUrl.mockRejectedValueOnce(new Error('blocked'))
    render(<MosaikBridge network="signetcustom" />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Mosaik' }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Tailscale VPN')
    )
  })
})
