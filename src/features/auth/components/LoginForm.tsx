import React, { useState } from 'react'
import Button from '../../../components/common/Button'
import { login, loginWithGoogle, register } from '../services/authService'

interface LoginFormProps {
  onAuthenticated: (token: string) => void
}

export const LoginForm: React.FC<LoginFormProps> = ({ onAuthenticated }) => {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleGoogleLogin = async () => {
    setError('')
    setSubmitting(true)
    try {
      await loginWithGoogle()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible iniciar con Google')
      setSubmitting(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setSubmitting(true)
    try {
      if (isRegistering) {
        await register(fullName.trim(), email.trim(), password)
        setNotice('Cuenta creada. Ya puedes iniciar sesión.')
        setIsRegistering(false)
        setFullName('')
      } else {
        const response = await login(email.trim(), password)
        onAuthenticated(response.token)
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Ocurrió un error inesperado')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-card">
      <div className="login-intro">
        <span className="eyebrow">{isRegistering ? 'Nuevo espacio' : 'Bienvenido de nuevo'}</span>
        <h1>{isRegistering ? 'Crea tu cuenta' : 'Inicia sesión'}</h1>
        <p>{isRegistering ? 'Empieza a trabajar en tus documentos seguros.' : 'Tu trabajo, listo para continuar donde lo dejaste.'}</p>
      </div>

      {error && <div className="form-message error-message" role="alert">{error}</div>}
      {notice && <div className="form-message success-message" role="status">{notice}</div>}

      {!isRegistering && <>
        <button type="button" className="google-button" onClick={handleGoogleLogin} disabled={submitting}>
          <span className="google-icon">G</span>
          {submitting ? 'Conectando...' : 'Continuar con Google'}
        </button>
        <div className="form-divider"><span>o continúa con correo</span></div>
      </>}

      <form onSubmit={handleSubmit} className="login-form">
        {isRegistering && <label>
          Nombre completo
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Tu nombre completo"
            autoComplete="name"
            required
          />

        </label>}
        <label>
          Correo electrónico
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu.nombre@gmail.com"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            name="email"
            required
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mínimo 8 caracteres"
            minLength={8}
            autoComplete={isRegistering ? 'new-password' : 'current-password'}
            required
          />
        </label>

        <Button type="submit" variant="primary" fullWidth disabled={submitting} className="submit-button">
          {submitting ? 'Procesando...' : isRegistering ? 'Crear cuenta' : 'Iniciar con correo'}
        </Button>
      </form>
      <p className="switch-mode">{isRegistering ? '¿Ya tienes una cuenta?' : '¿Aún no tienes cuenta?'} <button type="button" onClick={() => { setIsRegistering(!isRegistering); setError(''); setNotice('') }}>{isRegistering ? 'Inicia sesión' : 'Regístrate'}</button></p>
    </div>
  );
};

export default LoginForm;

