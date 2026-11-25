import Icon from '../../../components/common/Icon'
import Modal from '../../../components/common/Modal'
import type { ReceivedInvitation } from '../../../services/invitationService'
import { getRoleLabel } from '../utils/projectList'

const ROLE_DESCRIPTIONS: Record<string, string> = {
  editor: 'podrás editar el contenido y los archivos',
  lector: 'podrás ver, compilar y descargar, sin modificar nada',
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long' })

interface InvitationsInboxProps {
  invitations: ReceivedInvitation[]
  busyId: string | null
  onAccept: (invitation: ReceivedInvitation) => void
  onDecline: (invitation: ReceivedInvitation) => void
}

/** HU-25: Invitaciones pendientes del usuario, sobre la lista de proyectos. */
export function InvitationsInbox({ invitations, busyId, onAccept, onDecline }: Readonly<InvitationsInboxProps>) {
  if (invitations.length === 0) return null

  return (
    <section className="pm-invitations" aria-labelledby="pm-invitations-title">
      <h2 id="pm-invitations-title" className="pm-invitations-title">
        <Icon name="users" size={16} /> Invitaciones pendientes ({invitations.length})
      </h2>
      <ul className="pm-invitations-list">
        {invitations.map((invitation) => (
          <li key={invitation.id} className="pm-invitation">
            <div className="pm-invitation-text">
              <strong>{invitation.invitedBy || 'Alguien'}</strong> te invitó a{' '}
              <strong>«{invitation.projectName || 'un proyecto'}»</strong> como{' '}
              <span className="pm-invitation-role">{getRoleLabel(invitation.role)}</span>
              <span className="pm-invitation-meta">Vence el {formatDate(invitation.expiresAt)}</span>
            </div>
            <div className="pm-invitation-actions">
              <button type="button" className="pm-btn pm-btn-ghost" onClick={() => onDecline(invitation)} disabled={busyId === invitation.id}>
                Rechazar
              </button>
              <button type="button" className="pm-btn pm-btn-primary" onClick={() => onAccept(invitation)} disabled={busyId === invitation.id}>
                {busyId === invitation.id ? 'Procesando...' : 'Aceptar'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface InvitationLinkDialogProps {
  invitation: ReceivedInvitation
  isBusy: boolean
  onAccept: () => void
  onDismiss: () => void
}

/** HU-25: Diálogo al abrir un enlace de invitación (#invitacion=...). */
export function InvitationLinkDialog({ invitation, isBusy, onAccept, onDismiss }: Readonly<InvitationLinkDialogProps>) {
  return (
    <Modal title="Invitación a un proyecto" icon="users" isBusy={isBusy} onClose={onDismiss}>
      <p className="pm-confirm-text">
        <strong>{invitation.invitedBy || 'Alguien'}</strong> te invitó a colaborar en{' '}
        <strong>«{invitation.projectName || 'un proyecto'}»</strong> como{' '}
        <strong>{getRoleLabel(invitation.role)}</strong>: {ROLE_DESCRIPTIONS[invitation.role] ?? ''}.
      </p>
      <p className="pm-hint">La invitación vence el {formatDate(invitation.expiresAt)}.</p>
      <div className="pm-dialog-actions">
        <button type="button" className="pm-btn pm-btn-ghost" onClick={onDismiss} disabled={isBusy} data-autofocus>
          Ahora no
        </button>
        <button type="button" className="pm-btn pm-btn-primary" onClick={onAccept} disabled={isBusy}>
          {isBusy ? 'Aceptando...' : 'Aceptar invitación'}
        </button>
      </div>
    </Modal>
  )
}

export default InvitationsInbox
