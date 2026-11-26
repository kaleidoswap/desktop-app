import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { i18n } from '../../../i18n'
import { WalletSetup } from '../../../routes/trade/nostr-p2p/WalletSetup'
import { MnemonicVerifyForm } from '..'

const phrase =
  'north north south east west west south east south south north west'
const words = phrase.split(' ')

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

function wordPosition(group: HTMLElement) {
  return (
    Number(group.querySelector('legend')!.textContent!.replace(/\D/g, '')) - 1
  )
}

async function answer(
  user: ReturnType<typeof userEvent.setup>,
  group: HTMLElement,
  correct = true
) {
  const expected = words[wordPosition(group)]
  const options = within(group).getAllByRole('radio') as HTMLInputElement[]
  const option = options.find((radio) => {
    const word = radio.labels![0].textContent?.trim()
    return correct ? word === expected : word !== expected
  })!
  await user.click(option)
}

describe('recovery phrase multiple choice', () => {
  it('uses three different words from the phrase at each distinct position, including with repeated words or random draws', () => {
    const rng = vi
      .spyOn(crypto, 'getRandomValues')
      .mockImplementation((array) => {
        ;(array as Uint32Array).fill(0)
        return array
      })
    try {
      const props = { onBack: vi.fn(), onVerified: vi.fn(), phrase }
      const { rerender } = render(<MnemonicVerifyForm {...props} />)
      const groups = screen.getAllByRole('group')
      expect(groups).toHaveLength(3)
      const positions = groups.map(wordPosition)
      expect(new Set(positions).size).toBe(3)
      expect(positions).toEqual([...positions].sort((a, b) => a - b))
      for (const group of groups) {
        const options = within(group).getAllByRole(
          'radio'
        ) as HTMLInputElement[]
        const labels = options.map((radio) =>
          radio.labels![0].textContent!.trim()
        )
        expect(labels).toHaveLength(3)
        expect(new Set(labels).size).toBe(3)
        expect(labels.every((w) => words.includes(w))).toBe(true)
        expect(labels).toContain(words[wordPosition(group)])
      }
      const draws = rng.mock.calls.length
      expect(draws).toBeGreaterThan(0)
      rerender(<MnemonicVerifyForm {...props} submitLabel="Open wallet" />)
      expect(rng).toHaveBeenCalledTimes(draws)
      expect(screen.queryByRole('textbox')).toBeNull()
      rerender(<MnemonicVerifyForm {...props} wordCount="all" />)
      expect(screen.getAllByRole('group').map(wordPosition)).toEqual(
        words.map((_, index) => index)
      )
    } finally {
      rng.mockRestore()
    }
  })

  it('requires every correct answer, allows correction, and submits a completed verification only once', async () => {
    const user = userEvent.setup()
    let finish!: () => void
    const onVerified = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    render(
      <MnemonicVerifyForm
        onBack={vi.fn()}
        onVerified={onVerified}
        phrase={phrase}
      />
    )
    const groups = screen.getAllByRole('group')
    const confirm = screen.getByRole('button', { name: 'Confirm' })
    await answer(user, groups[0], false)
    expect(confirm).toBeDisabled()
    for (const group of groups.slice(1)) await answer(user, group)
    await user.click(confirm)
    expect(screen.getByRole('alert')).toHaveTextContent(/incorrect/i)
    expect(onVerified).not.toHaveBeenCalled()
    await answer(user, groups[0])
    await user.dblClick(confirm)
    expect(confirm).toBeDisabled()
    expect(onVerified).toHaveBeenCalledTimes(1)
    finish()
    await user.click(confirm)
    expect(onVerified).toHaveBeenCalledTimes(1)
  })

  it('keeps answers on ordinary rerender and clears them when given a new phrase', async () => {
    const user = userEvent.setup()
    const onVerified = vi.fn()
    const onBack = vi.fn()
    const { rerender } = render(
      <MnemonicVerifyForm
        onBack={onBack}
        onVerified={onVerified}
        phrase={phrase}
      />
    )
    await answer(user, screen.getAllByRole('group')[0])
    rerender(
      <MnemonicVerifyForm
        onBack={onBack}
        onVerified={onVerified}
        phrase={phrase}
      />
    )
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1)
    rerender(
      <MnemonicVerifyForm
        onBack={onBack}
        onVerified={onVerified}
        phrase="red green blue yellow"
      />
    )
    expect(screen.queryByRole('radio', { checked: true })).toBeNull()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(onVerified).not.toHaveBeenCalled()
  })

  it('allows another submission after a transient failure', async () => {
    const user = userEvent.setup()
    const onVerified = vi
      .fn()
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValueOnce(false)
      .mockResolvedValue(undefined)
    render(
      <MnemonicVerifyForm
        onBack={vi.fn()}
        onVerified={onVerified}
        phrase={phrase}
      />
    )
    for (const group of screen.getAllByRole('group')) await answer(user, group)
    const confirm = screen.getByRole('button', { name: 'Confirm' })
    await user.click(confirm)
    expect(await screen.findByRole('alert')).toHaveTextContent(/error/i)
    await user.click(confirm)
    expect(confirm).toBeEnabled()
    await user.click(confirm)
    expect(onVerified).toHaveBeenCalledTimes(3)
  })

  it('keeps restoration separate and accepts the user’s own recovery phrase', async () => {
    const user = userEvent.setup()
    const restoreWallet = vi.fn()
    const generate = vi.fn()
    render(
      <WalletSetup
        generate={generate}
        networkLabel="Signet"
        onComplete={restoreWallet}
        startWithRestore
      />
    )
    expect(screen.queryByRole('radio')).toBeNull()
    await user.type(screen.getByRole('textbox'), phrase.toUpperCase())
    await user.click(screen.getByRole('button', { name: 'Restore wallet' }))
    await waitFor(() =>
      expect(restoreWallet).toHaveBeenCalledExactlyOnceWith(phrase)
    )
    expect(generate).not.toHaveBeenCalled()
  })

  it('can return to generate a fresh trading-wallet phrase when three distinct choices are impossible', async () => {
    const user = userEvent.setup()
    const generate = vi
      .fn()
      .mockResolvedValueOnce('north north west north')
      .mockResolvedValueOnce(phrase)
    const createWallet = vi.fn()
    render(
      <WalletSetup
        generate={generate}
        networkLabel="Signet"
        onComplete={createWallet}
      />
    )
    await user.click(
      screen.getByRole('button', { name: /create a new wallet/i })
    )
    await user.click(
      await screen.findByRole('button', { name: /written it down/i })
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      /three different words/i
    )
    expect(screen.getByRole('button', { name: 'Create wallet' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(
      screen.getByRole('button', { name: /create a new wallet/i })
    )
    await user.click(
      await screen.findByRole('button', { name: /written it down/i })
    )
    for (const group of screen.getAllByRole('group')) await answer(user, group)
    expect(createWallet).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Create wallet' }))
    await waitFor(() =>
      expect(createWallet).toHaveBeenCalledExactlyOnceWith(phrase)
    )
  })
})
