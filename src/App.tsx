import { useState } from 'react'
import Header from './components/layout/Header'
import LoginForm from './features/auth/components/LoginForm'
import EditorPage from './features/editor/EditorPage'
import { useAuth } from './hooks/useAuth'

function App() {
  const { isAuthenticated, loading, profile, signIn, signOut } = useAuth()
  const [currentPage, setCurrentPage] = useState<'home' | 'editor'>('home')

  if (loading) return <div className="loading-screen">Comprobando tu sesión...</div>

  const displayName = profile?.nombre_completo || profile?.correo || 'Usuario'

  return (
    <div className={`app-shell ${isAuthenticated ? 'authenticated' : ''}`}>
      <Header
        authenticated={isAuthenticated}
        username={displayName}
        onSignOut={signOut}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
      />
      <main className={currentPage === 'editor' ? 'app-main-editor' : 'app-main'}>
        {currentPage === 'editor' ? (
          <EditorPage />
        ) : isAuthenticated ? (
          <section className="workspace-welcome">
            <span className="eyebrow">Sesión activa</span>
            <h1>Tu espacio está listo.</h1>
            <p>
              Has iniciado sesión como <strong>{displayName}</strong>. Puedes comenzar a redactar y compilar tus documentos LaTeX ahora mismo.
            </p>
            <div style={{ marginTop: '24px' }}>
              <button
                type="button"
                className="submit-button"
                onClick={() => setCurrentPage('editor')}
                style={{ padding: '12px 24px', cursor: 'pointer' }}
              >
                Abrir Editor LaTeX ➔
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="product-story">
              <p className="story-kicker">Documentos que avanzan contigo</p>
              <h2>Escribe sin perder el hilo.</h2>
              <p>Un espacio claro para colaborar, compilar y proteger cada idea.</p>
              <div className="story-meta">
                <span className="meta-dot" /> API segura conectada
              </div>
            </section>
            <div className="login-wrap">
              <LoginForm onAuthenticated={signIn} />
            </div>
          </>
        )}
      </main>
      {currentPage !== 'editor' && (
        <footer className="app-footer">Secureleaf <span>•</span> {new Date().getFullYear()}</footer>
      )}
    </div>
  )
}

export default App
