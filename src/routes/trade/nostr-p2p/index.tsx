import { useTranslation } from 'react-i18next'

import { TradeNav } from '../../../components/Trade'

export const Component = () => {
  const { t } = useTranslation()

  return (
    <div className="w-full min-h-full">
      <div className="mx-auto w-full max-w-screen-xl px-4 pt-2">
        <TradeNav />
      </div>
      <div className="flex w-full items-center justify-center py-24">
        <div className="text-center text-2xl font-bold text-content-secondary">
          {t('common.comingSoon')}
        </div>
      </div>
    </div>
  )
}
