import { useMemo, useState } from 'react'
import Icon from '../../components/common/Icon'
import type { LatexTemplate } from '../../types/template'
import { useTemplateCatalog } from './hooks/useTemplates'
import { buildCategoryOptions, filterTemplates, type CategoryFilter } from './utils/templateFilters'
import TemplateCard from './components/TemplateCard'
import TemplateDetailModal from './components/TemplateDetailModal'
import './templates.css'

interface TemplateGalleryProps {
  /** Crea un proyecto como copia de la plantilla y lo abre en el editor. */
  onUseTemplate: (template: LatexTemplate, name: string, description: string) => Promise<void>
}

/**
 * Galería de plantillas LaTeX del sistema (HU-16), al estilo de Overleaf:
 * filtros por categoría, buscador y tarjetas con la primera página real de cada plantilla.
 */
export function TemplateGallery({ onUseTemplate }: Readonly<TemplateGalleryProps>) {
  const { templates, loading, error } = useTemplateCatalog()
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<LatexTemplate | null>(null)

  const categories = useMemo(() => buildCategoryOptions(templates), [templates])
  const visible = useMemo(() => filterTemplates(templates, category, search), [templates, category, search])

  const renderGrid = () => {
    if (loading) return <p className="pm-empty">Cargando plantillas...</p>
    if (error) {
      return (
        <p className="pm-alert pm-alert-error" role="alert">
          {error}
        </p>
      )
    }
    if (visible.length === 0) return <p className="pm-empty">No hay plantillas que coincidan con la búsqueda.</p>
    return (
      <ul className="tpl-grid">
        {visible.map((template) => (
          <TemplateCard key={template.id} template={template} onSelect={setSelected} />
        ))}
      </ul>
    )
  }

  return (
    <section className="tpl-gallery" aria-label="Plantillas">
      <p className="tpl-intro">
        Empieza con una estructura lista para usar. Cada plantilla se copia a tus proyectos: puedes modificarla sin
        afectar a la original.
      </p>

      <div className="tpl-toolbar">
        <div className="pm-search tpl-search">
          <Icon name="search" />
          <input
            type="search"
            placeholder="Buscar plantillas (tesis, IEEE, presentación...)"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Buscar plantillas"
          />
        </div>
        <fieldset className="tpl-categories">
          <legend className="pm-sr-only">Categoría</legend>
          {categories.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`tpl-chip ${category === option.value ? 'is-active' : ''}`}
              aria-pressed={category === option.value}
              onClick={() => setCategory(option.value)}
            >
              {option.label}
              <span className="tpl-chip-count">{option.count}</span>
            </button>
          ))}
        </fieldset>
      </div>

      {renderGrid()}

      {selected && (
        <TemplateDetailModal template={selected} onClose={() => setSelected(null)} onUse={onUseTemplate} />
      )}
    </section>
  )
}

export default TemplateGallery
