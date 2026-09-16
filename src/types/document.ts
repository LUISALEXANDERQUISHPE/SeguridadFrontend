export interface CompilationError {
  line: number
  file: string
  message: string
  type: 'error' | 'warning'
  friendlyMessage?: string
  context?: string
}

export interface LastCompilation {
  id: string
  status: 'exitosa' | 'fallida' | 'error' | string
  hasPdf?: boolean
  pdfUrl?: string | null
  startedAt?: string
  finishedAt?: string
}

export interface DocumentAutoSave {
  contenido?: string
  actualizado_en?: string
}

export interface LatexDocument {
  id: string
  projectId?: string
  projectName?: string
  name: string
  content: string
  sizeBytes?: number
  role?: string
  description?: string
  createdAt?: string
  updatedAt?: string
  autoSave?: DocumentAutoSave | null
  lastCompilation?: LastCompilation | null
}

export interface DocumentListItem {
  id: string
  projectId?: string
  projectName?: string
  name: string
  sizeBytes?: number
  role?: string
  createdAt?: string
  updatedAt?: string
  lastCompilation?: LastCompilation | null
}

export interface CreateDocumentRequest {
  name: string
  content: string
  description?: string
}

export interface CreateDocumentResponse {
  message: string
  document: LatexDocument
}

export interface GetDocumentsResponse {
  documents: DocumentListItem[]
}

export interface GetDocumentResponse {
  document: LatexDocument
}

export interface SaveDocumentRequest {
  content: string
  isAutoSave: boolean
  summary?: string
}

export interface SaveDocumentResponse {
  message: string
  document: {
    id: string
    name: string
    sizeBytes: number
    updatedAt: string
    isAutoSave: boolean
  }
}

export interface CompileDocumentRequest {
  content?: string
}

export interface CompileDocumentResponse {
  success: boolean
  documentId: string
  compilationId: string
  pdfUrl: string | null
  previousPdfUrl?: string | null
  errors: CompilationError[]
  warnings: CompilationError[]
  compilationTime?: number
  log?: string
}

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error' | 'idle'
export type CompileStatus = 'idle' | 'compiling' | 'success' | 'failed'
