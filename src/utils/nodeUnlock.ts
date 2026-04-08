export interface NodeInfoResponseLike {
  isSuccess: boolean
  error?: unknown
}

export type UnlockNodeOutcome =
  | 'already-unlocked'
  | 'cancelled'
  | 'needs-init'
  | 'unlocked'

interface VerifyUnlockedNodeOptions {
  getNodeInfo: () => Promise<NodeInfoResponseLike>
  verifyFailureMessage: string
}

interface UnlockNodeWithRetryOptions extends VerifyUnlockedNodeOptions {
  unlock: () => Promise<void>
  invalidPasswordMessage: string
  isCancelled?: () => boolean
  maxRetries?: number
  maxRetriesMessage: string
  onLongUnlock?: (message: string) => void
  unlockLabel?: string
  unlockTimeoutMessage: string
  unlockTimeoutMs?: number
}

export const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
        ms
      )
    ),
  ])

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const NODE_CHANGING_STATE_MESSAGE =
  'Cannot call other APIs while node is changing state'

const isNodeChangingStateError = (
  message: string | null | undefined
): boolean => message?.includes(NODE_CHANGING_STATE_MESSAGE) ?? false

const isTimeoutError = (message: string | null | undefined): boolean => {
  if (!message) {
    return false
  }

  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('The request timed out')
  )
}

const isAlreadyUnlockedError = (
  message: string | null | undefined
): boolean => {
  if (!message) {
    return false
  }

  const normalizedMessage = message.toLowerCase()

  return (
    normalizedMessage.includes('node has already been unlocked') ||
    normalizedMessage.includes('node is unlocked')
  )
}

const extractNodeError = (errorLike: NodeInfoResponseLike['error']) => {
  const error =
    errorLike && typeof errorLike === 'object'
      ? (errorLike as {
          status?: number | string
          data?: { error?: string }
        })
      : undefined

  return {
    message: error?.data?.error,
    status: error?.status,
  }
}

export const verifyUnlockedNode = async ({
  getNodeInfo,
  verifyFailureMessage,
}: VerifyUnlockedNodeOptions): Promise<void> => {
  let lastError: string | null = null

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const nodeInfoRes = await withTimeout(
        getNodeInfo(),
        10000,
        'Node info check'
      )

      if (nodeInfoRes.isSuccess) {
        return
      }

      const { message, status } = extractNodeError(nodeInfoRes.error)
      lastError = message || `status ${String(status ?? 'unknown')}`

      const isTransient =
        status === 'FETCH_ERROR' ||
        status === 'TIMEOUT_ERROR' ||
        isNodeChangingStateError(message)

      if (!isTransient) {
        break
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }

    await sleep(Math.min(1000 * (attempt + 1), 4000))
  }

  throw new Error(
    lastError ? `${verifyFailureMessage}: ${lastError}` : verifyFailureMessage
  )
}

export const unlockNodeWithRetry = async ({
  unlock,
  getNodeInfo,
  invalidPasswordMessage,
  isCancelled,
  maxRetries = 240,
  maxRetriesMessage,
  onLongUnlock,
  unlockLabel = 'Wallet unlock',
  unlockTimeoutMessage,
  unlockTimeoutMs = 120000,
  verifyFailureMessage,
}: UnlockNodeWithRetryOptions): Promise<UnlockNodeOutcome> => {
  let pollingInterval = 2000
  const maxPollingInterval = 15000
  let retryCount = 0
  let reportedLongUnlock = false

  const reportLongUnlock = () => {
    if (reportedLongUnlock) {
      return
    }

    reportedLongUnlock = true
    onLongUnlock?.(unlockTimeoutMessage)
  }

  while (!isCancelled?.()) {
    if (retryCount >= maxRetries) {
      throw new Error(maxRetriesMessage)
    }

    try {
      await withTimeout(unlock(), unlockTimeoutMs, unlockLabel)

      if (isCancelled?.()) {
        return 'cancelled'
      }

      try {
        await verifyUnlockedNode({
          getNodeInfo,
          verifyFailureMessage,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)

        if (isTimeoutError(message) || isNodeChangingStateError(message)) {
          reportLongUnlock()
          retryCount++
          await sleep(pollingInterval)
          pollingInterval = Math.min(pollingInterval * 1.5, maxPollingInterval)
          continue
        }

        throw error instanceof Error
          ? error
          : new Error(message, { cause: error })
      }

      return 'unlocked'
    } catch (error) {
      if (isCancelled?.()) {
        return 'cancelled'
      }

      const message = error instanceof Error ? error.message : String(error)

      if (message.startsWith(`${unlockLabel} timed out`)) {
        reportLongUnlock()
        retryCount++
        await sleep(pollingInterval)
        pollingInterval = Math.min(pollingInterval * 1.5, maxPollingInterval)
        continue
      }

      if (isTimeoutError(message)) {
        reportLongUnlock()
        retryCount++
        await sleep(pollingInterval)
        pollingInterval = Math.min(pollingInterval * 1.5, maxPollingInterval)
        continue
      }

      const maybeError = error as {
        status?: number | string
        data?: { error?: string }
      }
      const errorMessage = maybeError?.data?.error || message

      if (
        (typeof maybeError.status === 'string' &&
          (maybeError.status === 'FETCH_ERROR' ||
            maybeError.status === 'TIMEOUT_ERROR')) ||
        isTimeoutError(errorMessage) ||
        isNodeChangingStateError(errorMessage) ||
        isNodeChangingStateError(message)
      ) {
        reportLongUnlock()
        retryCount++
        await sleep(pollingInterval)
        pollingInterval = Math.min(pollingInterval * 1.5, maxPollingInterval)
        continue
      }

      if (
        (maybeError.status === 401 && errorMessage === 'Invalid password') ||
        errorMessage.toLowerCase().includes('password is incorrect')
      ) {
        throw new Error(invalidPasswordMessage, { cause: error })
      }

      if (
        maybeError.status === 403 &&
        errorMessage === 'Wallet has not been initialized (hint: call init)'
      ) {
        return 'needs-init'
      }

      if (
        isAlreadyUnlockedError(errorMessage) ||
        isAlreadyUnlockedError(message)
      ) {
        await verifyUnlockedNode({
          getNodeInfo,
          verifyFailureMessage,
        })

        return 'already-unlocked'
      }

      throw new Error(errorMessage, { cause: error })
    }
  }

  return 'cancelled'
}
