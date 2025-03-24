import { ChevronLeft } from 'lucide-react'
import React, { ReactNode } from 'react'

import { Button, Card } from './index'

interface SetupLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
  icon?: ReactNode
  onBack?: () => void
  backButtonText?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl'
  centered?: boolean
  fullHeight?: boolean
  className?: string
}

/**
 * A consistent layout for setup screens with header, icon, and back button
 */
export const SetupLayout: React.FC<SetupLayoutProps> = ({
  children,
  title,
  subtitle,
  icon,
  onBack,
  backButtonText = 'Back',
  maxWidth = '4xl',
  centered = false,
  fullHeight = false,
  className = '',
}) => {
  const maxWidthClasses = {
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    lg: 'max-w-lg',
    md: 'max-w-md',
    sm: 'max-w-sm',
    xl: 'max-w-xl',
  }

  return (
    <div
      className={`${maxWidthClasses[maxWidth]} mx-auto w-full p-3 ${fullHeight ? 'h-full flex flex-col' : ''} ${className}`}
    >
      <Card
        className={`p-5 md:p-6 ${fullHeight ? 'flex-1 flex flex-col overflow-hidden min-h-0' : ''}`}
      >
        {onBack && (
          <div className="mb-5">
            <Button
              icon={<ChevronLeft className="w-4 h-4" />}
              onClick={onBack}
              size="sm"
              variant="outline"
            >
              {backButtonText}
            </Button>
          </div>
        )}

        <div className={`${centered ? 'text-center' : ''} mb-6`}>
          {icon && (
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-cyan/20 to-cyan/5 border border-cyan/20 mb-3">
              {React.cloneElement(icon as React.ReactElement, {
                className: 'w-6 h-6 text-cyan',
              })}
            </div>
          )}
          <h1 className="text-xl md:text-2xl font-bold mb-1.5 bg-gradient-to-r from-cyan to-blue-400 bg-clip-text text-transparent">
            {title}
          </h1>
          {subtitle && (
            <p className="text-gray-400 text-xs md:text-sm">{subtitle}</p>
          )}
        </div>

        <div
          className={`${fullHeight ? 'flex-1 overflow-auto custom-scrollbar min-h-0' : ''}`}
        >
          {children}
        </div>
      </Card>
    </div>
  )
}

/**
 * A section component for setup screens
 */
export const SetupSection: React.FC<{
  children: ReactNode
  title?: string
  className?: string
  icon?: ReactNode
}> = ({ children, title, className = '', icon }) => {
  return (
    <Card
      className={`p-3 md:p-4 border border-slate-700/50 bg-blue-darker/40 ${className}`}
    >
      {(title || icon) && (
        <div className="flex items-center gap-2 mb-3">
          {icon && (
            <div className="p-1.5 rounded-xl bg-cyan/10 border border-cyan/20 text-cyan">
              {icon}
            </div>
          )}
          {title && (
            <h3 className="text-base font-medium text-white">{title}</h3>
          )}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </Card>
  )
}

/**
 * A form field wrapper
 */
export const FormField: React.FC<{
  children: ReactNode
  label: string
  htmlFor: string
  error?: string
  description?: string
  className?: string
}> = ({ children, label, htmlFor, error, description, className = '' }) => {
  return (
    <div className={className}>
      <label className="block text-sm font-medium mb-1" htmlFor={htmlFor}>
        {label}
      </label>
      <div className="relative">{children}</div>
      {description && (
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      )}
      {error && (
        <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
          <svg
            className="w-3.5 h-3.5"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              clipRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
              fillRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}
