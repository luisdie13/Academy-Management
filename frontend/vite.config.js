import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    hmr: {
      // Tell the browser's HMR WebSocket client to connect back to localhost:5173
      // (the host-mapped port). Without this, Vite advertises the container's
      // internal address, which the browser can't reach.
      host: 'localhost',
      clientPort: 5173,
    },
    watch: {
      // Docker on Windows doesn't propagate inotify events through bind mounts.
      // Polling is required for HMR file detection to work.
      usePolling: true,
    },
    proxy: {
      // VITE_PROXY_TARGET is set to 'http://backend:3000' in docker-compose so
      // the Vite server (running inside the container) reaches the backend via
      // Docker's internal network. Falls back to localhost for plain local dev.
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
