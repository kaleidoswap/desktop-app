import React from 'react'
import { Control, Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

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
  containerClassName = 'bg-surface-overlay/50 p-4 rounded-xl border border-border-default/50',
  theme = 'dark',
}) => {
  const { t } = useTranslation()

  const getChannelExpiryOptions = () => {
    const options = [
      { label: t('channelConfiguration.duration.oneMonth'), value: '4320' },
      { label: t('channelConfiguration.duration.threeMonths'), value: '12960' },
    ]

    const sixMonthsBlocks = 25920
    if (!maxExpiryBlocks || sixMonthsBlocks <= maxExpiryBlocks) {
      options.push({
        label: t('channelConfiguration.duration.sixMonths'),
        value: sixMonthsBlocks.toString(),
      })
    }

    return options
  }

  return (
    <div className={containerClassName}>
      <label className="block text-sm font-medium text-content-secondary mb-2">
        {t('channelConfiguration.duration.label')}
        <span className="ml-2 text-content-secondary hover:text-content-secondary cursor-help relative group">
          ⓘ
          <span className="invisible group-hover:visible absolute left-0 bg-surface-base text-white text-sm rounded py-1 px-2 w-80 shadow-lg z-50 top-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {t('channelConfiguration.duration.tooltipInfo')}
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
