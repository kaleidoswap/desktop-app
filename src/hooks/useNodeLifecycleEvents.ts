import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useEffect } from 'react'

import { useAppDispatch } from '../app/store/hooks'
import {
  setLifecycleState,
  type BackendNodeState,
} from '../slices/node/node.slice'

export const useNodeLifecycleEvents = () => {
  const dispatch = useAppDispatch()

  useEffect(() => {
    let isMounted = true

    const syncInitialState = async () => {
      try {
        const state = await invoke<BackendNodeState>('get_node_state')
        if (isMounted) {
          dispatch(setLifecycleState(state))
        }
      } catch (error) {
        console.error('Failed to fetch initial node state:', error)
      }
    }

    const setupListeners = async () => {
      const unlisteners = await Promise.all([
        listen<BackendNodeState>('node-state-changed', (event) => {
          dispatch(setLifecycleState(event.payload))
        }),
        listen<string>('node-crashed', (event) => {
          const message = `Node crashed: ${event.payload}`
          dispatch(
            setLifecycleState({
              message,
              status: 'Failed',
            })
          )
        }),
        listen('node-stopped', () => {
          dispatch(
            setLifecycleState({
              status: 'Stopped',
            })
          )
        }),
      ])

      return () => {
        unlisteners.forEach((unlisten) => unlisten())
      }
    }

    void syncInitialState()
    const cleanupPromise = setupListeners()

    return () => {
      isMounted = false
      void cleanupPromise.then((cleanup) => cleanup())
    }
  }, [dispatch])
}
