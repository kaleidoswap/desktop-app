import React from 'react'
import { useTranslation } from 'react-i18next'

import { MakerSelector } from './MakerSelector'

interface HeaderProps {
  hasValidChannelsForTrading?: boolean
  onMakerChange: () => Promise<void>
}

export const Header: React.FC<HeaderProps> = ({
  hasValidChannelsForTrading = true,
  onMakerChange,
}) => {
  const { t } = useTranslation()

  return (
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-xl font-semibold text-white">
        {t('trade.header.title')}
      </h2>
      <MakerSelector
        onMakerChange={onMakerChange}
        show={hasValidChannelsForTrading}
      />
    </div>
  )
}
