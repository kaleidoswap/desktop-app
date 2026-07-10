import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import {
  Trash2,
  MoreVertical,
  X,
  Server,
  Cloud,
  AlertTriangle,
  Settings,
  Save,
  ArrowRight,
  Loader2,
  ChevronDown,
  Copy,
  Check,
} from 'lucide-react'
import { Input, AdvancedSettings, Button } from '../ui'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import {
  WALLET_DASHBOARD_PATH,
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
  getModalPortalTarget,
  getModalPositionClass,
} from '../../helpers/modalPortal'
import {
  nodeSettingsActions,
  setSettingsAsync,
} from '../../slices/nodeSettings/nodeSettings.slice'
import { waitForDockerNodeReady, waitForNodeReady } from '../../utils/nodeState'

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

  const pos = getModalPositionClass()

  return createPortal(
    <div
      aria-modal="true"
      className={`${pos} left-72 top-16 right-0 bottom-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn`}
      onClick={onClose}
      role="dialog"
    >
      <div
        className="bg-surface-base text-white rounded-3xl border border-border-subtle/50 shadow-2xl shadow-black/20 max-w-lg w-full mx-4 overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-h-[85vh] overflow-y-auto px-8 py-8">{children}</div>
      </div>
    </div>,
    getModalPortalTarget()
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
              <span
                className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium border ${getNetworkChipColor(account.network)}`}
              >
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
        navigate(WALLET_DASHBOARD_PATH)
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
            | typeof WALLET_DASHBOARD_PATH
            | typeof WALLET_UNLOCK_PATH
            | typeof WALLET_SETUP_PATH = WALLET_UNLOCK_PATH

          for (let attempt = 0; attempt < 8; attempt++) {
            const nodeInfoRes = await withTimeout(
              getNodeInfo(),
              5000,
              'Checking node status after start'
            )

            if (nodeInfoRes.isSuccess) {
              destination = WALLET_DASHBOARD_PATH
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
            // If the Docker containers are already running and reachable, just navigate — don't restart
            const alreadyRunning = await navigateFromNodeStatus(5000).catch(
              () => false
            )
            if (alreadyRunning) return

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

            await waitForDockerNodeReady({
              daemonPort: dockerPort,
              timeoutMs: 90000,
            })

            // Decide destination from node API status
            let destination:
              | typeof WALLET_DASHBOARD_PATH
              | typeof WALLET_UNLOCK_PATH
              | typeof WALLET_SETUP_PATH = WALLET_UNLOCK_PATH

            for (let attempt = 0; attempt < 8; attempt++) {
              const nodeInfoRes = await withTimeout(
                getNodeInfo(),
                5000,
                'Checking node status after Docker start'
              )

              if (nodeInfoRes.isSuccess) {
                destination = WALLET_DASHBOARD_PATH
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
          className={`flex items-center justify-between ${isCollapsed ? 'p-2' : 'px-4 pt-4 pb-1'} flex-shrink-0`}
        >
          {/* Title - completely hidden in collapsed state, no hover effect */}
          {!isCollapsed && (
            <h2 className="text-xs font-semibold text-content-tertiary uppercase tracking-wider">
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
const CopyField = ({ label, value }: { label: string; value: string }) => {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div>
      <label className="text-xs font-medium text-content-secondary uppercase tracking-wider">
        {label}
      </label>
      <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-lg border border-border-default/50 bg-surface-base group">
        <span className="flex-1 text-sm text-white break-all font-mono">
          {value}
        </span>
        <button
          className="shrink-0 p-1 rounded text-content-tertiary hover:text-white hover:bg-surface-high/60 transition-colors"
          onClick={handleCopy}
          title="Copy"
          type="button"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-primary" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  )
}

const AccordionSection = ({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) => (
  <div className="rounded-lg overflow-hidden">
    <button
      className={`w-full px-4 py-2.5 flex items-center justify-between text-left text-sm
        border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20
        ${
          isOpen
            ? 'border-border-default/50 bg-surface-overlay/50 rounded-b-none'
            : 'border-border-default/50 bg-surface-overlay/30 hover:bg-surface-overlay/50 hover:border-border-default/70'
        }`}
      onClick={onToggle}
      type="button"
    >
      <span className="font-medium text-white">{title}</span>
      <ChevronDown
        className={`w-4 h-4 text-content-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
      />
    </button>
    {isOpen && (
      <div className="p-4 border border-t-0 border-border-default/50 rounded-b-lg bg-surface-overlay/30 space-y-3">
        {children}
      </div>
    )}
  </div>
)

const getNetworkChipColor = (network: string): string => {
  switch (network) {
    case 'Testnet':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case 'Signet':
    case 'SignetCustom':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    default:
      return 'bg-primary/20 text-primary border-primary/30'
  }
}

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

  return (
    <div>
      <div className="flex items-center gap-3 pb-4 border-b border-divider/10 mb-4">
        <NodeIcon className={`w-6 h-6 ${nodeColor}`} />
        <h3 className="text-xl font-bold text-white flex-1">
          {t('toolbar.modal.switchNode')}
        </h3>
        <button
          className="text-content-secondary hover:text-white p-1.5 rounded-lg hover:bg-surface-high/60 transition-colors"
          onClick={onCancel}
          type="button"
        >
          <X size={18} />
        </button>
      </div>

      {/* Loading State */}
      {loadingState && (
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-primary shrink-0 animate-spin" />
            <p className="text-primary font-medium">{loadingState.message}</p>
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

      <div className="flex items-center gap-4 mb-4 p-3 bg-surface-overlay/30 rounded-xl border border-border-default/50">
        <div className="shrink-0">
          <MinidenticonImg
            className="rounded-lg"
            height="44"
            saturation="90"
            username={account.name}
            width="44"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate">{account.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium border ${getNetworkChipColor(account.network)}`}
            >
              {getNetworkDisplayName(account.network)}
            </span>
            <span
              className={`flex items-center gap-1 text-xs font-medium ${nodeColor}`}
            >
              <NodeIcon size={11} />
              {nodeType}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {/* Connection Details Section */}
        <AccordionSection
          isOpen={expandedSection === 'connection'}
          onToggle={() => toggleSection('connection')}
          title={t('toolbar.modal.connectionDetails')}
        >
          <CopyField
            label={t('toolbar.modal.nodeUrl')}
            value={account.node_url}
          />
          <CopyField
            label={t('toolbar.modal.rpcConnection')}
            value={account.rpc_connection_url}
          />
        </AccordionSection>

        {/* Service Endpoints Section */}
        <AccordionSection
          isOpen={expandedSection === 'services'}
          onToggle={() => toggleSection('services')}
          title={t('toolbar.modal.serviceEndpoints')}
        >
          <CopyField
            label={t('toolbar.modal.indexerUrl')}
            value={account.indexer_url}
          />
          <CopyField
            label={t('toolbar.modal.rgbProxy')}
            value={account.proxy_endpoint}
          />
        </AccordionSection>

        {/* Port Configuration Section - Only for Local Nodes */}
        {account.datapath && (
          <AccordionSection
            isOpen={expandedSection === 'ports'}
            onToggle={() => toggleSection('ports')}
            title={t('toolbar.modal.portConfiguration')}
          >
            <CopyField
              label={t('toolbar.modal.daemonPort')}
              value={account.daemon_listening_port}
            />
            <CopyField
              label={t('toolbar.modal.ldkPeerPort')}
              value={account.ldk_peer_listening_port}
            />
            <CopyField
              label={t('toolbar.modal.dataPath')}
              value={account.datapath}
            />
          </AccordionSection>
        )}
      </div>

      <div className="mt-4">
        <Button
          className="w-full"
          disabled={isLoading || loadingState !== null}
          icon={
            isLoading || loadingState ? (
              <Spinner size={16} />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )
          }
          iconPosition="right"
          onClick={handleConfirm}
          size="lg"
          type="button"
          variant="primary"
        >
          {isLoading || loadingState
            ? t('toolbar.modal.switching')
            : t('toolbar.modal.switchToNode')}
        </Button>
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
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-divider/10 shrink-0 -mx-8 -mt-8 mb-5 px-8 pt-8 pb-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-status-danger" />
          <h3 className="text-lg font-semibold text-white">
            {t('toolbar.delete.title')}
          </h3>
        </div>
        <button
          className="p-1.5 rounded-md text-content-secondary hover:text-white hover:bg-surface-overlay/50 transition-colors"
          onClick={onCancel}
          type="button"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2 mb-6 text-sm text-content-secondary">
        <p>{t('toolbar.delete.confirmMessage', { name: account.name })}</p>
        <ul className="space-y-1.5">
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

      <button
        className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-white text-sm font-medium shadow-md flex items-center justify-center gap-2"
        onClick={handleDelete}
        type="button"
      >
        <Trash2 className="w-4 h-4" />
        {t('toolbar.delete.title')}
      </button>
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
  const [portErrors, setPortErrors] = useState<{
    daemon?: string
    ldk?: string
  }>({})

  const validatePorts = (daemonPort: string, ldkPort: string) => {
    const errors: { daemon?: string; ldk?: string } = {}

    const daemonPortNum = parseInt(daemonPort)
    const ldkPortNum = parseInt(ldkPort)

    if (!daemonPort || isNaN(daemonPortNum)) {
      errors.daemon = t('toolbar.edit.validation.daemonPortRequired')
    } else if (daemonPortNum < 1024 || daemonPortNum > 65535) {
      errors.daemon = t('toolbar.edit.validation.daemonPortRange')
    }

    if (!ldkPort || isNaN(ldkPortNum)) {
      errors.ldk = t('toolbar.edit.validation.ldkPortRequired')
    } else if (ldkPortNum < 1024 || ldkPortNum > 65535) {
      errors.ldk = t('toolbar.edit.validation.ldkPortRange')
    }

    if (daemonPort && ldkPort && daemonPort === ldkPort) {
      errors.daemon = t('toolbar.edit.validation.portsMustDiffer')
      errors.ldk = t('toolbar.edit.validation.portsMustDiffer')
    }

    setPortErrors(errors)
    return Object.keys(errors).length === 0
  }

  useEffect(() => {
    validatePorts(
      formData.daemon_listening_port,
      formData.ldk_peer_listening_port
    )
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

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

    if (
      field === 'daemon_listening_port' ||
      field === 'ldk_peer_listening_port'
    ) {
      setTimeout(() => {
        validatePorts(
          newFormData.daemon_listening_port,
          newFormData.ldk_peer_listening_port
        )
      }, 500)
    }
  }

  const labelClass =
    'block text-xs font-medium text-content-secondary uppercase tracking-wider mb-1.5'

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-divider/10 shrink-0 -mx-6 -mt-6 mb-4 px-6 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-white">
            {t('toolbar.edit.title')}
          </h3>
        </div>
        <button
          className="p-1.5 rounded-md text-content-secondary hover:text-white hover:bg-surface-overlay/50 transition-colors"
          onClick={onClose}
          type="button"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {/* Basic fields — directly on bg */}
        <div>
          <label className={labelClass}>
            {t('toolbar.edit.fields.nodeName')}
          </label>
          <Input disabled type="text" value={formData.name} />
        </div>

        <div>
          <label className={labelClass}>
            {t('toolbar.edit.fields.nodeUrl')}
          </label>
          <Input
            onChange={(e) => handleInputChange('node_url', e.target.value)}
            placeholder="http://localhost:3000"
            type="text"
            value={formData.node_url}
          />
        </div>

        <div>
          <label className={labelClass}>
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

        {/* Advanced Settings accordion */}
        <AdvancedSettings>
          <div>
            <label className={labelClass}>
              {t('toolbar.edit.fields.indexerUrl')}
            </label>
            <Input
              onChange={(e) => handleInputChange('indexer_url', e.target.value)}
              placeholder="http://localhost:3002/api"
              type="text"
              value={formData.indexer_url}
            />
          </div>

          <div>
            <label className={labelClass}>
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

          <div>
            <label className={labelClass}>
              {t('toolbar.edit.fields.defaultMakerUrl')}
            </label>
            <Input
              onChange={(e) =>
                handleInputChange('default_maker_url', e.target.value)
              }
              placeholder="http://localhost:3004/maker"
              type="text"
              value={formData.default_maker_url}
            />
          </div>

          <div>
            <label className={labelClass}>
              {t('toolbar.edit.fields.defaultLspUrl')}
            </label>
            <Input
              onChange={(e) =>
                handleInputChange('default_lsp_url', e.target.value)
              }
              placeholder="http://localhost:3005/lsp"
              type="text"
              value={formData.default_lsp_url}
            />
          </div>

          <div>
            <label className={labelClass}>
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
              <p className="text-xs text-red-400 mt-1">{portErrors.daemon}</p>
            ) : (
              <p className="text-xs text-content-secondary mt-1">
                {t('toolbar.edit.fields.daemonListeningPortHint')}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>
              {t('toolbar.edit.fields.ldkPeerListeningPort')}
            </label>
            <Input
              error={!!portErrors.ldk}
              max="65535"
              min="1024"
              onChange={(e) =>
                handleInputChange('ldk_peer_listening_port', e.target.value)
              }
              placeholder="9735"
              type="number"
              value={formData.ldk_peer_listening_port}
            />
            {portErrors.ldk ? (
              <p className="text-xs text-red-400 mt-1">{portErrors.ldk}</p>
            ) : (
              <p className="text-xs text-content-secondary mt-1">
                {t('toolbar.edit.fields.ldkPeerListeningPortHint')}
              </p>
            )}
          </div>

          {account.datapath && (
            <div>
              <label className={labelClass}>
                {t('toolbar.edit.fields.dataPath')}
              </label>
              <Input disabled type="text" value={formData.datapath} />
              <p className="text-xs text-content-secondary mt-1">
                {t('toolbar.edit.fields.dataPathHint')}
              </p>
            </div>
          )}
        </AdvancedSettings>

        {/* Save button */}
        <div className="pt-2">
          <Button
            className="w-full"
            disabled={isLoading}
            icon={
              isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )
            }
            iconPosition="left"
            size="lg"
            type="submit"
            variant="primary"
          >
            {t('toolbar.edit.saveChanges')}
          </Button>
        </div>
      </form>
    </>
  )
}
