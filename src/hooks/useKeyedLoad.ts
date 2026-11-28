import { useEffect, useRef, useState } from 'react'

interface Loaded<T> {
  key: string
  data: T | null
  error: string | null
}

export interface KeyedLoadResult<T> {
  data: T | null
  error: string | null
  loading: boolean
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

/**
 * Ejecuta una carga asíncrona identificada por "key" y descarta las respuestas de cargas
 * anteriores (una respuesta lenta nunca reemplaza a una más reciente).
 * El estado de carga se deriva de la clave, sin actualizaciones síncronas dentro del efecto.
 *
 * @param key Identifica qué se está cargando; al cambiar se vuelve a cargar. null = no cargar.
 * @param load Función que obtiene los datos
 * @param fallbackError Mensaje si el error no trae uno propio
 */
export function useKeyedLoad<T>(
  key: string | null,
  load: () => Promise<T>,
  fallbackError: string,
): KeyedLoadResult<T> {
  const [loaded, setLoaded] = useState<Loaded<T>>({ key: '', data: null, error: null })
  // La clave decide cuándo recargar; la función más reciente se lee desde la ref
  const loadRef = useRef(load)

  useEffect(() => {
    loadRef.current = load
  }, [load])

  useEffect(() => {
    if (!key) return undefined
    let isCurrent = true
    loadRef
      .current()
      .then((data) => {
        if (isCurrent) setLoaded({ key, data, error: null })
      })
      .catch((err: unknown) => {
        if (isCurrent) setLoaded({ key, data: null, error: toMessage(err, fallbackError) })
      })
    return () => {
      isCurrent = false
    }
  }, [key, fallbackError])

  const isFresh = loaded.key === key
  return {
    data: isFresh ? loaded.data : null,
    error: isFresh ? loaded.error : null,
    loading: Boolean(key) && !isFresh,
  }
}
