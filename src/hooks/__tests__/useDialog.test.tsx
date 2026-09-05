import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { useDialog } from '../useDialog'

const Dialog = ({
  onClose,
  dismissable = true,
  children,
}: {
  onClose: () => void
  dismissable?: boolean
  children?: React.ReactNode
}) => {
  const { dialogRef, dialogProps } = useDialog({ dismissable, onClose })
  return (
    <div data-testid="dialog" ref={dialogRef} {...dialogProps}>
      <button>first</button>
      {children}
      <button>last</button>
    </div>
  )
}

const Harness = ({ dismissable }: { dismissable?: boolean }) => {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(true)}>trigger</button>
      <button>elsewhere</button>
      {open && (
        <Dialog dismissable={dismissable} onClose={() => setOpen(false)} />
      )}
    </div>
  )
}

describe('useDialog', () => {
  it('exposes dialog semantics and moves focus into the dialog', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('trigger'))

    const dialog = screen.getByTestId('dialog')
    expect(dialog).toHaveAttribute('role', 'dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('first')).toHaveFocus()
  })

  it('closes on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('trigger'))
    expect(screen.getByTestId('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('trigger')).toHaveFocus()
  })

  it('ignores Escape while not dismissable', async () => {
    const user = userEvent.setup()
    render(<Harness dismissable={false} />)
    await user.click(screen.getByText('trigger'))
    await user.keyboard('{Escape}')
    expect(screen.getByTestId('dialog')).toBeInTheDocument()
  })

  it('keeps Tab and Shift+Tab inside the dialog', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('trigger'))

    await user.tab()
    expect(screen.getByText('last')).toHaveFocus()
    await user.tab()
    expect(screen.getByText('first')).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByText('last')).toHaveFocus()
  })

  it('only the innermost dialog reacts to Escape', () => {
    const outerClose = vi.fn()
    const innerClose = vi.fn()
    render(
      <Dialog onClose={outerClose}>
        <Dialog onClose={innerClose} />
      </Dialog>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(innerClose).toHaveBeenCalledTimes(1)
    expect(outerClose).not.toHaveBeenCalled()
  })
})
