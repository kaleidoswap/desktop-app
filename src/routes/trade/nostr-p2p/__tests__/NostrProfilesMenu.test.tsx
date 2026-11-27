import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { i18n } from '../../../../i18n'
import { NostrProfilesMenu } from '../NostrProfilesMenu'
import { nostrProfiles } from '../nostrProfiles'

vi.mock('../nostrProfiles', () => ({
  nostrProfiles: {
    create: vi.fn(),
    forget: vi.fn(),
    list: vi.fn(),
    select: vi.fn(),
  },
}))
const original =
  'npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d'
const added = 'npub1ccz8l9zpa47k6vz9gphftsrumpw80rjt3nhnefat4symjhrsnmjs38mnyd'
const base = {
  active: original,
  profiles: [{ label: null, npub: original }],
  supported: true,
}
beforeEach(async () => {
  vi.clearAllMocks()
  await i18n.changeLanguage('en')
})

it('shows the actual daemon key on legacy versions and leaves identity actions unavailable', async () => {
  vi.mocked(nostrProfiles.list).mockResolvedValue({ ...base, supported: false })
  render(<NostrProfilesMenu npub={original} onSwitched={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Nostr profiles' }))
  const dialog = within(screen.getByRole('dialog'))
  await dialog.findByText('Original profile')
  expect(dialog.getByText(original)).toBeVisible()
  expect(
    dialog.getByRole('button', { name: 'Copy Nostr public key' })
  ).toBeVisible()
  expect(dialog.queryByRole('button', { name: 'Create profile' })).toBeNull()
})

it('creates a named profile separately and refreshes the market only after confirmed activation', async () => {
  const updated = {
    ...base,
    profiles: [...base.profiles, { label: 'Orange', npub: added }],
  }
  vi.mocked(nostrProfiles.list).mockResolvedValue(base)
  vi.mocked(nostrProfiles.create).mockResolvedValue(updated)
  vi.mocked(nostrProfiles.select)
    .mockRejectedValueOnce(new Error('Profile busy'))
    .mockResolvedValueOnce({ ...updated, active: added })
  const refresh = vi.fn()
  render(<NostrProfilesMenu npub={original} onSwitched={refresh} />)
  fireEvent.click(screen.getByRole('button', { name: 'Nostr profiles' }))
  fireEvent.change(
    await screen.findByRole('textbox', { name: 'Profile name' }),
    { target: { value: 'Orange' } }
  )
  fireEvent.click(screen.getByRole('button', { name: 'Create profile' }))
  const switcher = await screen.findByRole('button', { name: 'Use profile' })
  expect(nostrProfiles.create).toHaveBeenCalledWith(original, 'Orange')
  expect(refresh).not.toHaveBeenCalled()
  fireEvent.click(switcher)
  expect(await screen.findByRole('alert')).toHaveTextContent('Profile busy')
  expect(refresh).not.toHaveBeenCalled()
  fireEvent.click(switcher)
  await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce())
  expect(nostrProfiles.select).toHaveBeenCalledWith(original, added)
})

it('confirms before forgetting a secondary inactive key and protects the original', async () => {
  const secondary =
    'npub1lycg5qvjtrp3qjf5f7zl382j9x6nrjz9sdhenvyxq8c3808qxmus6gq266'
  const model = {
    active: added,
    profiles: [
      ...base.profiles,
      { label: 'Orange', npub: added },
      { label: 'Temporary', npub: secondary },
    ],
    supported: true,
  }
  vi.mocked(nostrProfiles.list).mockResolvedValue(model)
  vi.mocked(nostrProfiles.forget).mockResolvedValue({
    ...model,
    profiles: model.profiles.slice(0, 2),
  })
  render(<NostrProfilesMenu npub={added} onSwitched={vi.fn()} />)
  fireEvent.click(
    screen.getByRole('button', { name: i18n.t('p2pMarket.profiles.title') })
  )
  const forget = i18n.t('p2pMarket.profiles.forget')
  await screen.findByText('Temporary')
  expect(screen.getAllByRole('button', { name: forget })).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: forget }))
  const message = i18n.t('p2pMarket.profiles.forgetConfirm', {
    name: 'Temporary',
  })
  expect(await screen.findByText(message)).toBeVisible()
  expect(nostrProfiles.forget).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: i18n.t('common.cancel') }))
  expect(screen.queryByText(message)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: forget }))
  fireEvent.click(
    within(screen.getByRole('group', { name: forget })).getByRole('button', {
      name: forget,
    })
  )
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: forget })).toBeNull()
  )
  expect(nostrProfiles.forget).toHaveBeenCalledWith(added, secondary)
  expect(screen.queryByRole('button', { name: forget })).toBeNull()
  expect(
    screen.getByRole('button', { name: i18n.t('p2pMarket.profiles.switch') })
  ).toBeVisible()
})
