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

    const checkReady = async () => {
      if (settled) return
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const state = await invoke<NodeState>('get_node_state')

        if (state.status === 'Failed') {
          settle(() => reject(new Error(`Node failed: ${(state as Extract<NodeState, { status: 'Failed' }>).message}`)))
          return
        }

        if (state.status === 'Running') {
          // Primary check: direct HTTP probe — any response means the node is up
          if (daemonPort) {
            try {
              const controller = new AbortController()
              const timerId = setTimeout(() => controller.abort(), 2000)
              const res = await fetch(
                `http://127.0.0.1:${daemonPort}/nodeinfo`,
                { signal: controller.signal }
              )
              clearTimeout(timerId)
              if (res.status > 0) {
                settle(() => resolve())
              }
            } catch {
              // Connection refused or timeout — node not listening yet, keep polling
            }
            return
          }

          // Fallback: port binding check via Tauri
          try {
            const currentAccount = await invoke<string | null>('get_running_node_account')
            if (currentAccount) {
              const ports = await invoke<Record<string, string>>('get_running_node_ports')
              const port = Object.entries(ports).find(([, acc]) => acc === currentAccount)?.[0]
              if (port) {
                const availability = await invoke<Record<string, boolean>>('check_ports_available', { ports: [port] })
                if (availability[port] === true) {
                  // Port still available — node hasn't bound yet
                  return
                }
                // Port is bound, node is ready
                await new Promise((r) => setTimeout(r, 500))
                settle(() => resolve())
                return
              }
            }
            // Cannot determine port — keep polling rather than resolving early
          } catch {
            // Not ready yet, keep polling
          }
        }
      } catch {
        // Keep polling
      }
    }

    timeoutId = setTimeout(() => {
      settle(() => reject(new Error('Timeout waiting for node to become ready')))
    }, timeoutMs)

    ;(async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')

        const unlistenLog = await listen<string>('node-log', (event) => {
          if (!settled && onProgress) onProgress(event.payload)
        })
        unlisteners.push(unlistenLog)

        const unlistenError = await listen<string>('node-error', (event) => {
          const error = event.payload
          if (
            error.includes('Address already in use') ||
            error.includes('failed to start') ||
            error.includes('unavailable') ||
            error.includes('is already in use')
          ) {
            settle(() => reject(new Error(error)))
          }
        })
        unlisteners.push(unlistenError)

        const unlistenCrashed = await listen<string>('node-crashed', (event) => {
          settle(() => reject(new Error(`Node crashed: ${event.payload}`)))
        })
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
