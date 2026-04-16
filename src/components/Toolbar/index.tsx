import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import {
  Trash2,
  MoreVertical,
  X,
  Server,
  Cloud,
  AlertTriangle,
} from 'lucide-react'
import { Input } from '../ui'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import {
  ROOT_PATH,
  WALLET_SETUP_PATH,
  WALLET_UNLOCK_PATH,
} from '../../app/router/paths'
import { useAppDispatch } from '../../app/store/hooks'
import { buildLocalNodeUrl, normalizeNodeUrl } from '../../api/client'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { MinidenticonImg } from '../../components/MinidenticonImg'
import { Spinner } from '../../components/Spinner'
import { BitcoinNetwork, getNetworkDisplayName } from '../../constants'
import {
  nodeSettingsActions,
  setSettingsAsync,
} from '../../slices/nodeSettings/nodeSettings.slice'
import { waitForNodeReady } from '../../utils/nodeState'

export interface Account {
  datapath: string
  default_lsp_url: string
  default_maker_url: string
  indexer_url: string
  maker_urls: string[] | string
  name: string
  network: BitcoinNetwork
  node_url: string
  proxy_endpoint: string
  rpc_connection_url: string
  daemon_listening_port: string
  ldk_peer_listening_port: string
  language?: string
}

interface ModalProps {
  onClose: () => void
  children: React.ReactNode
}

interface NodeCardProps {
  account: Account
  isCollapsed: boolean
  onSelect: (account: Account) => void
  onEdit: (account: Account) => void
  onDelete: (account: Account) => void
}

const Modal: React.FC<ModalProps> = ({ onClose, children }) => {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Prevent scrolling of the body when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [])

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="bg-surface-overlay text-white p-8 rounded-xl shadow-xl max-w-lg w-full mx-4 overflow-auto max-h-[90vh] animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          aria-label="Close modal"
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-surface-high text-content-secondary hover:text-white transition-colors"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  )
}

const withTimeout = <T,>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
        ms
      )
    ),
  ])

const invokeWithTimeout = <T,>(
  command: string,
  args: Record<string, unknown> | undefined,
  ms: number,
  label: string
): Promise<T> =>
  withTimeout(args ? invoke<T>(command, args) : invoke<T>(command), ms, label)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const NodeCard: React.FC<NodeCardProps> = ({
  account,
  isCollapsed,
  onSelect,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ left: 0, top: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const NodeIcon = account.datapath ? Server : Cloud
  const nodeType = account.datapath
    ? t('toolbar.nodeCard.local')
    : t('toolbar.nodeCard.remote')
  const nodeColor = account.datapath ? 'text-green-400' : 'text-primary'

  useEffect(() => {
    if (!isMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMenuOpen])

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setMenuPos({ left: rect.right - 144, top: rect.bottom + 4 })
    setIsMenuOpen((prev) => !prev)
  }

  return (
    <div
      className={`group bg-surface-overlay/50 rounded-xl transition-all duration-300
        hover:bg-surface-overlay relative border overflow-hidden cursor-pointer
        border-divider/5 hover:border-divider/20 hover:shadow-lg hover:shadow-primary/5
        ${isMenuOpen ? '' : 'hover:-translate-y-0.5'}`}
      onClick={() => onSelect(account)}
    >
      <div className={`flex items-center gap-4 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        {/* Avatar */}
        <div className="relative">
          <MinidenticonImg
            className="rounded-lg flex-shrink-0"
            height="40"
            saturation="90"
            username={account.name}
            width="40"
          />
          {isCollapsed && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-surface-base flex items-center justify-center shadow-sm">
              <NodeIcon className={`w-3 h-3 ${nodeColor}`} />
            </div>
          )}
        </div>

        {/* Node details */}
        {!isCollapsed && (
          <div className="min-w-0 flex-grow">
            <div className="font-medium text-white truncate">
              {account.name}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface-base text-content-secondary">
                {getNetworkDisplayName(account.network)}
              </span>
              <span className={`flex items-center ${nodeColor} text-sm`}>
                <NodeIcon className="w-3 h-3 mr-1" />
                {nodeType}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3-dots button — absolutely anchored to top-right of card */}
      {!isCollapsed && (
        <button
          aria-label={`Options for ${account.name}`}
          className={`absolute top-2 right-2 p-1.5 rounded-lg text-content-tertiary hover:text-white
            hover:bg-surface-high/60 transition-colors duration-200
            ${isMenuOpen ? 'opacity-100 bg-surface-high/60 text-white' : 'opacity-0 group-hover:opacity-100'}`}
          onClick={openMenu}
          ref={btnRef}
        >
          <MoreVertical size={16} />
        </button>
      )}

      {/* Dropdown — fixed so it escapes overflow clipping */}
      {isMenuOpen && !isCollapsed && (
        <div
          className="fixed w-36 bg-surface-overlay border border-border-default/40 rounded-lg shadow-xl py-1"
          onClick={(e) => e.stopPropagation()}
          ref={menuRef}
          style={{ left: menuPos.left, top: menuPos.top, zIndex: 9999 }}
        >
          <button
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-content-primary hover:bg-surface-high/60 transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              setIsMenuOpen(false)
              onEdit(account)
            }}
          >
            Edit
          </button>
          <button
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              setIsMenuOpen(false)
              onDelete(account)
            }}
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

// Custom Hooks
const useAccounts = () => {
  const { t } = useTranslation()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const fetchedAccounts = (await invoke('get_accounts')) as Account[]
        setAccounts(fetchedAccounts)
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error(t('toolbar.accounts.fetchFailed'))
        )
        toast.error(t('toolbar.accounts.fetchFailed'))
      } finally {
        setIsLoading(false)
      }
    }

    fetchAccounts()
  }, [])

  const updateAccount = useCallback(async (updatedAccount: Account) => {
    try {
      // Convert maker_urls to string if it's an array
      const makerUrlsString = Array.isArray(updatedAccount.maker_urls)
        ? updatedAccount.maker_urls.join(',')
        : updatedAccount.maker_urls

      // Use camelCase parameter names for Tauri command
      const params = {
        daemonListeningPort: updatedAccount.daemon_listening_port,
        datapath: updatedAccount.datapath,
        defaultLspUrl: updatedAccount.default_lsp_url,
        defaultMakerUrl: updatedAccount.default_maker_url,
        indexerUrl: updatedAccount.indexer_url,
        ldkPeerListeningPort: updatedAccount.ldk_peer_listening_port,
        makerUrls: makerUrlsString,
        name: updatedAccount.name,
        network: updatedAccount.network,
        nodeUrl: updatedAccount.node_url,
        proxyEndpoint: updatedAccount.proxy_endpoint,
        rpcConnectionUrl: updatedAccount.rpc_connection_url,
      }

      await invoke('update_account', params)

      setAccounts((prev) =>
        prev.map((acc) =>
          acc.name === updatedAccount.name ? updatedAccount : acc
        )
      )

      toast.success(
        t('toolbar.accounts.updateSuccess', { name: updatedAccount.name })
      )
    } catch (error) {
      toast.error(
        t('toolbar.accounts.updateFailed', {
          error: error instanceof Error ? error.message : String(error),
        })
      )
      throw error
    }
  }, [])

  const deleteAccount = useCallback(async (account: Account) => {
    try {
      await invoke('delete_account', { name: account.name })
      setAccounts((prev) => prev.filter((a) => a.name !== account.name))
      toast.success(t('toolbar.accounts.deleteSuccess', { name: account.name }))
    } catch (error) {
      toast.error(t('toolbar.accounts.deleteFailed', { name: account.name }))
      throw error
    }
  }, [])

  return {
    accounts,
    deleteAccount,
    error,
    isLoading,
    updateAccount,
  }
}

// Main Toolbar Component
interface ToolbarProps {
  isCollapsed?: boolean
}

export const Toolbar: React.FC<ToolbarProps> = ({ isCollapsed = false }) => {
  const { t } = useTranslation()
  const { accounts, isLoading, error, updateAccount, deleteAccount } =
    useAccounts()

  const [selectedNode, setSelectedNode] = useState<Account | null>(null)
  const [nodeToDelete, setNodeToDelete] = useState<Account | null>(null)
  const [editingNode, setEditingNode] = useState<Account | null>(null)
  const [isSwitching, setIsSwitching] = useState(false)

  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  useEffect(() => {
    let isToastActive = false
    let timeoutId: number

    const handleNodeStarted = (event: { payload: string }) => {
      // If a toast is already active or there's a pending timeout, don't show another one
      if (isToastActive) return

      // Set the flag to prevent multiple toasts
      isToastActive = true

      // Clear any existing timeout
      if (timeoutId) window.clearTimeout(timeoutId)

      // Show the toast
      toast.success(
        t('toolbar.nodes.localNodeStarted', { name: event.payload }),
        {
          autoClose: 3000,
          onClose: () => {
            // Reset the flag when the toast closes
            isToastActive = false
          },
          position: 'bottom-right',
          toastId: 'node-started',
        }
      )

      // Set a timeout to reset the flag (in case onClose doesn't fire)
      timeoutId = window.setTimeout(() => {
        isToastActive = false
      }, 3000)
    }

    const unlisten = listen('node-started', handleNodeStarted)

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId)
      unlisten.then((fn) => fn())
    }
  }, [t])

  const [getNodeInfo] = nodeApi.endpoints.nodeInfo.useLazyQuery()

  const navigateFromNodeStatus = useCallback(
    async (timeoutMs = 15000): Promise<boolean> => {
      const nodeInfoRes = await withTimeout(
        getNodeInfo(),
        timeoutMs,
        'Checking node status'
      )

      if (nodeInfoRes.isSuccess) {
        console.log('Node unlocked, navigating to dashboard')
        navigate(ROOT_PATH)
        return true
      }

      const status =
        nodeInfoRes.error &&
        typeof nodeInfoRes.error === 'object' &&
        'status' in nodeInfoRes.error
          ? (nodeInfoRes.error as { status?: number | string }).status
          : undefined

      if (status === 400 || status === '400') {
        navigate(WALLET_SETUP_PATH)
        return true
      }

      if (
        status === 401 ||
        status === '401' ||
        status === 403 ||
        status === '403'
      ) {
        console.log('Node locked, navigating to unlock page')
        navigate(WALLET_UNLOCK_PATH)
        return true
      }

      return false
    },
    [getNodeInfo, navigate]
  )

  const waitForNodeStopped = useCallback(
    (timeoutMs = 15000): Promise<void> =>
      new Promise((resolve, reject) => {
        let unlisten: (() => void) | null = null

        const cleanup = () => {
          if (unlisten) {
            unlisten()
          }
        }

        const timeoutId = window.setTimeout(() => {
          cleanup()
          reject(
            new Error(
              `Waiting for node shutdown timed out after ${timeoutMs / 1000}s`
            )
          )
        }, timeoutMs)

        listen('node-stopped', () => {
          window.clearTimeout(timeoutId)
          cleanup()
          resolve()
        })
          .then((fn) => {
            unlisten = fn
          })
          .catch((error) => {
            window.clearTimeout(timeoutId)
            cleanup()
            reject(
              new Error(
                `Failed to subscribe to node shutdown event: ${
                  error instanceof Error ? error.message : String(error)
                }`
              )
            )
          })
      }),
    []
  )

  const handleNodeChange = async (node: Account) => {
    try {
      setIsSwitching(true)

      const currentNode = await invokeWithTimeout<Account | null>(
        'get_current_account',
        undefined,
        10000,
        'Loading current account'
      )

      const isNodeRunning = await invokeWithTimeout<boolean>(
        'is_node_running',
        {
          accountName: node.name,
        },
        10000,
        'Checking target node status'
      )

      const runningNodeAccount = await invokeWithTimeout<string | null>(
        'get_running_node_account',
        undefined,
        10000,
        'Loading running node account'
      )

      if (currentNode && currentNode.name === node.name && isNodeRunning) {
        // First update the Redux store before navigating
        const dbNode = await invokeWithTimeout<Account>(
          'get_account_by_name',
          {
            name: node.name,
          },
          10000,
          'Loading selected account'
        )

        if (!dbNode) {
          throw new Error('Node not found in database')
        }

        const formattedNode = {
          ...dbNode,
          maker_urls: Array.isArray(dbNode.maker_urls)
            ? dbNode.maker_urls
            : dbNode.maker_urls
                ?.split(',')
                .filter((url) => url.trim() !== '') || [],
        }

        // Wait for the Redux store to be updated
        await dispatch(setSettingsAsync(formattedNode))

        // Check if node is unlocked via API (same logic as root route)
        const didNavigate = await navigateFromNodeStatus()
        if (!didNavigate) {
          navigate(WALLET_UNLOCK_PATH)
        }
        return
      }

      // Only stop the running node if it's a different account than the target
      if (runningNodeAccount && runningNodeAccount !== node.name) {
        const stoppedPromise = waitForNodeStopped()
        try {
          await invokeWithTimeout(
            'stop_node',
            undefined,
            5000,
            'Stopping currently running node'
          )
        } catch (error) {
          void stoppedPromise.catch(() => undefined)
          throw error
        }
        await stoppedPromise
      }

      await invokeWithTimeout(
        'set_current_account',
        { accountName: node.name },
        10000,
        'Setting current account'
      )

      const dbNode = await invokeWithTimeout<Account>(
        'get_account_by_name',
        {
          name: node.name,
        },
        10000,
        'Loading selected account'
      )

      if (!dbNode) {
        throw new Error('Node not found in database')
      }

      const formattedNode = {
        ...dbNode,
        maker_urls: Array.isArray(dbNode.maker_urls)
          ? dbNode.maker_urls
          : dbNode.maker_urls?.split(',').filter((url) => url.trim() !== '') ||
            [],
      }

      await dispatch(setSettingsAsync(formattedNode))

      const isLocalNode =
        normalizeNodeUrl(node.node_url)?.startsWith('http://127.0.0.1:') &&
        node.datapath !== ''

      if (isLocalNode && runningNodeAccount !== node.name) {
        toast.info(t('toolbar.nodes.startingLocalNode'), {
          autoClose: 2000,
          position: 'bottom-right',
        })

        try {
          // Check port availability before starting the node
          const ports = [
            node.daemon_listening_port,
            node.ldk_peer_listening_port,
          ]
          const portCheck = await invokeWithTimeout<{
            [port: string]: boolean
          }>(
            'check_ports_available',
            { ports },
            10000,
            'Checking port availability'
          )
          const unavailablePorts = Object.entries(portCheck)
            .filter(([_, isAvailable]) => !isAvailable)
            .map(([port]) => port)

          if (unavailablePorts.length > 0) {
            // Try to stop our own nodes first
            const runningNodePorts = await invokeWithTimeout<{
              [port: string]: string
            }>(
              'get_running_node_ports',
              undefined,
              10000,
              'Loading running node ports'
            )
            const ourConflictingPorts = unavailablePorts.filter(
              (port) => port in runningNodePorts
            )

            if (ourConflictingPorts.length > 0) {
              toast.info(t('toolbar.nodes.stoppingExisting'), {
                autoClose: 2000,
              })
              for (const port of ourConflictingPorts) {
                const nodeAccount = runningNodePorts[port]
                try {
                  const stoppedPromise = waitForNodeStopped()
                  try {
                    await invokeWithTimeout(
                      'stop_node_by_account',
                      { accountName: nodeAccount },
                      5000,
                      `Stopping node for account ${nodeAccount}`
                    )
                  } catch (error) {
                    void stoppedPromise.catch(() => undefined)
                    throw error
                  }
                  await stoppedPromise
                } catch (error) {
                  console.warn(`Could not stop node on port ${port}:`, error)
                }
              }
            } else {
              // Try stopping any stale node
              try {
                const stoppedPromise = waitForNodeStopped()
                try {
                  await invokeWithTimeout(
                    'stop_node',
                    undefined,
                    5000,
                    'Stopping stale node'
                  )
                } catch (error) {
                  void stoppedPromise.catch(() => undefined)
                }
                await stoppedPromise
              } catch {
                // Ignore
              }
            }

            // After stopping, find available ports automatically
            const recheckPorts = await invokeWithTimeout<{
              [port: string]: boolean
            }>('check_ports_available', { ports }, 10000, 'Re-checking ports')
            const stillUnavailable = Object.entries(recheckPorts)
              .filter(([_, isAvailable]) => !isAvailable)
              .map(([port]) => port)

            if (stillUnavailable.length > 0) {
              const availablePorts = await invokeWithTimeout<{
                daemon: number
                ldk: number
              }>(
                'find_available_ports',
                {
                  baseDaemonPort: parseInt(node.daemon_listening_port),
                  baseLdkPort: parseInt(node.ldk_peer_listening_port),
                },
                10000,
                'Finding available ports'
              )
              node.daemon_listening_port = String(availablePorts.daemon)
              node.ldk_peer_listening_port = String(availablePorts.ldk)
              node.node_url = `http://localhost:${availablePorts.daemon}`

              // Update account in DB with new ports
              await invoke('update_account', {
                bearerToken: null,
                daemonListeningPort: node.daemon_listening_port,
                datapath: node.datapath,
                defaultLspUrl: node.default_lsp_url,
                defaultMakerUrl: node.default_maker_url,
                indexerUrl: node.indexer_url,
                language: node.language || 'en',
                ldkPeerListeningPort: node.ldk_peer_listening_port,
                makerUrls: Array.isArray(node.maker_urls)
                  ? node.maker_urls.join(',')
                  : node.maker_urls,
                name: node.name,
                network: node.network,
                nodeUrl: node.node_url,
                proxyEndpoint: node.proxy_endpoint,
                rpcConnectionUrl: node.rpc_connection_url,
              })

              toast.info(
                `Ports auto-updated: daemon ${availablePorts.daemon}, peer ${availablePorts.ldk}`,
                { autoClose: 3000 }
              )
            }
          }

          // Start the node with the resolved ports
          await invokeWithTimeout(
            'start_node',
            {
              accountName: node.name,
              daemonListeningPort: node.daemon_listening_port,
              datapath: node.datapath,
              ldkPeerListeningPort: node.ldk_peer_listening_port,
              network: node.network,
            },
            90000,
            'Starting local node process'
          )

          await waitForNodeReady({
            daemonPort: node.daemon_listening_port,
            timeoutMs: 90000,
          })

          // Decide destination from real node API status:
          // - unlocked: dashboard
          // - locked: unlock
          // - uninitialized: setup
          let destination:
            | typeof ROOT_PATH
            | typeof WALLET_UNLOCK_PATH
            | typeof WALLET_SETUP_PATH = WALLET_UNLOCK_PATH

          for (let attempt = 0; attempt < 8; attempt++) {
            const nodeInfoRes = await withTimeout(
              getNodeInfo(),
              5000,
              'Checking node status after start'
            )

            if (nodeInfoRes.isSuccess) {
              destination = ROOT_PATH
              break
            }

            const status =
              nodeInfoRes.error &&
              typeof nodeInfoRes.error === 'object' &&
              'status' in nodeInfoRes.error
                ? (nodeInfoRes.error as { status?: number | string }).status
                : undefined

            if (status === 400) {
              destination = WALLET_SETUP_PATH
              break
            }

            if (status === 401 || status === 403) {
              destination = WALLET_UNLOCK_PATH
              break
            }

            await sleep(750)
          }

          navigate(destination)
          return
        } catch (error) {
          throw new Error(
            error instanceof Error ? error.message : 'Failed to start node',
            { cause: error }
          )
        }
      }

      // Check if this might be a Docker-managed node (localhost URL, no datapath)
      const isDockerCandidate =
        !isLocalNode &&
        node.datapath === '' &&
        normalizeNodeUrl(node.node_url)?.startsWith('http://127.0.0.1:')

      if (isDockerCandidate) {
        try {
          const dockerEnv = await invokeWithTimeout<{
            name: string
            daemon_ports: number[]
          } | null>(
            'check_docker_environment',
            { accountName: node.name },
            5000,
            'Checking Docker environment'
          )

          if (dockerEnv) {
            toast.info(
              t('toolbar.nodes.startingDockerNode', {
                defaultValue: 'Starting Docker node...',
              }),
              { autoClose: 3000, position: 'bottom-right' }
            )

            const dockerPort = await invokeWithTimeout<number>(
              'start_docker_node',
              { envName: dockerEnv.name },
              90000,
              'Starting Docker node'
            )

            await waitForNodeReady({
              daemonPort: dockerPort,
              timeoutMs: 90000,
            })

            // Decide destination from node API status
            let destination:
              | typeof ROOT_PATH
              | typeof WALLET_UNLOCK_PATH
              | typeof WALLET_SETUP_PATH = WALLET_UNLOCK_PATH

            for (let attempt = 0; attempt < 8; attempt++) {
              const nodeInfoRes = await withTimeout(
                getNodeInfo(),
                5000,
                'Checking node status after Docker start'
              )

              if (nodeInfoRes.isSuccess) {
                destination = ROOT_PATH
                break
              }

              const status =
                nodeInfoRes.error &&
                typeof nodeInfoRes.error === 'object' &&
                'status' in nodeInfoRes.error
                  ? (nodeInfoRes.error as { status?: number | string }).status
                  : undefined

              if (status === 400) {
                destination = WALLET_SETUP_PATH
                break
              }
              if (status === 401 || status === 403) {
                destination = WALLET_UNLOCK_PATH
                break
              }

              await sleep(750)
            }

            navigate(destination)
            return
          }
        } catch (error) {
          console.warn('Docker auto-start check failed:', error)
          // Fall through to normal remote node handling
        }
      }

      // Check if node is unlocked or locked via API (same logic as root route)
      const didNavigate = await navigateFromNodeStatus()
      if (!didNavigate) {
        navigate(WALLET_UNLOCK_PATH)
      }
    } catch (error) {
      dispatch(nodeSettingsActions.resetNodeSettings())
      toast.error(
        error instanceof Error
          ? t('toolbar.nodes.startFailedWithReason', {
              error: error.message,
            })
          : t('toolbar.nodes.startFailed')
      )
    } finally {
      setIsSwitching(false)
      setSelectedNode(null)
    }
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        {t('toolbar.main.errorLoading', { error: error.message })}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size={24} />
      </div>
    )
  }

  return (
    <>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div
          className={`flex items-center justify-between ${isCollapsed ? 'p-2' : 'p-4'} flex-shrink-0`}
        >
          {/* Title - completely hidden in collapsed state, no hover effect */}
          {!isCollapsed && (
            <h2 className="text-xl font-semibold text-white">
              {t('toolbar.main.title')}
            </h2>
          )}
        </div>

        <div
          className={`flex-1 overflow-y-auto custom-scrollbar min-h-0 ${isCollapsed ? 'p-2' : 'p-4'} space-y-2`}
        >
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              {!isCollapsed && (
                <div
                  className={`bg-surface-overlay/50 rounded-xl p-6 max-w-xs`}
                >
                  <p className="text-content-secondary mb-2">
                    {t('toolbar.main.noNodesFound')}
                  </p>
                  <p className="text-sm text-content-tertiary">
                    {t('toolbar.main.createNodeHint')}
                  </p>
                </div>
              )}
            </div>
          ) : (
            accounts.map((account) => (
              <NodeCard
                account={account}
                isCollapsed={isCollapsed}
                key={account.name}
                onDelete={setNodeToDelete}
                onEdit={setEditingNode}
                onSelect={setSelectedNode}
              />
            ))
          )}
        </div>
      </div>

      {/* Node Selection Modal */}
      {selectedNode && (
        <Modal onClose={() => setSelectedNode(null)}>
          <NodeSelectionModalContent
            account={selectedNode}
            isLoading={isSwitching}
            onCancel={() => setSelectedNode(null)}
            onConfirm={handleNodeChange}
          />
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {nodeToDelete && (
        <Modal onClose={() => setNodeToDelete(null)}>
          <DeleteNodeModalContent
            account={nodeToDelete}
            onCancel={() => setNodeToDelete(null)}
            onConfirm={deleteAccount}
          />
        </Modal>
      )}

      {/* Edit Node Modal */}
      {editingNode && (
        <Modal onClose={() => setEditingNode(null)}>
          <EditNodeModalContent
            account={editingNode}
            onClose={() => setEditingNode(null)}
            onSave={updateAccount}
          />
        </Modal>
      )}
    </>
  )
}

// Modal Content Components
interface NodeSelectionModalContentProps {
  account: Account
  isLoading: boolean
  onCancel: () => void
  onConfirm: (account: Account) => void | Promise<void>
}

const NodeSelectionModalContent: React.FC<NodeSelectionModalContentProps> = ({
  account,
  isLoading,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const [suggestedPorts, setSuggestedPorts] = useState<{
    daemon: string
    ldk: string
  } | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [loadingState, setLoadingState] = useState<{
    message: string
    step: number
  } | null>(null)

  const handleConfirm = async () => {
    try {
      setLoadingState({
        message: t('toolbar.modal.checkingNodeStatus'),
        step: 1,
      })
      setError(null)

      // Check if node is already running
      const isNodeRunning = await invokeWithTimeout<boolean>(
        'is_node_running',
        { accountName: account.name },
        10000,
        'Checking selected node status'
      )

      if (isNodeRunning) {
        setLoadingState({
          message: t('toolbar.modal.nodeAlreadyRunning'),
          step: 2,
        })
      } else if (account.datapath) {
        setLoadingState({
          message: t('toolbar.modal.startingLocalNode'),
          step: 2,
        })
      } else {
        setLoadingState({
          message: t('toolbar.modal.connectingRemoteNode'),
          step: 2,
        })
      }

      await withTimeout(
        Promise.resolve(onConfirm(account)),
        45000,
        'Node switch operation'
      )
    } catch (error) {
      console.error('Node switch error:', error)
      if (error instanceof Error) {
        setError(error.message)
        // Check if error message contains suggested ports
        const match = error.message.match(
          /Daemon port: (\d+).*LDK peer port: (\d+)/s
        )
        if (match) {
          const [, daemonPort, ldkPort] = match
          setSuggestedPorts({
            daemon: daemonPort,
            ldk: ldkPort,
          })
        }
      } else {
        setError(t('toolbar.modal.unknownError'))
      }
    } finally {
      setLoadingState(null)
    }
  }

  const handleUseSuggestedPorts = async () => {
    if (!suggestedPorts) return

    const updatedAccount = {
      ...account,
      daemon_listening_port: suggestedPorts.daemon,
      ldk_peer_listening_port: suggestedPorts.ldk,
      node_url: buildLocalNodeUrl(suggestedPorts.daemon),
    }

    try {
      await withTimeout(
        Promise.resolve(onConfirm(updatedAccount)),
        45000,
        'Node switch operation'
      )
      setError(null)
      setSuggestedPorts(null)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : t('toolbar.modal.unknownError')
      )
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  const NodeIcon = account.datapath ? Server : Cloud
  const nodeType = account.datapath
    ? t('toolbar.modal.localNode')
    : t('toolbar.modal.remoteNode')
  const nodeColor = account.datapath ? 'text-green-400' : 'text-primary'
  const bgColor = account.datapath
    ? 'from-green-500/5 to-transparent'
    : 'from-cyan/5 to-transparent'

  return (
    <div className="max-h-[80vh] overflow-y-auto">
      <div className="sticky top-0 bg-surface-overlay pb-4 z-10">
        <h2 className="text-2xl font-bold mb-2">
          {t('toolbar.modal.switchNode')}
        </h2>
        <p className="text-content-secondary text-sm">
          {t('toolbar.modal.reviewDetails')}
        </p>
      </div>

      {/* Loading State */}
      {loadingState && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Spinner size={24} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-primary rounded-full" />
              </div>
            </div>
            <div>
              <p className="text-primary font-medium">{loadingState.message}</p>
              <div className="mt-2 flex gap-2">
                <div
                  className={`h-1 rounded-full flex-1 ${loadingState.step >= 1 ? 'bg-primary' : 'bg-surface-high'}`}
                />
                <div
                  className={`h-1 rounded-full flex-1 ${loadingState.step >= 2 ? 'bg-primary' : 'bg-surface-high'}`}
                />
                <div
                  className={`h-1 rounded-full flex-1 ${loadingState.step >= 3 ? 'bg-primary' : 'bg-surface-high'}`}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-500 font-medium">
                {t('toolbar.modal.errorSwitchingNode')}
              </p>
              <p className="text-sm text-red-400/80 mt-1 whitespace-pre-line">
                {error}
              </p>
              {suggestedPorts && (
                <div className="mt-3">
                  <button
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors"
                    onClick={handleUseSuggestedPorts}
                  >
                    {t('toolbar.modal.useSuggestedPorts')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        className={`bg-gradient-to-b ${bgColor} rounded-xl p-4 mb-4 border border-border-default`}
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            <MinidenticonImg
              className="rounded-lg"
              height="56"
              saturation="90"
              username={account.name}
              width="56"
            />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-surface-base flex items-center justify-center shadow-md">
              <NodeIcon className={`w-3.5 h-3.5 ${nodeColor}`} />
            </div>
          </div>
          <div className="flex-grow">
            <h3 className="text-xl font-semibold text-white">{account.name}</h3>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="bg-surface-base px-3 py-1 rounded-full text-sm text-content-secondary">
                {getNetworkDisplayName(account.network)}
              </span>
              <span
                className={`flex items-center ${nodeColor} text-sm font-medium`}
              >
                <NodeIcon className="mr-1.5" size={14} />
                {nodeType}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {/* Connection Details Section */}
        <div className="bg-surface-overlay/30 rounded-lg border border-border-default overflow-hidden">
          <button
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface-overlay/50 transition-colors"
            onClick={() => toggleSection('connection')}
          >
            <span className="font-medium text-white">
              {t('toolbar.modal.connectionDetails')}
            </span>
            <div
              className={`transform transition-transform ${expandedSection === 'connection' ? 'rotate-180' : ''}`}
            >
              <svg
                className="w-5 h-5 text-content-secondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M19 9l-7 7-7-7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </div>
          </button>
          {expandedSection === 'connection' && (
            <div className="px-4 pb-4 space-y-3">
              <div>
                <label className="text-sm text-content-secondary">
                  {t('toolbar.modal.nodeUrl')}
                </label>
                <div className="mt-1 text-sm text-white break-all font-mono bg-surface-base/30 p-2 rounded">
                  {account.node_url}
                </div>
              </div>
              <div>
                <label className="text-sm text-content-secondary">
                  {t('toolbar.modal.rpcConnection')}
                </label>
                <div className="mt-1 text-sm text-white break-all font-mono bg-surface-base/30 p-2 rounded">
                  {account.rpc_connection_url}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Service Endpoints Section */}
        <div className="bg-surface-overlay/30 rounded-lg border border-border-default overflow-hidden">
          <button
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface-overlay/50 transition-colors"
            onClick={() => toggleSection('services')}
          >
            <span className="font-medium text-white">
              {t('toolbar.modal.serviceEndpoints')}
            </span>
            <div
              className={`transform transition-transform ${expandedSection === 'services' ? 'rotate-180' : ''}`}
            >
              <svg
                className="w-5 h-5 text-content-secondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M19 9l-7 7-7-7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </div>
          </button>
          {expandedSection === 'services' && (
            <div className="px-4 pb-4 space-y-3">
              <div>
                <label className="text-sm text-content-secondary">
                  {t('toolbar.modal.indexerUrl')}
                </label>
                <div className="mt-1 text-sm text-white break-all font-mono bg-surface-base/30 p-2 rounded">
                  {account.indexer_url}
                </div>
              </div>
              <div>
                <label className="text-sm text-content-secondary">
                  {t('toolbar.modal.rgbProxy')}
                </label>
                <div className="mt-1 text-sm text-white break-all font-mono bg-surface-base/30 p-2 rounded">
                  {account.proxy_endpoint}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Port Configuration Section - Only for Local Nodes */}
        {account.datapath && (
          <div className="bg-surface-overlay/30 rounded-lg border border-border-default overflow-hidden">
            <button
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface-overlay/50 transition-colors"
              onClick={() => toggleSection('ports')}
            >
              <span className="font-medium text-white">
                {t('toolbar.modal.portConfiguration')}
              </span>
              <div
                className={`transform transition-transform ${expandedSection === 'ports' ? 'rotate-180' : ''}`}
              >
                <svg
                  className="w-5 h-5 text-content-secondary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M19 9l-7 7-7-7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </div>
            </button>
            {expandedSection === 'ports' && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <label className="text-sm text-content-secondary">
                    {t('toolbar.modal.daemonPort')}
                  </label>
                  <div className="mt-1 text-sm text-white font-mono bg-surface-base/30 p-2 rounded">
                    {account.daemon_listening_port}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-content-secondary">
                    {t('toolbar.modal.ldkPeerPort')}
                  </label>
                  <div className="mt-1 text-sm text-white font-mono bg-surface-base/30 p-2 rounded">
                    {account.ldk_peer_listening_port}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-content-secondary">
                    {t('toolbar.modal.dataPath')}
                  </label>
                  <div className="mt-1 text-sm text-white break-all font-mono bg-surface-base/30 p-2 rounded">
                    {account.datapath}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 bg-surface-overlay pt-4 mt-6 border-t border-border-default">
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          <button
            className="flex-1 px-4 py-2.5 bg-surface-high hover:bg-surface-elevated text-white font-medium rounded-lg transition-colors"
            disabled={isLoading || loadingState !== null}
            onClick={onCancel}
            type="button"
          >
            {t('toolbar.modal.cancel')}
          </button>
          <button
            className={`flex-1 px-4 py-2.5 font-medium rounded-lg transition-colors text-primary-foreground
              ${
                isLoading || loadingState !== null
                  ? 'bg-primary/50 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary-emphasis'
              }`}
            disabled={isLoading || loadingState !== null}
            onClick={handleConfirm}
            type="button"
          >
            {isLoading || loadingState ? (
              <div className="flex items-center justify-center gap-2">
                <Spinner size={20} />
                <span>{t('toolbar.modal.switching')}</span>
              </div>
            ) : (
              t('toolbar.modal.switchToNode')
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

interface DeleteNodeModalContentProps {
  account: Account
  onCancel: () => void
  onConfirm: (account: Account) => void
}

const DeleteNodeModalContent: React.FC<DeleteNodeModalContentProps> = ({
  account,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation()
  const handleDelete = () => {
    try {
      onConfirm(account)
      onCancel() // Close the modal after successful deletion
    } catch (error) {
      // Error is already handled in the parent component
      console.error('Failed to delete node:', error)
    }
  }

  return (
    <>
      <div className="flex flex-col items-center mb-6">
        <AlertTriangle className="text-red-600 w-16 h-16 mb-4" />
        <h2 className="text-2xl font-bold">{t('toolbar.delete.title')}</h2>
      </div>

      <div className="space-y-4 mb-8">
        <p className="text-content-secondary">
          {t('toolbar.delete.confirmMessage', { name: account.name })}
        </p>

        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-left">
          <p className="text-yellow-500 font-medium mb-2">
            {t('toolbar.delete.warningTitle')}
          </p>
          <ul className="text-yellow-100/80 space-y-2 text-sm">
            <li>• {t('toolbar.delete.cannotUndo')}</li>
            {account.datapath ? (
              <>
                <li>• {t('toolbar.delete.localWarning1')}</li>
                <li>• {t('toolbar.delete.localWarning2')}</li>
                <li className="break-all">
                  •{' '}
                  {t('toolbar.delete.localWarning3', {
                    path: account.datapath,
                  })}
                </li>
              </>
            ) : (
              <>
                <li>• {t('toolbar.delete.remoteWarning1')}</li>
                <li>• {t('toolbar.delete.remoteWarning2')}</li>
                <li>• {t('toolbar.delete.remoteWarning3')}</li>
              </>
            )}
          </ul>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
        <button
          className="flex-1 px-6 py-3 border border-white/30 hover:bg-surface-high rounded-lg transition-colors text-white font-medium"
          onClick={onCancel}
          type="button"
        >
          {t('toolbar.delete.cancel')}
        </button>
        <button
          className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-white font-medium"
          onClick={handleDelete}
          type="button"
        >
          Delete
        </button>
      </div>
    </>
  )
}

interface EditNodeModalContentProps {
  account: Account
  onClose: () => void
  onSave: (updatedAccount: Account) => Promise<void>
}

const EditNodeModalContent: React.FC<EditNodeModalContentProps> = ({
  account,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation()
  const [formData, setFormData] = useState(account)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic')
  const [portErrors, setPortErrors] = useState<{
    daemon?: string
    ldk?: string
  }>({})

  const validatePorts = (daemonPort: string, ldkPort: string) => {
    const errors: { daemon?: string; ldk?: string } = {}

    const daemonPortNum = parseInt(daemonPort)
    const ldkPortNum = parseInt(ldkPort)

    // Validate daemon port
    if (!daemonPort || isNaN(daemonPortNum)) {
      errors.daemon = t('toolbar.edit.validation.daemonPortRequired')
    } else if (daemonPortNum < 1024 || daemonPortNum > 65535) {
      errors.daemon = t('toolbar.edit.validation.daemonPortRange')
    }

    // Validate LDK port
    if (!ldkPort || isNaN(ldkPortNum)) {
      errors.ldk = t('toolbar.edit.validation.ldkPortRequired')
    } else if (ldkPortNum < 1024 || ldkPortNum > 65535) {
      errors.ldk = t('toolbar.edit.validation.ldkPortRange')
    }

    // Check if ports are the same
    if (daemonPort && ldkPort && daemonPort === ldkPort) {
      errors.daemon = t('toolbar.edit.validation.portsMustDiffer')
      errors.ldk = t('toolbar.edit.validation.portsMustDiffer')
    }

    setPortErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Validate ports on initial load
  useEffect(() => {
    validatePorts(
      formData.daemon_listening_port,
      formData.ldk_peer_listening_port
    )
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate ports before submission
    const isValidPorts = validatePorts(
      formData.daemon_listening_port,
      formData.ldk_peer_listening_port
    )
    if (!isValidPorts) {
      toast.error(t('toolbar.nodes.portErrors'))
      return
    }

    setIsLoading(true)
    try {
      await onSave(formData)
      onClose()
      toast.success(
        t('toolbar.nodes.nodeUpdateSuccess', { name: formData.name })
      )
    } catch (error) {
      toast.error(t('toolbar.nodes.nodeUpdateFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof Account, value: string) => {
    const newFormData = { ...formData, [field]: value }
    setFormData(newFormData)

    // Real-time validation for port fields
    if (
      field === 'daemon_listening_port' ||
      field === 'ldk_peer_listening_port'
    ) {
      // Use a small timeout to avoid excessive validation calls while typing
      setTimeout(() => {
        validatePorts(
          newFormData.daemon_listening_port,
          newFormData.ldk_peer_listening_port
        )
      }, 500)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-primary">
          {t('toolbar.edit.title')}
        </h2>
        <div className="flex items-center">
          <MinidenticonImg
            className="rounded-lg mr-3"
            height="32"
            saturation="90"
            username={account.name}
            width="32"
          />
          <span className="font-medium text-lg">{account.name}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-default mb-6">
        <button
          className={`px-4 py-2 font-medium text-sm transition-colors relative
            ${
              activeTab === 'basic'
                ? 'text-primary'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          onClick={() => setActiveTab('basic')}
          type="button"
        >
          {t('toolbar.edit.tabs.basic')}
          {activeTab === 'basic' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan" />
          )}
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm transition-colors relative
            ${
              activeTab === 'advanced'
                ? 'text-primary'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          onClick={() => setActiveTab('advanced')}
          type="button"
        >
          {t('toolbar.edit.tabs.advanced')}
          {activeTab === 'advanced' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan" />
          )}
        </button>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {activeTab === 'basic' && (
          <>
            <div className="bg-surface-overlay/30 p-4 rounded-lg border border-divider/10">
              <h3 className="text-sm font-medium text-content-secondary mb-4">
                {t('toolbar.edit.sections.connectionSettings')}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-content-secondary text-sm mb-1.5">
                    {t('toolbar.edit.fields.nodeName')}
                  </label>
                  <Input disabled type="text" value={formData.name} />
                </div>

                <div>
                  <label className="block text-content-secondary text-sm mb-1.5">
                    {t('toolbar.edit.fields.nodeUrl')}
                  </label>
                  <Input
                    onChange={(e) =>
                      handleInputChange('node_url', e.target.value)
                    }
                    placeholder="http://localhost:3000"
                    type="text"
                    value={formData.node_url}
                  />
                </div>

                <div>
                  <label className="block text-content-secondary text-sm mb-1.5">
                    {t('toolbar.edit.fields.rpcConnectionUrl')}
                  </label>
                  <Input
                    onChange={(e) =>
                      handleInputChange('rpc_connection_url', e.target.value)
                    }
                    placeholder="http://localhost:3001/rpc"
                    type="text"
                    value={formData.rpc_connection_url}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'advanced' && (
          <>
            <div className="bg-surface-overlay/30 p-4 rounded-lg border border-divider/10">
              <h3 className="text-sm font-medium text-content-secondary mb-4">
                {t('toolbar.edit.sections.serviceEndpoints')}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-content-secondary text-sm mb-1.5">
                    {t('toolbar.edit.fields.bitcoindRpcUrl')}
                  </label>
                  <Input
                    onChange={(e) =>
                      handleInputChange('rpc_connection_url', e.target.value)
                    }
                    placeholder="user:password@localhost:18443"
                    type="text"
                    value={formData.rpc_connection_url}
                  />
                </div>

                <div>
                  <label className="block text-content-secondary text-sm mb-1.5">
                    {t('toolbar.edit.fields.indexerUrl')}
                  </label>
                  <Input
                    onChange={(e) =>
                      handleInputChange('indexer_url', e.target.value)
                    }
                    placeholder="http://localhost:3002/api"
                    type="text"
                    value={formData.indexer_url}
                  />
                </div>

                <div>
                  <label className="block text-content-secondary text-sm mb-1.5">
                    {t('toolbar.edit.fields.rgbProxyEndpoint')}
                  </label>
                  <Input
                    onChange={(e) =>
                      handleInputChange('proxy_endpoint', e.target.value)
                    }
                    placeholder="http://localhost:3003/proxy"
                    type="text"
                    value={formData.proxy_endpoint}
                  />
                </div>

                {account.datapath && (
                  <div>
                    <label className="block text-content-secondary text-sm mb-1.5">
                      {t('toolbar.edit.fields.dataPath')}
                    </label>
                    <Input disabled type="text" value={formData.datapath} />
                    <p className="text-xs text-content-secondary mt-1">
                      {t('toolbar.edit.fields.dataPathHint')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-surface-overlay/30 p-4 rounded-lg border border-divider/10">
              <h3 className="text-sm font-medium text-content-secondary mb-4">
                {t('toolbar.edit.sections.portConfiguration')}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-content-secondary text-sm mb-1.5">
                    {t('toolbar.edit.fields.daemonListeningPort')}
                  </label>
                  <Input
                    error={!!portErrors.daemon}
                    max="65535"
                    min="1024"
                    onChange={(e) =>
                      handleInputChange('daemon_listening_port', e.target.value)
                    }
                    placeholder="3001"
                    type="number"
                    value={formData.daemon_listening_port}
                  />
                  {portErrors.daemon ? (
                    <p className="text-xs text-red-400 mt-1">
                      {portErrors.daemon}
                    </p>
                  ) : (
                    <p className="text-xs text-content-secondary mt-1">
                      {t('toolbar.edit.fields.daemonListeningPortHint')}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-content-secondary text-sm mb-1.5">
                    {t('toolbar.edit.fields.ldkPeerListeningPort')}
                  </label>
                  <Input
                    error={!!portErrors.ldk}
                    max="65535"
                    min="1024"
                    onChange={(e) =>
                      handleInputChange(
                        'ldk_peer_listening_port',
                        e.target.value
                      )
                    }
                    placeholder="9735"
                    type="number"
                    value={formData.ldk_peer_listening_port}
                  />
                  {portErrors.ldk ? (
                    <p className="text-xs text-red-400 mt-1">
                      {portErrors.ldk}
                    </p>
                  ) : (
                    <p className="text-xs text-content-secondary mt-1">
                      {t('toolbar.edit.fields.ldkPeerListeningPortHint')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-surface-overlay/30 p-4 rounded-lg border border-divider/10">
              <h3 className="text-sm font-medium text-content-secondary mb-4">
                {t('toolbar.edit.sections.makerSettings')}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-content-secondary text-sm mb-1.5">
                    {t('toolbar.edit.fields.defaultMakerUrl')}
                  </label>
                  <div className="flex items-center">
                    <input
                      className="w-full bg-surface-high rounded-lg px-4 py-2.5 text-white border border-border-default focus:border-primary/50 focus:outline-none"
                      onChange={(e) =>
                        handleInputChange('default_maker_url', e.target.value)
                      }
                      placeholder="http://localhost:3004/maker"
                      type="text"
                      value={formData.default_maker_url}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-content-secondary text-sm mb-1.5">
                    {t('toolbar.edit.fields.defaultLspUrl')}
                  </label>
                  <div className="flex items-center">
                    <input
                      className="w-full bg-surface-high rounded-lg px-4 py-2.5 text-white border border-border-default focus:border-primary/50 focus:outline-none"
                      onChange={(e) =>
                        handleInputChange('default_lsp_url', e.target.value)
                      }
                      placeholder="http://localhost:3005/lsp"
                      type="text"
                      value={formData.default_lsp_url}
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex space-x-4 mt-8 pt-4 border-t border-border-default">
          <button
            className="flex-1 px-6 py-3 bg-surface-high hover:bg-surface-elevated rounded-lg transition-colors text-white font-medium"
            onClick={onClose}
            type="button"
          >
            {t('toolbar.edit.cancel')}
          </button>
          <button
            className="flex-1 px-6 py-3 bg-[#15E99A] hover:bg-[#12C97E] rounded-lg transition-colors text-gray-900 font-medium flex items-center justify-center"
            disabled={isLoading}
            type="submit"
          >
            {isLoading ? <Spinner size={20} /> : t('toolbar.edit.saveChanges')}
          </button>
        </div>
      </form>
    </>
  )
}
