import { useState } from 'react'

const BASE = '/auth'

async function authRequest(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
  return json
}

export default function AuthPage({ onAuth }) {
  const [mode,     setMode]     = useState('login')   // 'login' | 'register'
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const path = mode === 'login' ? '/login' : '/register'
      const data = await authRequest(path, { email, password })
      localStorage.setItem('project-os:token', data.token)
      localStorage.setItem('project-os:user',  JSON.stringify(data.user))
      onAuth(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-1)',
    }}>
      <div style={{
        width: 360, padding: '32px', borderRadius: 'var(--r)',
        background: 'var(--bg-2)', border: '0.5px solid var(--border)',
      }}>
        <h2 style={{ margin: '0 0 6px', color: 'var(--text-1)', fontSize: 20, fontWeight: 600 }}>
          Project OS
        </h2>
        <p style={{ margin: '0 0 24px', color: 'var(--text-3)', fontSize: 13 }}>
          {mode === 'login' ? 'Sign in to your workspace' : 'Create your workspace'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email" placeholder="Email" value={email} required
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password" placeholder="Password (min 8 chars)" value={password} required
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
          />

          {error && (
            <div style={{ color: 'var(--red, #e05252)', fontSize: 13, padding: '8px 0' }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              padding: '10px 0', borderRadius: 'var(--r)', border: 'none',
              background: 'var(--green)', color: '#fff', fontWeight: 600,
              fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p style={{ margin: '16px 0 0', textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null) }}
            style={{ background: 'none', border: 'none', color: 'var(--green)', cursor: 'pointer', fontWeight: 600, padding: 0, fontSize: 13 }}
          >
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}

const inputStyle = {
  padding: '9px 12px', borderRadius: 'var(--r)', border: '0.5px solid var(--border)',
  background: 'var(--bg-1)', color: 'var(--text-1)', fontSize: 14, outline: 'none', width: '100%',
  boxSizing: 'border-box',
}
