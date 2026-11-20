import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MakerList } from '../MakerList'

const makers = vi.hoisted(() => vi.fn())

vi.mock('../../api', () => ({ marketApi: { makers } }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) =>
      opts?.defaultValue ?? _key,
  }),
}))

const shares = [
  { amount: 9500, away: false, maker: 'aaaa', npub: 'npub1aaaa' },
  { amount: 2500, away: true, maker: 'bbbb', npub: 'npub1bbbb' },
  { amount: 1000, away: false, maker: 'cccc' },
]

describe('MakerList', () => {
  it('shows each maker by the name it gives, and whether its domain confirms it', async () => {
    makers.mockResolvedValue([
      {
        name: 'Desk',
        nip05: 'desk@example.com',
        nip05_verified: true,
        npub: 'npub1aaaa',
        picture: null,
      },
      {
        name: null,
        nip05: 'bob@other.example',
        nip05_verified: false,
        npub: 'npub1bbbb',
        picture: null,
      },
    ])
    render(<MakerList makers={shares} precision={2} ticker="USD" />)

    expect(await screen.findByText('Desk')).toBeTruthy()
    expect(makers).toHaveBeenCalledWith(['npub1aaaa', 'npub1bbbb'])
    expect(
      screen.getByText(/bob@other\.example \(not confirmed\)/)
    ).toBeTruthy()
    // no profile for a maker whose daemon gave no full key: its short key shows
    expect(screen.getByText('cccc')).toBeTruthy()
    expect(screen.getByText(/check mark means/)).toBeTruthy()
  })

  it('still lists the makers when profiles cannot be read', async () => {
    makers.mockRejectedValue(new Error('old daemon'))
    render(<MakerList makers={shares.slice(0, 1)} precision={2} ticker="USD" />)
    expect(screen.getByText('npub1aaaa')).toBeTruthy()
    expect(screen.queryByText(/check mark means/)).toBeNull()
  })
})
