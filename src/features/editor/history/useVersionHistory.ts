import { useCallback, useEffect, useRef, useState } from 'react'
import { CURRENT_VERSION, type DiffLine, type FileVersion, type VersionHistoryPage } from '../../../types/version'
import {
  compareVersions,
  createVersion,
  getVersion,
  getVersionHistory,
  restoreVersion,
} from '../../../services/versionService'
import { toAddedLines } from './diffBlocks'

/**
 * Qué se compara al seleccionar una versión:
 * - changes: lo que cambió en esa versión (respecto a la anterior)
 * - vs-current: diferencias entre esa versión y el contenido actual
 */
export type CompareMode = 'changes' | 'vs-current'

const HISTORY_PAGE_SIZE = 100

interface Loaded<T> {
  key: string
  data: T | null
  error: string | null
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

/** Líneas a mostrar para la versión seleccionada según el modo de comparación. */
async function loadComparison(documentId: string, number: number, mode: CompareMode): Promise<DiffLine[]> {
  if (mode === 'vs-current') {
    return (await compareVersions(documentId, number, CURRENT_VERSION)).lines
  }
  if (number === 1) {
    // La primera versión no tiene anterior: todo su contenido es nuevo
    return toAddedLines((await getVersion(documentId, number)).content ?? '')
  }
  return (await compareVersions(documentId, number - 1, number)).lines
}

/**
 * Ejecuta una carga asíncrona identificada por "key" y descarta respuestas de cargas anteriores.
 * El estado de carga se deriva de la clave, sin actualizaciones síncronas dentro del efecto.
 */
function useKeyedLoad<T>(key: string | null, load: () => Promise<T>, fallbackError: string) {
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

interface UseVersionHistoryOptions {
  /** Se ejecuta antes de guardar o restaurar (ej. enviar el autoguardado pendiente). */
  beforeChange: () => Promise<void>
  /** Recibe el contenido restaurado para mostrarlo en el editor. */
  onRestored: (content: string) => void
}

export interface UseVersionHistoryResult {
  page: VersionHistoryPage | null
  loadingList: boolean
  listError: string | null
  selected: FileVersion | null
  selectVersion: (number: number) => void
  mode: CompareMode
  setMode: (mode: CompareMode) => void
  diffLines: DiffLine[]
  loadingDiff: boolean
  diffError: string | null
  saveVersion: (summary: string) => Promise<void>
  restore: (number: number) => Promise<void>
}

/** Estado y operaciones del historial de versiones de un archivo (HU-23). */
export function useVersionHistory(
  documentId: string,
  { beforeChange, onRestored }: UseVersionHistoryOptions,
): UseVersionHistoryResult {
  const [reloadToken, setReloadToken] = useState(0)
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null)
  const [mode, setMode] = useState<CompareMode>('changes')

  const list = useKeyedLoad(
    `${documentId}:${reloadToken}`,
    () => getVersionHistory(documentId, HISTORY_PAGE_SIZE),
    'No fue posible cargar el historial',
  )

  const versions = list.data?.versions ?? []
  // Por defecto se selecciona la versión más reciente
  const selected = versions.find((version) => version.number === selectedNumber) ?? versions[0] ?? null

  const diff = useKeyedLoad(
    selected ? `${documentId}:${selected.number}:${mode}:${reloadToken}` : null,
    () => loadComparison(documentId, selected?.number ?? 1, mode),
    'No fue posible comparar las versiones',
  )

  const reloadAndSelect = useCallback((number: number) => {
    setSelectedNumber(number)
    setReloadToken((token) => token + 1)
  }, [])

  const saveVersion = useCallback(
    async (summary: string) => {
      await beforeChange()
      const created = await createVersion(documentId, summary)
      reloadAndSelect(created.number)
    },
    [beforeChange, documentId, reloadAndSelect],
  )

  const restore = useCallback(
    async (number: number) => {
      await beforeChange()
      const result = await restoreVersion(documentId, number)
      onRestored(result.content)
      reloadAndSelect(result.version.number)
    },
    [beforeChange, documentId, onRestored, reloadAndSelect],
  )

  return {
    page: list.data,
    loadingList: list.loading,
    listError: list.error,
    selected,
    selectVersion: setSelectedNumber,
    mode,
    setMode,
    diffLines: diff.data ?? [],
    loadingDiff: diff.loading,
    diffError: diff.error,
    saveVersion,
    restore,
  }
}
