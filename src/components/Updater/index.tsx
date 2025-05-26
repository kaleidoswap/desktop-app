import { relaunch } from '@tauri-apps/plugin-process'
import { Update, check } from '@tauri-apps/plugin-updater'
import {
  Loader2,
  AlertCircle,
  Download,
  CheckCircle2,
  RefreshCw,
  X,
  Calendar,
  FileText,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'

type UpdaterProps = {
  setUpdateChecked: (checked: boolean) => void
}

export const Updater = ({ setUpdateChecked }: UpdaterProps) => {
  const [update, setUpdate] = useState<null | Update>(null)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(true)
  const [contentLength, setContentLength] = useState<number | undefined>(
    undefined
  )
  const [downloaded, setDownloaded] = useState<number>(0)
  const [completed, setCompleted] = useState<boolean>(false)
  const [isInstalling, setIsInstalling] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkForUpdate = async () => {
      setIsCheckingUpdate(true)
      setError(null)
      let _update: Update | null = null
      try {
        _update = await check({
          timeout: 10000,
        })
      } catch (e) {
        console.log(e)
        setError('Failed to check for updates. Please try again later.')
      } finally {
        setIsCheckingUpdate(false)
      }

      if (_update) {
        setUpdate(_update)
      } else {
        setUpdateChecked(true)
      }
    }

    checkForUpdate()
  }, [setUpdateChecked])

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  if (isCheckingUpdate) {
    return (
      <div className="relative overflow-hidden p-6 bg-gradient-to-br from-blue-900/40 to-blue-800/30 backdrop-blur-md border border-cyan/30 rounded-xl shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan/5 to-blue/5 animate-pulse" />
        <div className="relative flex items-center gap-4">
          <div className="p-2 bg-cyan/20 rounded-full">
            <Loader2 className="w-6 h-6 animate-spin text-cyan" />
          </div>
          <div>
            <p className="text-white font-medium">Checking for updates...</p>
            <p className="text-gray-400 text-sm">This may take a few moments</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-gradient-to-br from-red-900/40 to-red-800/30 backdrop-blur-md border border-red/30 rounded-xl shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-red/20 rounded-full">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          <div className="flex-1">
            <p className="text-white font-medium">Update Check Failed</p>
            <p className="text-gray-400 text-sm mt-1">{error}</p>
          </div>
          <button
            aria-label="Dismiss"
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
            onClick={() => setUpdateChecked(true)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    )
  }

  if (!update) return null

  const handleInstall = async () => {
    setIsInstalling(true)
    setError(null)
    try {
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            setContentLength(() => event.data.contentLength)
            break
          case 'Progress':
            setDownloaded((prev) => (prev += event.data.chunkLength))
            break
          case 'Finished':
            setCompleted(true)
            setIsInstalling(false)
            break
        }
      })
    } catch (err) {
      setError('Failed to install update. Please try again.')
      setIsInstalling(false)
      toast.error('Failed to install update')
      console.error(err)
    }
  }

  if (completed) {
    return (
      <div className="relative overflow-hidden p-6 bg-gradient-to-br from-green-900/40 to-emerald-800/30 backdrop-blur-md border border-emerald/30 rounded-xl shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald/10 to-green/10" />
        <div className="relative flex items-center gap-4">
          <div className="p-2 bg-emerald/20 rounded-full">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white text-lg">Update Ready!</p>
            <p className="text-gray-300 text-sm">
              Version {update.version} has been downloaded successfully. Restart
              to apply changes.
            </p>
          </div>
          <button
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-emerald/25 transform hover:scale-105"
            onClick={() => relaunch()}
          >
            <RefreshCw className="w-4 h-4 mr-2 inline" />
            Restart Now
          </button>
        </div>
      </div>
    )
  }

  if (contentLength && isInstalling) {
    const progress = Math.round((downloaded / contentLength) * 100)
    const downloadedSize = formatFileSize(downloaded)
    const totalSize = formatFileSize(contentLength)

    return (
      <div className="space-y-4">
        <div className="p-6 bg-gradient-to-br from-blue-900/40 to-purple-800/30 backdrop-blur-md border border-cyan/30 rounded-xl shadow-2xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 bg-cyan/20 rounded-full">
              <Download className="w-6 h-6 text-cyan animate-bounce" />
            </div>
            <div>
              <p className="font-semibold text-white">Downloading Update</p>
              <p className="text-gray-400 text-sm">Version {update.version}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-300">
                {downloadedSize} / {totalSize}
              </span>
              <span className="text-cyan font-medium">{progress}%</span>
            </div>

            <div className="relative w-full bg-gray-700/50 rounded-full h-3 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-gray-700/30 to-gray-600/30" />
              <div
                className="relative h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500 ease-out shadow-lg"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-full" />
                <div className="absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-white/30 to-transparent rounded-full animate-pulse" />
              </div>
            </div>
          </div>

          {update.body && (
            <div className="mt-4 p-3 bg-black/20 rounded-lg border border-gray-600/30">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-300">
                  Release Notes
                </span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                {update.body}
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden p-6 bg-gradient-to-br from-amber-900/40 to-orange-800/30 backdrop-blur-md border border-amber/30 rounded-xl shadow-2xl">
      <div className="absolute inset-0 bg-gradient-to-r from-amber/5 to-orange/5" />
      <div className="relative">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-2 bg-amber/20 rounded-full">
            <AlertCircle className="w-6 h-6 text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white text-lg mb-1">
              Update Available
            </h3>
            <p className="text-amber-200 font-medium">
              Version {update.version}
            </p>

            <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
              {update.date && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>Released {formatDate(update.date)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {update.body && (
          <div className="mb-6 p-4 bg-black/20 rounded-lg border border-gray-600/30">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-300">
                What's New
              </span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              {update.body}
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            className="px-4 py-2 text-gray-400 hover:text-white transition-all duration-200 rounded-lg hover:bg-white/10 border border-transparent hover:border-gray-600"
            disabled={isInstalling}
            onClick={() => setUpdateChecked(true)}
          >
            Skip for Now
          </button>
          <button
            className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all duration-200 shadow-lg hover:shadow-amber/25 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            disabled={isInstalling}
            onClick={handleInstall}
          >
            {isInstalling ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Installing...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Install Update
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
