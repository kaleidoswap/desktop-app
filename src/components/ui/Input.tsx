import React, { InputHTMLAttributes, ReactNode, forwardRef } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode
  iconPosition?: 'left' | 'right'
  error?: boolean
  className?: string
  suffixNode?: ReactNode
  prefixNode?: ReactNode
}

/**
 * Standard input component
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      icon,
      iconPosition = 'left',
      error = false,
      className = '',
      suffixNode,
      prefixNode,
      ...props
    },
    ref
  ) => {
    const baseStyles = `
      border rounded-lg bg-surface-overlay/30 px-4 py-3 w-full outline-none
      focus:ring-2 transition-shadow
    `

    const stateStyles = error
      ? 'border-red/50 focus:ring-red/20 text-white'
      : 'border-border-default/50 focus:ring-primary/20 focus:border-cyan text-white'

    const paddingLeft =
      prefixNode || (icon && iconPosition === 'left') ? 'pl-10' : ''
    const paddingRight =
      suffixNode || (icon && iconPosition === 'right') ? 'pr-10' : ''

    return (
      <div className="relative">
        {prefixNode && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-content-secondary">
            {prefixNode}
          </div>
        )}

        {icon && iconPosition === 'left' && !prefixNode && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-content-secondary">
            {icon}
          </div>
        )}

        <input
          className={`${baseStyles} ${stateStyles} ${paddingLeft} ${paddingRight} ${className}`}
          ref={ref}
          {...props}
        />

        {suffixNode && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-content-secondary">
            {suffixNode}
          </div>
        )}

        {icon && iconPosition === 'right' && !suffixNode && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-content-secondary">
            {icon}
          </div>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

/**
 * Password input with toggle visibility button
 */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputProps, 'type'> & {
    isVisible: boolean
    onToggleVisibility: () => void
  }
>(({ isVisible, onToggleVisibility, className = '', ...props }, ref) => {
  return (
    <Input
      ref={ref}
      suffixNode={
        <button
          className="p-1 hover:bg-surface-high/50 rounded-md transition-colors"
          onClick={onToggleVisibility}
          type="button"
        >
          {isVisible ? (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path>
              <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path>
              <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path>
              <line x1="2" x2="22" y1="2" y2="22"></line>
            </svg>
          ) : (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          )}
        </button>
      }
      type={isVisible ? 'text' : 'password'}
      {...props}
    />
  )
})

PasswordInput.displayName = 'PasswordInput'

/**
 * Textarea component
 */
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    error?: boolean
    className?: string
  }
>(({ error = false, className = '', ...props }, ref) => {
  const baseStyles = `
      border rounded-lg bg-surface-overlay/30 px-4 py-3 w-full outline-none
      focus:ring-2 transition-shadow min-h-[100px] resize-y
    `

  const stateStyles = error
    ? 'border-red/50 focus:ring-red/20 text-white'
    : 'border-border-default/50 focus:ring-primary/20 focus:border-cyan text-white'

  return (
    <textarea
      className={`${baseStyles} ${stateStyles} ${className}`}
      ref={ref}
      {...props}
    />
  )
})

Textarea.displayName = 'Textarea'
