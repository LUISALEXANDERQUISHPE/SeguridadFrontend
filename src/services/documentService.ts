import type {
  CompileDocumentResponse,
  CreateDocumentRequest,
  CreateDocumentResponse,
  DocumentListItem,
  GetDocumentResponse,
  GetDocumentsResponse,
  LatexDocument,
  SaveDocumentResponse,
  ProjectNode,
} from '../types/document'

export const DEFAULT_LATEX_TEMPLATE = `\\documentclass[12pt,a4paper]{article}

\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[spanish]{babel}
\\usepackage{geometry}

\\geometry{
    top=3cm,
    bottom=2.5cm,
    left=3cm,
    right=2.5cm
}

\\begin{document}

\\section{Introducción}

Escribe aquí el contenido del documento.

\\end{document}
`

const RAW_API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').trim().replace(/\/$/, '')
// Ensure base URL points to the /api prefix correctly
const BASE_URL = RAW_API_URL.endsWith('/api') ? RAW_API_URL : `${RAW_API_URL}/api`

export function getAuthToken(): string | null {
  return localStorage.getItem('seguridad_auth_token')
}

async function requestWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const response = await fetch(`${BASE_URL}${cleanEndpoint}`, {
    ...options,
    headers,
  })

  // Handle 401 Unauthorized
  if (response.status === 401) {
    throw new Error('Sesión expirada o no autenticada. Por favor, inicia sesión de nuevo.')
  }

  // Handle 422 Unprocessable Entity (compilation errors return status 422)
  if (response.status === 422) {
    const errorData = await response.json().catch(() => ({}))
    return errorData as T
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const msg = errorData.message || errorData.error || `Error en la solicitud (código ${response.status})`
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }

  return (await response.json()) as T
}

/**
 * Crea un nuevo documento LaTeX en el Backend
 */
export async function createDocument(data: CreateDocumentRequest): Promise<CreateDocumentResponse> {
  return requestWithAuth<CreateDocumentResponse>('/documents', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Obtiene la lista de documentos del usuario
 */
export async function getDocuments(): Promise<DocumentListItem[]> {
  const response = await requestWithAuth<GetDocumentsResponse>('/documents', {
    method: 'GET',
  })
  return response.documents || []
}

/**
 * Obtiene un documento por su ID
 */
export async function getDocument(id: string): Promise<LatexDocument> {
  const response = await requestWithAuth<GetDocumentResponse>(`/documents/${id}`, {
    method: 'GET',
  })
  return response.document
}

export async function getProjectTree(projectId: string): Promise<{ nodes: ProjectNode[]; role: string }> {
  const response = await requestWithAuth<{ nodes: ProjectNode[]; role: string }>(`/documents/project/${projectId}/tree`)
  return response
}

export async function createProjectNode(
  projectId: string,
  data: { name: string; nodeType: 'archivo' | 'carpeta'; parentId?: string | null; content?: string; dataBase64?: string; mimeType?: string }
): Promise<ProjectNode> {
  const response = await requestWithAuth<{ node: ProjectNode }>(`/documents/project/${projectId}/nodes`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return response.node
}

export async function renameProjectNode(projectId: string, nodeId: string, name: string): Promise<ProjectNode> {
  const response = await requestWithAuth<{ node: ProjectNode }>(`/documents/project/${projectId}/nodes/${nodeId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
  return response.node
}

export async function moveProjectNode(projectId: string, nodeId: string, parentId: string | null, order: number): Promise<ProjectNode> {
  const response = await requestWithAuth<{ node: ProjectNode }>(`/documents/project/${projectId}/nodes/${nodeId}/move`, {
    method: 'PATCH',
    body: JSON.stringify({ parentId, order }),
  })
  return response.node
}

export async function deleteProjectNode(projectId: string, nodeId: string): Promise<void> {
  await requestWithAuth(`/documents/project/${projectId}/nodes/${nodeId}`, { method: 'DELETE' })
}

/**
 * Obtiene el contenido de un archivo del proyecto (imagen, PDF, etc.) como Blob con su tipo MIME
 */
export async function getProjectNodeBlob(projectId: string, nodeId: string): Promise<Blob> {
  const token = getAuthToken()
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
  const response = await fetch(`${BASE_URL}/documents/project/${projectId}/nodes/${nodeId}/download?inline=true`, { headers })
  if (!response.ok) throw new Error('No fue posible obtener el archivo')
  return response.blob()
}

export async function downloadProjectNode(projectId: string, node: ProjectNode): Promise<void> {
  const token = getAuthToken()
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
  const response = await fetch(`${BASE_URL}/documents/project/${projectId}/nodes/${node.id}/download`, { headers })
  if (!response.ok) throw new Error('No fue posible descargar el archivo')
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = node.nombre
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(url)
}

/**
 * Guarda o autoguarda un documento
 * isAutoSave: true -> Actualiza estados_autoguardado sin generar versión histórica
 * isAutoSave: false -> Guarda versión formal con snapshot en versiones_archivo
 */
export async function saveDocument(
  id: string,
  content: string,
  isAutoSave: boolean,
  summary?: string
): Promise<SaveDocumentResponse> {
  const body: { content: string; isAutoSave: boolean; summary?: string } = {
    content,
    isAutoSave,
  }
  if (!isAutoSave && summary) {
    body.summary = summary
  }

  return requestWithAuth<SaveDocumentResponse>(`/documents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/**
 * Compila un documento enviando su contenido actual
 */
export async function compileDocument(id: string, content?: string): Promise<CompileDocumentResponse> {
  const body = content !== undefined ? JSON.stringify({ content }) : undefined
  const response = await requestWithAuth<CompileDocumentResponse>(`/documents/${id}/compile`, {
    method: 'POST',
    body,
  })

  console.log('[Compile] documentId:', response.documentId || id)
  console.log('[Compile] success:', response.success)
  console.log('[Compile] errors:', response.errors || [])

  return response
}

/**
 * Descarga el PDF compilado autenticado como un Blob
 */
export async function getPdfBlob(id: string): Promise<Blob> {
  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${BASE_URL}/documents/${id}/pdf?t=${Date.now()}`, {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('El documento aún no tiene un PDF compilado disponible.')
    }
    throw new Error(`No fue posible obtener el PDF (código ${response.status})`)
  }

  return await response.blob()
}

/**
 * Descarga directa del archivo PDF en el navegador del usuario
 */
export async function downloadPdfFile(id: string, fileName = 'documento.pdf'): Promise<void> {
  const blob = await getPdfBlob(id)
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}

/**
 * Descarga directa del código fuente .tex
 */
export async function downloadSourceFile(id: string, fileName = 'documento.tex', fallbackContent?: string): Promise<void> {
  try {
    const token = getAuthToken()
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${BASE_URL}/documents/${id}/source?download=true`, {
      method: 'GET',
      headers,
    })

    if (response.ok) {
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName.endsWith('.tex') ? fileName : `${fileName}.tex`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      return
    }
  } catch {
    // Si falla la descarga directa del backend, usar el fallback con el contenido en memoria
  }

  if (fallbackContent !== undefined) {
    const blob = new Blob([fallbackContent], { type: 'text/x-tex;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName.endsWith('.tex') ? fileName : `${fileName}.tex`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }
}
