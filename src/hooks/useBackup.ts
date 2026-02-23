import { open } from '@tauri-apps/plugin-dialog'
import { exists } from '@tauri-apps/plugin-fs'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'react-toastify'

import { parseRpcUrl } from '../helpers/utils'
import { nodeApi } from '../slices/nodeApi/nodeApi.slice'

interface BackupFormFields {
  backupPath: string
  nodePassword: string
}

interface NodeSettings {
  rpc_connection_url: string
  indexer_url: string
  proxy_endpoint: string
  default_lsp_url?: string
}

interface UseBackupProps {
  nodeSettings: NodeSettings
}

interface UseBackupReturn {
  showBackupModal: boolean
  setShowBackupModal: (show: boolean) => void
  isBackupInProgress: boolean
  control: any
  handleSubmit: any
  formState: any
  backupPath: string
  handleBackup: (data: BackupFormFields) => Promise<void>
  selectBackupFolder: () => Promise<void>
  isBackupLoading: boolean
}

export const useBackup = ({
  nodeSettings,
}: UseBackupProps): UseBackupReturn => {
  const [showBackupModal, setShowBackupModal] = useState(false)
  const [isBackupInProgress, setIsBackupInProgress] = useState(false)

  const { control, handleSubmit, formState, reset, watch, setValue } =
    useForm<BackupFormFields>({
      defaultValues: {
        backupPath: '',
        nodePassword: '',
      },
    })

  const [backup, { isLoading: isBackupLoading }] =
    nodeApi.useBackupMutation()
  const [lock] = nodeApi.endpoints.lock.useMutation()
  const [unlock] = nodeApi.endpoints.unlock.useMutation()

  const backupPath = watch('backupPath')

  const attemptLock = async () => {
    try {
      await lock().unwrap()
      return { data: {}, status: 200 }
    } catch (err) {
      console.error('Lock attempt failed:', err)
      return err as { status: number; data: { error?: string; code?: number } }
    }
  }

  const attemptUnlock = async (password: string) => {
    try {
      const rpcConfig = parseRpcUrl(nodeSettings.rpc_connection_url)
      await unlock({
        bitcoind_rpc_host: rpcConfig.host,
        bitcoind_rpc_password: rpcConfig.password,
        bitcoind_rpc_port: rpcConfig.port,
        bitcoind_rpc_username: rpcConfig.username,
        indexer_url: nodeSettings.indexer_url,
        password,
        proxy_endpoint: nodeSettings.proxy_endpoint,
      }).unwrap()
      return { data: {}, status: 200 }
    } catch (err) {
      console.error('Unlock attempt failed:', err)
      return err as { status: number; data: { error?: string; code?: number } }
    }
  }

  const attemptBackup = async (backupPath: string, password: string) => {
    try {
      await backup({ backup_path: backupPath, password }).unwrap()
      return { data: {}, status: 200 }
    } catch (err) {
      console.error('Backup attempt failed:', err)
      return err as { status: number; data: { error?: string; code?: number } }
    }
  }

  const handleBackup = async (data: BackupFormFields) => {
    const { backupPath: pathToBackup } = data

    if (!pathToBackup.trim()) {
      toast.error('Invalid backup path')
      return
    }

    if (await exists(pathToBackup)) {
      toast.error('Backup file already exists. Please choose a different path.')
      return
    }

    try {
      setIsBackupInProgress(true)
      const lockResponse = await attemptLock()

      if (lockResponse.status === 200) {
        await performBackupSequence(data)
      } else if (lockResponse.status === 403) {
        await handleLockedBackup(data)
      } else {
        toast.error('Lock unsuccessful')
      }
    } catch (err) {
      console.error('Backup failed:', err)
      toast.error('Backup error')
    } finally {
      handleBackupCompletion(pathToBackup)
    }
  }

  const performBackupSequence = async (data: BackupFormFields) => {
    const backupResponse = await attemptBackup(
      data.backupPath,
      data.nodePassword
    )
    if (backupResponse.status === 200) {
      await handleSuccessfulBackup(data)
    } else if (backupResponse.status === 401) {
      toast.error('Wrong password')
    } else {
      toast.error('Backup error')
    }
  }

  const handleLockedBackup = async (data: BackupFormFields) => {
    const unlockResponse = await attemptUnlock(data.nodePassword)
    if (unlockResponse.status === 200) {
      await lock().unwrap()
      await performBackupSequence(data)
    } else if (unlockResponse.status === 401) {
      toast.error('Wrong password')
    } else {
      toast.error('Unlock unsuccessful')
    }
  }

  const handleSuccessfulBackup = async (data: BackupFormFields) => {
    const rpcConfig = parseRpcUrl(nodeSettings.rpc_connection_url)
    await unlock({
      bitcoind_rpc_host: rpcConfig.host,
      bitcoind_rpc_password: rpcConfig.password,
      bitcoind_rpc_port: rpcConfig.port,
      bitcoind_rpc_username: rpcConfig.username,
      indexer_url: nodeSettings.indexer_url,
      password: data.nodePassword,
      proxy_endpoint: nodeSettings.proxy_endpoint,
    }).unwrap()
    toast.success('Backup successful')
  }

  const handleBackupCompletion = (pathToBackup: string) => {
    const directoryPath = pathToBackup.substring(
      0,
      pathToBackup.lastIndexOf('/')
    )
    const timestamp = new Date()
      .toLocaleString()
      .replace(/[/, ]/g, '_')
      .replace(/:/g, '')
    const newBackupPath = `${directoryPath}/backup_${timestamp}.enc`

    reset({ backupPath: newBackupPath, nodePassword: '' })
    setShowBackupModal(false)
    setIsBackupInProgress(false)
  }

  const selectBackupFolder = async () => {
    const selected = await open({ directory: true, multiple: false })
    if (typeof selected === 'string') {
      const timestamp = new Date()
        .toLocaleString()
        .replace(/[/, ]/g, '_')
        .replace(/:/g, '')
      setValue('backupPath', `${selected}/backup_${timestamp}.enc`)
    }
  }

  return {
    backupPath,
    control,
    formState,
    handleBackup,
    handleSubmit,
    isBackupInProgress,
    isBackupLoading,
    selectBackupFolder,
    setShowBackupModal,
    showBackupModal,
  }
}
