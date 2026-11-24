import { useEffect, useId, useState, type KeyboardEvent, type SyntheticEvent } from 'react'
import Modal from '../../../components/common/Modal'
import {
  getProjectMembers,
  shareProject,
  type ProjectMember,
  type ShareSuggestion,
} from '../../../services/projectService'
import useShareSuggestions from './useShareSuggestions'

interface ShareProjectModalProps {
  projectId: string
  /** Solo el propietario puede agregar colaboradores; el resto solo ve la lista. */
  canShare: boolean
  onClose: () => void
}

const toMessage = (error: unknown) => (error instanceof Error ? error.message : 'No fue posible completar la operación')

/** Compartir el proyecto por correo para editarlo en tiempo real. */
export function ShareProjectModal({ projectId, canShare, onClose }: Readonly<ShareProjectModalProps>) {
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Autocompletado de correos de usuarios registrados
  const [isListOpen, setIsListOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const listId = useId()
  const { suggestions, isSearching } = useShareSuggestions(projectId, email, canShare && isListOpen)
  const showList = isListOpen && suggestions.length > 0

  const chooseSuggestion = (suggestion: ShareSuggestion) => {
    setEmail(suggestion.email)
    setIsListOpen(false)
    setActiveIndex(-1)
  }

  const handleEmailKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showList) {
      if (event.key === 'ArrowDown') setIsListOpen(true)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1))
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      // Enter elige la sugerencia resaltada en lugar de enviar el formulario
      event.preventDefault()
      chooseSuggestion(suggestions[activeIndex])
    } else if (event.key === 'Escape') {
      // Cierra solo la lista, no el modal
      event.preventDefault()
      event.stopPropagation()
      setIsListOpen(false)
    }
  }

  useEffect(() => {
    let mounted = true
    getProjectMembers(projectId)
      .then((list) => { if (mounted) setMembers(list) })
      .catch((err: unknown) => { if (mounted) setError(toMessage(err)) })
      .finally(() => { if (mounted) setIsLoading(false) })
    return () => { mounted = false }
  }, [projectId])

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = email.trim()
    if (!value) {
      setError('Escribe el correo de la persona con la que quieres compartir')
      return
    }
    setIsListOpen(false)
    setIsSubmitting(true)
    setError(null)
    setNotice(null)
    try {
      const member = await shareProject(projectId, value)
      setMembers((previous) => [...previous, member])
      setEmail('')
      setNotice(`${member.name || member.email} ya puede abrir el proyecto y editarlo contigo en tiempo real.`)
    } catch (err: unknown) {
      setError(toMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal title="Compartir proyecto" icon="users" isBusy={isSubmitting} onClose={onClose}>
      {error && <p className="pm-alert pm-alert-error" role="alert">{error}</p>}
      {notice && <p className="pm-alert collab-share-notice" role="status">{notice}</p>}

      {canShare ? (
        <form onSubmit={(event) => void handleSubmit(event)} className="pm-form" noValidate>
          <div className="pm-field">
            <label htmlFor="share-email">Correo del colaborador</label>
            <div className="collab-autocomplete">
              <input
                id="share-email"
                data-autofocus
                type="email"
                placeholder="Escribe al menos 3 letras del correo"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setIsListOpen(true)
                  setActiveIndex(-1)
                }}
                onKeyDown={handleEmailKeyDown}
                onBlur={() => setIsListOpen(false)}
                maxLength={254}
                autoComplete="off"
                required
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showList}
                aria-controls={listId}
                aria-activedescendant={showList && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
              />
              {isSearching && <span className="collab-autocomplete-spinner" aria-hidden="true" />}
              {showList && (
                <ul id={listId} className="collab-autocomplete-list" role="listbox" aria-label="Usuarios sugeridos">
                  {suggestions.map((suggestion, index) => (
                    <li
                      key={suggestion.email}
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={index === activeIndex}
                      className={index === activeIndex ? 'is-active' : undefined}
                      // mousedown en vez de click: se elige antes de que el input pierda el foco
                      onMouseDown={(event) => {
                        event.preventDefault()
                        chooseSuggestion(suggestion)
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <span className="collab-autocomplete-email">{suggestion.email}</span>
                      {suggestion.name && <span className="collab-autocomplete-name">{suggestion.name}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <p className="pm-hint">La persona debe tener una cuenta registrada. Entrará como editor.</p>
          <div className="pm-dialog-actions">
            <button type="button" className="pm-btn pm-btn-ghost" onClick={onClose} disabled={isSubmitting}>
              Cerrar
            </button>
            <button type="submit" className="pm-btn pm-btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Compartiendo...' : 'Compartir'}
            </button>
          </div>
        </form>
      ) : (
        <p className="pm-hint">Solo el propietario puede agregar colaboradores.</p>
      )}

      <h3 className="collab-members-title">Colaboradores</h3>
      {isLoading ? (
        <p className="pm-hint">Cargando...</p>
      ) : members.length === 0 ? (
        <p className="pm-hint">Todavía no has compartido este proyecto.</p>
      ) : (
        <ul className="collab-members-list">
          {members.map((member) => (
            <li key={member.userId}>
              <span className="collab-member-name">{member.name || member.email}</span>
              {member.name && <span className="collab-member-email">{member.email}</span>}
              <span className="collab-member-role">{member.role}</span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

export default ShareProjectModal
