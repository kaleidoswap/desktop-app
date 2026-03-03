import { ChevronDownIcon, CopyIcon, CheckIcon } from 'lucide-react'
import React, { useState } from 'react'
import { Controller } from 'react-hook-form'

import 'react-toastify/dist/ReactToastify.css'

interface AssetInfo {
  name: string
  ticker: string
  asset_id: string
  precision: number
  min_initial_client_amount: number
  max_initial_client_amount: number
  min_initial_lsp_amount: number
  max_initial_lsp_amount: number
  min_channel_amount: number
  max_channel_amount: number
}

interface AssetSelectorOptionProps {
  assetInfo: AssetInfo
  assetId: string
  onSelect: (value: string) => void
}

const AssetSelectorOption: React.FC<AssetSelectorOptionProps> = ({
  assetInfo,
  assetId,
  onSelect,
}) => {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = (e: any) => {
    e.stopPropagation()
    navigator.clipboard.writeText(assetId).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      className="flex justify-between items-center p-3 hover:bg-surface-high cursor-pointer"
      onClick={() => onSelect(assetId)}
    >
      <div className="flex items-center">
        <div>
          <div className="font-medium">{`${assetInfo.name} (${assetInfo.ticker})`}</div>
          <div className="text-sm text-content-secondary break-all">{assetId}</div>
        </div>
      </div>
      <button
        className="p-1 hover:bg-surface-elevated rounded"
        onClick={copyToClipboard}
      >
        {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
      </button>
    </div>
  )
}

interface AssetSelectorProps {
  control: any
  name: string
  assetMap: Record<string, AssetInfo>
}

export const AssetSelector: React.FC<AssetSelectorProps> = ({
  control,
  name,
  assetMap,
}) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const selectedAsset = assetMap[field.value]
        return (
          <div className="relative">
            <div
              className="bg-surface-high p-3 rounded-md flex justify-between items-center cursor-pointer"
              onClick={() => setIsOpen(!isOpen)}
            >
              {field.value && selectedAsset ? (
                <div className="flex items-center">
                  <span>{`${selectedAsset.name} (${selectedAsset.ticker})`}</span>
                </div>
              ) : (
                <span>Select an asset</span>
              )}
              <ChevronDownIcon size={20} />
            </div>
            {isOpen && (
              <div className="absolute z-10 w-full mt-1 bg-surface-overlay border border-border-default rounded-md shadow-lg max-h-60 overflow-auto">
                {Object.entries(assetMap).map(([assetId, assetInfo]) => (
                  <AssetSelectorOption
                    assetId={assetId}
                    assetInfo={assetInfo}
                    key={assetId}
                    onSelect={(value) => {
                      field.onChange(value)
                      setIsOpen(false)
                    }}
                  />
                ))}
              </div>
            )}
            {field.value && selectedAsset && (
              <div className="mt-2 text-sm text-content-secondary break-all">
                Asset ID: {field.value}
              </div>
            )}
          </div>
        )
      }}
    />
  )
}
