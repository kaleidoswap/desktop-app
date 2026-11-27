import { invoke } from '@tauri-apps/api/core'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { i18n } from '../../../i18n'
import { memoryWalletStore } from '../../trade/nostr-p2p/__tests__/memoryWalletStore'
import { OnchainSetup } from '../OnchainSetup'
import {
  readPending,
  rememberPending,
  type WalletIdentity,
  type WalletMethod,
} from '../onchain'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

// Public BIP39 test vectors. All wallet and authenticator calls terminate at the mock.
const generated =
  'legal winner thank year wave sausage worth useful legal winner thank yellow'
const recovered =
  'letter advice cage absurd amount doctor acoustic avoid letter advice cage above'
const fingerprints: Record<string, string> = {
  [generated]:
    'ecb0e7ba498c5920991f0b3483e91f7abafa9ecc6bd82a9a51494589592b1a8f',
  [recovered]:
    '3a64bcd9cea43c0aba67ba0bf2ddff8137a492bccbc672107fcbf7381086f698',
}
let webcrypto: Crypto
const credentialId = 'ZGVza3RvcC10ZXN0'
const text = (key: string) => i18n.t(key)
const label = (key: string) => text('onchainSetup.' + key)
const button = (name: string) => screen.getByRole('button', { name })
const ipc = vi.mocked(invoke)
const calls = (command: string) =>
  ipc.mock.calls.filter(([name]) => name === command)
type User = ReturnType<typeof userEvent.setup>
type IpcArgs = Record<string, unknown>
type Handler = (args: IpcArgs) => unknown

function identity(method: WalletMethod, words: string): WalletIdentity {
  return {
    fingerprint: fingerprints[words],
    masterFingerprint: 'beadbead',
    method,
  }
}

function native(overrides: Record<string, Handler> = {}) {
  const handlers: Record<string, Handler> = {
    mainnet_passkey_capability: () => ({ available: true, reason: null }),
    mainnet_passkey_derive: () => ({ credentialId, mnemonic: recovered }),
    mainnet_passkey_register: () => ({ credentialId }),
    mainnet_wallet_create: ({ method, mnemonic }) => ({
      state: 'ready',
      wallet: identity(method as WalletMethod, String(mnemonic)),
    }),
    mainnet_wallet_generate: () => generated,
    ...overrides,
  }
  ipc.mockImplementation(async (command, args) => {
    const handler = handlers[command]
    if (!handler) throw Error('Unexpected native command: ' + command)
    return handler((args ?? {}) as IpcArgs)
  })
}

async function choose(user: User, key: string) {
  const action = await screen.findByRole('button', { name: label(key) })
  await waitFor(() => expect(action).toBeEnabled())
  await user.click(action)
}

function recoveryList() {
  return screen.queryByRole('list', {
    name: text('walletInit.mnemonicStep.title'),
  })
}

function reveal(user: User) {
  return user.click(button(text('walletInit.mnemonicStep.revealTitle')))
}

async function answerQuestions(user: User, words: string, wrongFirst = false) {
  const groups = screen.getAllByRole('group')
  expect(groups).toHaveLength(3)
  for (const [index, group] of groups.entries()) {
    const position = Array.from(
      { length: words.split(' ').length },
      (_, i) => i
    ).find(
      (i) =>
        group.querySelector('legend')?.textContent ===
        i18n.t('mnemonicCheck.word', { number: i + 1 })
    )!
    expect(position).toBeDefined()
    const options = within(group).getAllByRole('radio') as HTMLInputElement[]
    expect(options).toHaveLength(3)
    const correct = words.split(' ')[position]
    const option = options.find((radio) => {
      const word = radio.labels![0].textContent!.trim()
      return wrongFirst && index === 0 ? word !== correct : word === correct
    })!
    await user.click(option)
  }
}

beforeAll(async () => {
  const nativeCrypto = await vi.importActual<{ webcrypto: Crypto }>(
    'node:crypto'
  )
  webcrypto = nativeCrypto.webcrypto
  await i18n.changeLanguage('it')
})
beforeEach(() => {
  ipc.mockReset()
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal('localStorage', memoryWalletStore())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('mainnet wallet onboarding', () => {
  it('reveals the generated phrase on demand and creates the wallet only after the multiple-choice check succeeds', async () => {
    native()
    const user = userEvent.setup()
    const onReady = vi.fn()
    render(<OnchainSetup onReady={onReady} wallet={null} />)
    await choose(user, 'createPhrase')
    expect(recoveryList()).toBeNull()
    const verifyLabel = text('walletInit.mnemonicStep.verifyButton')
    expect(button(verifyLabel)).toBeDisabled()
    await reveal(user)
    expect(within(recoveryList()!).getAllByRole('listitem')).toHaveLength(12)
    await user.click(button(verifyLabel))
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(button(label('finish'))).toBeDisabled()
    await answerQuestions(user, generated, true)
    await choose(user, 'finish')
    expect(screen.getByRole('alert')).toHaveTextContent(
      text('mnemonicCheck.mismatch')
    )
    expect(calls('mainnet_wallet_create')).toHaveLength(0)
    await user.click(button(text('common.back')))
    expect(recoveryList()).toBeNull()
    await user.click(button(verifyLabel))
    expect(screen.queryByRole('radio', { checked: true })).toBeNull()
    await answerQuestions(user, generated)
    await user.dblClick(button(label('finish')))
    expect(calls('mainnet_wallet_create')).toEqual([
      ['mainnet_wallet_create', { method: 'mnemonic', mnemonic: generated }],
    ])
    expect(onReady).toHaveBeenCalledExactlyOnceWith(
      identity('mnemonic', generated)
    )
  })

  it('keeps restore explicit, clears the input on Back and reports an invalid phrase without replacing it', async () => {
    native({
      mainnet_wallet_create: ({ mnemonic }) => {
        if (mnemonic !== recovered) throw 'invalid_mnemonic'
        return { state: 'ready', wallet: identity('mnemonic', recovered) }
      },
    })
    const user = userEvent.setup()
    const onReady = vi.fn()
    render(<OnchainSetup onReady={onReady} wallet={null} />)
    await choose(user, 'restore')
    expect(button(text('common.import'))).toBeDisabled()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'wrong' } })
    await user.click(button(text('common.import')))
    expect(await screen.findByRole('alert')).toHaveTextContent(label('invalid'))
    expect(input).toHaveValue('wrong')
    expect(onReady).not.toHaveBeenCalled()
    await user.click(button(text('common.back')))
    await choose(user, 'restore')
    expect(screen.getByRole('textbox')).toHaveValue('')
    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: '  ' + recovered.toUpperCase().replace(' ', '\n') + ' ',
      },
    })
    await user.click(button(text('common.import')))
    expect(calls('mainnet_wallet_create').at(-1)).toEqual([
      'mainnet_wallet_create',
      { method: 'mnemonic', mnemonic: recovered },
    ])
    expect(calls('mainnet_wallet_generate')).toHaveLength(0)
    expect(onReady).toHaveBeenCalledExactlyOnceWith(
      identity('mnemonic', recovered)
    )
  })

  it('leaves mnemonic creation and import available when the native passkey capability is unavailable', async () => {
    native({
      mainnet_passkey_capability: () => ({
        available: false,
        reason: 'passkey_unsupported_platform',
      }),
    })
    render(<OnchainSetup onReady={vi.fn()} wallet={null} />)
    expect(await screen.findByText(label('unavailable'))).toBeVisible()
    expect(button(label('createPasskey'))).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: label('recoverPasskey') })
    ).toBeNull()
    expect(button(label('createPhrase'))).toBeEnabled()
    expect(button(label('restore'))).toBeEnabled()
    expect(ipc.mock.calls).toEqual([['mainnet_passkey_capability']])
  })

  it('cancels registration without creating a wallet, generating a phrase or recording a credential', async () => {
    native({
      mainnet_passkey_register: () => {
        throw 'passkey_cancelled'
      },
    })
    const user = userEvent.setup()
    const onReady = vi.fn()
    render(<OnchainSetup onReady={onReady} wallet={null} />)
    await choose(user, 'createPasskey')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      label('cancelled')
    )
    expect(ipc.mock.calls).toEqual([
      ['mainnet_passkey_capability'],
      ['mainnet_passkey_register'],
    ])
    expect(readPending()).toBeNull()
    expect(onReady).not.toHaveBeenCalled()
  })

  it('resumes a pending registration and rejects unsupported PRF or an unexpected credential without falling back', async () => {
    const responses = vi
      .fn()
      .mockRejectedValueOnce('passkey_prf_unsupported')
      .mockResolvedValueOnce({ credentialId: 'b3RoZXI', mnemonic: recovered })
      .mockResolvedValue({ credentialId, mnemonic: recovered })
    native({ mainnet_passkey_derive: responses })
    const storeWrite = vi.spyOn(localStorage, 'setItem')
    const user = userEvent.setup()
    const onReady = vi.fn()
    const first = render(<OnchainSetup onReady={onReady} wallet={null} />)
    await choose(user, 'createPasskey')
    expect(readPending()).toBe(credentialId)
    first.unmount()
    render(<OnchainSetup onReady={onReady} wallet={null} />)
    await choose(user, 'resume')
    await choose(user, 'usePasskey')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      label('unsupported')
    )
    await choose(user, 'usePasskey')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      label('wrongKey')
    )
    expect(readPending()).toBe(credentialId)
    expect(calls('mainnet_wallet_create')).toHaveLength(0)
    expect(calls('mainnet_wallet_generate')).toHaveLength(0)
    expect(recoveryList()).toBeNull()
    await choose(user, 'usePasskey')
    expect(recoveryList()).toBeNull()
    expect(button(label('finish'))).toBeDisabled()
    await reveal(user)
    const savedWords = within(recoveryList()!)
      .getAllByRole('listitem')
      .map((li) => li.lastChild?.textContent)
    expect(savedWords.join(' ')).toBe(recovered)
    expect(calls('mainnet_wallet_create')).toHaveLength(0)
    await choose(user, 'finish')
    expect(calls('mainnet_passkey_register')).toHaveLength(1)
    expect(responses.mock.calls).toEqual([
      [{ credentialId }],
      [{ credentialId }],
      [{ credentialId }],
    ])
    expect(onReady).toHaveBeenCalledExactlyOnceWith(
      identity('passkey', recovered)
    )
    expect(readPending()).toBeNull()
    expect(storeWrite.mock.calls.map(([, value]) => value)).toEqual([
      credentialId,
    ])
  })

  it('can explicitly forget an unfinished setup and recover a discoverable passkey with no stored credential ID', async () => {
    rememberPending(credentialId)
    native()
    const user = userEvent.setup()
    const onReady = vi.fn()
    render(<OnchainSetup onReady={onReady} wallet={null} />)
    await choose(user, 'resume')
    await user.click(button(text('common.back')))
    expect(readPending()).toBe(credentialId)
    await choose(user, 'forgetPending')
    expect(readPending()).toBeNull()
    await choose(user, 'recoverPasskey')
    expect(calls('mainnet_passkey_register')).toHaveLength(0)
    expect(calls('mainnet_passkey_derive')).toEqual([
      ['mainnet_passkey_derive', { credentialId: null }],
    ])
    await reveal(user)
    await choose(user, 'finish')
    expect(onReady).toHaveBeenCalledExactlyOnceWith(
      identity('passkey', recovered)
    )
  })

  it('allows a different recovery method when the selected passkey came from a legacy test', async () => {
    native({
      mainnet_passkey_derive: () => Promise.reject('passkey_legacy_test'),
    })
    const user = userEvent.setup()
    render(<OnchainSetup onReady={vi.fn()} wallet={null} />)
    await choose(user, 'recoverPasskey')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      label('legacyKey')
    )
    expect(calls('mainnet_wallet_create')).toHaveLength(0)
    await choose(user, 'restore')
    expect(screen.getByRole('textbox')).toBeEmptyDOMElement()
  })

  it('exports only a phrase matching the current wallet fingerprint and hides it when the window loses focus', async () => {
    const derive = vi
      .fn()
      .mockResolvedValueOnce({ credentialId, mnemonic: generated })
      .mockResolvedValueOnce({ credentialId, mnemonic: recovered })
    native({ mainnet_passkey_derive: derive })
    const user = userEvent.setup()
    const onReady = vi.fn()
    render(
      <OnchainSetup onReady={onReady} wallet={identity('passkey', recovered)} />
    )
    await choose(user, 'export')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      label('wrongKey')
    )
    expect(recoveryList()).toBeNull()
    await choose(user, 'export')
    const list = await screen.findByRole('list', {
      name: text('walletInit.mnemonicStep.title'),
    })
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.lastChild?.textContent)
        .join(' ')
    ).toBe(recovered)
    fireEvent(window, new Event('blur'))
    expect(recoveryList()).toBeNull()
    await user.click(button(text('common.close')))
    expect(button(label('export'))).toBeEnabled()
    expect(calls('mainnet_wallet_create')).toHaveLength(0)
    expect(onReady).not.toHaveBeenCalled()
  })
})
