import { shallowEqual } from 'react-redux'

import { useAppSelector } from '../app/store/hooks'

export const useSettings = () => {
  return useAppSelector((state) => state.settings, shallowEqual)
}
