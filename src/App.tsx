import Header from './components/layout/Header'
import LoginForm from './features/auth/components/LoginForm'
import WorkspacePage from './features/projects/WorkspacePage'
import { useAuth } from './hooks/useAuth'

function App() {
  const { isAuthenticated, loading, profile, signIn, signOut } = useAuth()

  if (loading) return <div className="loading-screen">Comprobando tu sesión...</div>

  const displayName = profile?.nombre_completo || profile?.correo || 'Usuario'

  return (
    <div className={`app-shell ${isAuthenticated ? 'authenticated' : ''}`}>
      <Header authenticated={isAuthenticated} username={displayName} onSignOut={signOut} />
      <main className={isAuthenticated ? 'app-main-workspace' : 'app-main'}>
        {isAuthenticated ? (
          <WorkspacePage displayName={displayName} />
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
      {!isAuthenticated && (
        <footer className="app-footer">Secureleaf <span>•</span> {new Date().getFullYear()}</footer>
      )}
    </div>
  )
}

export default App
