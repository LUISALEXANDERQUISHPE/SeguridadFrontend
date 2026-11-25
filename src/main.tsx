import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { captureInvitationTokenFromUrl } from './services/invitationService'

// Antes de cualquier redirección de inicio de sesión: guarda el enlace de invitación (#invitacion=...)
captureInvitationTokenFromUrl()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
