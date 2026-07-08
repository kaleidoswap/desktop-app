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
  containerClassName = 'bg-surface-overlay/80 border border-border-default/50 rounded-xl p-4',
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
    <div className="flex gap-1 rounded-xl bg-surface-base/35 p-1 w-fit">
      {options.map((opt) => {
        const isSelected = currentValue === opt.value
        return (
          <button
            className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 focus:outline-none ${
              isSelected
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'text-content-secondary hover:text-white border border-transparent'
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
      <div className="text-sm font-medium text-white mb-3">
        {t('channelConfiguration.duration.label')}
      </div>
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
