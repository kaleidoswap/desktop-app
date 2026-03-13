/**
 * Node state management utilities
 * Provides type-safe handling of RGB Lightning node states
 */

export type NodeState =
  | { status: 'Stopped' }
  | { status: 'Starting' }
  | { status: 'Running' }
  | { status: 'Stopping' }
  | { status: 'Failed'; message: string }

export const isNodeRunning = (state: NodeState): boolean => {
  return state.status === 'Running' || state.status === 'Starting'
}

export const isNodeStopped = (state: NodeState): boolean => {
  return state.status === 'Stopped'
}

export const isNodeFailed = (state: NodeState): boolean => {
  return state.status === 'Failed'
}

export const getNodeStateMessage = (state: NodeState): string => {
  switch (state.status) {
    case 'Stopped':
      return 'Node is stopped'
    case 'Starting':
      return 'Node is starting...'
    case 'Running':
      return 'Node is running'
    case 'Stopping':
      return 'Node is stopping...'
    case 'Failed':
      return `Node failed: ${state.message}`
  }
}

/**
 * Wait for node to reach a specific state with timeout
 */
export const waitForNodeState = async (
  targetState: NodeState['status'],
  options: {
    timeoutMs?: number
    pollIntervalMs?: number
    onProgress?: (state: NodeState) => void
  } = {}
): Promise<NodeState> => {
  const { timeoutMs = 60000, pollIntervalMs = 500, onProgress } = options
  const startTime = Date.now()

  return new Promise((resolve, reject) => {
    const checkState = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const state = await invoke<NodeState>('get_node_state')

        if (onProgress) {
          onProgress(state)
        }

        if (state.status === targetState) {
          resolve(state)
          return
        }

        // Check for failed state
        if (state.status === 'Failed') {
          reject(new Error(`Node failed: ${state.message}`))
          return
        }

        // Check timeout
        if (Date.now() - startTime > timeoutMs) {
          reject(
            new Error(
              `Timeout waiting for node to reach ${targetState}. Current state: ${state.status}`
            )
          )
          return
        }

        // Continue polling
        setTimeout(checkState, pollIntervalMs)
      } catch (error) {
        reject(error)
      }
    }

    checkState()
  })
}

/**
 * Enhanced node startup helper with better readiness detection.
 * Polls every 2s to check if the node port is bound, rather than
 * relying solely on log events (which required Stdio::piped in Rust).
 */
export const waitForNodeReady = async (
  options: {
    timeoutMs?: number
    onProgress?: (message: string) => void
    daemonPort?: string | number
  } = {}
): Promise<void> => {
  const { timeoutMs = 90000, onProgress, daemonPort } = options

  return new Promise((resolve, reject) => {
    let settled = false
    let lastNodeError: string | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let pollId: ReturnType<typeof setInterval> | null = null
    const unlisteners: Array<() => void> = []

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (pollId) clearInterval(pollId)
      unlisteners.forEach((fn) => fn())
    }

    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      fn()
    }

    const buildTimeoutMessage = async (): Promise<string> => {
      const timeoutMessage = 'Timeout waiting for node to become ready'

      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const [state, logResponse] = await Promise.all([
          invoke<NodeState>('get_node_state'),
          invoke<{ logs: string[]; total: number }>('get_node_logs', {
            page: 1,
            pageSize: 20,
          }),
        ])

        const recentLogs = logResponse.logs
          .slice(-5)
          .map((line) => line.trim())
          .filter(Boolean)

        const details = [`Current state: ${state.status}`]

        if (state.status === 'Failed') {
          details.push(`Failure: ${state.message}`)
        } else if (lastNodeError) {
          details.push(`Last node error: ${lastNodeError}`)
        }

        if (recentLogs.length > 0) {
          details.push(`Recent output: ${recentLogs.join(' | ')}`)
        }

        return `${timeoutMessage}. ${details.join('. ')}`
      } catch {
        if (lastNodeError) {
          return `${timeoutMessage}. Last node error: ${lastNodeError}`
        }

        return timeoutMessage
      }
    }

    const checkReady = async () => {
      if (settled) return
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const state = await invoke<NodeState>('get_node_state')

        if (state.status === 'Failed') {
          settle(() =>
            reject(
              new Error(
                `Node failed: ${(state as Extract<NodeState, { status: 'Failed' }>).message}`
              )
            )
          )
          return
        }

        if (state.status === 'Stopped') {
          settle(() => reject(new Error('Node process stopped unexpectedly')))
          return
        }

        if (state.status === 'Running') {
          settle(() => resolve())
          return
        }

        // Primary check: Tauri-side HTTP probe — avoid coupling frontend readiness
        // to the backend's final state transition. If the daemon is answering, the UI
        // can continue even if the backend is still marked Starting momentarily.
        if (daemonPort) {
          try {
            const status = await invoke<number>('probe_node_http', {
              daemonPort: Number(daemonPort),
            })
            console.log(
              '[waitForNodeReady] Tauri HTTP probe succeeded with status',
              status,
              'while backend state is',
              state.status
            )
            if (status > 0) {
              settle(() => resolve())
            }
          } catch {
            // Connection refused or timeout — node not listening yet, keep polling
          }
        }
      } catch {
        // Keep polling
      }
    }

    timeoutId = setTimeout(() => {
      void buildTimeoutMessage()
        .then((message) => {
          settle(() => reject(new Error(message)))
        })
        .catch(() => {
          settle(() =>
            reject(new Error('Timeout waiting for node to become ready'))
          )
        })
    }, timeoutMs)
    ;(async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')

        const unlistenLog = await listen<string>('node-log', (event) => {
          if (!settled && onProgress) onProgress(event.payload)
        })
        unlisteners.push(unlistenLog)

        const unlistenStarted = await listen<string>('node-started', () => {
          settle(() => resolve())
        })
        unlisteners.push(unlistenStarted)

        const unlistenState = await listen<NodeState>(
          'node-state-changed',
          (event) => {
            const state = event.payload
            if (state.status === 'Running') {
              settle(() => resolve())
              return
            }

            if (state.status === 'Failed') {
              settle(() =>
                reject(
                  new Error(
                    `Node failed: ${
                      (state as Extract<NodeState, { status: 'Failed' }>)
                        .message
                    }`
                  )
                )
              )
              return
            }

            // Stopped can arrive when the node is cleanly shut down (e.g. user
            // cancelled init) or after force_kill. Reject immediately so the
            // caller doesn't have to wait for the next 2-second poll cycle.
            if (state.status === 'Stopped') {
              settle(() =>
                reject(new Error('Node process stopped unexpectedly'))
              )
            }
          }
        )
        unlisteners.push(unlistenState)

        // Belt-and-suspenders: also listen for the explicit node-stopped event.
        // The monitoring thread emits this when the process exits cleanly, but
        // does NOT always emit node-state-changed for the Stopped transition.
        const unlistenStopped = await listen('node-stopped', () => {
          settle(() => reject(new Error('Node process stopped unexpectedly')))
        })
        unlisteners.push(unlistenStopped)

        const unlistenError = await listen<string>('node-error', (event) => {
          const error = event.payload
          lastNodeError = error
          if (!settled && onProgress) onProgress(`ERROR: ${error}`)
          if (
            error.includes('Address already in use') ||
            error.includes('failed to start') ||
            error.includes('panic') ||
            error.includes('unavailable') ||
            error.includes('is already in use') ||
            // Emitted by handle_http_wait_error when the 30-second backend
            // readiness probe times out
            error.includes('never became ready')
          ) {
            settle(() => reject(new Error(error)))
          }
        })
        unlisteners.push(unlistenError)

        const unlistenCrashed = await listen<string>(
          'node-crashed',
          (event) => {
            if (!settled && onProgress) {
              onProgress(`CRASH: ${event.payload}`)
            }
            settle(() => reject(new Error(`Node crashed: ${event.payload}`)))
          }
        )
        unlisteners.push(unlistenCrashed)

        // Poll every 2s — works even if no log events arrive
        pollId = setInterval(checkReady, 2000)

        // Check immediately too
        await checkReady()
      } catch (error) {
        settle(() => reject(error))
      }
    })()
  })
}
