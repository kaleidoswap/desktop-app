import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SwapButton } from '../SwapButton'
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
const props = {
  errorMessage: null,
  hasChannels: false,
  hasTradablePairs: true,
  hasValidQuote: false,
  isPriceLoading: false,
  isSwapInProgress: false,
  isToAmountLoading: false,
  missingChannelAsset: { asset: 'USDT', assetId: 'asset', isFromAsset: false },
  wsConnected: true,
}
describe('swap action availability', () => {
  it('does not allow the missing-channel exception to bypass a failed quote', () => {
    const submit = vi.fn((event) => event.preventDefault())
    render(
      <form onSubmit={submit}>
        <SwapButton
          {...props}
          errorMessage="Pair unavailable"
          quoteUnavailable
        />
      </form>
    )
    const button = screen.getByRole('button', { name: 'ux.quoteUnavailable' })
    expect(button).toBeDisabled()
    expect(button).not.toHaveClass('bg-primary')
    fireEvent.click(button)
    expect(submit).not.toHaveBeenCalled()
  })
  it.each([{ wsConnected: false }, { isSwapInProgress: true }])(
    'blocks missing-channel actions when unavailable: %o',
    (override) => {
      render(<SwapButton {...props} {...override} />)
      expect(screen.getByRole('button')).toBeDisabled()
      expect(screen.getByRole('button')).not.toHaveClass('bg-primary')
    }
  )
  it('restores the channel action when the quote failure clears', () => {
    const { rerender } = render(<SwapButton {...props} quoteUnavailable />)
    rerender(<SwapButton {...props} quoteUnavailable={false} />)
    expect(screen.getByRole('button')).toBeEnabled()
    expect(screen.getByRole('button')).toHaveClass('bg-primary')
  })
})
