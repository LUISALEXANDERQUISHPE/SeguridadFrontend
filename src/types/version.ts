/** Contenido vigente del archivo, al comparar ("versión actual"). */
export const CURRENT_VERSION = 'current'

export type VersionRef = number | typeof CURRENT_VERSION

export interface VersionAuthor {
  id: string
  name: string
}

export interface LineChanges {
  added: number
  removed: number
}

export interface FileVersion {
  id: string
  number: number
  summary: string
  createdAt: string
  author: VersionAuthor | null
  sizeBytes: number
  /** Líneas cambiadas respecto a la versión anterior (solo en el listado). */
  changes?: LineChanges
  /** Contenido completo (solo al consultar una versión). */
  content?: string
}

export interface VersionHistoryPage {
  versions: FileVersion[]
  total: number
  limit: number
  offset: number
  /** true si el archivo tiene cambios posteriores a la última versión guardada. */
  hasUnversionedChanges: boolean
}

export type DiffLineType = 'equal' | 'added' | 'removed'

export interface DiffLine {
  type: DiffLineType
  oldNumber: number | null
  newNumber: number | null
  text: string
}

export interface VersionComparison {
  from: VersionRef
  to: VersionRef
  fileName: string
  lines: DiffLine[]
  stats: LineChanges & { unchanged: number }
}

export interface RestoreVersionResult {
  message: string
  version: FileVersion
  content: string
}
