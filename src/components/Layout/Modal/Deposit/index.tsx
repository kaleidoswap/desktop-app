import { useState } from 'react'

import { useAppDispatch } from '../../../../app/store/hooks'
import { uiSliceActions } from '../../../../slices/ui/ui.slice'

import { Step1 } from './Step1'
import { Step2 } from './Step2'

export const DepositModalContent = () => {
  const dispatch = useAppDispatch()
  const [step, setStep] = useState<number>(1)
  const [assetId, setAssetId] = useState<string>()

  const progress = (step / 2) * 100

  return (
    <>
      <div className="max-w-2xl mx-auto p-4 max-h-[90vh] flex flex-col">
        {/* Progress bar */}
        <div className="mb-4">
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-sm text-slate-400">
            <span>Select Asset</span>
            <span>Deposit Details</span>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
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
