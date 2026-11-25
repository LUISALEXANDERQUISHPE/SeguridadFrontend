import { useCallback, useEffect, useState } from 'react'
import {
  acceptInvitation,
  acceptInvitationByToken,
  clearPendingInvitationToken,
  declineInvitation,
  getMyInvitations,
  peekPendingInvitationToken,
  previewInvitationByToken,
  type AcceptResult,
  type ReceivedInvitation,
} from '../../../services/invitationService'

const toMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback)

/** Invitación abierta con un enlace (#invitacion=...) a la espera de que el usuario decida. */
export interface LinkInvitation {
  token: string
  invitation: ReceivedInvitation
}

/**
 * HU-25: Invitaciones recibidas por el usuario: bandeja del panel y enlace de invitación.
 */
export function useInvitations({ onError }: { onError: (message: string) => void }) {
  const [invitations, setInvitations] = useState<ReceivedInvitation[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [linkInvitation, setLinkInvitation] = useState<LinkInvitation | null>(null)

  const reload = useCallback(async () => {
    try {
      setInvitations(await getMyInvitations())
    } catch {
      // La bandeja es secundaria: si falla, el panel de proyectos sigue funcionando
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  // Enlace de invitación guardado al cargar la página (sobrevive al inicio de sesión)
  useEffect(() => {
    const token = peekPendingInvitationToken()
    if (!token) return
    let active = true
    previewInvitationByToken(token)
      .then((invitation) => { if (active) setLinkInvitation({ token, invitation }) })
      .catch((err: unknown) => {
        if (!active) return
        clearPendingInvitationToken()
        onError(toMessage(err, 'El enlace de invitación no es válido'))
      })
    return () => { active = false }
    // Solo al montar: el enlace se procesa una vez
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const run = async <T,>(id: string, action: () => Promise<T>, fallback: string): Promise<T | null> => {
    setBusyId(id)
    try {
      return await action()
    } catch (err: unknown) {
      onError(toMessage(err, fallback))
      return null
    } finally {
      setBusyId(null)
    }
  }

  const accept = async (invitation: ReceivedInvitation): Promise<AcceptResult | null> => {
    const result = await run(invitation.id, () => acceptInvitation(invitation.id), 'No se pudo aceptar la invitación')
    // Aceptada o no, la lista se actualiza (pudo expirar o revocarse mientras tanto)
    await reload()
    return result
  }

  const decline = async (invitation: ReceivedInvitation): Promise<boolean> => {
    const result = await run(invitation.id, async () => { await declineInvitation(invitation.id); return true }, 'No se pudo rechazar la invitación')
    await reload()
    return Boolean(result)
  }

  const acceptLink = async (): Promise<AcceptResult | null> => {
    if (!linkInvitation) return null
    const result = await run(linkInvitation.invitation.id, () => acceptInvitationByToken(linkInvitation.token), 'No se pudo aceptar la invitación')
    clearPendingInvitationToken()
    setLinkInvitation(null)
    await reload()
    return result
  }

  const dismissLink = () => {
    clearPendingInvitationToken()
    setLinkInvitation(null)
  }

  return { invitations, busyId, linkInvitation, reload, accept, decline, acceptLink, dismissLink }
}

export default useInvitations
