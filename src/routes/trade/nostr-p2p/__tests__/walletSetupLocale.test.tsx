import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { i18n, LANGUAGES } from '../../../../i18n'
import { WalletSetup } from '../WalletSetup'

const prefix = 'p2pMarket.market.setup'
const renderSetup = (walletLabel?: string) =>
  render(
    <WalletSetup
      generate={async () =>
        Array.from({ length: 12 }, (_, i) => `test-${i}`).join(' ')
      }
      networkLabel="Mutinynet"
      onComplete={vi.fn()}
      walletLabel={walletLabel}
    />
  )

it.each(Object.keys(LANGUAGES))(
  'uses %s throughout the setup and restore screens',
  async (language) => {
    await i18n.changeLanguage(language)
    const t = i18n.getFixedT(language, 'translation', prefix)
    renderSetup()

    expect(screen.getByRole('heading', { name: t('title') })).toBeVisible()
    expect(screen.getByText(t('body', { network: 'Mutinynet' }))).toBeVisible()
    const steps = within(
      screen.getByRole('list', { name: t('gettingStarted') })
    )
    expect(
      steps.getAllByRole('listitem').map((item) => item.textContent)
    ).toEqual([
      `1 · ${t('stepCreate')}`,
      `2 · ${t('stepFund')}`,
      `3 · ${t('stepOffer')}`,
    ])
    fireEvent.click(screen.getByText(t('restore')))
    expect(
      screen.getByRole('heading', { name: t('restoreTitle') })
    ).toBeVisible()
    expect(screen.getByPlaceholderText(t('restorePlaceholder'))).toBeVisible()
    expect(screen.getByText(t('wordCount', { n: 0 }))).toBeVisible()
  }
)

it('preserves the custom name and translates the BTC/RGB recovery instructions and word prompts', async () => {
  await i18n.changeLanguage('it')
  const t = i18n.getFixedT('it', 'translation', prefix)
  renderSetup('Cold desk')
  expect(
    screen.getByRole('heading', { name: 'Configura Cold desk' })
  ).toBeVisible()
  fireEvent.click(screen.getByText(t('create')))
  expect(await screen.findByText(t('assetsNote'))).toHaveTextContent(
    /bitcoin.*RGB/
  )
  fireEvent.click(screen.getByRole('button', { name: t('written') }))
  const groups = screen.getAllByRole('group', { name: /^Parola.*\d+/i })
  expect(groups).toHaveLength(3)
  for (const group of groups) {
    expect(within(group).getAllByRole('radio')).toHaveLength(3)
  }
})
