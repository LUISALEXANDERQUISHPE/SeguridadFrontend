import { useEffect, useState } from 'react'
import { getShareSuggestions, SHARE_SUGGESTION_MIN_LENGTH, type ShareSuggestion } from '../../../services/projectService'

// Espera tras la última tecla antes de consultar, para no hacer una petición por letra
const DEBOUNCE_MS = 250

/**
 * Sugerencias de usuarios registrados mientras se escribe el correo al compartir.
 * Cancela la consulta anterior si el texto cambia antes de que llegue la respuesta.
 */
export function useShareSuggestions(projectId: string, query: string, enabled: boolean) {
  const [suggestions, setSuggestions] = useState<ShareSuggestion[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const trimmed = query.trim()
  const shouldSearch = enabled && trimmed.length >= SHARE_SUGGESTION_MIN_LENGTH

  useEffect(() => {
    if (!shouldSearch) return

    const controller = new AbortController()
    const timer = setTimeout(() => {
      setIsSearching(true)
      getShareSuggestions(projectId, trimmed, controller.signal)
        .then((users) => setSuggestions(users))
        .catch(() => {
          // Si se canceló o falló, simplemente no se muestran sugerencias
          if (!controller.signal.aborted) setSuggestions([])
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsSearching(false)
        })
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [projectId, trimmed, shouldSearch])

  return { suggestions: shouldSearch ? suggestions : [], isSearching: shouldSearch && isSearching }
}

export default useShareSuggestions
