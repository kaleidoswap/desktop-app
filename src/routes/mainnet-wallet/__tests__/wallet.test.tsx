import { invoke } from '@tauri-apps/api/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'

import { P2P_BALANCE_PATH } from '../../../app/router/paths'
import { Activity, Component } from '..'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

afterEach(() => vi.resetAllMocks())

it('keeps mainnet separate from the test wallet until the user changes network', async () => {
  vi.mocked(invoke).mockResolvedValue('not_bundled')
  render(<Component />, { wrapper: MemoryRouter })
  expect(await screen.findByText('mainnetWallet.unavailable')).toBeVisible()
  expect(screen.getByRole('link')).toHaveAttribute('href', P2P_BALANCE_PATH)
  expect(vi.mocked(invoke).mock.calls).toEqual([['mainnet_wallet_status']])
})

it('rechecks a failed capability query without displaying test history on mainnet', async () => {
  vi.mocked(invoke)
    .mockRejectedValueOnce(new Error('IPC unavailable'))
    .mockResolvedValueOnce('not_bundled')
  render(<Activity />, { wrapper: MemoryRouter })
  fireEvent.click(
    await screen.findByRole('button', { name: 'mainnetWallet.retry' })
  )
  expect(await screen.findByText('mainnetWallet.historyHint')).toBeVisible()
  expect(vi.mocked(invoke).mock.calls).toEqual([
    ['mainnet_wallet_status'],
    ['mainnet_wallet_status'],
  ])
})
