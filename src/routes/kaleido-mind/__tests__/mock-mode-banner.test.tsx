import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MockModeBanner } from '../mock-mode-banner'

describe('MockModeBanner', () => {
  it('warns loudly when the provider runs in mock mode', () => {
    const onDownload = vi.fn()
    render(<MockModeBanner device="mock" onDownload={onDownload} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/Mock mode/)
    expect(screen.getByRole('alert')).toHaveTextContent(/Answers are fake/)
    expect(screen.queryByRole('button', { name: /dismiss|close/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Download runtime/ }))
    expect(onDownload).toHaveBeenCalledOnce()
  })

  it.each(['gpu', 'cpu', null, undefined] as const)(
    'renders nothing for device %s',
    (device) => {
      const { container } = render(
        <MockModeBanner device={device} onDownload={() => {}} />
      )
      expect(container).toBeEmptyDOMElement()
    }
  )
})
