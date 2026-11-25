import { act, render, screen } from '@testing-library/react'
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

  const maker = { name: 'Desk', nip05_verified: false, npub: 'npub1aaaa' }
  const score = {
    counterparties: 4,
    event_id: 'score-event',
    settled: 18,
    verified: true,
    volume_sat: 833,
  }
  const single = {
    assetId: 'asset-a',
    makers: shares.slice(0, 1),
    precision: 2,
    ticker: 'USD',
  }

  it('shows a signed report separately from NIP-05 and only labels the issuer for the selected asset', async () => {
    makers.mockResolvedValue([
      {
        ...maker,
        issuer_assets: ['asset-a'],
        reputation: { ...score, expires_at: Date.now() / 1000 + 600 },
      },
    ])
    const view = render(<MakerList {...single} network="signetcustom" />)
    expect(await screen.findByText('Verified by Mosaik')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(screen.getByText('833')).toBeInTheDocument()
    expect(screen.getByText('Listed issuer of this asset')).toBeInTheDocument()
    view.rerender(
      <MakerList {...single} assetId="asset-b" network="signetcustom" />
    )
    expect(screen.queryByText('Listed issuer of this asset')).toBeNull()
    view.rerender(<MakerList {...single} network="signet" />)
    expect(screen.queryByText('Mosaik reputation')).toBeNull()
  })

  it('shows the measurements of an unverified maker and hides them as the report expires', async () => {
    vi.useFakeTimers()
    try {
      const now = new Date('2030-01-01T12:00:00Z')
      vi.setSystemTime(now)
      makers.mockResolvedValue([
        {
          ...maker,
          reputation: {
            ...score,
            expires_at: now.getTime() / 1000 + 2,
            verified: false,
          },
        },
      ])
      render(<MakerList {...single} network="signetcustom" />)
      await act(async () => {})
      expect(screen.getByText('Distinct counterparties')).toBeInTheDocument()
      expect(screen.queryByText('Verified by Mosaik')).toBeNull()
      act(() => vi.advanceTimersByTime(2000))
      expect(screen.queryByText('Distinct counterparties')).toBeNull()
      expect(
        screen.getByText('No current signed report for this maker.')
      ).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('allows catalog evidence alone to identify an issuer when a report is missing', async () => {
    makers.mockResolvedValue([{ ...maker, issuer_assets: ['asset-a'] }])
    render(<MakerList {...single} network="signetcustom" />)
    expect(
      await screen.findByText('Listed issuer of this asset')
    ).toBeInTheDocument()
    expect(screen.queryByText('Verified by Mosaik')).toBeNull()
    expect(
      screen.getByText('No current signed report for this maker.')
    ).toBeInTheDocument()
  })

  it('still lists the makers when profiles cannot be read', async () => {
    makers.mockRejectedValue(new Error('old daemon'))
    render(<MakerList makers={shares.slice(0, 1)} precision={2} ticker="USD" />)
    expect(screen.getByText('npub1aaaa')).toBeTruthy()
    expect(screen.queryByText(/check mark means/)).toBeNull()
  })
})
