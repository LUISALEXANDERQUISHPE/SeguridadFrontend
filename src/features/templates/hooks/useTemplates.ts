import { useKeyedLoad } from '../../../hooks/useKeyedLoad'
import { getTemplate, getTemplates } from '../../../services/templateService'
import type { LatexTemplate } from '../../../types/template'

/** Catálogo de plantillas del sistema. */
export function useTemplateCatalog() {
  const { data, error, loading } = useKeyedLoad('catalog', getTemplates, 'No fue posible cargar las plantillas')
  return { templates: data ?? [], error, loading }
}

/** Detalle de una plantilla (archivos y código principal). null = no cargar. */
export function useTemplateDetail(templateId: string | null) {
  const { data, error, loading } = useKeyedLoad<LatexTemplate>(
    templateId,
    () => getTemplate(templateId ?? ''),
    'No fue posible cargar la plantilla',
  )
  return { template: data, error, loading }
}
