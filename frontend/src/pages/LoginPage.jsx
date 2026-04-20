// src/pages/LoginPage.jsx

import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { Spinner } from '../components/ui.jsx'

export default function LoginPage() {
  const { login }   = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--c-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48, height: 48,
            background: 'var(--c-accent)',
            borderRadius: 12,
            marginBottom: 16,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                 stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/>
              <polyline points="2 17 12 22 22 17"/>
              <polyline points="2 12 12 17 22 12"/>
            </svg>
          </div>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--c-text-3)',
                        letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            DCM
          </div>
          <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--c-text)' }}>
            ERP Ingeniería
          </div>
        </div>

        {/* Card */}
        <div className="card">
          <div className="card-body" style={{ padding: 28 }}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 20 }}>
              Iniciar sesión
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  className="input"
                  type="email"
                  placeholder="tu@empresa.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Contraseña</label>
                <input
                  className="input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div style={{
                  padding: '9px 12px',
                  background: 'var(--c-danger-bg)',
                  color: 'var(--c-danger)',
                  borderRadius: 'var(--radius)',
                  fontSize: 13,
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ marginTop: 4, justifyContent: 'center', padding: '9px 14px' }}
              >
                {loading ? <Spinner /> : 'Ingresar'}
              </button>
            </form>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12.5,
                    color: 'var(--c-text-3)' }}>
          Las cuentas son creadas por el administrador del sistema
        </p>
      </div>
    </div>
  )
}
