import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { login } from '../lib/api'

export const SITE_URL = 'https://gndott.theangelorgapps.workers.dev'

export const Route = createFileRoute('/login')({
  component: Login,
})

export function AuthShell({ children, title }: { children: React.ReactNode; title: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <img className="auth-logo" src="/default-image.jpg" alt="Streamit" />
        <h1>{title}</h1>
        {children}
      </div>
    </div>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await login({ data: { email, password } })
      if (res.ok) {
        window.location.href = '/admin'
      } else {
        setError(res.error ?? 'Login failed.')
      }
    } catch (err: any) {
      setError(err?.message ?? 'Login failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title={<>Welcome to the Streamit Admin Panel</>}>
      <form onSubmit={onSubmit}>
        <div className="field">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="field field-pw">
          <input type={showPw ? 'text' : 'password'} placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="button" className="pw-eye" onClick={() => setShowPw(!showPw)} aria-label="Show password">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
        <div className="auth-row">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember Me
          </label>
        </div>
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary auth-btn" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
      <div className="demo-box">
        <h3>Demo Admin Account</h3>
        <div className="demo-cred">
          admin@streamit.com<br />12345678
        </div>
        <div className="auth-alt" style={{ marginBottom: 0 }}>
          <a href={SITE_URL} className="admin-link">← Back to Streamit</a>
        </div>
      </div>
    </AuthShell>
  )
}
