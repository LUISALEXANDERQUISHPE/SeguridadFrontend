import { randomBytes } from 'node:crypto'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { originsOf, securityHeadersPlugin } from './securityHeaders.ts'

// https://vite.dev/config/
export default defineConfig(({ command, mode, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Backend al que el servidor de desarrollo reenvía /api (HTTP y WebSocket)
  const backendUrl = env.VITE_BACKEND_PROXY_TARGET || 'http://localhost:5000'

  // En desarrollo Vite inserta scripts y estilos propios (recarga en caliente): llevan este nonce
  // aleatorio para que la Content-Security-Policy los permita sin abrir 'unsafe-inline'.
  // La versión compilada no tiene código en línea, así que no lo necesita.
  const isDevServer = command === 'serve' && !isPreview
  const nonce = isDevServer ? randomBytes(18).toString('base64') : undefined

  return {
    plugins: [
      react(),
      tailwindcss(),
      securityHeadersPlugin({
        nonce,
        connectSources: originsOf([env.VITE_SUPABASE_URL, env.VITE_API_URL, env.VITE_COLLAB_URL]),
      }),
    ],
    html: nonce ? { cspNonce: nonce } : undefined,
    server: {
      // Permite abrir el frontend desde túneles (reenvío de puertos de VS Code / Dev Tunnels)
      allowedHosts: ['.devtunnels.ms'],
      proxy: {
        '/api': { target: backendUrl, changeOrigin: true, ws: true },
      },
    },
  }
})
