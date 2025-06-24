import React, { useState } from 'react'

import { AssetSelectionModal, AssetOptionData } from './AssetSelectionModal'
import { AssetSelectTrigger } from './AssetSelectTrigger'

interface AssetSelectWithModalProps {
  options: AssetOptionData[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  title?: string
  searchPlaceholder?: string
  fieldLabel?: string
  className?: string
}

export const AssetSelectWithModal: React.FC<AssetSelectWithModalProps> = ({
  options,
  value,
  onChange,
  disabled = false,
  placeholder = 'Select an asset',
  title = 'Select Asset',
  searchPlaceholder = 'Search by ticker, name or asset ID...',
  fieldLabel,
  className = '',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleOpenModal = () => {
    if (!disabled) {
      setIsModalOpen(true)
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
  }

  const handleAssetChange = (newValue: string) => {
    onChange(newValue)
    setIsModalOpen(false)
  }

  return (
    <>
      <AssetSelectTrigger
        className={className}
        disabled={disabled}
        onClick={handleOpenModal}
        options={options}
        placeholder={placeholder}
        value={value}
      />

      <AssetSelectionModal
        fieldLabel={fieldLabel}
        isOpen={isModalOpen}
        onChange={handleAssetChange}
        onClose={handleCloseModal}
        options={options}
        searchPlaceholder={searchPlaceholder}
        title={title}
        value={value}
      />
    </>
  )
}
