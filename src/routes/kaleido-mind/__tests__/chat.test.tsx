import { act, fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Component as Layout } from '../index'
import { Component as Chat } from '../chat'

const mock = vi.hoisted(() => ({
  mind: {
    cancelChat: vi.fn(async () => {}),
    chat: vi.fn(),
    clearChat: vi.fn(async () => {}),
    runtimeInstalled: true,
    runtimeProgress: null,
    status: { on: true },
  },
}))
vi.mock('../../../hooks/useMind', () => ({ useMind: () => mock.mind }))
vi.mock('../../../api/mind', () => ({ mindClient: { on: () => () => {} } }))
vi.mock('../../../app/store/hooks', () => ({ useAppSelector: () => true }))
vi.mock('../thinking-toggle', () => ({ ThinkingToggle: () => null }))
vi.mock('../start-brain-modal', () => ({ StartBrainModal: () => null }))
vi.mock('../welcome-actions', () => ({
  FollowupActions: () => null,
  WelcomeActions: () => null,
}))
vi.mock('../cards', () => ({ ToolEventView: () => null, fmtSats: () => '' }))
beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => data.set(key, value)),
  })
  vi.clearAllMocks()
})

function renderChat() {
  return render(
    <MemoryRouter initialEntries={['/kaleido-mind']}>
      <Link to="/kaleido-mind">Chat tab</Link>
      <Link to="/kaleido-mind/brain">Brain tab</Link>
      <Routes>
        <Route element={<Layout />} path="kaleido-mind">
          <Route element={<Chat />} index />
          <Route element={<p>Brain panel</p>} path="brain" />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('Mind chat navigation', () => {
  it('clears provider context before clearing the visible conversation', async () => {
    mock.mind.chat.mockResolvedValueOnce({ text: 'previous answer' })
    renderChat()
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'hello' },
    })
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    )
    mock.mind.clearChat.mockRejectedValueOnce(new Error('offline'))
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
    )
    expect(screen.getByText('previous answer')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Could not clear')
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
    )
    expect(mock.mind.clearChat).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('previous answer')).not.toBeInTheDocument()
  })

  it('flushes the last message on leaving Mind before the persistence debounce', async () => {
    mock.mind.chat.mockResolvedValueOnce({ text: 'hello back' })
    const view = renderChat()
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'hello' },
    })
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    )
    view.unmount()
    expect(
      JSON.parse(localStorage.getItem('kaleido-mind.chat-history.v1')!)
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ text: 'hello back' })])
    )
  })
  it('keeps chat usable when storage is full', async () => {
    vi.mocked(localStorage.setItem).mockImplementation(() => {
      throw new Error('quota')
    })
    mock.mind.chat.mockResolvedValueOnce({ text: 'hello back' })
    const view = renderChat()
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'hello' },
    })
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    )
    expect(screen.getByText('hello back')).toBeInTheDocument()
    expect(() => view.unmount()).not.toThrow()
  })
  it('keeps the active response stoppable across tabs and blocks clearing it', async () => {
    let finish!: (value: { text: string }) => void
    mock.mind.chat.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    renderChat()
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'hello' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    fireEvent.click(screen.getByRole('link', { name: 'Brain tab' }))
    fireEvent.click(screen.getByRole('link', { name: 'Chat tab' }))
    expect(
      screen.getByRole('button', { name: 'Stop KaleidoMind' })
    ).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled()
    expect(
      screen
        .getAllByRole('button', { name: 'New chat' })
        .every((button) => button.hasAttribute('disabled'))
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Stop KaleidoMind' }))
    expect(mock.mind.cancelChat).toHaveBeenCalledWith(
      mock.mind.chat.mock.calls[0][2]
    )
    await act(async () => finish({ text: 'Stopped.' }))
    expect(
      screen.getByRole('button', { name: 'Send message' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeEnabled()
  })
})
