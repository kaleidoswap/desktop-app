import React from 'react'
import { Control, Controller } from 'react-hook-form'

import { Select } from '../Select'

interface ChannelDurationSelectorProps {
  value: number
  onChange: (value: number) => void
  maxExpiryBlocks?: number
  control?: Control<any>
  fieldName?: string
  containerClassName?: string
  theme?: 'light' | 'dark'
}

export const ChannelDurationSelector: React.FC<
  ChannelDurationSelectorProps
> = ({
  value,
  onChange,
  maxExpiryBlocks,
  control,
  fieldName = 'channelExpireBlocks',
  containerClassName = 'bg-gray-800/50 p-4 rounded-xl border border-gray-700/50',
  theme = 'dark',
}) => {
  const getChannelExpiryOptions = () => {
    const options = [
      { label: '1 month', value: '4320' },
      { label: '3 months', value: '12960' },
    ]

    const sixMonthsBlocks = 25920
    if (!maxExpiryBlocks || sixMonthsBlocks <= maxExpiryBlocks) {
      options.push({ label: '6 months', value: sixMonthsBlocks.toString() })
    }

    return options
  }

  return (
    <div className={containerClassName}>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        Channel Lock Duration
        <span className="ml-2 text-gray-400 hover:text-gray-300 cursor-help relative group">
          ⓘ
          <span className="invisible group-hover:visible absolute left-0 bg-gray-900 text-white text-sm rounded py-1 px-2 w-80 shadow-lg z-50 top-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            The minimum time the LSP guarantees to keep your channel open.
            Longer durations provide more stability but may affect fees. 1 month
            = 4,320 blocks, 3 months = 12,960 blocks, 6 months = 25,920 blocks.
            Default: 3 months.
          </span>
        </span>
      </label>
      {control ? (
        <Controller
          control={control}
          name={fieldName}
          render={({ field }) => (
            <Select
              active={field.value.toString()}
              onSelect={(value) => field.onChange(parseInt(value, 10))}
              options={getChannelExpiryOptions()}
              theme={theme}
            />
          )}
        />
      ) : (
        <Select
          active={value.toString()}
          onSelect={(value) => onChange(parseInt(value, 10))}
          options={getChannelExpiryOptions()}
          theme={theme}
        />
      )}
    </div>
  )
}
