import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

/** Dev-only server for screenshotting the P2P cost screens. Not the desktop app. */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: fileURLToPath(new URL('../..', import.meta.url)),
  server: {
    host: '127.0.0.1',
    port: 4178,
    strictPort: true,
  },
})
