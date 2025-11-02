import { useAppDispatch } from '../../../app/store/hooks'
import { uiSliceSeletors, uiSliceActions } from '../../../slices/ui/ui.slice'
import {
  SparkDepositModal,
  SparkWithdrawModal,
  SparkL1WithdrawModal,
} from '../../SparkWallet'
import { UnifiedDepositWithdrawModal } from '../../WalletActions'
import { WalletManagementModal } from '../../WalletManagement/WalletManagementModal'
import { WalletTypeSelectorModal } from '../../WalletTypeSelector/WalletTypeSelectorModal'

import { DepositModalContent } from './Deposit'
import { WithdrawModalContent } from './Withdraw'

interface Props {
  modal: Exclude<ReturnType<typeof uiSliceSeletors.modal>, 'none'>
}
export const Content = (props: Props) => {
  const dispatch = useAppDispatch()

  const handleCloseModal = () => {
    dispatch(uiSliceActions.setModal({ type: 'none' }))
  }

  const handleWalletSelection = async (selectedWallets: string[]) => {
    // Handle wallet selection - create/activate selected wallet types
    console.log('Selected wallets:', selectedWallets)

    // If Spark is selected, we'll need to show wallet setup
    // For now, we'll just enable multi-wallet mode
    if (selectedWallets.includes('spark')) {
      // TODO: Show Spark wallet setup modal or create wallet
      // This would involve:
      // 1. Prompting for mnemonic (new or existing)
      // 2. Getting API key from settings
      // 3. Calling connectWallet mutation
      // 4. Adding wallet to multi-wallet state
      console.log('Spark wallet selected - setup required')
    }

    handleCloseModal()
  }

  switch (props.modal.type) {
    case 'deposit':
      return <DepositModalContent />
    case 'withdraw':
      return <WithdrawModalContent />
    case 'spark-deposit':
      return <SparkDepositModal onClose={handleCloseModal} />
    case 'spark-withdraw':
      return <SparkWithdrawModal onClose={handleCloseModal} />
    case 'spark-l1-withdraw':
      return <SparkL1WithdrawModal onClose={handleCloseModal} />
    case 'wallet-type-selection':
      return (
        <WalletTypeSelectorModal
          context={props.modal.context}
          isOpen={true}
          onClose={handleCloseModal}
          onConfirm={handleWalletSelection}
        />
      )
    case 'manage-wallets':
      return <WalletManagementModal isOpen={true} onClose={handleCloseModal} />
    case 'add-wallet':
      return (
        <WalletTypeSelectorModal
          context="dashboard"
          isOpen={true}
          onClose={handleCloseModal}
          onConfirm={handleWalletSelection}
        />
      )
    case 'unified-wallet-action':
      return (
        <UnifiedDepositWithdrawModal
          assetId={props.modal.assetId}
          defaultAction={props.modal.action || 'deposit'}
          onClose={handleCloseModal}
        />
      )
  }
}
