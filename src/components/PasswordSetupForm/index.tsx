import { Eye, EyeOff, AlertCircle, Loader2, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { UseFormReturn, SubmitHandler } from 'react-hook-form'

import { Button, Card, Alert } from '../ui'

export interface PasswordFields {
  password: string
  confirmPassword: string
}

interface PasswordSetupFormProps {
  form: UseFormReturn<PasswordFields>
  onSubmit: SubmitHandler<PasswordFields>
  isPasswordVisible: boolean
  setIsPasswordVisible: (value: boolean) => void
  errors: string[]
  disabled?: boolean
  isLoading?: boolean
}

export const PasswordSetupForm = ({
  form,
  onSubmit,
  isPasswordVisible,
  setIsPasswordVisible,
  errors,
  disabled = false,
  isLoading = false,
}: PasswordSetupFormProps) => {
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

  return (
    <div className="w-full">
      <p className="text-slate-400 mb-6 leading-relaxed">
        Set a strong password to secure your node. This password will be
        required to access your wallet.
      </p>

      {/* Form Section */}
      <Card
        className={`p-6 bg-blue-dark/40 border transition-all duration-500 relative overflow-hidden ${
          isDisabled
            ? 'opacity-75 pointer-events-none border-cyan-500/30'
            : 'border-white/5'
        }`}
      >
        {isDisabled && (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-cyan-500/10 to-blue-500/5 animate-pulse rounded-lg" />
        )}
        <form
          className="space-y-5 relative z-10"
          onSubmit={form.handleSubmit(handleSubmit)}
        >
          {/* Password Field */}
          <div className="transition-all duration-300">
            <label className="block text-sm font-medium text-slate-300 mb-1.5 transition-opacity duration-300">
              Create Password
            </label>
            <div className="relative group">
              <input
                className="w-full px-4 py-2.5 rounded-lg border-2 border-slate-700/50 
                          bg-slate-800/30 text-slate-300 
                          focus:border-cyan focus:ring-2 focus:ring-cyan/20 
                          outline-none transition-all duration-300 placeholder:text-slate-600
                          disabled:opacity-50 disabled:cursor-not-allowed
                          hover:border-slate-600/70"
                disabled={isDisabled}
                placeholder="Enter a strong password"
                type={isPasswordVisible ? 'text' : 'password'}
                {...form.register('password', {
                  minLength: {
                    message: 'Password must be at least 8 characters',
                    value: 8,
                  },
                  required: 'Password is required',
                })}
              />
              {isDisabled && (
                <div
                  className="absolute inset-0 rounded-lg pointer-events-none animate-shimmer-gradient"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent)',
                    backgroundSize: '200% 100%',
                  }}
                />
              )}
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1
                           text-slate-400 hover:text-white rounded-lg
                           hover:bg-slate-700/50 transition-all duration-200
                           disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isDisabled}
                onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                type="button"
              >
                {isPasswordVisible ? (
                  <EyeOff className="w-4 h-4 transition-transform duration-200" />
                ) : (
                  <Eye className="w-4 h-4 transition-transform duration-200" />
                )}
              </button>
            </div>
            {form.formState.errors.password && (
              <p className="mt-1.5 text-red-400 text-xs flex items-center gap-1.5 animate-in slide-in-from-top-1 duration-200">
                <AlertCircle className="w-3.5 h-3.5" />
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          {/* Confirm Password Field */}
          <div className="transition-all duration-300">
            <label className="block text-sm font-medium text-slate-300 mb-1.5 transition-opacity duration-300">
              Confirm Password
            </label>
            <div className="relative group">
              <input
                className="w-full px-4 py-2.5 rounded-lg border-2 border-slate-700/50 
                          bg-slate-800/30 text-slate-300 
                          focus:border-cyan focus:ring-2 focus:ring-cyan/20 
                          outline-none transition-all duration-300 placeholder:text-slate-600
                          disabled:opacity-50 disabled:cursor-not-allowed
                          hover:border-slate-600/70"
                disabled={isDisabled}
                placeholder="Re-enter your password"
                type={isPasswordVisible ? 'text' : 'password'}
                {...form.register('confirmPassword', {
                  minLength: {
                    message: 'Password must be at least 8 characters',
                    value: 8,
                  },
                  required: 'Password confirmation is required',
                  validate: (value) =>
                    value === form.getValues('password') ||
                    'Passwords do not match',
                })}
              />
              {isDisabled && (
                <div
                  className="absolute inset-0 rounded-lg pointer-events-none animate-shimmer-gradient"
                  style={{
                    animationDelay: '0.5s',
                    background:
                      'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent)',
                    backgroundSize: '200% 100%',
                  }}
                />
              )}
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1
                           text-slate-400 hover:text-white rounded-lg
                           hover:bg-slate-700/50 transition-all duration-200
                           disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isDisabled}
                onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                type="button"
              >
                {isPasswordVisible ? (
                  <EyeOff className="w-4 h-4 transition-transform duration-200" />
                ) : (
                  <Eye className="w-4 h-4 transition-transform duration-200" />
                )}
              </button>
            </div>
            {form.formState.errors.confirmPassword && (
              <p className="mt-1.5 text-red-400 text-xs flex items-center gap-1.5 animate-in slide-in-from-top-1 duration-200">
                <AlertCircle className="w-3.5 h-3.5" />
                {form.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Password Strength Indicator */}
          <div className="bg-slate-800/30 p-3 rounded-lg border border-slate-700/50 transition-all duration-300">
            <h4 className="text-sm font-medium text-slate-300 mb-2">
              Password Requirements:
            </h4>
            <ul className="space-y-1 text-xs">
              <li className="flex items-center gap-1.5 text-slate-400 transition-all duration-300">
                <span
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    form.watch('password')?.length >= 8
                      ? 'bg-green-500 shadow-lg shadow-green-500/50 scale-110'
                      : 'bg-slate-600'
                  }`}
                ></span>
                <span
                  className={
                    form.watch('password')?.length >= 8 ? 'text-green-400' : ''
                  }
                >
                  At least 8 characters
                </span>
              </li>
              <li className="flex items-center gap-1.5 text-slate-400 transition-all duration-300">
                <span
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    form.watch('password')?.match(/[A-Z]/)
                      ? 'bg-green-500 shadow-lg shadow-green-500/50 scale-110'
                      : 'bg-slate-600'
                  }`}
                ></span>
                <span
                  className={
                    form.watch('password')?.match(/[A-Z]/)
                      ? 'text-green-400'
                      : ''
                  }
                >
                  Contains uppercase letter
                </span>
              </li>
              <li className="flex items-center gap-1.5 text-slate-400 transition-all duration-300">
                <span
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    form.watch('password')?.match(/[0-9]/)
                      ? 'bg-green-500 shadow-lg shadow-green-500/50 scale-110'
                      : 'bg-slate-600'
                  }`}
                ></span>
                <span
                  className={
                    form.watch('password')?.match(/[0-9]/)
                      ? 'text-green-400'
                      : ''
                  }
                >
                  Contains number
                </span>
              </li>
              <li className="flex items-center gap-1.5 text-slate-400 transition-all duration-300">
                <span
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    form.watch('password') === form.watch('confirmPassword') &&
                    form.watch('password')?.length > 0
                      ? 'bg-green-500 shadow-lg shadow-green-500/50 scale-110'
                      : 'bg-slate-600'
                  }`}
                ></span>
                <span
                  className={
                    form.watch('password') === form.watch('confirmPassword') &&
                    form.watch('password')?.length > 0
                      ? 'text-green-400'
                      : ''
                  }
                >
                  Passwords match
                </span>
              </li>
            </ul>
          </div>

          {/* Error Display */}
          {errors.length > 0 && (
            <div className="animate-in slide-in-from-top-2 fade-in duration-300">
              <Alert
                icon={<AlertCircle className="w-5 h-5" />}
                title="Error"
                variant="error"
              >
                <ul className="text-sm space-y-1">
                  {errors.map((error, index) => (
                    <li
                      className="flex items-center gap-2 animate-in slide-in-from-left-1 duration-200"
                      key={index}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <span>•</span> {error}
                    </li>
                  ))}
                </ul>
              </Alert>
            </div>
          )}

          {/* Submit Button */}
          <div className="relative">
            <Button
              className={`w-full mt-4 transition-all duration-300 ${
                isDisabled ? 'scale-[0.98]' : 'hover:scale-[1.01]'
              }`}
              disabled={isDisabled}
              icon={
                isDisabled ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                )
              }
              iconPosition="right"
              size="lg"
              type="submit"
              variant="primary"
            >
              {isDisabled ? 'Initializing...' : 'Initialize Node'}
            </Button>
            {isDisabled && (
              <div
                className="absolute inset-0 rounded-lg pointer-events-none animate-shimmer-gradient"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.1), transparent)',
                  backgroundSize: '200% 100%',
                }}
              />
            )}
          </div>
        </form>
      </Card>
    </div>
  )
}
