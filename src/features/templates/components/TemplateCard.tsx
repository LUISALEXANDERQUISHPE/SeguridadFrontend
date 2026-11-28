import type { LatexTemplate } from '../../../types/template'
import TemplateThumbnail from './TemplateThumbnail'

const THUMBNAIL_WIDTH = 220

interface TemplateCardProps {
  template: LatexTemplate
  onSelect: (template: LatexTemplate) => void
}

/** Tarjeta de la galería: miniatura real de la primera página, categoría, nombre y descripción. */
export function TemplateCard({ template, onSelect }: Readonly<TemplateCardProps>) {
  return (
    <li>
      <button type="button" className="tpl-card" onClick={() => onSelect(template)}>
        <span className="tpl-card-preview">
          <TemplateThumbnail templateId={template.id} width={THUMBNAIL_WIDTH} label={template.name} />
        </span>
        <span className="tpl-card-body">
          <span className="tpl-badge">{template.categoryLabel}</span>
          <strong className="tpl-card-title">{template.name}</strong>
          <span className="tpl-card-description">{template.description}</span>
        </span>
      </button>
    </li>
  )
}

export default TemplateCard
