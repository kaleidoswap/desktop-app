import { Plus, Wallet } from 'lucide-react'
import React from 'react'

import { useAppDispatch } from '../../app/store/hooks'
import { uiSliceActions } from '../../slices/ui/ui.slice'
import { Button } from '../ui'

export const AddWalletButton: React.FC = () => {
  const dispatch = useAppDispatch()

  const handleClick = () => {
    dispatch(
      uiSliceActions.setModal({
        context: 'dashboard',
        type: 'wallet-type-selection',
      })
    )
  }

  return (
    <Button
      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
      onClick={handleClick}
    >
      <Wallet className="w-4 h-4" />
      <Plus className="w-4 h-4" />
      <span>Add Wallet</span>
    </Button>
  )
}
