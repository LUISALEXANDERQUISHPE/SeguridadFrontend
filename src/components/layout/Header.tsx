/** Cabecera pública (pantalla de inicio de sesión). */
export function Header() {
  return (
    <header className="app-header">
      <div className="flex items-center gap-2">
        <div className="brand-mark" aria-hidden="true">
          S
        </div>
        <span className="brand-name">Secureleaf</span>
      </div>
    </header>
  )
}

export default Header
