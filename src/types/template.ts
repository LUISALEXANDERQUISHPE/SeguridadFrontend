/** Categorías de plantillas (mismas claves que el backend). */
export type TemplateCategory = 'tesis' | 'articulo' | 'normas' | 'informe' | 'presentacion' | 'carta' | 'cv'

export interface TemplateFile {
  path: string
  sizeBytes: number
}

/** Plantilla LaTeX del sistema (solo lectura: al usarla se crea una copia como proyecto nuevo). */
export interface LatexTemplate {
  id: string
  name: string
  category: TemplateCategory
  categoryLabel: string
  description: string
  tags: string[]
  mainFile: string
  /** Solo en el detalle de una plantilla. */
  hasPreview?: boolean
  files?: TemplateFile[]
  mainFileContent?: string
}

export interface GetTemplatesResponse {
  templates: LatexTemplate[]
}

export interface GetTemplateResponse {
  template: LatexTemplate
}
