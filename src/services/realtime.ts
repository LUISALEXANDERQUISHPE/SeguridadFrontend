import { API_URL } from './api'

/** Convierte la URL de la API (absoluta o relativa como "/api") en su equivalente ws:// o wss://. */
function toWebSocketUrl(apiUrl: string): string {
  const url = new URL(apiUrl, window.location.href)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString().replace(/\/$/, '')
}

/** URL del WebSocket en tiempo real: VITE_COLLAB_URL o la misma API con ws:// (ej. ws://localhost:5000/api/collab). */
export const REALTIME_URL = (import.meta.env.VITE_COLLAB_URL as string | undefined)?.trim()
  || `${toWebSocketUrl(API_URL)}/collab`
