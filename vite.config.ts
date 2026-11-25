import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Backend al que el servidor de desarrollo reenvía /api (HTTP y WebSocket)
  const backendUrl = env.VITE_BACKEND_PROXY_TARGET || 'http://localhost:5000'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // Permite abrir el frontend desde túneles (reenvío de puertos de VS Code / Dev Tunnels)
      allowedHosts: ['.devtunnels.ms'],
      proxy: {
        '/api': { target: backendUrl, changeOrigin: true, ws: true },
      },
    },
  }
})
