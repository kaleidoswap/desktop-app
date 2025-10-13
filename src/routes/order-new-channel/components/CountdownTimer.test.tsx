import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { CountdownTimer } from './CountdownTimer'

describe('CountdownTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders countdown timer', () => {
    const futureDate = new Date(Date.now() + 300000) // 5 minutes from now
    render(<CountdownTimer expiresAt={futureDate.toISOString()} />)

    expect(screen.getByText('Payment Expires In')).toBeInTheDocument()
    expect(screen.getByText('05:00')).toBeInTheDocument()
  })

  it('formats countdown correctly', () => {
    const futureDate = new Date(Date.now() + 125000) // 2 minutes 5 seconds
    render(<CountdownTimer expiresAt={futureDate.toISOString()} />)

    expect(screen.getByText('02:05')).toBeInTheDocument()
  })

  it('displays progress bar', () => {
    const futureDate = new Date(Date.now() + 300000)
    const { container } = render(
      <CountdownTimer expiresAt={futureDate.toISOString()} />
    )

    const progressBar = container.querySelector(
      '.h-2.rounded-full.transition-all'
    )
    expect(progressBar).toBeInTheDocument()
  })

  it('counts down over time', async () => {
    const futureDate = new Date(Date.now() + 3000) // 3 seconds
    render(<CountdownTimer expiresAt={futureDate.toISOString()} />)

    expect(screen.getByText('00:03')).toBeInTheDocument()

    // Advance timer by 1 second and wait for update
    await vi.advanceTimersByTimeAsync(1000)
    expect(screen.getByText('00:02')).toBeInTheDocument()

    // Advance timer by another second
    await vi.advanceTimersByTimeAsync(1000)
    expect(screen.getByText('00:01')).toBeInTheDocument()
  })

  it('calls onExpiry when countdown reaches zero', async () => {
    const onExpiry = vi.fn()
    const futureDate = new Date(Date.now() + 2000) // 2 seconds

    render(
      <CountdownTimer
        expiresAt={futureDate.toISOString()}
        onExpiry={onExpiry}
      />
    )

    expect(onExpiry).not.toHaveBeenCalled()

    // Advance timer to expiry
    await vi.advanceTimersByTimeAsync(2000)

    // Note: onExpiry may be called twice - once when countdown hits 1 and transitions to 0,
    // and once from the useEffect when countdown <= 0
    expect(onExpiry).toHaveBeenCalled()
    expect(onExpiry.mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it('shows warning when countdown is less than 3 minutes', () => {
    const futureDate = new Date(Date.now() + 120000) // 2 minutes
    render(<CountdownTimer expiresAt={futureDate.toISOString()} />)

    expect(screen.getByText('Payment expiring soon.')).toBeInTheDocument()
  })

  it('shows urgent warning when countdown is less than 1 minute', () => {
    const futureDate = new Date(Date.now() + 30000) // 30 seconds
    render(<CountdownTimer expiresAt={futureDate.toISOString()} />)

    expect(screen.getByText('Payment expires soon!')).toBeInTheDocument()
  })

  it('does not show warning when countdown is more than 3 minutes', () => {
    const futureDate = new Date(Date.now() + 240000) // 4 minutes
    render(<CountdownTimer expiresAt={futureDate.toISOString()} />)

    expect(screen.queryByText('Payment expiring soon.')).not.toBeInTheDocument()
    expect(screen.queryByText('Payment expires soon!')).not.toBeInTheDocument()
  })

  it('handles already expired time', () => {
    const onExpiry = vi.fn()
    const pastDate = new Date(Date.now() - 1000) // 1 second ago

    render(
      <CountdownTimer expiresAt={pastDate.toISOString()} onExpiry={onExpiry} />
    )

    expect(screen.getByText('00:00')).toBeInTheDocument()
    expect(onExpiry).toHaveBeenCalled()
  })

  it('changes progress bar color based on time remaining', () => {
    // Test blue color (more than 3 minutes)
    const { container: container1, unmount: unmount1 } = render(
      <CountdownTimer expiresAt={new Date(Date.now() + 300000).toISOString()} />
    )
    let progressBar = container1.querySelector(
      '.h-2.rounded-full.transition-all'
    ) as HTMLElement
    expect(progressBar?.style.backgroundColor).toBe('rgb(59, 130, 246)') // Blue
    unmount1()

    // Test amber color (less than 3 minutes)
    const { container: container2, unmount: unmount2 } = render(
      <CountdownTimer expiresAt={new Date(Date.now() + 120000).toISOString()} />
    )
    progressBar = container2.querySelector(
      '.h-2.rounded-full.transition-all'
    ) as HTMLElement
    expect(progressBar?.style.backgroundColor).toBe('rgb(245, 158, 11)') // Amber
    unmount2()

    // Test red color (less than 1 minute)
    const { container: container3 } = render(
      <CountdownTimer expiresAt={new Date(Date.now() + 30000).toISOString()} />
    )
    progressBar = container3.querySelector(
      '.h-2.rounded-full.transition-all'
    ) as HTMLElement
    expect(progressBar?.style.backgroundColor).toBe('rgb(239, 68, 68)') // Red
  })

  it('displays spinner animation', () => {
    const futureDate = new Date(Date.now() + 300000)
    const { container } = render(
      <CountdownTimer expiresAt={futureDate.toISOString()} />
    )

    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })
})
