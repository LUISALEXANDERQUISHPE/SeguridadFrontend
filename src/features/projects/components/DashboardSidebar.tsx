import Icon, { type IconName } from '../../../components/common/Icon'
import type { ProjectFilter } from '../types'
import NewProjectMenu from './NewProjectMenu'

interface NavItem {
  filter: ProjectFilter
  label: string
  icon: IconName
}

const NAV_ITEMS: readonly NavItem[] = [
  { filter: 'all', label: 'Todos los proyectos', icon: 'folder' },
  { filter: 'owned', label: 'Tus proyectos', icon: 'user' },
  { filter: 'shared', label: 'Compartidos contigo', icon: 'users' },
  { filter: 'archived', label: 'Archivados', icon: 'archive' },
]

interface DashboardSidebarProps {
  activeFilter: ProjectFilter
  displayName: string
  isUploading: boolean
  onFilterChange: (filter: ProjectFilter) => void
  onCreateBlank: () => void
  onUpload: () => void
  onSignOut: () => void
}

/** Barra lateral del panel de proyectos: marca, "Nuevo proyecto", secciones y cuenta. */
export function DashboardSidebar({
  activeFilter,
  displayName,
  isUploading,
  onFilterChange,
  onCreateBlank,
  onUpload,
  onSignOut,
}: Readonly<DashboardSidebarProps>) {
  return (
    <aside className="pm-sidebar">
      <div className="pm-brand">
        <span className="pm-brand-mark" aria-hidden="true">
          S
        </span>
        <span className="pm-brand-name">Secureleaf</span>
      </div>

      <NewProjectMenu isUploading={isUploading} onCreateBlank={onCreateBlank} onUpload={onUpload} />

      <nav className="pm-nav" aria-label="Secciones de proyectos">
        <ul>
          {NAV_ITEMS.map((item) => (
            <li key={item.filter}>
              <button
                type="button"
                className={`pm-nav-item ${activeFilter === item.filter ? 'is-active' : ''}`}
                aria-current={activeFilter === item.filter ? 'page' : undefined}
                onClick={() => onFilterChange(item.filter)}
              >
                <Icon name={item.icon} />
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="pm-account">
        <span className="pm-avatar" aria-hidden="true">
          {displayName.charAt(0).toUpperCase()}
        </span>
        <span className="pm-account-name" title={displayName}>
          {displayName}
        </span>
        <button type="button" className="pm-icon-btn" onClick={onSignOut} title="Cerrar sesión" aria-label="Cerrar sesión">
          <Icon name="logout" />
        </button>
      </div>
    </aside>
  )
}

export default DashboardSidebar
