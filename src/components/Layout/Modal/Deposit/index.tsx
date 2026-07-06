import { useState } from 'react'

import { useAppDispatch, useAppSelector } from '../../../../app/store/hooks'
import { BTC_ASSET_ID } from '../../../../constants'
import {
  DepositModal,
  uiSliceActions,
  uiSliceSeletors,
} from '../../../../slices/ui/ui.slice'

import { Step1 } from './Step1'
import { Step2 } from './Step2'

interface DepositModalContentProps {
  onClose: () => void
}

export const DepositModalContent = ({ onClose }: DepositModalContentProps) => {
  const dispatch = useAppDispatch()
  const modal = useAppSelector(uiSliceSeletors.modal) as DepositModal
  // Open straight on the address/invoice screen (Step2), defaulting to BTC, so
  // a BTC deposit shows a generated address immediately — no asset pick +
  // "Continue" click. The asset can still be changed via Back (→ Step1).
  const [step, setStep] = useState<number>(2)
  const [assetId, setAssetId] = useState<string | undefined>(
    modal.assetId ?? BTC_ASSET_ID
  )

  return (
    <div
      className={`flex-1 pr-1 ${step === 2 ? 'overflow-y-auto custom-scrollbar' : ''}`}
    >
      {step === 1 && (
        <Step1
          onClose={onClose}
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
          onClose={onClose}
          onNext={() => dispatch(uiSliceActions.setModal({ type: 'none' }))}
        />
      )}
    </div>
  )
}
