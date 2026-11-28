import type { LatexTemplate, TemplateCategory } from '../../../types/template'

/** Filtro de categoría de la galería: una categoría concreta o todas. */
export type CategoryFilter = TemplateCategory | 'all'

export interface CategoryOption {
  value: CategoryFilter
  label: string
  count: number
}

/** Texto sin tildes y en minúsculas, para buscar "articulo" y encontrar "Artículo". */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replaceAll(/\p{M}/gu, '').toLowerCase()
}

function matchesSearch(template: LatexTemplate, terms: readonly string[]): boolean {
  if (terms.length === 0) return true
  const haystack = normalizeText(
    [template.name, template.description, template.categoryLabel, ...template.tags].join(' '),
  )
  return terms.every((term) => haystack.includes(term))
}

/**
 * Plantillas visibles según la categoría elegida y la búsqueda.
 * Todas las palabras buscadas deben aparecer (en nombre, descripción, categoría o etiquetas).
 */
export function filterTemplates(
  templates: readonly LatexTemplate[],
  category: CategoryFilter,
  search: string,
): LatexTemplate[] {
  const terms = normalizeText(search).split(/\s+/).filter(Boolean)
  return templates.filter(
    (template) => (category === 'all' || template.category === category) && matchesSearch(template, terms),
  )
}

/** Categorías presentes en el catálogo (en orden de aparición), con su cantidad de plantillas. */
export function buildCategoryOptions(templates: readonly LatexTemplate[]): CategoryOption[] {
  const byCategory = new Map<TemplateCategory, CategoryOption>()
  for (const template of templates) {
    const option = byCategory.get(template.category) ?? {
      value: template.category,
      label: template.categoryLabel,
      count: 0,
    }
    option.count += 1
    byCategory.set(template.category, option)
  }
  return [{ value: 'all', label: 'Todas', count: templates.length }, ...byCategory.values()]
}

/** Tamaño legible de un archivo ("1.2 KB"). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
