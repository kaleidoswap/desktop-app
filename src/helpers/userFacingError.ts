import type { TFunction } from 'i18next'

import { extractErrorMessage } from '../api/errors'

export interface UserFacingError {
  /** Short, translated sentence safe to show in a toast or banner. */
  message: string
  /** The underlying technical text, for a details toggle or the logs. */
  details: string
}

const API_PREFIX = /^API Error \(\d+\):\s*/i

const statusOf = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') return undefined
  const status = (error as { status?: unknown }).status
  return typeof status === 'number' ? status : undefined
}

const looksTechnical = (text: string): boolean =>
  text.length > 160 ||
  /^\s*[{[]/.test(text) || // JSON payloads
  /\n\s+at\s/.test(text) || // stack traces
  /Cannot read propert|is not a function|undefined is not|TypeError|ReferenceError/i.test(
    text
  )

/**
 * Turn any thrown value into something a user can act on. Known failure
 * modes (no desktop runtime, node unreachable, timeouts, auth, locked node)
 * get a specific translated message; anything that still reads like a stack
 * trace or a JSON blob falls back to a generic message. The raw text is kept
 * in `details` so nothing is lost for support.
 */
export function toUserFacingError(
  error: unknown,
  t: TFunction,
  fallbackKey = 'errors.user.generic'
): UserFacingError {
  const raw = extractErrorMessage(error)
  const details = raw.replace(API_PREFIX, '').trim()
  const lower = details.toLowerCase()
  const status = statusOf(error)
  const statusText =
    typeof (error as { status?: unknown })?.status === 'string'
      ? String((error as { status: string }).status)
      : ''

  const pick = (key: string, fallback: string) => ({
    details,
    message: t(key, fallback),
  })

  if (lower.includes("reading 'invoke'") || lower.includes('__tauri')) {
    return pick(
      'errors.user.desktopRuntime',
      'This feature is only available in the desktop app.'
    )
  }
  if (
    statusText === 'FETCH_ERROR' ||
    /failed to fetch|network ?error|econnrefused|err_network|load failed|networkerror/i.test(
      lower
    ) ||
    lower.includes('access-control-allow-origin')
  ) {
    return pick(
      'errors.user.unreachable',
      'Could not reach the node. Check that it is running and try again.'
    )
  }
  if (statusText === 'TIMEOUT_ERROR' || /timed? ?out/i.test(lower)) {
    return pick(
      'errors.user.timeout',
      'The request took too long. Please try again.'
    )
  }
  if (status === 401 || /invalid password|unauthori[sz]ed/i.test(lower)) {
    return pick(
      'errors.user.unauthorized',
      'Authentication failed. Check your password or access token.'
    )
  }
  if (
    status === 403 ||
    /node is locked|wallet has not been initialized|node is changing state/i.test(
      lower
    )
  ) {
    return pick(
      'errors.user.locked',
      'The node is locked or still starting. Unlock it and try again.'
    )
  }
  if (status === 429 || lower.includes('rate limit')) {
    return pick(
      'errors.user.rateLimited',
      'Too many requests. Please wait a moment and try again.'
    )
  }
  if (!details || looksTechnical(details)) {
    return pick(fallbackKey, 'Something went wrong. Please try again.')
  }
  // A short, human-readable message from the node or maker is fine as-is.
  return { details, message: details }
}
