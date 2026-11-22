import { authorizedRequest } from './api'
import type {
  FileVersion,
  RestoreVersionResult,
  VersionComparison,
  VersionHistoryPage,
  VersionRef,
} from '../types/version'

function versionsPath(documentId: string): string {
  return `/documents/${encodeURIComponent(documentId)}/versions`
}

/** Historial de versiones del archivo, de la más reciente a la más antigua. */
export function getVersionHistory(documentId: string, limit = 50, offset = 0): Promise<VersionHistoryPage> {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  return authorizedRequest<VersionHistoryPage>(`${versionsPath(documentId)}?${query}`)
}

/** Una versión con su contenido completo. */
export async function getVersion(documentId: string, number: number): Promise<FileVersion> {
  const response = await authorizedRequest<{ version: FileVersion }>(`${versionsPath(documentId)}/${number}`)
  return response.version
}

/** Diferencias línea a línea entre dos versiones ("current" = contenido actual). */
export function compareVersions(documentId: string, from: VersionRef, to: VersionRef): Promise<VersionComparison> {
  const query = new URLSearchParams({ from: String(from), to: String(to) })
  return authorizedRequest<VersionComparison>(`${versionsPath(documentId)}/compare?${query}`)
}

/** Guarda el contenido actual como una versión con descripción. */
export async function createVersion(documentId: string, summary: string): Promise<FileVersion> {
  const response = await authorizedRequest<{ version: FileVersion }>(versionsPath(documentId), {
    method: 'POST',
    body: JSON.stringify({ summary }),
  })
  return response.version
}

/** Restaura una versión anterior (se registra como versión nueva). */
export function restoreVersion(documentId: string, number: number): Promise<RestoreVersionResult> {
  return authorizedRequest<RestoreVersionResult>(`${versionsPath(documentId)}/${number}/restore`, { method: 'POST' })
}
