import type { WalletStore } from '../wallets'

export const memoryWalletStore = (): WalletStore => {
  const data = new Map<string, string>()
  return {
    getItem: (key) => data.get(key) ?? null,
    removeItem: (key) => {
      data.delete(key)
    },
    setItem: (key, value) => {
      data.set(key, value)
    },
  }
}
