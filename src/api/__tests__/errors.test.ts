import { describe, expect, it } from 'vitest'

import { categorizeError, ErrorCategory, transformSdkError } from '../errors'

/**
 * Mirrors kaleido-sdk's ValidationError shape (a KaleidoError subclass): an
 * Error carrying `statusCode` and `code`.
 */
function makeSdkError(
  message: string,
  code: string,
  statusCode?: number
): Error & { code: string; statusCode?: number } {
  const err = new Error(message) as Error & {
    code: string
    statusCode?: number
  }
  err.code = code
  err.statusCode = statusCode
  return err
}

describe('categorizeError', () => {
  it('classifies a 400 as a validation error', () => {
    const result = categorizeError(new Error('bad input'), 400)
    expect(result.category).toBe(ErrorCategory.VALIDATION)
  })

  it('does not treat a content error containing the word "network" as a connectivity error when a status code is present', () => {
    const result = categorizeError(
      new Error(
        "The provided recipient ID is for a different network than the wallet's one"
      ),
      400
    )
    expect(result.category).toBe(ErrorCategory.VALIDATION)
    expect(result.category).not.toBe(ErrorCategory.NETWORK)
  })

  it('still detects genuine connectivity failures when no status code is present', () => {
    const result = categorizeError(new Error('Load failed'))
    expect(result.category).toBe(ErrorCategory.NETWORK)
  })
})

describe('transformSdkError', () => {
  it('maps a 400 RGB network-mismatch error to a 400, not a FETCH_ERROR', () => {
    const sdkError = makeSdkError(
      "The provided recipient ID is for a different network than the wallet's one",
      'VALIDATION_ERROR',
      400
    )

    const result = transformSdkError(sdkError)

    expect(result.status).toBe(400)
    expect(result.status).not.toBe('FETCH_ERROR')
    expect((result as { data: { error: string } }).data.error).toContain(
      'different network'
    )
  })

  it('reports a real connectivity error as FETCH_ERROR', () => {
    const sdkError = makeSdkError('fetch failed', 'NETWORK_ERROR')

    const result = transformSdkError(sdkError)

    expect(result.status).toBe('FETCH_ERROR')
  })
})
