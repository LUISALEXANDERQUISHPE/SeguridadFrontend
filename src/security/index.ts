import { createSecureClient } from './secureClient.ts'

/**
 * Canal cifrado de la aplicación, configurado con el .env (VITE_DH_PRIME_HEX, VITE_DH_GENERATOR).
 * Aquí no hay AES ni Huffman ni llave maestra: el navegador nunca toca los datos guardados.
 *
 * Uso:  const data = await secureRequest<Respuesta>('/ruta', { method: 'POST', body: { ... } })
 */
const API_URL = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/$/, '')

export const secureClient = createSecureClient({
  baseUrl: API_URL,
  dhPrimeHex: import.meta.env.VITE_DH_PRIME_HEX ?? '',
  dhGenerator: import.meta.env.VITE_DH_GENERATOR || '2',
})

export const secureRequest = secureClient.request

export interface SecureRoundtripReport {
  receivedBytes: number
  receivedSha256: string
  huffmanBytes: number
  storedBytes: number
  storageRoundtripOk: boolean
}

/**
 * Prueba de punta a punta (requiere SECURE_DIAGNOSTICS_ENABLED=true en el backend):
 * envía un texto cifrado, el servidor lo guarda con Huffman + AES, lo lee y lo devuelve cifrado.
 */
export function runSecureRoundtrip(content: string) {
  return secureRequest<{ content: string; report: SecureRoundtripReport }>('/secure/diagnostics/roundtrip', {
    method: 'POST',
    body: { content },
  })
}
