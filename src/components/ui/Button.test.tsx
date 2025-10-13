import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Plus } from 'lucide-react'
import { describe, it, expect, vi } from 'vitest'

import { Button, ActionButton, IconButton } from './Button'

describe('Button', () => {
  it('renders with children text', () => {
    render(<Button>Click me</Button>)
    expect(
      screen.getByRole('button', { name: /click me/i })
    ).toBeInTheDocument()
  })

  it('renders with primary variant by default', () => {
    render(<Button>Primary</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-blue-600')
  })

  it('renders with different variants', () => {
    const { rerender } = render(<Button variant="secondary">Secondary</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-slate-700')

    rerender(<Button variant="danger">Danger</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-red/10')

    rerender(<Button variant="success">Success</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-green-600/10')
  })

  it('renders with different sizes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>)
    expect(screen.getByRole('button')).toHaveClass('text-xs')

    rerender(<Button size="md">Medium</Button>)
    expect(screen.getByRole('button')).toHaveClass('text-sm')

    rerender(<Button size="lg">Large</Button>)
    expect(screen.getByRole('button')).toHaveClass('text-base')
  })

  it('handles click events', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    render(<Button onClick={handleClick}>Click me</Button>)
    await user.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('disables button when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)
    const button = screen.getByRole('button')

    expect(button).toBeDisabled()
    expect(button).toHaveClass('opacity-60')
    expect(button).toHaveClass('cursor-not-allowed')
  })

  it('shows loading state', () => {
    render(<Button isLoading>Loading</Button>)
    const button = screen.getByRole('button')

    expect(button).toBeDisabled()
    expect(button.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('renders with icon on left side', () => {
    render(
      <Button icon={<Plus data-testid="icon" />} iconPosition="left">
        With Icon
      </Button>
    )

    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('renders with icon on right side', () => {
    render(
      <Button icon={<Plus data-testid="icon" />} iconPosition="right">
        With Icon
      </Button>
    )

    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('hides icon when loading', () => {
    render(
      <Button icon={<Plus data-testid="icon" />} isLoading>
        Loading
      </Button>
    )

    expect(screen.queryByTestId('icon')).not.toBeInTheDocument()
  })

  it('renders full width when fullWidth is true', () => {
    render(<Button fullWidth>Full Width</Button>)
    expect(screen.getByRole('button')).toHaveClass('w-full')
  })

  it('applies custom className', () => {
    render(<Button className="custom-class">Custom</Button>)
    expect(screen.getByRole('button')).toHaveClass('custom-class')
  })
})

describe('ActionButton', () => {
  it('renders with default blue color', () => {
    render(<ActionButton>Action</ActionButton>)
    expect(screen.getByRole('button')).toHaveClass('bg-blue-darker')
  })

  it('renders with different colors', () => {
    const { rerender } = render(<ActionButton color="cyan">Cyan</ActionButton>)
    expect(screen.getByRole('button')).toHaveClass('border-cyan/10')

    rerender(<ActionButton color="red">Red</ActionButton>)
    expect(screen.getByRole('button')).toHaveClass('border-red/10')

    rerender(<ActionButton color="purple">Purple</ActionButton>)
    expect(screen.getByRole('button')).toHaveClass('border-purple/10')
  })

  it('handles click events', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    render(<ActionButton onClick={handleClick}>Action</ActionButton>)
    await user.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})

describe('IconButton', () => {
  it('renders with icon only', () => {
    render(
      <IconButton aria-label="Add" icon={<Plus data-testid="plus-icon" />} />
    )

    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getByTestId('plus-icon')).toBeInTheDocument()
  })

  it('renders with different sizes', () => {
    const { rerender } = render(
      <IconButton aria-label="Add" icon={<Plus />} size="sm" />
    )
    expect(screen.getByRole('button')).toHaveClass('p-1')

    rerender(<IconButton aria-label="Add" icon={<Plus />} size="md" />)
    expect(screen.getByRole('button')).toHaveClass('p-1.5')

    rerender(<IconButton aria-label="Add" icon={<Plus />} size="lg" />)
    expect(screen.getByRole('button')).toHaveClass('p-2')
  })

  it('renders with different variants', () => {
    const { rerender } = render(
      <IconButton aria-label="Add" icon={<Plus />} variant="ghost" />
    )
    expect(screen.getByRole('button')).toHaveClass('hover:bg-slate-700/50')

    rerender(<IconButton aria-label="Add" icon={<Plus />} variant="primary" />)
    expect(screen.getByRole('button')).toHaveClass('bg-blue-500/10')
  })

  it('handles click events', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    render(
      <IconButton aria-label="Add" icon={<Plus />} onClick={handleClick} />
    )
    await user.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
