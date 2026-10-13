import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ThinkingToggle } from '../thinking-toggle'
const client = vi.hoisted(() => ({
  getAgentState: vi.fn(),
  setGenerationLimits: vi.fn(),
}))
vi.mock('../../../api/mind', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/mind')>()),
  mindClient: client,
}))
beforeEach(() => {
  vi.clearAllMocks()
  client.getAgentState.mockResolvedValue({
    generation: {
      maxOutputTokens: 4096,
      maxThinkingTokens: 1024,
      thinking: false,
    },
  })
})
describe('Thinking control', () => {
  it('shows the confirmed mode and keeps it after a failed change', async () => {
    client.setGenerationLimits.mockRejectedValueOnce(new Error('offline'))
    render(<ThinkingToggle />)
    fireEvent.click(await screen.findByRole('button', { name: 'Thinking off' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not change Thinking'
    )
    expect(screen.getByRole('button', { name: 'Thinking off' })).toBeEnabled()
  })
  it('updates the visible label after the provider confirms the setting', async () => {
    client.setGenerationLimits.mockResolvedValueOnce({
      generation: { thinking: true },
    })
    render(<ThinkingToggle />)
    fireEvent.click(await screen.findByRole('button', { name: 'Thinking off' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Thinking on' })
      ).toHaveAttribute('aria-pressed', 'true')
    )
  })
})
