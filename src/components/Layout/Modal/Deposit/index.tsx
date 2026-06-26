import { useState } from 'react'

import { useAppDispatch } from '../../../../app/store/hooks'
import { uiSliceActions } from '../../../../slices/ui/ui.slice'

import { Step1 } from './Step1'
import { Step2 } from './Step2'

export const DepositModalContent = () => {
  const dispatch = useAppDispatch()
  const [step, setStep] = useState<number>(1)
  const [assetId, setAssetId] = useState<string>()

  return (
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
  )
}
