import { useTranslation } from 'react-i18next'

export const Component = () => {
  const { t } = useTranslation()

  return (
    <div className="container mx-auto w-full flex items-center justify-center">
      {/* cooming soon */}
      <div className="text-center text-2xl font-bold">
        {t('common.comingSoon')}
      </div>
    </div>
  )
}
