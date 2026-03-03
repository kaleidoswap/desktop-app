import { ArrowRight } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

interface WalletActionProps {
  title: string
  description: string
  icon: React.ReactNode
  onClick: () => void
  primary?: boolean
}

const IconWrapper = `
  p-4 rounded-xl backdrop-blur-sm bg-opacity-20
  flex items-center justify-center
  transition-all duration-300
`

export const WalletAction: React.FC<WalletActionProps> = ({
  title,
  description,
  icon,
  onClick,
  primary,
}) => {
  const { t } = useTranslation()

  return (
    <div
      className={`relative overflow-hidden transition-all duration-300 border-2 rounded-2xl backdrop-blur-sm
      hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-2 w-full text-left cursor-pointer group fade-in
      ${primary ? 'bg-gradient-to-br from-cyan/15 to-transparent border-primary/40' : 'bg-surface-elevated/40 hover:bg-surface-elevated/60 border-divider/20'}`}
      onClick={onClick}
    >
      <div className="p-6">
        <div className="flex items-center gap-4 mb-4">
          <div
            className={`${IconWrapper}
            ${primary ? 'bg-surface-elevated/80 text-primary scale-105' : 'bg-surface-elevated/80 text-white'}`}
          >
            {React.cloneElement(icon as React.ReactElement, {
              strokeWidth: 2.5,
            })}
          </div>
          <h2
            className={`text-2xl font-bold ${primary ? 'text-primary' : 'text-white'}`}
          >
            {title}
          </h2>
        </div>
        <p className="text-content-secondary text-sm leading-relaxed mb-6">
          {description}
        </p>
        <div
          className={`flex items-center gap-2 text-sm font-medium
          ${primary ? 'text-primary' : 'text-content-secondary group-hover:text-content-secondary'}`}
        >
          {t('walletSetup.getStarted')}
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-2" />
        </div>
      </div>
      {primary && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl"></div>
        </div>
      )}
    </div>
  )
}
