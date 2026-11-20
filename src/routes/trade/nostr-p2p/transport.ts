/**
 * How the market talks to the daemon. In the app every call goes through Rust (`p2p_request`),
 * which only forwards the market's own routes. A plain HTTP transport exists so the interface can
 * be developed and previewed in a browser against a daemon on loopback.
 */

import { invoke } from '@tauri-apps/api/core'

export type Method = 'GET' | 'POST' | 'DELETE'

export interface Transport {
  request<T>(method: Method, path: string, body?: unknown): Promise<T>
}

export const tauriTransport: Transport = {
  request: (method, path, body) =>
    invoke('p2p_request', { body: body ?? null, method, path }),
}

export function httpTransport(base: string): Transport {
  return {
    async request<T>(method: Method, path: string, body?: unknown) {
      const res = await fetch(base + path, {
        body: body === undefined ? undefined : JSON.stringify(body),
        headers:
          body === undefined
            ? undefined
            : { 'content-type': 'application/json' },
        method,
      })
      const text = await res.text()
      if (!res.ok) throw new Error(text || res.statusText)
      return (text ? JSON.parse(text) : undefined) as T
    },
  }
}

let current: Transport = tauriTransport

export const setTransport = (t: Transport) => {
  current = t
}

export const transport = (): Transport => current
