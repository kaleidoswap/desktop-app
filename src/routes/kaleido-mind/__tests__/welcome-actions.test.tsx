import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../api/mind', () => ({
  mindClient: { getSuggestedActions: vi.fn() },
}))

import { WelcomeActions } from '../welcome-actions'

describe('chat without a node', () => {
  it('offers general chat instead of wallet operations', () => {
    render(
      <WelcomeActions
        disabled={false}
        nodeConnected={false}
        onPick={vi.fn()}
        providerOn={false}
      />
    )
    expect(
      screen.getByRole('button', { name: /Understand Lightning/ })
    ).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: /Check my balances/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Buy 100 USDT/ })
    ).not.toBeInTheDocument()
  })
})
