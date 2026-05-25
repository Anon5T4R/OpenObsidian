import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config for the Capacitor (Android/iOS) web build.
// Builds only the renderer — no Electron main/preload.
export default defineConfig({
  root: 'src/renderer',
  build: {
    outDir: resolve(__dirname, 'www'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
    },
  },
  plugins: [react()],
})
