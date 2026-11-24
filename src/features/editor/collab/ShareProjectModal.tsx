import { useEffect, useState, type SyntheticEvent } from 'react'
import Modal from '../../../components/common/Modal'
import { getProjectMembers, shareProject, type ProjectMember } from '../../../services/projectService'

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
            <input
              id="share-email"
              data-autofocus
              type="email"
              placeholder="colaborador@correo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              autoComplete="off"
              required
            />
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
