import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, AlertTriangle } from 'lucide-react'
import { useAuth } from '../auth'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      setError((err as Error).message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--c-bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      gap: 36,
    }}>
      {/* Subtle radial glow behind the form */}
      <div style={{
        position: 'fixed', top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.05) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Logo — centered in full viewport width */}
      <img src="/logo/folio-lockup.svg" alt="Folio" style={{ height: 77, width: 'auto', position: 'relative' }} />

      <div style={{ width: '100%', maxWidth: 380, position: 'relative' }}>
        {/* Card */}
        <div style={{
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          borderRadius: 12,
          padding: '32px 28px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--c-text-1)', marginBottom: 4, letterSpacing: '-0.01em' }}>
            Welcome back
          </h1>
          <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginBottom: 28 }}>
            Sign in to your Folio workspace
          </p>

        {/* Form — no card, just fields */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="field-label">Username</label>
            <input
              className="field"
              autoFocus
              autoComplete="username"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Password</label>
            <input
              type="password"
              className="field"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="error-box">
              <AlertTriangle size={13} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            style={{
              width: '100%', padding: '11px',
              background: 'var(--c-purple)', color: '#fff',
              border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500,
              fontFamily: 'var(--font)',
              cursor: loading || !username || !password ? 'not-allowed' : 'pointer',
              opacity: loading || !username || !password ? 0.55 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginTop: 4, transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!loading) (e.target as HTMLElement).style.background = 'var(--c-purple-text)' }}
            onMouseLeave={e => { (e.target as HTMLElement).style.background = 'var(--c-purple)' }}
          >
            {loading && <Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} />}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: 'var(--c-text-3)' }}>
          Folio v1.0 · Powered by RootSec
        </p>
      </div>
    </div>
  )
}
