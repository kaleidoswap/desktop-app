import { useTranslation } from 'react-i18next'

export const FormError = () => {
  const { t } = useTranslation()
  return (
    <div className="flex justify-end text-red mt-4">
      {t('orderChannel.formErrors.formSubmissionError')}
    </div>
  )
}
