import Header from './components/layout/Header'
import LoginForm from './features/auth/components/LoginForm'

function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      <Header />
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <LoginForm />
        </div>
      </main>
      <footer className="py-4 text-center text-xs text-slate-500 border-t border-slate-200 bg-white">
        &copy; {new Date().getFullYear()} - Estructura de Proyecto Frontend
      </footer>
    </div>
  )
}

export default App
