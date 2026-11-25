import { invoke } from '@tauri-apps/api/core'
import { useState, useEffect, useCallback, useRef } from 'react'
import { logger } from '../../utils/logger'

export function useLocalNodeCapabilities() {
  // Docker / local node mode
  const [isNativeSupported, setIsNativeSupported] = useState(false)
  const [isDockerAvailable, setIsDockerAvailable] = useState(false)
  const [capabilitiesLoaded, setCapabilitiesLoaded] = useState(false)
  const [localNodeMode, setLocalNodeMode] = useState<
    'native' | 'docker' | null
  >(null)

  const [checkingCapabilities, setCheckingCapabilities] = useState(false)
  const capabilityCheckPending = useRef(false)
  const checkCapabilities = useCallback(async () => {
    if (capabilityCheckPending.current) return
    capabilityCheckPending.current = true
    setCheckingCapabilities(true)
    try {
      const caps = await invoke<Record<string, boolean>>(
        'get_local_node_capabilities'
      )
      const native = caps.native ?? false
      const docker = caps.docker ?? false
      setIsNativeSupported(native)
      setIsDockerAvailable(docker)
      setLocalNodeMode((mode) => {
        if ((mode === 'docker' && docker) || (mode === 'native' && native)) {
          return mode
        }
        return docker ? 'docker' : native ? 'native' : null
      })
    } catch (error) {
      logger.error('Failed to check local node capabilities:', error)
      setIsNativeSupported(false)
      setIsDockerAvailable(false)
      setLocalNodeMode(null)
    } finally {
      capabilityCheckPending.current = false
      setCheckingCapabilities(false)
      setCapabilitiesLoaded(true)
    }
  }, [])

  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => {
      if (active) void checkCapabilities()
    })
    const onFocus = () => void checkCapabilities()
    window.addEventListener('focus', onFocus)
    return () => {
      active = false
      window.removeEventListener('focus', onFocus)
    }
  }, [checkCapabilities])

  return {
    capabilitiesLoaded,
    checkCapabilities,
    checkingCapabilities,
    isDockerAvailable,
    isNativeSupported,
    localNodeMode,
    setLocalNodeMode,
  }
}
