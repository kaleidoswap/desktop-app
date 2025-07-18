import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { Trash2, Edit, X, Server, Cloud, AlertTriangle } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import { ROOT_PATH , WALLET_UNLOCK_PATH } from '../../app/router/paths'
import { useAppDispatch } from '../../app/store/hooks'
import { MinidenticonImg } from '../../components/MinidenticonImg'
import { Spinner } from '../../components/Spinner'
import { BitcoinNetwork } from '../../constants'
import {
  nodeSettingsActions,
  setSettingsAsync,
} from '../../slices/nodeSettings/nodeSettings.slice'

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
}

interface ModalProps {
  onClose: () => void
  children: React.ReactNode
}

interface NodeCardProps {
  account: Account
  isCollapsed: boolean
  isEditing: boolean
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
        className="bg-gray-800 text-white p-8 rounded-xl shadow-xl max-w-lg w-full mx-4 overflow-auto max-h-[90vh] animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          aria-label="Close modal"
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  )
}

const NodeCard: React.FC<NodeCardProps> = ({
  account,
  isCollapsed,
  isEditing,
  onSelect,
  onEdit,
  onDelete,
}) => {
  const NodeIcon = account.datapath ? Server : Cloud
  const nodeType = account.datapath ? 'Local' : 'Remote'
  const nodeColor = account.datapath ? 'text-green-400' : 'text-cyan'

  // Handle card click based on edit mode
  const handleCardClick = () => {
    if (isEditing) {
      onEdit(account)
    } else {
      onSelect(account)
    }
  }

  return (
    <div
      className={`group bg-blue-darker/50 rounded-xl transition-all duration-300 
        hover:bg-blue-darker relative overflow-hidden border
        ${isCollapsed ? 'p-2' : 'p-4'}
        ${
          isEditing
            ? 'cursor-pointer border-cyan/30 hover:border-cyan/70 hover:shadow-[0_0_0_1px_rgba(56,189,248,0.4)] hover:-translate-y-0.5'
            : 'border-divider/5 hover:border-divider/20 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cyan/5'
        }`}
      onClick={handleCardClick}
    >
      {/* Account info section */}
      <div className="flex items-center gap-4">
        {/* Avatar with edit indicator */}
        <div className="relative">
          <MinidenticonImg
            className={`rounded-lg flex-shrink-0 transition-opacity duration-200 ${isEditing ? 'opacity-80' : ''}`}
            height={isCollapsed ? '40' : '40'}
            saturation="90"
            username={account.name}
            width={isCollapsed ? '40' : '40'}
          />

          {/* Node type indicator for collapsed view */}
          {isCollapsed && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-blue-darkest flex items-center justify-center shadow-sm">
              <NodeIcon className={`w-3 h-3 ${nodeColor}`} />
            </div>
          )}

          {/* Edit mode indicator for collapsed view */}
          {isEditing && isCollapsed && (
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan/80 flex items-center justify-center shadow-sm">
              <Edit className="w-2.5 h-2.5 text-blue-darkest" />
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
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-darkest text-gray-400">
                {account.network}
              </span>
              <span className={`flex items-center ${nodeColor} text-sm`}>
                <NodeIcon className="w-3 h-3 mr-1" />
                {nodeType}
              </span>
            </div>
          </div>
        )}

        {/* Edit/Delete buttons - visible in expanded view */}
        {isEditing && !isCollapsed && (
          <div
            className="flex items-center space-x-3"
            onClick={(e) => e.stopPropagation()} // Prevent card click when clicking buttons
          >
            <button
              aria-label={`Edit node ${account.name}`}
              className="p-2.5 rounded-lg text-gray-400 hover:text-cyan bg-blue-darkest/40 hover:bg-blue-darkest
                transition-colors duration-200 hover:shadow-md"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(account)
              }}
            >
              <Edit size={18} />
            </button>
            <button
              aria-label={`Delete node ${account.name}`}
              className="p-2.5 rounded-lg text-gray-400 hover:text-red-500 bg-blue-darkest/40 hover:bg-blue-darkest
                transition-colors duration-200 hover:shadow-md"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(account)
              }}
            >
              <Trash2 size={18} />
            </button>
          </div>
        )}

        {/* Edit/Delete buttons for collapsed view */}
        {isEditing && isCollapsed && (
          <div
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-blue-darker/80 backdrop-blur-sm transition-opacity duration-200"
            onClick={(e) => e.stopPropagation()} // Prevent card click when clicking buttons
          >
            <div className="flex space-x-2">
              <button
                aria-label={`Edit node ${account.name}`}
                className="p-1.5 rounded-lg text-cyan bg-blue-darkest/80 hover:bg-blue-darkest
                  transition-colors duration-200 hover:scale-110"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(account)
                }}
              >
                <Edit size={16} />
              </button>
              <button
                aria-label={`Delete node ${account.name}`}
                className="p-1.5 rounded-lg text-red-400 bg-blue-darkest/80 hover:bg-blue-darkest
                  transition-colors duration-200 hover:scale-110"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(account)
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit mode indicator - left border */}
      {isEditing && (
        <div className="absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-cyan/80 to-cyan/40" />
      )}
    </div>
  )
}

// Custom Hooks
const useAccounts = () => {
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
          err instanceof Error ? err : new Error('Failed to fetch accounts')
        )
        toast.error('Failed to fetch accounts')
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

      toast.success(`Account "${updatedAccount.name}" updated successfully`)
    } catch (error) {
      toast.error(`Failed to update account: ${error}`)
      throw error
    }
  }, [])

  const deleteAccount = useCallback(async (account: Account) => {
    try {
      await invoke('delete_account', { name: account.name })
      setAccounts((prev) => prev.filter((a) => a.name !== account.name))
      toast.success(`Account "${account.name}" deleted successfully`)
    } catch (error) {
      toast.error(`Failed to delete account "${account.name}"`)
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
  const { accounts, isLoading, error, updateAccount, deleteAccount } =
    useAccounts()

  const [selectedNode, setSelectedNode] = useState<Account | null>(null)
  const [nodeToDelete, setNodeToDelete] = useState<Account | null>(null)
  const [editingNode, setEditingNode] = useState<Account | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)

  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  // Exit edit mode when toolbar is collapsed
  useEffect(() => {
    if (isCollapsed && isEditing) {
      setIsEditing(false)
    }
  }, [isCollapsed, isEditing])

  // Exit edit mode when there are no nodes
  useEffect(() => {
    if (accounts.length === 0 && isEditing) {
      setIsEditing(false)
    }
  }, [accounts, isEditing])

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
      toast.success(`Local node "${event.payload}" started successfully`, {
        autoClose: 3000,
        onClose: () => {
          // Reset the flag when the toast closes
          isToastActive = false
        },
        position: 'bottom-right',
        toastId: 'node-started',
      })

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
  }, [])

  const toggleEditMode = () => {
    setIsEditing(!isEditing)
  }

  const handleNodeChange = async (node: Account) => {
    try {
      setIsSwitching(true)

      const currentNode = await invoke<Account | null>('get_current_account')

      const isNodeRunning = await invoke<boolean>('is_node_running', {
        accountName: node.name,
      })

      const runningNodeAccount = await invoke<string | null>(
        'get_running_node_account'
      )

      if (currentNode && currentNode.name === node.name && isNodeRunning) {
        // First update the Redux store before navigating
        const dbNode = await invoke<Account>('get_account_by_name', {
          name: node.name,
        })

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

        // Check if node is locked before navigating
        try {
          await invoke('node_info')
          console.log('Node unlocked, navigating to dashboard')
          navigate(ROOT_PATH)
        } catch (error) {
          console.log('Node locked, navigating to unlock page')
          navigate(WALLET_UNLOCK_PATH)
        }
        return
      }

      if (runningNodeAccount && isNodeRunning) {
        await invoke('stop_node')
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      await invoke('set_current_account', { accountName: node.name })

      const dbNode = await invoke<Account>('get_account_by_name', {
        name: node.name,
      })

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

      if (
        node.node_url.startsWith('http://localhost:') &&
        node.datapath !== ''
      ) {
        toast.info('Starting local node...', {
          autoClose: 2000,
          position: 'bottom-right',
        })

        try {
          // Check port availability before starting the node
          const ports = [
            node.daemon_listening_port,
            node.ldk_peer_listening_port,
          ]
          const portCheck = await invoke<{ [port: string]: boolean }>(
            'check_ports_available',
            { ports }
          )
          const unavailablePorts = Object.entries(portCheck)
            .filter(([_, isAvailable]) => !isAvailable)
            .map(([port]) => port)

          if (unavailablePorts.length > 0) {
            // Get running node ports to check if they're our own nodes
            const runningNodePorts = await invoke<{ [port: string]: string }>(
              'get_running_node_ports'
            )
            const ourConflictingPorts = unavailablePorts.filter(
              (port) => port in runningNodePorts
            )

            if (ourConflictingPorts.length > 0) {
              // If ports are used by our nodes, try to stop them
              toast.info('Stopping existing nodes on conflicting ports...', {
                autoClose: false,
                toastId: 'stopping-nodes',
              })

              for (const port of ourConflictingPorts) {
                const nodeAccount = runningNodePorts[port]
                try {
                  await invoke('stop_node_by_account', {
                    accountName: nodeAccount,
                  })
                  await new Promise((resolve) => setTimeout(resolve, 2000)) // Wait for cleanup
                } catch (error) {
                  console.error(`Failed to stop node on port ${port}:`, error)
                  throw new Error(
                    `Failed to stop existing node on port ${port}`
                  )
                }
              }

              toast.update('stopping-nodes', {
                autoClose: 2000,
                render: 'Existing nodes stopped successfully',
                type: 'success',
              })

              // Recheck port availability after stopping our nodes
              const recheckPorts = await invoke<{ [port: string]: boolean }>(
                'check_ports_available',
                { ports }
              )
              const stillUnavailablePorts = Object.entries(recheckPorts)
                .filter(([_, isAvailable]) => !isAvailable)
                .map(([port]) => port)

              if (stillUnavailablePorts.length > 0) {
                // Try to find alternative ports
                const suggestedPorts = await invoke<{
                  daemon: number
                  ldk: number
                }>('find_available_ports', {
                  base_daemon_port: parseInt(node.daemon_listening_port),
                  base_ldk_port: parseInt(node.ldk_peer_listening_port),
                })

                throw new Error(
                  `Ports ${stillUnavailablePorts.join(', ')} are still in use by other processes. ` +
                    'Suggested alternative ports:\n' +
                    `- Daemon port: ${suggestedPorts.daemon}\n` +
                    `- LDK peer port: ${suggestedPorts.ldk}`
                )
              }
            } else {
              // Ports are in use by external processes
              // Try to find alternative ports
              const suggestedPorts = await invoke<{
                daemon: number
                ldk: number
              }>('find_available_ports', {
                base_daemon_port: parseInt(node.daemon_listening_port),
                base_ldk_port: parseInt(node.ldk_peer_listening_port),
              })

              throw new Error(
                `Ports ${unavailablePorts.join(', ')} are in use by other applications. ` +
                  'Suggested alternative ports:\n' +
                  `- Daemon port: ${suggestedPorts.daemon}\n` +
                  `- LDK peer port: ${suggestedPorts.ldk}`
              )
            }
          }

          // Start the node with the checked ports
          await invoke('start_node', {
            accountName: node.name,
            daemonListeningPort: node.daemon_listening_port,
            datapath: node.datapath,
            ldkPeerListeningPort: node.ldk_peer_listening_port,
            network: node.network,
          })
        } catch (error) {
          throw new Error(
            error instanceof Error ? error.message : 'Failed to start node'
          )
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Check if node is locked before navigating
      try {
        await invoke('node_info')
        console.log('Node unlocked, navigating to dashboard')
        navigate(ROOT_PATH)
      } catch (error) {
        console.log('Node locked, navigating to unlock page')
        navigate(WALLET_UNLOCK_PATH)
      }
    } catch (error) {
      dispatch(nodeSettingsActions.resetNodeSettings())
      toast.error(
        error instanceof Error
          ? `Failed to start node: ${error.message}`
          : 'Failed to start node'
      )
    } finally {
      setIsSwitching(false)
      setSelectedNode(null)
    }
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Error loading nodes: {error.message}
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
            <h2 className="text-xl font-semibold text-white">Your Nodes</h2>
          )}

          {/* Only show edit button if there are nodes */}
          {accounts.length > 0 && !isCollapsed && (
            <button
              aria-label={isEditing ? 'Exit Edit Mode' : 'Enter Edit Mode'}
              className={`p-2 rounded-lg text-gray-400 hover:text-white 
                transition-colors duration-200 ${isEditing ? 'bg-blue-darker text-cyan' : ''}`}
              onClick={toggleEditMode}
            >
              {isEditing ? (
                <>
                  <X size={18} />
                  <span className="ml-2 text-sm">Exit Edit Mode</span>
                </>
              ) : (
                <>
                  <Edit size={18} />
                  <span className="ml-2 text-sm">Edit Nodes</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Visual indication of edit mode - only show in expanded view */}
        {isEditing && !isCollapsed && (
          <div className="px-4 py-2 bg-cyan/10 border-y border-cyan/20 flex-shrink-0">
            <p className="text-sm text-cyan flex items-center">
              <Edit className="w-4 h-4 mr-2" />
              Edit Mode: Click a node to edit, or use the edit/delete buttons
            </p>
          </div>
        )}

        <div
          className={`flex-1 overflow-y-auto custom-scrollbar min-h-0 ${isCollapsed ? 'p-2' : 'p-4'} space-y-2`}
        >
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              {!isCollapsed && (
                <div className={`bg-blue-darker/50 rounded-xl p-6 max-w-xs`}>
                  <p className="text-gray-400 mb-2">No nodes found</p>
                  <p className="text-sm text-gray-500">
                    Create a new node to get started with Kaleidoswap
                  </p>
                </div>
              )}
            </div>
          ) : (
            accounts.map((account) => (
              <NodeCard
                account={account}
                isCollapsed={isCollapsed}
                isEditing={isEditing}
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
  onConfirm: (account: Account) => void
}

const NodeSelectionModalContent: React.FC<NodeSelectionModalContentProps> = ({
  account,
  isLoading,
  onCancel,
  onConfirm,
}) => {
  const [error, setError] = useState<string | null>(null)
  const [suggestedPorts, setSuggestedPorts] = useState<{
    daemon: string
    ldk: string
  } | null>(null)

  const handleConfirm = async () => {
    try {
      await onConfirm(account)
    } catch (error) {
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
        setError('An unknown error occurred')
      }
    }
  }

  const handleUseSuggestedPorts = () => {
    if (!suggestedPorts) return

    const updatedAccount = {
      ...account,
      daemon_listening_port: suggestedPorts.daemon,
      ldk_peer_listening_port: suggestedPorts.ldk,
      node_url: `http://localhost:${suggestedPorts.daemon}`,
    }

    onConfirm(updatedAccount)
    setError(null)
    setSuggestedPorts(null)
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Switch Node</h2>
        <p className="text-gray-400">
          Review the node details before switching
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-500 font-medium">Error starting node</p>
              <p className="text-sm text-red-400/80 mt-1 whitespace-pre-line">
                {error}
              </p>
              {suggestedPorts && (
                <div className="mt-3">
                  <button
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors"
                    onClick={handleUseSuggestedPorts}
                  >
                    Use suggested ports
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-700/50 p-6 rounded-xl mb-8 text-left space-y-4 border border-gray-600">
        <div className="flex items-center gap-4 mb-6">
          <MinidenticonImg
            className="rounded-lg"
            height="48"
            saturation="90"
            username={account.name}
            width="48"
          />
          <div>
            <h3 className="text-xl font-semibold">{account.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="bg-gray-600 px-3 py-1 rounded-full text-sm">
                {account.network}
              </span>
              {account.datapath ? (
                <span className="flex items-center text-green-400 text-sm">
                  <Server className="mr-1" size={14} />
                  Local Node
                </span>
              ) : (
                <span className="flex items-center text-blue-400 text-sm">
                  <Cloud className="mr-1" size={14} />
                  Remote Node
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          {account.datapath && (
            <div>
              <label className="text-gray-400 block mb-1">Data Path</label>
              <div className="text-white break-all">{account.datapath}</div>
            </div>
          )}
          <div>
            <label className="text-gray-400 block mb-1">Node URL</label>
            <div className="text-white break-all">{account.node_url}</div>
          </div>
          <div>
            <label className="text-gray-400 block mb-1">RPC Connection</label>
            <div className="text-white break-all">
              {account.rpc_connection_url}
            </div>
          </div>
          <div>
            <label className="text-gray-400 block mb-1">Indexer URL</label>
            <div className="text-white break-all">{account.indexer_url}</div>
          </div>
          <div>
            <label className="text-gray-400 block mb-1">RGB Proxy</label>
            <div className="text-white break-all">{account.proxy_endpoint}</div>
          </div>
          {account.datapath && (
            <>
              <div>
                <label className="text-gray-400 block mb-1">Daemon Port</label>
                <div className="text-white">
                  {account.daemon_listening_port}
                </div>
              </div>
              <div>
                <label className="text-gray-400 block mb-1">
                  LDK Peer Port
                </label>
                <div className="text-white">
                  {account.ldk_peer_listening_port}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
        <button
          className="w-full sm:w-1/2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white text-lg font-bold rounded shadow-md transition duration-200"
          disabled={isLoading}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="w-full sm:w-1/2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white text-lg font-bold rounded shadow-md transition duration-200"
          disabled={isLoading}
          onClick={handleConfirm}
          type="button"
        >
          {isLoading ? <Spinner size={20} /> : 'Select Node'}
        </button>
      </div>
    </>
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
        <AlertTriangle className="text-yellow-500 w-16 h-16 mb-4" />
        <h2 className="text-2xl font-bold">Delete Node</h2>
      </div>

      <div className="space-y-4 mb-8">
        <p className="text-gray-300">
          Are you sure you want to delete the node "
          <span className="font-semibold text-white">{account.name}</span>"?
        </p>

        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-left">
          <p className="text-yellow-500 font-medium mb-2">⚠️ Warning</p>
          <ul className="text-yellow-100/80 space-y-2 text-sm">
            <li>• This action cannot be undone</li>
            {account.datapath ? (
              <>
                <li>
                  • If you haven't backed up your node, you will permanently
                  lose access to your funds
                </li>
                <li>• All local node data will be permanently deleted</li>
                <li className="break-all">
                  • Data path to be deleted: {account.datapath}
                </li>
              </>
            ) : (
              <>
                <li>• This will only delete the stored connection settings</li>
                <li>
                  • The remote node will remain active and must be managed
                  directly on the remote machine
                </li>
                <li>
                  • Make sure you have access to the remote node's credentials
                  if you want to reconnect later
                </li>
              </>
            )}
          </ul>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
        <button
          className="w-full sm:w-1/2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white text-lg font-bold rounded-lg shadow-md transition duration-200"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="w-full sm:w-1/2 px-6 py-3 bg-blue-500/10 hover:bg-blue-500/20 text-white text-lg font-bold rounded-lg shadow-md transition duration-200 flex items-center justify-center gap-2"
          onClick={handleDelete}
          type="button"
        >
          <Trash2 size={20} />
          Delete {account.datapath ? 'Node' : 'Connection'}
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
  const [formData, setFormData] = useState(account)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await onSave(formData)
      onClose()
      toast.success(`Node "${formData.name}" updated successfully`)
    } catch (error) {
      toast.error('Failed to update node')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof Account, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Edit Node</h2>
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
      <div className="flex border-b border-gray-700 mb-6">
        <button
          className={`px-4 py-2 font-medium text-sm transition-colors relative
            ${
              activeTab === 'basic'
                ? 'text-cyan'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          onClick={() => setActiveTab('basic')}
          type="button"
        >
          Basic Settings
          {activeTab === 'basic' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan" />
          )}
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm transition-colors relative
            ${
              activeTab === 'advanced'
                ? 'text-cyan'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          onClick={() => setActiveTab('advanced')}
          type="button"
        >
          Advanced Settings
          {activeTab === 'advanced' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan" />
          )}
        </button>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {activeTab === 'basic' && (
          <>
            <div className="bg-blue-darker/30 p-4 rounded-lg border border-divider/10">
              <h3 className="text-sm font-medium text-gray-300 mb-4">
                Connection Settings
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1.5">
                    Node Name
                  </label>
                  <div className="flex items-center">
                    <input
                      className="w-full bg-gray-700 rounded-lg px-4 py-2.5 text-white border border-gray-600 focus:border-cyan/50 focus:outline-none"
                      disabled
                      type="text"
                      value={formData.name}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 text-sm mb-1.5">
                    Node URL
                  </label>
                  <div className="flex items-center">
                    <input
                      className="w-full bg-gray-700 rounded-lg px-4 py-2.5 text-white border border-gray-600 focus:border-cyan/50 focus:outline-none"
                      onChange={(e) =>
                        handleInputChange('node_url', e.target.value)
                      }
                      placeholder="http://localhost:3000"
                      type="text"
                      value={formData.node_url}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 text-sm mb-1.5">
                    RPC Connection URL
                  </label>
                  <div className="flex items-center">
                    <input
                      className="w-full bg-gray-700 rounded-lg px-4 py-2.5 text-white border border-gray-600 focus:border-cyan/50 focus:outline-none"
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
            </div>
          </>
        )}

        {activeTab === 'advanced' && (
          <>
            <div className="bg-blue-darker/30 p-4 rounded-lg border border-divider/10">
              <h3 className="text-sm font-medium text-gray-300 mb-4">
                Service Endpoints
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1.5">
                    Bitcoind RPC URL
                  </label>
                  <div className="flex items-center">
                    <input
                      className="w-full bg-gray-700 rounded-lg px-4 py-2.5 text-white border border-gray-600 focus:border-cyan/50 focus:outline-none"
                      onChange={(e) =>
                        handleInputChange('rpc_connection_url', e.target.value)
                      }
                      placeholder="user:password@localhost:18443"
                      type="text"
                      value={formData.rpc_connection_url}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 text-sm mb-1.5">
                    Indexer URL
                  </label>
                  <div className="flex items-center">
                    <input
                      className="w-full bg-gray-700 rounded-lg px-4 py-2.5 text-white border border-gray-600 focus:border-cyan/50 focus:outline-none"
                      onChange={(e) =>
                        handleInputChange('indexer_url', e.target.value)
                      }
                      placeholder="http://localhost:3002/api"
                      type="text"
                      value={formData.indexer_url}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 text-sm mb-1.5">
                    RGB Proxy Endpoint
                  </label>
                  <div className="flex items-center">
                    <input
                      className="w-full bg-gray-700 rounded-lg px-4 py-2.5 text-white border border-gray-600 focus:border-cyan/50 focus:outline-none"
                      onChange={(e) =>
                        handleInputChange('proxy_endpoint', e.target.value)
                      }
                      placeholder="http://localhost:3003/proxy"
                      type="text"
                      value={formData.proxy_endpoint}
                    />
                  </div>
                </div>

                {account.datapath && (
                  <div>
                    <label className="block text-gray-300 text-sm mb-1.5">
                      Data Path
                    </label>
                    <div className="flex items-center">
                      <input
                        className="w-full bg-gray-700 rounded-lg px-4 py-2.5 text-white border border-gray-600"
                        disabled
                        type="text"
                        value={formData.datapath}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Data path cannot be changed after account creation
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-blue-darker/30 p-4 rounded-lg border border-divider/10">
              <h3 className="text-sm font-medium text-gray-300 mb-4">
                Maker Settings
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1.5">
                    Default Maker URL
                  </label>
                  <div className="flex items-center">
                    <input
                      className="w-full bg-gray-700 rounded-lg px-4 py-2.5 text-white border border-gray-600 focus:border-cyan/50 focus:outline-none"
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
                  <label className="block text-gray-300 text-sm mb-1.5">
                    Default LSP URL
                  </label>
                  <div className="flex items-center">
                    <input
                      className="w-full bg-gray-700 rounded-lg px-4 py-2.5 text-white border border-gray-600 focus:border-cyan/50 focus:outline-none"
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

        <div className="flex space-x-4 mt-8 pt-4 border-t border-gray-700">
          <button
            className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white font-medium"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="flex-1 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 rounded-lg transition-colors text-white font-medium flex items-center justify-center"
            disabled={isLoading}
            type="submit"
          >
            {isLoading ? <Spinner size={20} /> : 'Save Changes'}
          </button>
        </div>
      </form>
    </>
  )
}
