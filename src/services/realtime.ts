import { API_URL } from './api'

/** URL del WebSocket en tiempo real: VITE_COLLAB_URL o la misma API con ws:// (ej. ws://localhost:5000/api/collab). */
export const REALTIME_URL = (import.meta.env.VITE_COLLAB_URL as string | undefined)?.trim()
  || `${API_URL.replace(/^http/i, 'ws')}/collab`
