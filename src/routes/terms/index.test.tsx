import { invoke } from '@tauri-apps/api/core'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { renderWithRouter } from '@/test/test-utils'

import { Component as TermsRoute } from './index'

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

describe('Terms Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    vi.mocked(invoke).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    renderWithRouter(<TermsRoute />)

    expect(
      screen.getByText('TEST NET KALEIDOSWAP TERMS OF USE')
    ).toBeInTheDocument()
    expect(screen.getByText(/Effective Date/i)).toBeInTheDocument()
  })

  it('loads and displays markdown content', async () => {
    const mockContent = '# Terms of Service\n\nThese are the terms.'
    vi.mocked(invoke).mockResolvedValue(mockContent)

    renderWithRouter(<TermsRoute />)

    await waitFor(() => {
      expect(screen.getByText('Terms of Service')).toBeInTheDocument()
      expect(screen.getByText('These are the terms.')).toBeInTheDocument()
    })

    expect(invoke).toHaveBeenCalledWith('get_markdown_content', {
      filePath: 'desktop-app/docs/ksw_terms_of_service.md',
    })
  })

  it('displays important notice section with all points', () => {
    vi.mocked(invoke).mockResolvedValue('# Terms')

    renderWithRouter(<TermsRoute />)

    expect(screen.getByText('IMPORTANT NOTICE:')).toBeInTheDocument()
    expect(
      screen.getByText(/THE APP OPERATES ON THE RGB TEST NET PROTOCOL/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/THE APP IS AN EXPERIMENTAL DIGITAL ASSET WALLET/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/ALL USE OF THE APP IS AT YOUR OWN RISK/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/YOU SHOULD NOT USE THE APP TO SEND OR RECEIVE/i)
    ).toBeInTheDocument()
  })

  it('displays error message when content fails to load', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('Failed to load file'))

    renderWithRouter(<TermsRoute />)

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load terms of service')
      ).toBeInTheDocument()
    })

    // Should not show the markdown content area when there's an error
    expect(
      screen.queryByText('TEST NET KALEIDOSWAP TERMS OF USE')
    ).not.toBeInTheDocument()
  })

  it('renders Okay button', async () => {
    vi.mocked(invoke).mockResolvedValue('# Content')

    renderWithRouter(<TermsRoute />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /okay/i })).toBeInTheDocument()
    })
  })

  it('navigates back when Okay button is clicked', async () => {
    vi.mocked(invoke).mockResolvedValue('# Content')
    const user = userEvent.setup()

    renderWithRouter(<TermsRoute />)

    const okayButton = await screen.findByRole('button', { name: /okay/i })
    await user.click(okayButton)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(-1)
    })
  })

  it('displays warning as bullet list', () => {
    vi.mocked(invoke).mockResolvedValue('# Content')
    const { container } = renderWithRouter(<TermsRoute />)

    const bulletList = container.querySelector('ul.list-disc')
    expect(bulletList).toBeInTheDocument()
  })

  it('has correct styling for container', () => {
    vi.mocked(invoke).mockResolvedValue('# Content')
    const { container } = renderWithRouter(<TermsRoute />)

    const mainContainer = container.querySelector('.container.mx-auto')
    expect(mainContainer).toBeInTheDocument()
    expect(mainContainer).toHaveClass('py-8', 'px-4')
  })

  it('displays warning box with correct styling', () => {
    vi.mocked(invoke).mockResolvedValue('# Content')
    const { container } = renderWithRouter(<TermsRoute />)

    const warningBox = container.querySelector('.bg-yellow-900\\/20')
    expect(warningBox).toBeInTheDocument()
  })

  it('displays error box with correct styling when error occurs', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('Network error'))
    const { container } = renderWithRouter(<TermsRoute />)

    await waitFor(() => {
      const errorBox = container.querySelector('.bg-red-900\\/20')
      expect(errorBox).toBeInTheDocument()
    })
  })

  it('logs error to console when content fails to load', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    const error = new Error('Failed to load file')
    vi.mocked(invoke).mockRejectedValue(error)

    renderWithRouter(<TermsRoute />)

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load terms of service:',
        error
      )
    })

    consoleErrorSpy.mockRestore()
  })
})
