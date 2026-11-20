import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RelaysModal } from '../RelaysModal'

const invoke = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) =>
      opts?.defaultValue ?? _key,
  }),
}))

const defaults = ['wss://relay.kaleidoswap.com', 'wss://nos.lol']

const open = (onSaved = vi.fn()) => {
  render(
    <RelaysModal
      isOpen
      networkKey="SignetCustom"
      onClose={vi.fn()}
      onSaved={onSaved}
    />
  )
  return onSaved
}

describe('RelaysModal', () => {
  beforeEach(() => {
    invoke.mockReset()
    invoke.mockImplementation(async (cmd: string, args?: unknown) => {
      if (cmd === 'p2p_relays_get') return { custom: null, defaults }
      if (cmd === 'p2p_relays_set') {
        const relays = (args as { relays: string[] | null }).relays
        return { custom: relays, defaults }
      }
      throw new Error(`unexpected ${cmd}`)
    })
  })

  it('shows the defaults and saves an added relay for the network', async () => {
    const onSaved = open()
    expect(await screen.findByText('wss://nos.lol')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('wss://'), {
      target: { value: ' wss://relay.example.com/ ' },
    })
    fireEvent.click(screen.getByText('Add'))
    expect(screen.getByText('wss://relay.example.com')).toBeTruthy()

    fireEvent.click(screen.getByText('Save and restart'))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(invoke).toHaveBeenCalledWith('p2p_relays_set', {
      networkKey: 'SignetCustom',
      relays: [...defaults, 'wss://relay.example.com'],
    })
  })

  it('goes back to the defaults by saving no list of its own', async () => {
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'p2p_relays_get')
        return { custom: ['wss://relay.example.com'], defaults }
      if (cmd === 'p2p_relays_set') return { custom: null, defaults }
      throw new Error(`unexpected ${cmd}`)
    })
    open()
    expect(await screen.findByText('wss://relay.example.com')).toBeTruthy()
    fireEvent.click(screen.getByText('Use the defaults'))
    fireEvent.click(screen.getByText('Save and restart'))
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('p2p_relays_set', {
        networkKey: 'SignetCustom',
        relays: null,
      })
    )
  })

  it('shows why the app refused a relay and keeps the dialog open', async () => {
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'p2p_relays_get') return { custom: null, defaults }
      throw 'wss://127.0.0.1 is on this computer or a private network'
    })
    const onSaved = open()
    await screen.findByText('wss://nos.lol')
    fireEvent.change(screen.getByPlaceholderText('wss://'), {
      target: { value: 'wss://127.0.0.1' },
    })
    fireEvent.click(screen.getByText('Add'))
    fireEvent.click(screen.getByText('Save and restart'))
    expect(
      await screen.findByText(/on this computer or a private network/)
    ).toBeTruthy()
    expect(onSaved).not.toHaveBeenCalled()
  })
})
