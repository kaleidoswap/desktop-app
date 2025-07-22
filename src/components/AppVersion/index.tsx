import { getName, getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { GitCommit, Calendar, Package } from 'lucide-react'
import { useState, useEffect } from 'react'

interface AppVersionInfo {
  name: string
  version: string
  commit?: string
  buildDate?: string
  environment?: string
}

interface AppVersionProps {
  isCollapsed?: boolean
  showDetailed?: boolean
  className?: string
}

export const AppVersion: React.FC<AppVersionProps> = ({
  isCollapsed = false,
  showDetailed = false,
  className = '',
}) => {
  const [versionInfo, setVersionInfo] = useState<AppVersionInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    const getVersionInfo = async () => {
      try {
        setIsLoading(true)

        // Get basic app info from Tauri
        const [appName, appVersion] = await Promise.all([
          getName(),
          getVersion(),
        ])

        // Try to get additional build info if available
        const info: AppVersionInfo = {
          commit: __GIT_COMMIT__ || 'unknown',
          environment: __NODE_ENV__ || 'development',
          name: appName,
          version: appVersion,
        }

        setVersionInfo(info)
      } catch (error) {
        console.error('Failed to get version info:', error)
        // Fallback to package.json version if available
        setVersionInfo({
          name: 'KaleidoSwap',
          version: '0.1.1', // fallback
        })
      } finally {
        setIsLoading(false)
      }
    }

    getVersionInfo()
  }, [])

  if (isLoading || !versionInfo) {
    return null
  }

  const formatCommit = (commit?: string) => {
    if (!commit) return 'Unknown'
    return commit.length > 7 ? commit.substring(0, 7) : commit
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown'
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  if (isCollapsed && !showDetailed) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <button
          className="px-1.5 py-0.5 text-xs text-gray-400 hover:text-white transition-colors rounded font-mono"
          onClick={() => setShowDetails(!showDetails)}
          onMouseEnter={() => setShowDetails(true)}
          onMouseLeave={() => setShowDetails(false)}
          title={`${versionInfo.name} v${versionInfo.version}`}
        >
          v{versionInfo.version}
        </button>

        {showDetails && (
          <div className="absolute bottom-12 left-2 bg-blue-dark border border-divider/20 rounded shadow-lg p-2 z-50 min-w-48">
            <div className="text-xs text-gray-300 space-y-1">
              <div className="flex items-center gap-1.5 pb-1 border-b border-divider/20">
                <Package className="w-2.5 h-2.5" />
                <span className="font-medium text-xs">{versionInfo.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Version:</span>
                <span className="font-mono text-xs">
                  v{versionInfo.version}
                </span>
              </div>
              {versionInfo.commit && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Commit:</span>
                  <span className="font-mono text-xs">
                    {formatCommit(versionInfo.commit)}
                  </span>
                </div>
              )}
              {versionInfo.buildDate && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Built:</span>
                  <span className="text-xs">
                    {formatDate(versionInfo.buildDate)}
                  </span>
                </div>
              )}
              {versionInfo.environment && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Env:</span>
                  <span className="capitalize text-xs">
                    {versionInfo.environment}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (showDetailed) {
    return (
      <div className={`bg-white/5 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-cyan" />
          <h3 className="text-sm font-medium text-white">App Information</h3>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Version:</span>
            <span className="font-mono text-white bg-cyan/20 px-2 py-1 rounded">
              v{versionInfo.version}
            </span>
          </div>

          {versionInfo.commit && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1 text-gray-400">
                <GitCommit className="w-3 h-3" />
                <span>Commit:</span>
              </div>
              <span className="font-mono text-white bg-gray-600/30 px-2 py-1 rounded">
                {formatCommit(versionInfo.commit)}
              </span>
            </div>
          )}

          {versionInfo.buildDate && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1 text-gray-400">
                <Calendar className="w-3 h-3" />
                <span>Built:</span>
              </div>
              <span className="text-white">
                {formatDate(versionInfo.buildDate)}
              </span>
            </div>
          )}

          {versionInfo.environment && (
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Environment:</span>
              <span className="capitalize text-white bg-amber-600/30 px-2 py-1 rounded text-xs">
                {versionInfo.environment}
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Compact version for sidebar footer
  return (
    <div className={`${className}`}>
      <button
        className="w-full text-center px-1.5 py-1 text-xs text-gray-400 hover:text-white transition-colors rounded font-mono"
        onClick={() => setShowDetails(!showDetails)}
        onMouseEnter={() => setShowDetails(true)}
        onMouseLeave={() => setShowDetails(false)}
        title={`${versionInfo.name} v${versionInfo.version}`}
      >
        v{versionInfo.version}
      </button>

      {showDetails && (
        <div className="absolute bottom-full left-2 right-2 mb-1 bg-blue-dark border border-divider/20 rounded shadow-lg p-2 z-50">
          <div className="text-xs text-gray-300 space-y-1">
            <div className="flex items-center gap-1.5 pb-1 border-b border-divider/20">
              <Package className="w-2.5 h-2.5 text-cyan" />
              <span className="font-medium text-white text-xs">
                {versionInfo.name}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Version:</span>
              <span className="font-mono text-white text-xs">
                v{versionInfo.version}
              </span>
            </div>
            {versionInfo.commit && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Commit:</span>
                <span className="font-mono text-white text-xs">
                  {formatCommit(versionInfo.commit)}
                </span>
              </div>
            )}
            {versionInfo.buildDate && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Built:</span>
                <span className="text-white text-xs">
                  {formatDate(versionInfo.buildDate)}
                </span>
              </div>
            )}
            {versionInfo.environment && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Environment:</span>
                <span className="capitalize text-white text-xs">
                  {versionInfo.environment}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
