import { toast } from 'react-toastify'

import { logger } from '../../../utils/logger'

/**
 * Creates a function to set the "from" amount directly
 */
export const createSetFromAmountHelper = (
  form: any,
  formatAmount: (amount: number, asset: string) => string,
  updateToAmount: (amount: string) => void,
  maxFromAmount: number,
  setSelectedSize: (size: number) => void
) => {
  return async (
    amount: number,
    fromAsset: string,
    percentageOfMax?: number
  ): Promise<string | null> => {
    try {
      // Ensure amount doesn't exceed max
      const safeAmount = Math.min(amount, maxFromAmount)

      // Format the amount according to asset precision
      const formattedAmount = formatAmount(safeAmount, fromAsset)

      // Set the form value with validation
      form.setValue('from', formattedAmount, { shouldValidate: true })

      // Update the "to" amount (will trigger a quote request)
      updateToAmount(formattedAmount)

      // Update the selected size if provided
      if (percentageOfMax !== undefined) {
        setSelectedSize(percentageOfMax)
      }

      // Trigger validation to update any error messages immediately
      form.trigger('from')

      return formattedAmount
    } catch (error) {
      logger.error('Error setting from amount:', error)
      return null
    }
  }
}

/**
 * Creates a handler for the size percentage buttons
 */
export const createSizeClickHandler = (
  form: any,
  maxFromAmount: number,
  setFromAmount: (
    amount: number,
    fromAsset: string,
    percentageOfMax?: number
  ) => Promise<string | null>
) => {
  return async (size: number) => {
    try {
      const fromAsset = form.getValues().fromAsset

      // Calculate the amount based on the percentage
      const amount = (maxFromAmount * size) / 100

      // Early exit if the amount is 0 or invalid
      if (amount <= 0) {
        logger.warn(`Invalid amount calculated for size ${size}%: ${amount}`)
        return null
      }

      logger.debug(
        `Size button clicked: ${size}% of ${maxFromAmount} = ${amount} ${fromAsset}`
      )

      // Ensure both form value and debounced value are updated
      const formattedAmount = await setFromAmount(amount, fromAsset, size)

      // Important: Make sure the formattedAmount isn't null before using it
      if (formattedAmount) {
        // Let the component know there was a size change to trigger re-rendering the to amount
        form.setValue('from', formattedAmount, { shouldValidate: true })

        // Explicitly trigger form validation immediately
        form.trigger('from')
        form.trigger('to')
      }

      return formattedAmount
    } catch (error) {
      logger.error('Error processing size click:', error)
      return null
    }
  }
}

/**
 * Creates a handler for the refresh amounts button
 */
export const createRefreshAmountsHandler = (
  selectedPair: any,
  form: any,
  calculateMaxTradableAmount: (
    asset: string,
    isFrom: boolean
  ) => Promise<number>,
  updateMinMaxAmounts: () => Promise<void>,
  selectedSize: number,
  setFromAmount: (
    amount: number,
    fromAsset: string,
    percentageOfMax?: number
  ) => Promise<string | null>,
  setIsLoading: (isLoading: boolean) => void,
  setMaxFromAmount: (amount: number) => void,
  setMaxToAmount: (amount: number) => void
) => {
  return async () => {
    if (!selectedPair) return

    setIsLoading(true)
    try {
      // Recalculate max amounts
      const fromAsset = form.getValues().fromAsset
      const toAsset = form.getValues().toAsset
      const newMaxFromAmount = await calculateMaxTradableAmount(fromAsset, true)
      const newMaxToAmount = await calculateMaxTradableAmount(toAsset, false)

      // Set the state with the new max amounts
      setMaxFromAmount(newMaxFromAmount)
      setMaxToAmount(newMaxToAmount)

      // Calculate the percentage of max based on selectedSize
      const newFromAmount = (newMaxFromAmount * selectedSize) / 100

      // Set from amount using helper function, maintain same percentage
      await setFromAmount(newFromAmount, fromAsset, selectedSize)
      await updateMinMaxAmounts()
    } catch (error) {
      logger.error('Error refreshing amounts:', error)
      toast.error('Failed to refresh amounts. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }
}
