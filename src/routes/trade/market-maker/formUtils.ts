import { ChangeEvent } from 'react'
import { UseFormReturn } from 'react-hook-form'

import { logger } from '../../../utils/logger'

import { Fields } from './types'

/**
 * Creates a handler function for from amount changes
 * 
 * @param form Form instance from react-hook-form
 * @param getAssetPrecision Function to get asset precision
 * @param parseAssetAmount Function to parse asset amount
 * @param setDebouncedFromAmount Function to set debounced from amount
 */
export const createFromAmountChangeHandler = (
  form: UseFormReturn<Fields>,
  getAssetPrecision: (asset: string) => number,
  setDebouncedFromAmount: (value: string) => void
) => {
  return (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    const fromAsset = form.getValues().fromAsset

    // Format input to ensure correct number format
    const formattedValue = formatNumericInput(value, getAssetPrecision(fromAsset))
    form.setValue('from', formattedValue, { shouldValidate: true })
    
    // Store the debounced value for later processing
    setDebouncedFromAmount(formattedValue)
  }
}

/**
 * Creates a handler function for to amount changes
 * 
 * @param form Form instance from react-hook-form
 * @param getAssetPrecision Function to get asset precision
 * @param parseAssetAmount Function to parse asset amount
 * @param setDebouncedToAmount Function to set debounced to amount
 */
export const createToAmountChangeHandler = (
  form: UseFormReturn<Fields>,
  getAssetPrecision: (asset: string) => number,
  setDebouncedToAmount: (value: string) => void
) => {
  return (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    const toAsset = form.getValues().toAsset

    // Format input to ensure correct number format
    const formattedValue = formatNumericInput(value, getAssetPrecision(toAsset))
    form.setValue('to', formattedValue, { shouldValidate: true })
    
    // Store the debounced value for later processing
    setDebouncedToAmount(formattedValue)
  }
}

/**
 * Format numeric input to ensure correct number format
 * 
 * @param value Input value
 * @param precision Decimal precision
 */
const formatNumericInput = (value: string, precision: number): string => {
  // Remove any character that is not a digit or a dot
  let formatted = value.replace(/[^\d.]/g, '')
  
  // Replace multiple dots with a single dot
  const dotCount = (formatted.match(/\./g) || []).length
  if (dotCount > 1) {
    const firstDotIndex = formatted.indexOf('.')
    formatted = formatted.slice(0, firstDotIndex + 1) + 
                formatted.slice(firstDotIndex + 1).replace(/\./g, '')
  }
  
  // Ensure the decimal part doesn't exceed the precision
  if (formatted.includes('.')) {
    const [whole, decimal] = formatted.split('.')
    formatted = `${whole}.${decimal.slice(0, precision)}`
  }
  
  return formatted
}

/**
 * Creates a debounced handler for updating the "to" amount based on "from" changes
 */
export const createDebouncedFromEffectHandler = (
  debouncedFromAmount: string,
  previousFromAmount: string | undefined,
  updatePending: boolean,
  updateToAmount: (amount: string) => void,
  setIsToAmountLoading: (isLoading: boolean) => void,
  setUpdatePending: (isPending: boolean) => void
) => {
  // Skip if the amount is invalid or not changed
  if (
    !debouncedFromAmount ||
    debouncedFromAmount.endsWith('.') ||
    updatePending ||
    debouncedFromAmount === previousFromAmount
  ) {
    return () => {}
  }

  setUpdatePending(true)

  return () => {
    const timer = setTimeout(() => {
      // Only show "calculating" UI if request takes more than 200ms
      const loadingTimer = setTimeout(() => {
        setIsToAmountLoading(true)
      }, 200)
      
      updateToAmount(debouncedFromAmount)
      
      clearTimeout(loadingTimer)
      setIsToAmountLoading(false)
      setUpdatePending(false)
    }, 300)

    return () => {
      clearTimeout(timer)
    }
  }
}

/**
 * Creates a debounced handler for updating the "from" amount based on "to" changes
 */
export const createDebouncedToEffectHandler = (
  debouncedToAmount: string,
  previousToAmount: string | undefined,
  updatePending: boolean,
  calculateRate: () => number,
  form: any,
  parseAssetAmount: (
    amount: string | undefined | null,
    asset: string
  ) => number,
  formatAmount: (amount: number, asset: string) => string,
  setUpdatePending: (isPending: boolean) => void
) => {
  if (!debouncedToAmount || debouncedToAmount.endsWith('.') || updatePending) {
    return () => {}
  }

  setUpdatePending(true)

  return () => {
    const timer = setTimeout(() => {
      if (debouncedToAmount !== previousToAmount) {
        try {
          const rate = calculateRate()
          const fromAmount =
            parseAssetAmount(debouncedToAmount, form.getValues().toAsset) / rate
          form.setValue(
            'from',
            formatAmount(fromAmount, form.getValues().fromAsset)
          )
        } catch (error) {
          logger.error('Error calculating from amount:', error)
        }
      }
      setUpdatePending(false)
    }, 300)

    return () => {
      clearTimeout(timer)
    }
  }
}
