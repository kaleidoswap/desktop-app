import { ChangeEvent } from 'react'
import { UseFormReturn } from 'react-hook-form'

import { formatNumberInput } from '../../../helpers/number'

import { Fields } from './types'

/**
 * Creates a handler function for from amount changes
 *
 * @param form Form instance from react-hook-form
 * @param getAssetPrecision Function to get asset precision
 * @param setDebouncedFromAmount Optional function to set debounced from amount
 * @param maxAmount Optional maximum amount allowed (in base units)
 * @param bitcoinUnit Optional bitcoin unit (BTC or SAT)
 */
export const createFromAmountChangeHandler = (
  form: UseFormReturn<Fields>,
  getAssetPrecision: (asset: string) => number,
  setDebouncedFromAmount?: (value: string) => void,
  maxAmount?: number
) => {
  return (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target
    const fromAsset = form.getValues().fromAsset
    const precision = getAssetPrecision(fromAsset)

    // Get current cursor position before formatting
    const cursorPosition = e.target.selectionStart || 0

    // Count commas before cursor position to adjust cursor later
    const commasBeforeCursor = (
      value.substring(0, cursorPosition).match(/,/g) || []
    ).length

    // First, remove any non-numeric characters except decimal point
    let cleanValue = value.replace(/[^\d.]/g, '')

    // Ensure only one decimal point
    const decimalPoints = cleanValue.match(/\./g)
    if (decimalPoints && decimalPoints.length > 1) {
      cleanValue = cleanValue.replace(/\./g, (match, index) =>
        index === cleanValue.indexOf('.') ? match : ''
      )
    }

    // Split into integer and decimal parts
    const parts = cleanValue.split('.')
    const integerPart = parts[0]
    let decimalPart = parts[1] || ''

    // Limit decimal places to asset precision
    if (decimalPart.length > precision) {
      decimalPart = decimalPart.slice(0, precision)
    }

    // Reconstruct the value
    cleanValue = integerPart + (decimalPart ? '.' + decimalPart : '')

    // Convert to number for comparison
    const numericValue = parseFloat(cleanValue) || 0
    const maxDisplayValue = maxAmount
      ? maxAmount / Math.pow(10, precision)
      : Infinity

    // Ensure value doesn't exceed max
    let finalValue =
      numericValue > maxDisplayValue ? maxDisplayValue.toString() : cleanValue

    // Format the value with proper number formatting
    let formattedValue = formatNumberInput(finalValue, precision)

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
 * @param maxAmount Optional maximum amount allowed (in base units)
 * @param bitcoinUnit Optional bitcoin unit (BTC or SAT)
 */
export const createToAmountChangeHandler = (
  form: UseFormReturn<Fields>,
  getAssetPrecision: (asset: string) => number,
  maxAmount?: number
) => {
  return (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target
    const toAsset = form.getValues().toAsset
    const precision = getAssetPrecision(toAsset)

    // First, remove any non-numeric characters except decimal point
    let cleanValue = value.replace(/[^\d.]/g, '')

    // Ensure only one decimal point
    const decimalPoints = cleanValue.match(/\./g)
    if (decimalPoints && decimalPoints.length > 1) {
      cleanValue = cleanValue.replace(/\./g, (match, index) =>
        index === cleanValue.indexOf('.') ? match : ''
      )
    }

    // Split into integer and decimal parts
    const parts = cleanValue.split('.')
    const integerPart = parts[0]
    let decimalPart = parts[1] || ''

    // Limit decimal places to asset precision
    if (decimalPart.length > precision) {
      decimalPart = decimalPart.slice(0, precision)
    }

    // Reconstruct the value
    cleanValue = integerPart + (decimalPart ? '.' + decimalPart : '')

    // Convert to number for comparison
    const numericValue = parseFloat(cleanValue) || 0
    const maxDisplayValue = maxAmount
      ? maxAmount / Math.pow(10, precision)
      : Infinity

    // Ensure value doesn't exceed max
    let finalValue =
      numericValue > maxDisplayValue ? maxDisplayValue.toString() : cleanValue

    // Format the value with proper number formatting
    let formattedValue = formatNumberInput(finalValue, precision)

    form.setValue('to', formattedValue, { shouldValidate: true })
  }
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
