import React from 'react'
import { Control, Controller } from 'react-hook-form'

import { AssetInfo } from '../../utils/channelOrderUtils'
import { AssetChannelSelector } from '../AssetChannelSelector'
import { AssetSelectWithModal } from '../Trade/AssetSelectWithModal'

interface AssetChannelSectionProps {
  assetMap: Record<string, AssetInfo>
  selectedAssetId: string
  totalAssetAmount: number
  clientAssetAmount?: number
  onAssetChange: (assetId: string) => void
  onTotalAssetAmountChange: (value: number) => void
  onClientAssetAmountChange?: (value: number) => void
  control?: Control<any>
  showAssetSelector?: boolean
  containerClassName?: string
  selectLabel?: string
  selectPlaceholder?: string
}

export const AssetChannelSection: React.FC<AssetChannelSectionProps> = ({
  assetMap,
  selectedAssetId,
  totalAssetAmount,
  clientAssetAmount,
  onAssetChange,
  onTotalAssetAmountChange,
  onClientAssetAmountChange,
  control,
  showAssetSelector = true,
  containerClassName = 'bg-gray-800/50 p-4 rounded-xl border border-gray-700/50',
  selectLabel = 'Select Asset to Buy (Optional)',
  selectPlaceholder = 'Select an RGB asset',
}) => {
  const hasAssets = Object.keys(assetMap).length > 0

  if (!hasAssets) {
    return (
      <div className={containerClassName}>
        <div className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  clipRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  fillRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-200">
                No Assets Available
              </h3>
              <div className="mt-2 text-sm text-yellow-300">
                <p>
                  There are currently no assets available to add to your
                  channel. Please try again later or proceed without adding an
                  asset.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={containerClassName}>
      {showAssetSelector && (
        <>
          <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            {selectLabel}
          </label>
          {control ? (
            <Controller
              control={control}
              name="assetId"
              render={({ field }) => (
                <AssetSelectWithModal
                  className="w-full"
                  fieldLabel="Choose an RGB asset for your channel"
                  onChange={field.onChange}
                  options={Object.entries(assetMap).map(
                    ([assetId, assetInfo]) => ({
                      assetId: assetId,
                      label: assetInfo.name,
                      name: assetInfo.name,
                      ticker: assetInfo.ticker,
                      value: assetId,
                    })
                  )}
                  placeholder={selectPlaceholder}
                  searchPlaceholder="Search by name, ticker or asset ID..."
                  title="Select RGB Asset"
                  value={field.value}
                />
              )}
            />
          ) : (
            <AssetSelectWithModal
              className="w-full"
              fieldLabel="Choose an RGB asset for your channel"
              onChange={onAssetChange}
              options={Object.entries(assetMap).map(([assetId, assetInfo]) => ({
                assetId: assetId,
                label: assetInfo.name,
                name: assetInfo.name,
                ticker: assetInfo.ticker,
                value: assetId,
              }))}
              placeholder={selectPlaceholder}
              searchPlaceholder="Search by name, ticker or asset ID..."
              title="Select RGB Asset"
              value={selectedAssetId}
            />
          )}
        </>
      )}

      {selectedAssetId && assetMap[selectedAssetId] && (
        <div className={showAssetSelector ? 'mt-4' : ''}>
          <AssetChannelSelector
            assetInfo={assetMap[selectedAssetId]}
            clientAssetAmount={clientAssetAmount}
            onClientAssetAmountChange={onClientAssetAmountChange}
            onTotalAssetAmountChange={onTotalAssetAmountChange}
            totalAssetAmount={totalAssetAmount}
          />
        </div>
      )}
    </div>
  )
}
