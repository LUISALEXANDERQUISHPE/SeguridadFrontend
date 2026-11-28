import { authorizedRequest } from './api'
import { getAuthToken } from './documentService'
import { secureFetch } from '../security'
import type { GetTemplateResponse, GetTemplatesResponse, LatexTemplate } from '../types/template'

function templatePath(templateId: string): string {
  return `/templates/${encodeURIComponent(templateId)}`
}

/** Catálogo de plantillas del sistema. */
export async function getTemplates(): Promise<LatexTemplate[]> {
  const response = await authorizedRequest<GetTemplatesResponse>('/templates')
  return response.templates ?? []
}

/** Detalle de una plantilla: archivos que se copiarán y código del archivo principal. */
export async function getTemplate(templateId: string): Promise<LatexTemplate> {
  const response = await authorizedRequest<GetTemplateResponse>(templatePath(templateId))
  return response.template
}

// Las vistas previas no cambian mientras la app está abierta: se descargan una sola vez
const previewCache = new Map<string, Promise<Blob>>()

async function downloadPreview(templateId: string): Promise<Blob> {
  const token = getAuthToken()
  if (!token) throw new Error('Sesión expirada o no autenticada. Por favor, inicia sesión de nuevo.')

  const response = await secureFetch(`${templatePath(templateId)}/preview`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    throw new Error(`No fue posible obtener la vista previa (código ${response.status})`)
  }
  return response.blob()
}

/** Vista previa en PDF de una plantilla (por el canal cifrado, con caché en memoria). */
export function getTemplatePreview(templateId: string): Promise<Blob> {
  const cached = previewCache.get(templateId)
  if (cached) return cached

  const request = downloadPreview(templateId).catch((error: unknown) => {
    // Un fallo no queda en caché: el siguiente intento vuelve a pedirla
    previewCache.delete(templateId)
    throw error
  })
  previewCache.set(templateId, request)
  return request
}
