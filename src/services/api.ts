const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').trim().replace(/\/$/, '')

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

export { API_URL }