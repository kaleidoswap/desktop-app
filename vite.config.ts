import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'child_process'

// Get git information at build time
const getGitInfo = () => {
  try {
    const gitCommit = execSync('git rev-parse HEAD', {
      encoding: 'utf8',
    }).trim()
    const gitBranch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
    }).trim()
    return { gitCommit, gitBranch }
  } catch (error) {
    console.warn('Could not get git info:', error)
    return { gitCommit: 'unknown', gitBranch: 'unknown' }
  }
}

// https://vitejs.dev/config/
export default defineConfig(async () => {
  const { gitCommit, gitBranch } = getGitInfo()
  const buildDate = new Date().toISOString()
  const devHost = process.env.TAURI_DEV_HOST || '127.0.0.1'

  return {
    plugins: [react(), tailwindcss()],

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
      host: devHost,
      hmr: {
        host: devHost,
        port: 1421,
        protocol: 'ws',
      },
      port: 1420,
      strictPort: true,
      watch: {
        ignored: ['**/src-tauri/target/**'],
      },
    },
    // 3. to make use of `TAURI_DEBUG` and other env variables
    // https://tauri.studio/v1/api/config#buildconfig.beforedevcommand
    envPrefix: ['VITE_', 'TAURI_'],

    // 4. Define build-time constants
    define: {
      __GIT_COMMIT__: JSON.stringify(gitCommit),
      __GIT_BRANCH__: JSON.stringify(gitBranch),
      __BUILD_DATE__: JSON.stringify(buildDate),
      __NODE_ENV__: JSON.stringify(process.env.NODE_ENV || 'development'),
    },
  }
})
