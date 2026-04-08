import { Control, Controller, FieldPath, FieldValues } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

interface ChannelDurationSelectorProps<
  TFieldValues extends FieldValues = FieldValues,
> {
  value: number
  onChange: (value: number) => void
  maxExpiryBlocks?: number
  control?: Control<TFieldValues>
  fieldName?: FieldPath<TFieldValues>
  containerClassName?: string
  theme?: 'light' | 'dark'
}

export const ChannelDurationSelector = <
  TFieldValues extends FieldValues = FieldValues,
>({
  value,
  onChange,
  maxExpiryBlocks,
  control,
  fieldName,
  containerClassName = 'bg-surface-overlay/50 p-4 rounded-xl border border-border-default/50',
}: ChannelDurationSelectorProps<TFieldValues>) => {
  const { t } = useTranslation()
  const controllerFieldName = (fieldName ??
    'channelExpireBlocks') as FieldPath<TFieldValues>

  const getChannelExpiryOptions = () => {
    const options = [
      { label: t('channelConfiguration.duration.oneMonth'), value: 4320 },
      { label: t('channelConfiguration.duration.threeMonths'), value: 12960 },
    ]

    const sixMonthsBlocks = 25920
    if (!maxExpiryBlocks || sixMonthsBlocks <= maxExpiryBlocks) {
      options.push({
        label: t('channelConfiguration.duration.sixMonths'),
        value: sixMonthsBlocks,
      })
    }

    return options
  }

  const options = getChannelExpiryOptions()

  const PillButtons = ({
    currentValue,
    onSelect,
  }: {
    currentValue: number
    onSelect: (v: number) => void
  }) => (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isSelected = currentValue === opt.value
        return (
          <button
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              isSelected
                ? 'bg-gradient-to-r from-orange-500 to-yellow-600 text-white shadow-md shadow-orange-500/30'
                : 'bg-surface-overlay/60 text-content-secondary hover:bg-surface-high/70 hover:text-content-primary border border-border-default/50'
            }`}
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            type="button"
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className={containerClassName}>
      <label className="block text-sm font-medium text-content-secondary mb-3">
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
          name={controllerFieldName}
          render={({ field }) => (
            <PillButtons
              currentValue={field.value}
              onSelect={(v) => field.onChange(v)}
            />
          )}
        />
      ) : (
        <PillButtons currentValue={value} onSelect={onChange} />
      )}
    </div>
  )
}
