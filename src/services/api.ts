import { getAuthToken } from './documentService'

const API_URL = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/$/, '')

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const data = (await response.json().catch(() => ({}))) as T & { error?: string | { message?: string } }
  if (!response.ok) {
    const error = typeof data.error === 'string' ? data.error : data.error?.message
    throw new Error(error || 'No fue posible completar la solicitud')
  }

  return data
}

/**
 * Petición a la API con el token de la sesión. Si no hay sesión, falla sin llamar al servidor.
 */
export function authorizedRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken()
  if (!token) {
    return Promise.reject(new Error('Sesión expirada o no autenticada. Por favor, inicia sesión de nuevo.'))
  }

  return apiRequest<T>(path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  })
}

export { API_URL }