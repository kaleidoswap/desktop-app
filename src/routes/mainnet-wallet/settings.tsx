import { PageHeader } from 'kaleido-ui'
import { useTranslation } from 'react-i18next'

import { ApplicationPreferences } from '../settings/ApplicationPreferences'

export function Component() {
  const { t } = useTranslation()

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <PageHeader title={t('settings.applicationSettings')} variant="page" />
      <ApplicationPreferences />
    </section>
  )
}
