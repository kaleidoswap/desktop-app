import { uiSliceSeletors } from '../../../slices/ui/ui.slice'
import {
  SparkDepositModal,
  SparkWithdrawModal,
  SparkL1WithdrawModal,
} from '../../SparkWallet'

import { DepositModalContent } from './Deposit'
import { WithdrawModalContent } from './Withdraw'

interface Props {
  modal: Exclude<ReturnType<typeof uiSliceSeletors.modal>, 'none'>
}
export const Content = (props: Props) => {
  switch (props.modal.type) {
    case 'deposit':
      return <DepositModalContent />
    case 'withdraw':
      return <WithdrawModalContent />
    case 'spark-deposit':
      return <SparkDepositModal onClose={() => {}} />
    case 'spark-withdraw':
      return <SparkWithdrawModal onClose={() => {}} />
    case 'spark-l1-withdraw':
      return <SparkL1WithdrawModal onClose={() => {}} />
  }
}
