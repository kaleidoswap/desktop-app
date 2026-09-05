import { describe, expect, it, vi } from 'vitest'

import { unlockNodeWithRetry } from '../nodeUnlock'

describe('unlockNodeWithRetry', () => {
  it('treats prefixed already-unlocked API errors as success', async () => {
    const unlock = vi.fn().mockRejectedValue({
      data: { error: 'API Error (500): Node has already been unlocked' },
      status: 500,
    })
    const getNodeInfo = vi.fn().mockResolvedValue({ isSuccess: true })

    const outcome = await unlockNodeWithRetry({
      getNodeInfo,
      invalidPasswordMessage: 'Invalid password',
      maxRetriesMessage: 'Too many retries',
      unlock,
      unlockTimeoutMessage: 'Unlock taking too long',
      verifyFailureMessage: 'Failed to verify node status after unlock',
    })

    expect(outcome).toBe('already-unlocked')
    expect(unlock).toHaveBeenCalledTimes(1)
    expect(getNodeInfo).toHaveBeenCalledTimes(1)
  })

  it('maps a prefixed 403 not-initialized error to needs-init', async () => {
    const unlock = vi.fn().mockRejectedValue({
      data: {
        error:
          'API Error (403): Wallet has not been initialized (hint: call init)',
      },
      status: 403,
    })

    const outcome = await unlockNodeWithRetry({
      getNodeInfo: vi.fn(),
      invalidPasswordMessage: 'Invalid password',
      maxRetriesMessage: 'Too many retries',
      unlock,
      unlockTimeoutMessage: 'Unlock taking too long',
      verifyFailureMessage: 'Failed to verify node status after unlock',
    })

    expect(outcome).toBe('needs-init')
    expect(unlock).toHaveBeenCalledTimes(1)
  })

  it('maps a prefixed 401 invalid-password error to the friendly message', async () => {
    const unlock = vi.fn().mockRejectedValue({
      data: { error: 'API Error (401): Invalid password' },
      status: 401,
    })

    await expect(
      unlockNodeWithRetry({
        getNodeInfo: vi.fn(),
        invalidPasswordMessage: 'Invalid password',
        maxRetriesMessage: 'Too many retries',
        unlock,
        unlockTimeoutMessage: 'Unlock taking too long',
        verifyFailureMessage: 'Failed to verify node status after unlock',
      })
    ).rejects.toThrow('Invalid password')
    expect(unlock).toHaveBeenCalledTimes(1)
  })
})
