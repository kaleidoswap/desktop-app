import { Clock } from 'lucide-react'
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
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isSelected = currentValue === opt.value
        return (
          <button
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              isSelected
                ? 'bg-primary/20 text-primary border border-primary/40'
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
      <h3 className="text-lg font-semibold text-content-primary mb-3 flex items-center gap-2">
        <Clock className="w-5 h-5 text-primary" />
        {t('channelConfiguration.duration.label')}
      </h3>
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
