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
 * Enhanced node startup helper with better readiness detection
 */
export const waitForNodeReady = async (options: {
  timeoutMs?: number
  onProgress?: (message: string) => void
} = {}): Promise<void> => {
  const { timeoutMs = 60000, onProgress } = options

  return new Promise((resolve, reject) => {
    let unlistenLog: (() => void) | null = null
    let unlistenError: (() => void) | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    let cleanup = () => {
      if (unlistenLog) unlistenLog()
      if (unlistenError) unlistenError()
      if (timeoutId) clearTimeout(timeoutId)
    }

    const checkReady = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const state = await invoke<NodeState>('get_node_state')

        if (state.status === 'Running') {
          // Node is marked as running, now check if it's actually responding
          try {
            await invoke('node_info')
            cleanup()
            resolve()
            return true
          } catch (error) {
            // Node not ready yet, continue waiting
            return false
          }
        } else if (state.status === 'Failed') {
          cleanup()
          reject(new Error(`Node failed: ${state.message}`))
          return true
        }
        return false
      } catch (error) {
        // Continue waiting
        return false
      }
    }

    // Set up timeout
    timeoutId = setTimeout(async () => {
      const isReady = await checkReady()
      if (!isReady) {
        cleanup()
        reject(new Error('Timeout waiting for node to become ready'))
      }
    }, timeoutMs)

    // Set up event listeners
    ;(async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')

        unlistenLog = await listen<string>('node-log', async (event) => {
          const log = event.payload
          if (onProgress) {
            onProgress(log)
          }

          // Check for readiness indicators in logs
          if (
            log.includes('Listening on') ||
            log.includes('Node is ready') ||
            log.includes('Server started')
          ) {
            // Give it a moment to fully initialize
            await new Promise((r) => setTimeout(r, 2000))
            const isReady = await checkReady()
            if (isReady) return
          }
        })

        unlistenError = await listen<string>('node-error', (event) => {
          const error = event.payload
          if (
            error.includes('Address already in use') ||
            error.includes('failed to start')
          ) {
            cleanup()
            reject(new Error(error))
          }
        })

        // Also check for 'node-started' event
        const unlistenStarted = await listen('node-started', async () => {
          if (onProgress) {
            onProgress('Node process started, waiting for initialization...')
          }
          await new Promise((r) => setTimeout(r, 1000))
          await checkReady()
        })

        // Add to cleanup
        const originalCleanup = cleanup
        cleanup = () => {
          originalCleanup()
          unlistenStarted()
        }
      } catch (error) {
        cleanup()
        reject(error)
      }
    })()
  })
}
