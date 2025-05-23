import { ChangeEvent } from 'react'
import { UseFormReturn } from 'react-hook-form'

import { logger } from '../../../utils/logger'

import { Fields } from './types'

/**
 * Creates a handler function for from amount changes
 *
 * @param form Form instance from react-hook-form
 * @param getAssetPrecision Function to get asset precision
 * @param parseAssetAmount Optional function to parse asset amount
 * @param setDebouncedFromAmount Optional function to set debounced from amount
 */
export const createFromAmountChangeHandler = (
  form: UseFormReturn<Fields>,
  getAssetPrecision: (asset: string) => number,
  setDebouncedFromAmount?: (value: string) => void
) => {
  return (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target
    const fromAsset = form.getValues().fromAsset

    // Get current cursor position before formatting
    const cursorPosition = e.target.selectionStart || 0

    // Count commas before cursor position to adjust cursor later
    const commasBeforeCursor = (
      value.substring(0, cursorPosition).match(/,/g) || []
    ).length

    // Format input to ensure correct number format
    const formattedValue = formatNumericInput(
      value,
      getAssetPrecision(fromAsset)
    )

    // Set the formatted value in the form
    form.setValue('from', formattedValue, { shouldValidate: true })

    // Store the debounced value for later processing if provided
    if (setDebouncedFromAmount) {
      setDebouncedFromAmount(formattedValue)
    }

    // Schedule cursor position adjustment for after React re-renders the input
    setTimeout(() => {
      const input = document.querySelector(
        'input[value="' + formattedValue + '"]'
      ) as HTMLInputElement
      if (input) {
        // Count new commas before the original cursor position
        const newCommasBeforeCursor = (
          formattedValue.substring(0, cursorPosition).match(/,/g) || []
        ).length

        // Adjust cursor position based on difference in commas
        const newPosition =
          cursorPosition + (newCommasBeforeCursor - commasBeforeCursor)

        // Set cursor position
        input.setSelectionRange(newPosition, newPosition)
      }
    }, 0)
  }
}

/**
 * Creates a handler function for to amount changes
 *
 * @param form Form instance from react-hook-form
 * @param getAssetPrecision Function to get asset precision
 * @param setDebouncedToAmount Function to set debounced to amount
 */
export const createToAmountChangeHandler = (
  form: UseFormReturn<Fields>,
  getAssetPrecision: (asset: string) => number,
  setDebouncedToAmount: (value: string) => void
) => {
  return (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target
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
  // Remove any character that is not a digit, dot, or comma
  let cleaned = value.replace(/[^\d.,]/g, '')

  // Replace commas with empty string to handle values with thousand separators
  cleaned = cleaned.replace(/,/g, '')

  // Replace multiple dots with a single dot
  const dotCount = (cleaned.match(/\./g) || []).length
  if (dotCount > 1) {
    const firstDotIndex = cleaned.indexOf('.')
    cleaned =
      cleaned.slice(0, firstDotIndex + 1) +
      cleaned.slice(firstDotIndex + 1).replace(/\./g, '')
  }

  // Ensure the decimal part doesn't exceed the precision
  if (cleaned.includes('.')) {
    const [whole, decimal] = cleaned.split('.')
    cleaned = `${whole}.${decimal.slice(0, precision)}`
  }

  // If value is not empty, try to format with comma thousand separators
  if (cleaned && !cleaned.endsWith('.')) {
    try {
      // Parse the cleaned value to a number
      const numValue = parseFloat(cleaned)
      if (!isNaN(numValue)) {
        // Format the whole part with commas
        if (cleaned.includes('.')) {
          const [whole, decimal] = cleaned.split('.')
          const formattedWhole = parseInt(whole).toLocaleString('en-US')
          return `${formattedWhole}.${decimal}`
        } else {
          return parseInt(cleaned).toLocaleString('en-US')
        }
      }
    } catch (e) {
      // Fall back to the cleaned value if formatting fails
      return cleaned
    }
  }

  return cleaned
}

/**
 * Format a number with commas for better display (like 1,000,000)
 *
 * @param value Number to format
 */
export const formatNumberWithCommas = (value: number | string): string => {
  if (typeof value === 'string' && !value) return ''

  // Parse to ensure we're working with a number
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return ''

  // Format with comma separators
  return numValue.toLocaleString('en-US')
}

/**
 * Parse a display value with commas back to a numeric string format
 *
 * @param value Display value with commas
 */
export const parseFormattedNumber = (value: string): string => {
  // Remove all non-numeric characters except decimal point
  return value.replace(/[^\d.]/g, '')
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
