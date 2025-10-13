import { invoke } from '@tauri-apps/api/core'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { renderWithRouter } from '@/test/test-utils'

import { Component as PrivacyRoute } from './index'

vi.mock('@tauri-apps/api/core')

// Mock the Layout component to simplify testing
vi.mock('../../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

// Mock useNavigate before the describe block
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('Privacy Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    vi.mocked(invoke).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    renderWithRouter(<PrivacyRoute />)

    expect(screen.getByText('KaleidoSwap Privacy Policy')).toBeInTheDocument()
    expect(screen.getByText(/Last updated/i)).toBeInTheDocument()
  })

  it('loads and displays markdown content', async () => {
    const mockContent =
      '# Privacy Policy\n\nThis is the privacy policy content.'
    vi.mocked(invoke).mockResolvedValue(mockContent)

    renderWithRouter(<PrivacyRoute />)

    await waitFor(() => {
      expect(screen.getByText('Privacy Policy')).toBeInTheDocument()
      expect(
        screen.getByText('This is the privacy policy content.')
      ).toBeInTheDocument()
    })

    expect(invoke).toHaveBeenCalledWith('get_markdown_content', {
      filePath: 'desktop-app/docs/ksw_privacy_policy.md',
    })
  })

  it('displays important notice section', () => {
    vi.mocked(invoke).mockResolvedValue('# Privacy Policy')

    renderWithRouter(<PrivacyRoute />)

    expect(screen.getByText('IMPORTANT NOTICE:')).toBeInTheDocument()
    expect(
      screen.getByText(/While the RGB protocol and RGB test net protocol/i)
    ).toBeInTheDocument()
  })

  it('displays error message when content fails to load', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('Failed to load file'))

    renderWithRouter(<PrivacyRoute />)

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load privacy policy')
      ).toBeInTheDocument()
    })

    // Should not show the markdown content area when there's an error
    expect(
      screen.queryByText('KaleidoSwap Privacy Policy')
    ).not.toBeInTheDocument()
  })

  it('renders Okay button', async () => {
    vi.mocked(invoke).mockResolvedValue('# Content')

    renderWithRouter(<PrivacyRoute />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /okay/i })).toBeInTheDocument()
    })
  })

  it('navigates back when Okay button is clicked', async () => {
    vi.mocked(invoke).mockResolvedValue('# Content')
    const user = userEvent.setup()

    renderWithRouter(<PrivacyRoute />)

    const okayButton = await screen.findByRole('button', { name: /okay/i })
    await user.click(okayButton)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(-1)
    })
  })

  it('has correct styling for container', () => {
    vi.mocked(invoke).mockResolvedValue('# Content')
    const { container } = renderWithRouter(<PrivacyRoute />)

    const mainContainer = container.querySelector('.container.mx-auto')
    expect(mainContainer).toBeInTheDocument()
    expect(mainContainer).toHaveClass('py-8', 'px-4')
  })

  it('displays warning box with correct styling', () => {
    vi.mocked(invoke).mockResolvedValue('# Content')
    const { container } = renderWithRouter(<PrivacyRoute />)

    const warningBox = container.querySelector('.bg-yellow-900\\/20')
    expect(warningBox).toBeInTheDocument()
  })

  it('displays error box with correct styling when error occurs', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('Network error'))
    const { container } = renderWithRouter(<PrivacyRoute />)

    await waitFor(() => {
      const errorBox = container.querySelector('.bg-red-900\\/20')
      expect(errorBox).toBeInTheDocument()
    })
  })
})
