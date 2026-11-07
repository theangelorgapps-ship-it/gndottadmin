import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { login } from '../lib/api'
import { GlassEffect, GlassFilter } from '../components/ui/liquid-glass'

export const SITE_URL = 'https://gndott.theangelorgapps.workers.dev'

export const Route = createFileRoute('/login')({
  component: Login,
})

export function AuthShell({ children, title }: { children: React.ReactNode; title: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <GlassFilter />
      <main className="auth-card" aria-labelledby="auth-title">
        <GlassEffect className="auth-glass">
          <div className="auth-glass-inner">
            <div className="auth-brand">
              <span className="brand-mark" aria-hidden="true">GH</span>
              <span>GoodNews Halobox</span>
            </div>
            <div className="auth-heading">
              <p>Admin workspace</p>
              <h1 id="auth-title">{title}</h1>
              <span>Sign in to manage content, people, and publishing.</span>
            </div>
            {children}
          </div>
        </GlassEffect>
      </main>
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
    <AuthShell title="Welcome back">
      <form onSubmit={onSubmit} aria-busy={busy}>
        <div className="field">
          <label htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            name="email"
            type="email"
            placeholder="you@example.org"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoFocus
            autoComplete="email"
            inputMode="email"
            aria-describedby={error ? 'login-error' : undefined}
          />
        </div>
        <div className="field field-pw">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            type={showPw ? 'text' : 'password'}
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
            aria-describedby={error ? 'login-error' : undefined}
          />
          <button
            type="button"
            className="pw-eye"
            onClick={() => setShowPw((visible) => !visible)}
            aria-label={showPw ? 'Hide password' : 'Show password'}
            aria-pressed={showPw}
            aria-controls="login-password"
            title={showPw ? 'Hide password' : 'Show password'}
          >
            {showPw ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        </div>
        <div className="auth-row">
          <label htmlFor="login-remember">
            <input
              id="login-remember"
              name="remember"
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            Remember me
          </label>
        </div>
        {error && <div className="error" id="login-error" role="alert">{error}</div>}
        <button type="submit" className="btn btn-primary auth-btn" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  )
}
