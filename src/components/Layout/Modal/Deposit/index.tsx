import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppDispatch } from '../../../../app/store/hooks'
import { uiSliceActions } from '../../../../slices/ui/ui.slice'

import { Step1 } from './Step1'
import { Step2 } from './Step2'

export const DepositModalContent = () => {
  const dispatch = useAppDispatch()
  const [step, setStep] = useState<number>(1)
  const [assetId, setAssetId] = useState<string>()
  const { t } = useTranslation()

  const progress = (step / 2) * 100

  return (
    <>
      <div className="max-w-2xl mx-auto p-4 max-h-[85vh] flex flex-col">
        {/* Progress bar */}
        <div className="mb-4">
          <div className="h-1.5 w-full bg-surface-overlay rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs">
            <span
              className={
                step === 1
                  ? 'text-primary font-semibold'
                  : 'text-content-secondary line-through opacity-60'
              }
            >
              {t('depositModal.progress.selectAsset')}
            </span>
            <span
              className={
                step === 2
                  ? 'text-primary font-semibold'
                  : 'text-content-secondary'
              }
            >
              {t('depositModal.progress.details')}
            </span>
          </div>
        </div>

        <div
          className={`flex-1 pr-1 ${step === 2 ? 'overflow-y-auto custom-scrollbar' : ''}`}
        >
          {step === 1 && (
            <Step1
              onNext={(a) => {
                setAssetId(a)
                setStep((state) => state + 1)
              }}
            />
          )}

          {step === 2 && (
            <Step2
              assetId={assetId as string}
              onBack={() => setStep((state) => state - 1)}
              onNext={() => dispatch(uiSliceActions.setModal({ type: 'none' }))}
            />
          )}
        </div>
      </div>
    </>
  )
}
