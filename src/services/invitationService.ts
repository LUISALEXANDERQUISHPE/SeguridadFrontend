import { authorizedRequest as requestWithAuth } from './api'
import type { AssignableRole } from '../types/project'

/** Invitación vista por el propietario (panel "Acceso al proyecto"). */
export interface ProjectInvitation {
  id: string
  email: string
  role: AssignableRole
  status: string
  invitedBy: string | null
  createdAt: string
  expiresAt: string
  /** Solo viene al invitar o reenviar: permite copiar el enlace una vez. */
  token?: string
}

/** Invitación vista por quien la recibe (bandeja del panel de proyectos). */
export interface ReceivedInvitation {
  id: string
  projectId: string
  projectName: string | null
  role: AssignableRole
  invitedBy: string | null
  createdAt: string
  expiresAt: string
}

export interface InviteResult {
  invitations: ProjectInvitation[]
  skipped: Array<{ email: string; reason: string }>
}

export interface AcceptResult {
  projectId: string
  projectName: string
  role: AssignableRole
}

// ---------- Propietario ----------

export function inviteToProject(projectId: string, emails: string[], role: AssignableRole): Promise<InviteResult> {
  return requestWithAuth<InviteResult>(`/projects/${projectId}/invitations`, {
    method: 'POST',
    body: JSON.stringify({ emails, role }),
  })
}

export async function getProjectInvitations(projectId: string): Promise<ProjectInvitation[]> {
  const response = await requestWithAuth<{ invitations: ProjectInvitation[] }>(`/projects/${projectId}/invitations`)
  return response.invitations || []
}

export async function resendInvitation(projectId: string, invitationId: string): Promise<ProjectInvitation> {
  const response = await requestWithAuth<{ invitation: ProjectInvitation }>(
    `/projects/${projectId}/invitations/${invitationId}/resend`,
    { method: 'POST' },
  )
  return response.invitation
}

export async function revokeInvitation(projectId: string, invitationId: string): Promise<void> {
  await requestWithAuth(`/projects/${projectId}/invitations/${invitationId}`, { method: 'DELETE' })
}

// ---------- Invitado ----------

export async function getMyInvitations(): Promise<ReceivedInvitation[]> {
  const response = await requestWithAuth<{ invitations: ReceivedInvitation[] }>('/invitations')
  return response.invitations || []
}

export function acceptInvitation(invitationId: string): Promise<AcceptResult> {
  return requestWithAuth<AcceptResult>(`/invitations/${invitationId}/accept`, { method: 'POST' })
}

export async function declineInvitation(invitationId: string): Promise<void> {
  await requestWithAuth(`/invitations/${invitationId}/decline`, { method: 'POST' })
}

// El token viaja en el cuerpo (no en la URL) para que no quede en registros del servidor
export async function previewInvitationByToken(token: string): Promise<ReceivedInvitation> {
  const response = await requestWithAuth<{ invitation: ReceivedInvitation }>('/invitations/token/preview', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
  return response.invitation
}

export function acceptInvitationByToken(token: string): Promise<AcceptResult> {
  return requestWithAuth<AcceptResult>('/invitations/token/accept', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

// ---------- Enlace de invitación ----------

const LINK_PREFIX = '#invitacion='
const PENDING_TOKEN_KEY = 'secureleaf:invitacion'

/**
 * Enlace para compartir la invitación. El token va en el fragmento (#), que el navegador
 * nunca envía al servidor: no queda en logs ni en el historial de proxies.
 */
export function buildInvitationLink(token: string): string {
  return `${window.location.origin}/${LINK_PREFIX}${encodeURIComponent(token)}`
}

/**
 * Si la página se abrió con un enlace de invitación, guarda el token para usarlo después de
 * iniciar sesión y lo quita de la barra de direcciones. Se llama una vez al cargar la app.
 */
export function captureInvitationTokenFromUrl(): void {
  if (!window.location.hash.startsWith(LINK_PREFIX)) return
  const token = decodeURIComponent(window.location.hash.slice(LINK_PREFIX.length))
  try {
    if (token) sessionStorage.setItem(PENDING_TOKEN_KEY, token)
  } catch {
    // Sin sessionStorage (modo privado estricto): el enlace no se recuerda tras iniciar sesión
  }
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
}

/** Token de invitación pendiente de procesar (se borra con clearPendingInvitationToken al usarlo). */
export function peekPendingInvitationToken(): string | null {
  try {
    return sessionStorage.getItem(PENDING_TOKEN_KEY)
  } catch {
    return null
  }
}

export function clearPendingInvitationToken(): void {
  try {
    sessionStorage.removeItem(PENDING_TOKEN_KEY)
  } catch {
    // Sin sessionStorage no hay nada que borrar
  }
}
