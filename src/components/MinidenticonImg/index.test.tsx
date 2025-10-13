import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { MinidenticonImg } from './index'

describe('MinidenticonImg', () => {
  it('renders an image element', () => {
    render(<MinidenticonImg username="testuser" />)
    const img = screen.getByRole('img')
    expect(img).toBeInTheDocument()
  })

  it('sets alt text to username', () => {
    render(<MinidenticonImg username="alice" />)
    expect(screen.getByAltText('alice')).toBeInTheDocument()
  })

  it('generates data URI for SVG', () => {
    render(<MinidenticonImg username="bob" />)
    const img = screen.getByRole('img') as HTMLImageElement

    expect(img.src).toContain('data:image/svg+xml')
  })

  it('generates different images for different usernames', () => {
    const { rerender } = render(<MinidenticonImg username="user1" />)
    const img1 = (screen.getByRole('img') as HTMLImageElement).src

    rerender(<MinidenticonImg username="user2" />)
    const img2 = (screen.getByRole('img') as HTMLImageElement).src

    expect(img1).not.toBe(img2)
  })

  it('generates consistent image for same username', () => {
    const { unmount } = render(<MinidenticonImg username="consistent" />)
    const img1 = (screen.getByRole('img') as HTMLImageElement).src
    unmount()

    render(<MinidenticonImg username="consistent" />)
    const img2 = (screen.getByRole('img') as HTMLImageElement).src

    expect(img1).toBe(img2)
  })

  it('accepts custom saturation and lightness', () => {
    render(<MinidenticonImg lightness={70} saturation={50} username="custom" />)
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('passes through additional HTML img props', () => {
    render(
      <MinidenticonImg
        className="custom-class"
        height={32}
        username="test"
        width={32}
      />
    )
    const img = screen.getByRole('img')

    expect(img).toHaveClass('custom-class')
    expect(img).toHaveAttribute('width', '32')
    expect(img).toHaveAttribute('height', '32')
  })
})
