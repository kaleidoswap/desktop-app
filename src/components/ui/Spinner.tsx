import React from 'react'

type SpinnerSize = 'sm' | 'md' | 'lg'

interface SpinnerProps {
  size?: SpinnerSize
  className?: string
}

/**
 * Spinner component for loading states
 */
export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    lg: 'w-10 h-10',
    md: 'w-6 h-6',
    sm: 'w-4 h-4',
  }

  return (
    <svg
      className={`animate-spin text-primary ${sizeClasses[size]} ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        fill="currentColor"
      ></path>
    </svg>
  )
}
