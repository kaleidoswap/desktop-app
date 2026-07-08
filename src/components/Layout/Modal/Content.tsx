import { uiSliceSeletors } from '../../../slices/ui/ui.slice'

import { DepositModalContent } from './Deposit'
import { WithdrawModalContent } from './Withdraw'

interface Props {
  modal: Exclude<ReturnType<typeof uiSliceSeletors.modal>, 'none'>
  onClose: () => void
}
export const Content = (props: Props) => {
  switch (props.modal.type) {
    case 'deposit':
      return <DepositModalContent onClose={props.onClose} />
    case 'withdraw':
      return <WithdrawModalContent onClose={props.onClose} />
  }
}
