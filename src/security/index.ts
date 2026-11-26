import { createSecureClient } from './secureClient.ts'

/**
 * Canal cifrado de la aplicación, configurado con el .env (VITE_DH_PRIME_HEX, VITE_DH_GENERATOR).
 * Aquí no hay AES ni Huffman ni llave maestra: el navegador nunca toca los datos guardados.
 *
 * Toda la comunicación con el backend pasa por aquí:
 *   secureFetch('/ruta', init)         en lugar de fetch(`${API}/ruta`, init)
 *   openSecureWebSocket(url)           en lugar de new WebSocket(url)
 */
const RAW_API_URL = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/$/, '')
const API_BASE_URL = RAW_API_URL.endsWith('/api') ? RAW_API_URL : `${RAW_API_URL}/api`

export const secureClient = createSecureClient({
  baseUrl: API_BASE_URL,
  dhPrimeHex: import.meta.env.VITE_DH_PRIME_HEX ?? '',
  dhGenerator: import.meta.env.VITE_DH_GENERATOR || '2',
})

export const secureFetch = secureClient.fetch
export const openSecureWebSocket = secureClient.openWebSocket

export type { SecureWebSocket } from './secureWebSocket.ts'

export interface SecureRoundtripReport {
  receivedBytes: number
  receivedSha256: string
  huffmanBytes: number
  storedBytes: number
  storageRoundtripOk: boolean
}
