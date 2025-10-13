import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { FormError } from './FormError'

describe('FormError', () => {
  it('renders error message', () => {
    render(<FormError />)
    expect(
      screen.getByText('There was an error submitting the form.')
    ).toBeInTheDocument()
  })

  it('has correct styling classes', () => {
    const { container } = render(<FormError />)
    const errorDiv = container.querySelector('.text-red')
    expect(errorDiv).toBeInTheDocument()
    expect(errorDiv).toHaveClass('flex', 'justify-end', 'mt-4')
  })
})
