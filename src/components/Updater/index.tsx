import { relaunch } from '@tauri-apps/plugin-process'
import { Update, check } from '@tauri-apps/plugin-updater'
import { Loader2, AlertCircle } from 'lucide-react'
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

  useEffect(() => {
    const checkForUpdate = async () => {
      setIsCheckingUpdate(true)
      let _update: Update | null = null
      try {
        _update = await check({
          timeout: 10000,
        })
      } catch (e) {
        console.log(e)
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

  if (isCheckingUpdate) {
    return (
      <div className="flex items-center gap-4 p-4 bg-blue-dark/50 backdrop-blur-sm border border-cyan/20 rounded-lg">
        <Loader2 className="w-5 h-5 animate-spin text-cyan" />
        <p className="text-white">Checking for updates...</p>
      </div>
    )
  }

  if (!update) return null

  const handleInstall = async () => {
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
            break
        }
      })
    } catch (err) {
      toast.error('Failed to install update')
      console.error(err)
    }
  }

  if (completed) {
    return (
      <div className="flex items-center gap-4 p-4 bg-blue-dark/50 backdrop-blur-sm border border-cyan/20 rounded-lg">
        <div className="flex-1">
          <p className="font-medium text-white">
            Update downloaded successfully!
          </p>
          <p className="text-sm text-gray-400">
            The application needs to restart to apply the update.
          </p>
        </div>
        <button
          className="px-4 py-2 bg-cyan text-white rounded hover:bg-cyan/80 transition-colors"
          onClick={() => relaunch()}
        >
          Restart Now
        </button>
      </div>
    )
  }

  if (contentLength) {
    console.log(Math.round((downloaded / contentLength) * 100))
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div
              className="bg-cyan h-2.5 rounded-full transition-all duration-300"
              style={{
                width: `${Math.floor((downloaded / contentLength) * 10) * 10}%`,
              }}
            />
          </div>
          <p className="text-sm text-gray-400">
            Downloading: {Math.round((downloaded / contentLength) * 100)}%
          </p>
        </div>

        <div className="p-4 bg-blue-dark/50 backdrop-blur-sm border border-cyan/20 rounded-lg">
          <p className="font-medium text-white">Update v{update.version}</p>
          {update.date && (
            <p className="text-sm text-gray-400">Released: {update.date}</p>
          )}
          {update.body && (
            <p className="text-sm text-gray-400 mt-1">Notes: {update.body}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 p-4 bg-blue-dark/50 backdrop-blur-sm border border-cyan/20 rounded-lg">
      <AlertCircle className="w-5 h-5 text-cyan" />
      <div className="flex-1">
        <p className="font-medium text-white">
          Update available: v{update.version}
        </p>
        {update.date && (
          <p className="text-sm text-gray-400">Released: {update.date}</p>
        )}
        {update.body && (
          <p className="text-sm text-gray-400 mt-1">Notes: {update.body}</p>
        )}
      </div>
      <div className="flex gap-2">
        <button
          className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          onClick={() => setUpdateChecked(true)}
        >
          Skip
        </button>
        <button
          className="px-3 py-1.5 text-sm bg-cyan text-white rounded hover:bg-cyan/90 transition-colors"
          onClick={handleInstall}
        >
          Install Update
        </button>
      </div>
    </div>
  )
}
