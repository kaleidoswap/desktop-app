import { invoke } from '@tauri-apps/api/core'
import type { BitcoinNetwork } from '../constants'
import { nodeApi } from './nodeApi/nodeApi.slice'

export interface SavedNodeAccount {
  local: boolean
  name: string
  network: BitcoinNetwork
}

// The native rows can include node credentials and encrypted backup material.
// Keep only the display fields in the shared navigation cache.
const accountsApi = nodeApi
  .enhanceEndpoints({
    addTagTypes: ['SavedNodeAccounts'],
  })
  .injectEndpoints({
    endpoints: (builder) => ({
      savedNodeAccounts: builder.query<SavedNodeAccount[], void>({
        providesTags: ['SavedNodeAccounts'],
        async queryFn() {
          try {
            const accounts = await invoke<
              {
                datapath: string | null
                name: string
                network: BitcoinNetwork
              }[]
            >('get_accounts')
            return {
              data: accounts.map(({ datapath, name, network }) => ({
                local: Boolean(datapath),
                name,
                network,
              })),
            }
          } catch (error) {
            return { error: { message: String(error) } }
          }
        },
      }),
    }),
  })

export const { useSavedNodeAccountsQuery } = accountsApi
export const invalidateNodeAccounts = () =>
  accountsApi.util.invalidateTags(['SavedNodeAccounts'])
