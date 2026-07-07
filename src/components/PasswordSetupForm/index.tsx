import { Eye, EyeOff, AlertCircle, Loader2, ArrowRight, ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { UseFormReturn, SubmitHandler } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Button, Alert } from '../ui'

export interface PasswordFields {
  password: string
  confirmPassword: string
}

interface PasswordSetupFormProps {
  form: UseFormReturn<PasswordFields>
  onSubmit: SubmitHandler<PasswordFields>
  onBack?: () => void
  isPasswordVisible: boolean
  setIsPasswordVisible: (value: boolean) => void
  errors: string[]
  disabled?: boolean
  isLoading?: boolean
}

const inputCls = `w-full px-4 py-2.5 text-sm rounded-lg border border-border-default/50
  bg-surface-overlay/30 text-white outline-none focus:ring-2 focus:ring-primary/20
  focus:border-primary transition-shadow placeholder:text-content-tertiary
  disabled:opacity-50 disabled:cursor-not-allowed pr-10`

export const PasswordSetupForm = ({
  form,
  onSubmit,
  onBack,
  isPasswordVisible,
  setIsPasswordVisible,
  errors,
  disabled = false,
  isLoading = false,
}: PasswordSetupFormProps) => {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit: SubmitHandler<PasswordFields> = async (data) => {
    if (isSubmitting || disabled || isLoading) return
    setIsSubmitting(true)
    try {
      await onSubmit(data)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isDisabled = disabled || isLoading || isSubmitting

  const EyeToggle = () => (
    <button
      className="absolute right-3 top-1/2 -translate-y-1/2 p-1
                 text-content-secondary hover:text-white rounded-lg
                 hover:bg-surface-high/50 transition-all duration-200
                 disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={isDisabled}
      onClick={() => setIsPasswordVisible(!isPasswordVisible)}
      type="button"
    >
      {isPasswordVisible ? (
        <EyeOff className="w-4 h-4" />
      ) : (
        <Eye className="w-4 h-4" />
      )}
    </button>
  )

  return (
    <div className="w-full">
      <form
        className="space-y-5"
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        {/* Password Field */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-content-secondary">
            {t('components.passwordSetupForm.createPasswordLabel')}
          </label>
          <div className="relative">
            <input
              className={inputCls}
              disabled={isDisabled}
              placeholder={t('components.passwordSetupForm.createPasswordPlaceholder')}
              type={isPasswordVisible ? 'text' : 'password'}
              {...form.register('password', {
                minLength: {
                  message: t('components.passwordSetupForm.passwordMinLength'),
                  value: 8,
                },
                required: t('components.passwordSetupForm.passwordRequired'),
              })}
            />
            <EyeToggle />
          </div>
          {form.formState.errors.password && (
            <p className="text-red-400 text-xs flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        {/* Confirm Password Field */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-content-secondary">
            {t('components.passwordSetupForm.confirmPasswordLabel')}
          </label>
          <div className="relative">
            <input
              className={inputCls}
              disabled={isDisabled}
              placeholder={t('components.passwordSetupForm.confirmPasswordPlaceholder')}
              type={isPasswordVisible ? 'text' : 'password'}
              {...form.register('confirmPassword', {
                minLength: {
                  message: t('components.passwordSetupForm.passwordMinLength'),
                  value: 8,
                },
                required: t('components.passwordSetupForm.passwordConfirmRequired'),
                validate: (value) =>
                  value === form.getValues('password') ||
                  t('components.passwordSetupForm.passwordsDoNotMatch'),
              })}
            />
            <EyeToggle />
          </div>
          {form.formState.errors.confirmPassword && (
            <p className="text-red-400 text-xs flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {form.formState.errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Password Requirements */}
        <div className="bg-surface-overlay/30 p-3 rounded-lg border border-border-default/50">
          <h4 className="text-sm font-medium text-content-secondary mb-2">
            {t('components.passwordSetupForm.requirementsTitle')}
          </h4>
          <ul className="space-y-1 text-xs">
            {[
              {
                label: t('components.passwordSetupForm.requirementMinLength'),
                met: (form.watch('password')?.length ?? 0) >= 8,
              },
              {
                label: t('components.passwordSetupForm.requirementUppercase'),
                met: !!form.watch('password')?.match(/[A-Z]/),
              },
              {
                label: t('components.passwordSetupForm.requirementNumber'),
                met: !!form.watch('password')?.match(/[0-9]/),
              },
              {
                label: t('components.passwordSetupForm.requirementMatch'),
                met:
                  form.watch('password') === form.watch('confirmPassword') &&
                  (form.watch('password')?.length ?? 0) > 0,
              },
            ].map(({ label, met }) => (
              <li className="flex items-center gap-1.5 text-content-secondary" key={label}>
                <span
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    met
                      ? 'bg-green-500 shadow-lg shadow-green-500/50 scale-110'
                      : 'bg-surface-elevated'
                  }`}
                />
                <span className={met ? 'text-green-400' : ''}>{label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Error Display */}
        {errors.length > 0 && (
          <Alert
            icon={<AlertCircle className="w-5 h-5" />}
            title={t('common.error')}
            variant="error"
          >
            <ul className="text-sm space-y-1">
              {errors.map((error, index) => (
                <li className="flex items-center gap-2" key={index}>
                  <span>•</span> {error}
                </li>
              ))}
            </ul>
          </Alert>
        )}

        {/* Footer: Back + Submit */}
        <div className="flex justify-between items-center mt-2">
          {onBack ? (
            <button
              className="px-3 py-2 text-content-secondary hover:text-white transition-colors flex items-center gap-1.5 hover:bg-surface-overlay/50 rounded-lg text-sm"
              onClick={onBack}
              type="button"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
          ) : <span />}
          <Button
            disabled={isDisabled}
            icon={
              isDisabled ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )
            }
            iconPosition="right"
            size="lg"
            type="submit"
            variant="primary"
          >
            {isDisabled
              ? t('components.passwordSetupForm.initializingButton')
              : 'View Recovery Phrase'}
          </Button>
        </div>
      </form>
    </div>
  )
}
