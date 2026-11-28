import { useEffect, useId, useState, type KeyboardEvent, type SyntheticEvent } from 'react'
import Modal from '../../../components/common/Modal'
import Icon from '../../../components/common/Icon'
import {
  changeMemberRole,
  getProjectMembers,
  leaveProject,
  removeProjectMember,
  type ProjectMember,
  type ShareSuggestion,
} from '../../../services/projectService'
import {
  buildInvitationLink,
  getProjectInvitations,
  inviteToProject,
  resendInvitation,
  revokeInvitation,
  type ProjectInvitation,
} from '../../../services/invitationService'
import type { AssignableRole } from '../../../types/project'
import { getRoleLabel } from '../../projects/utils/projectList'
import { ConfirmModal } from '../../projects/components/ProjectModals'
import useShareSuggestions from './useShareSuggestions'
import { useProjectNotifications } from '../../projects/hooks/useProjectNotifications'

interface ShareProjectModalProps {
  projectId: string
  projectName: string
  /** Solo el propietario invita y gestiona el acceso; el resto solo ve quién tiene acceso. */
  canShare: boolean
  onClose: () => void
  /** HU-25: el usuario salió del proyecto (el editor debe cerrarse). */
  onLeft?: () => void
}

// Valor especial del selector de cada colaborador para quitarle el acceso
const REMOVE_ACCESS = '__quitar__'

const ROLE_OPTIONS: Array<{ value: AssignableRole; label: string }> = [
  { value: 'editor', label: 'Puede editar' },
  { value: 'lector', label: 'Solo lectura' },
]

const toMessage = (error: unknown) => (error instanceof Error ? error.message : 'No fue posible completar la operación')

/** "ana@x.com, luis@x" -> ["ana@x.com", "luis@x"] */
const splitEmails = (text: string) => text.split(/[,;\s]+/).map((email) => email.trim()).filter(Boolean)

/** Texto que se está escribiendo después de la última coma (para el autocompletado). */
const currentFragment = (text: string) => text.split(/[,;]/).at(-1)?.trim() ?? ''

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' })

/**
 * HU-25: Compartir un proyecto al estilo de Overleaf.
 * El propietario invita uno o varios correos con un rol; cada persona entra al aceptar.
 * En "Acceso al proyecto" se ven los colaboradores y las invitaciones pendientes
 * (copiar enlace, reenviar o revocar).
 */
export function ShareProjectModal({ projectId, projectName, canShare, onClose, onLeft }: Readonly<ShareProjectModalProps>) {
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([])
  // Invitaciones rechazadas mientras el modal está abierto (se muestran con su estado)
  const [declined, setDeclined] = useState<ProjectInvitation[]>([])
  // Enlaces que se pueden copiar en esta sesión (el token solo llega al invitar o reenviar)
  const [links, setLinks] = useState<Record<string, string>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [emails, setEmails] = useState('')
  const [role, setRole] = useState<AssignableRole>('editor')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // Acción que espera confirmación en el popup (quitar acceso o salir del proyecto)
  const [pendingConfirm, setPendingConfirm] = useState<
    { kind: 'remove'; member: ProjectMember } | { kind: 'leave' } | null
  >(null)

  // Autocompletado del correo que se está escribiendo (después de la última coma)
  const [isListOpen, setIsListOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const listId = useId()
  const fragment = currentFragment(emails)
  const { suggestions, isSearching } = useShareSuggestions(projectId, fragment, canShare && isListOpen)
  const typed = new Set(splitEmails(emails).map((email) => email.toLowerCase()))
  const visibleSuggestions = suggestions.filter((suggestion) => !typed.has(suggestion.email.toLowerCase()))
  const showList = isListOpen && visibleSuggestions.length > 0

  useEffect(() => {
    let mounted = true
    Promise.all([getProjectMembers(projectId), canShare ? getProjectInvitations(projectId) : Promise.resolve([])])
      .then(([memberList, invitationList]) => {
        if (!mounted) return
        setMembers(memberList)
        setInvitations(invitationList)
      })
      .catch((err: unknown) => { if (mounted) setError(toMessage(err)) })
      .finally(() => { if (mounted) setIsLoading(false) })
    return () => { mounted = false }
  }, [projectId, canShare])

  // HU-25: el estado de cada invitación cambia solo cuando la persona acepta o rechaza
  // (el backend avisa al propietario en tiempo real)
  useProjectNotifications((event) => {
    if (event.projectId !== projectId) return
    if (event.type === 'invitation-accepted') {
      setInvitations((previous) => previous.filter((item) => item.id !== event.invitationId))
      setDeclined((previous) => previous.filter((item) => item.id !== event.invitationId))
      // La persona pasa a "Acceso al proyecto" con su rol
      getProjectMembers(projectId).then(setMembers).catch(() => {})
      setNotice(`${event.acceptedBy || 'La persona invitada'} aceptó la invitación y ahora es ${getRoleLabel(event.role).toLowerCase()}.`)
    } else if (event.type === 'invitation-declined') {
      // "invitations" es el estado actual: el hook siempre llama a la versión más reciente de este callback
      const invitation = invitations.find((item) => item.id === event.invitationId)
      if (invitation) setDeclined((list) => [...list.filter((item) => item.id !== invitation.id), invitation])
      setInvitations((previous) => previous.filter((item) => item.id !== event.invitationId))
      setNotice(`${event.declinedBy || 'La persona invitada'} rechazó la invitación.`)
    } else if (event.type === 'member-left') {
      getProjectMembers(projectId).then(setMembers).catch(() => {})
      setNotice(`${event.userName || 'Un colaborador'} salió del proyecto.`)
    }
  })

  const chooseSuggestion = (suggestion: ShareSuggestion) => {
    const parts = emails.split(/([,;])/)
    parts[parts.length - 1] = ` ${suggestion.email}`
    setEmails(`${parts.join('').replace(/^\s+/, '')}, `)
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
      setActiveIndex((index) => (index + 1) % visibleSuggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index <= 0 ? visibleSuggestions.length - 1 : index - 1))
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      // Enter elige la sugerencia resaltada en lugar de enviar el formulario
      event.preventDefault()
      chooseSuggestion(visibleSuggestions[activeIndex])
    } else if (event.key === 'Escape') {
      // Cierra solo la lista, no el modal
      event.preventDefault()
      event.stopPropagation()
      setIsListOpen(false)
    }
  }

  const rememberLinks = (list: ProjectInvitation[]) => {
    const fresh = Object.fromEntries(list.filter((item) => item.token).map((item) => [item.id, buildInvitationLink(item.token!)]))
    setLinks((previous) => ({ ...previous, ...fresh }))
  }

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const list = splitEmails(emails)
    if (list.length === 0) {
      setError('Escribe al menos un correo electrónico')
      return
    }
    setIsListOpen(false)
    setIsSubmitting(true)
    setError(null)
    setNotice(null)
    try {
      const result = await inviteToProject(projectId, list, role)
      rememberLinks(result.invitations)
      setInvitations((previous) => [
        ...previous.filter((item) => !result.invitations.some((created) => created.id === item.id)),
        ...result.invitations.map(({ token: _token, ...rest }) => rest),
      ])
      setEmails('')
      const parts: string[] = []
      if (result.invitations.length > 0) {
        parts.push(`Invitación enviada a ${result.invitations.map((item) => item.email).join(', ')}. Entrará al proyecto cuando la acepte.`)
      }
      if (result.skipped.length > 0) {
        parts.push(`Omitidos: ${result.skipped.map((item) => `${item.email} (${item.reason})`).join('; ')}.`)
      }
      setNotice(parts.join(' '))
    } catch (err: unknown) {
      setError(toMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const runInvitationAction = async (invitationId: string, action: () => Promise<void>) => {
    setBusyId(invitationId)
    setError(null)
    setNotice(null)
    try {
      await action()
    } catch (err: unknown) {
      setError(toMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const handleResend = (invitation: ProjectInvitation) =>
    runInvitationAction(invitation.id, async () => {
      const updated = await resendInvitation(projectId, invitation.id)
      rememberLinks([updated])
      setInvitations((previous) => previous.map((item) => (item.id === updated.id ? { ...updated, token: undefined } : item)))
      setNotice(`Invitación reenviada a ${invitation.email}. El enlace anterior ya no funciona.`)
    })

  const handleRevoke = (invitation: ProjectInvitation) =>
    runInvitationAction(invitation.id, async () => {
      await revokeInvitation(projectId, invitation.id)
      setInvitations((previous) => previous.filter((item) => item.id !== invitation.id))
      setNotice(`Se revocó la invitación de ${invitation.email}.`)
    })

  // HU-25: cambiar el rol de un colaborador o quitarle el acceso (desde su selector)
  const handleMemberChange = (member: ProjectMember, value: string) => {
    const who = member.name || member.email || 'Esa persona'
    if (value === REMOVE_ACCESS) {
      // Se confirma en un popup de la aplicación (no con el confirm del navegador)
      setPendingConfirm({ kind: 'remove', member })
      return
    }
    const role = value as AssignableRole
    void runInvitationAction(member.userId, async () => {
      await changeMemberRole(projectId, member.userId, role)
      setMembers((previous) => previous.map((item) => (item.userId === member.userId ? { ...item, role } : item)))
      setNotice(`${who} ahora es ${getRoleLabel(role).toLowerCase()}.`)
    })
  }

  // Volver a invitar a quien rechazó (crea una invitación nueva con el mismo rol)
  const handleReinvite = (invitation: ProjectInvitation) =>
    runInvitationAction(invitation.id, async () => {
      const result = await inviteToProject(projectId, [invitation.email], invitation.role)
      rememberLinks(result.invitations)
      setDeclined((previous) => previous.filter((item) => item.id !== invitation.id))
      setInvitations((previous) => [
        ...previous.filter((item) => !result.invitations.some((created) => created.id === item.id)),
        ...result.invitations.map(({ token: _token, ...rest }) => rest),
      ])
      setNotice(
        result.invitations.length > 0
          ? `Se invitó de nuevo a ${invitation.email}.`
          : `No se pudo invitar de nuevo: ${result.skipped.map((item) => item.reason).join(', ')}.`,
      )
    })

  const handleLeave = () => setPendingConfirm({ kind: 'leave' })

  /** Acción aceptada en el popup de confirmación. Si falla, el error se muestra dentro del popup. */
  const confirmPendingAction = async () => {
    if (pendingConfirm?.kind === 'remove') {
      const { member } = pendingConfirm
      await removeProjectMember(projectId, member.userId)
      setMembers((previous) => previous.filter((item) => item.userId !== member.userId))
      setNotice(`${member.name || member.email || 'Esa persona'} ya no tiene acceso al proyecto.`)
    } else if (pendingConfirm?.kind === 'leave') {
      await leaveProject(projectId)
      onLeft?.()
    }
  }

  const handleCopy = async (invitationId: string) => {
    try {
      await navigator.clipboard.writeText(links[invitationId])
      setCopiedId(invitationId)
      setTimeout(() => setCopiedId((current) => (current === invitationId ? null : current)), 2000)
    } catch {
      setError('No se pudo copiar el enlace. Cópialo manualmente.')
    }
  }

  const accessCount = members.length + invitations.length + declined.length

  return (
    <Modal title={`Compartir ${projectName}`} icon="users" size="wide" isBusy={isSubmitting} onClose={onClose}>
      {error && <p className="pm-alert pm-alert-error" role="alert">{error}</p>}
      {notice && <p className="pm-alert collab-share-notice" role="status">{notice}</p>}

      {canShare ? (
        <form onSubmit={(event) => void handleSubmit(event)} className="share-invite-form" noValidate>
          <label htmlFor="share-emails" className="share-label">Ingresa correos electrónicos separados por comas</label>
          <div className="share-invite-row">
            <div className="collab-autocomplete share-invite-input">
              <input
                id="share-emails"
                data-autofocus
                type="text"
                inputMode="email"
                placeholder="ana@correo.com, luis@correo.com"
                value={emails}
                onChange={(event) => {
                  setEmails(event.target.value)
                  setIsListOpen(true)
                  setActiveIndex(-1)
                }}
                onKeyDown={handleEmailKeyDown}
                onBlur={() => setIsListOpen(false)}
                maxLength={2600}
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showList}
                aria-controls={listId}
                aria-activedescendant={showList && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
              />
              {isSearching && fragment.length >= 3 && <span className="collab-autocomplete-spinner" aria-hidden="true" />}
              {showList && (
                <ul id={listId} className="collab-autocomplete-list" role="listbox" aria-label="Usuarios sugeridos">
                  {visibleSuggestions.map((suggestion, index) => (
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
            <select
              className="share-role-select"
              value={role}
              onChange={(event) => setRole(event.target.value as AssignableRole)}
              aria-label="Permiso de las personas invitadas"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button type="submit" className="pm-btn pm-btn-primary share-invite-btn" disabled={isSubmitting || !emails.trim()}>
              {isSubmitting ? 'Invitando...' : 'Invitar'}
            </button>
          </div>
          <p className="share-help">
            La persona recibe la invitación en su panel de proyectos y entra al aceptarla. Si aún no tiene cuenta,
            la verá al registrarse con ese correo.
          </p>
        </form>
      ) : (
        <p className="pm-hint">Solo el propietario puede invitar personas y cambiar los permisos.</p>
      )}

      <section className="share-access" aria-labelledby="share-access-title">
        <h3 id="share-access-title" className="share-access-title">Acceso al proyecto</h3>
        {isLoading && <p className="share-empty">Cargando...</p>}
        {!isLoading && accessCount === 0 && (
          <p className="share-empty">
            <Icon name="users" size={16} /> Nadie ha sido invitado todavía
          </p>
        )}
        {!isLoading && accessCount > 0 && (
          <ul className="share-access-list">
            {members.map((member) => (
              <li key={member.userId} className="share-person">
                <span className="share-avatar" aria-hidden="true">{(member.name || member.email || '?').charAt(0).toUpperCase()}</span>
                <span className="share-person-text">
                  <span className="share-person-name">{member.name || member.email}</span>
                  {member.name && <span className="share-person-email">{member.email}</span>}
                </span>
                {canShare ? (
                  <select
                    className="share-member-select"
                    value={member.role}
                    onChange={(event) => handleMemberChange(member, event.target.value)}
                    disabled={busyId === member.userId}
                    aria-label={`Permiso de ${member.name || member.email}`}
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                    {/* Roles heredados: se muestran tal cual hasta que el propietario los cambie */}
                    {!ROLE_OPTIONS.some((option) => option.value === member.role) && (
                      <option value={member.role} disabled>{getRoleLabel(member.role)}</option>
                    )}
                    <option value={REMOVE_ACCESS}>Quitar acceso</option>
                  </select>
                ) : (
                  <span className="share-role-label">{getRoleLabel(member.role)}</span>
                )}
              </li>
            ))}
            {invitations.map((invitation) => (
              <li key={invitation.id} className="share-person is-pending">
                <span className="share-avatar" aria-hidden="true">{invitation.email.charAt(0).toUpperCase()}</span>
                <span className="share-person-text">
                  <span className="share-person-name">
                    {invitation.email} <span className="share-pending-tag">Invitación pendiente</span>
                  </span>
                  <span className="share-person-email">
                    {getRoleLabel(invitation.role)} · vence el {formatDate(invitation.expiresAt)}
                  </span>
                </span>
                <span className="share-person-actions">
                  {links[invitation.id] && (
                    <button type="button" className="share-link-btn" onClick={() => void handleCopy(invitation.id)} disabled={busyId === invitation.id}>
                      <Icon name="link" size={14} /> {copiedId === invitation.id ? '¡Copiado!' : 'Copiar enlace'}
                    </button>
                  )}
                  <button type="button" className="share-link-btn" onClick={() => void handleResend(invitation)} disabled={busyId === invitation.id}>
                    Reenviar
                  </button>
                  <button type="button" className="share-link-btn is-danger" onClick={() => void handleRevoke(invitation)} disabled={busyId === invitation.id}>
                    Revocar
                  </button>
                </span>
              </li>
            ))}
            {declined.map((invitation) => (
              <li key={invitation.id} className="share-person is-declined">
                <span className="share-avatar" aria-hidden="true">{invitation.email.charAt(0).toUpperCase()}</span>
                <span className="share-person-text">
                  <span className="share-person-name">
                    {invitation.email} <span className="share-declined-tag">Rechazó la invitación</span>
                  </span>
                  <span className="share-person-email">{getRoleLabel(invitation.role)}</span>
                </span>
                <span className="share-person-actions">
                  <button type="button" className="share-link-btn" onClick={() => void handleReinvite(invitation)} disabled={busyId === invitation.id}>
                    Invitar de nuevo
                  </button>
                  <button
                    type="button"
                    className="share-link-btn"
                    onClick={() => setDeclined((previous) => previous.filter((item) => item.id !== invitation.id))}
                  >
                    Quitar de la lista
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="pm-dialog-actions">
        {!canShare && onLeft && (
          <button type="button" className="pm-btn pm-btn-ghost is-danger share-leave-btn" onClick={handleLeave}>
            Salir del proyecto
          </button>
        )}
        <button type="button" className="pm-btn pm-btn-ghost" onClick={onClose} disabled={isSubmitting}>
          Cerrar
        </button>
      </div>

      {pendingConfirm?.kind === 'remove' && (
        <ConfirmModal
          title="Quitar acceso"
          message={`¿Quitar el acceso de ${pendingConfirm.member.name || pendingConfirm.member.email} al proyecto? Si lo tiene abierto, se le cerrará.`}
          confirmLabel="Quitar acceso"
          confirmingLabel="Quitando..."
          danger
          icon="users"
          onClose={() => setPendingConfirm(null)}
          onConfirm={confirmPendingAction}
        />
      )}
      {pendingConfirm?.kind === 'leave' && (
        <ConfirmModal
          title="Salir del proyecto"
          message={`¿Salir de «${projectName}»? Dejarás de tener acceso hasta que te vuelvan a invitar.`}
          confirmLabel="Salir del proyecto"
          confirmingLabel="Saliendo..."
          danger
          icon="logout"
          onClose={() => setPendingConfirm(null)}
          onConfirm={confirmPendingAction}
        />
      )}
    </Modal>
  )
}

export default ShareProjectModal
