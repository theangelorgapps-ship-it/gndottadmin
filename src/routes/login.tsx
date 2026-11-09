import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { authClient } from '../lib/auth-client'
import { SocialSignIn } from '../components/SocialSignIn'
import { login, requestOtp, verifyOtp } from '../lib/api'
import { AdminBrand } from '../components/AdminBrand'
import '../admin-polish.css'

export const SITE_URL = 'https://halobox.tv'

export const Route = createFileRoute('/login')({
  component: Login,
})

export function AuthShell({ children, title }: { children: React.ReactNode; title: React.ReactNode }) {
  return (
    <div className="auth-wrap halobox-auth">
      <main className="auth-card" aria-labelledby="auth-title">
        <div className="auth-glass-inner">
          <AdminBrand link={false} />
          <div className="auth-heading">
            <p>Content. People. Possibility.</p>
            <h1 id="auth-title">{title}</h1>
            <span>Sign in to your Halobox workspace.</span>
          </div>
          {children}
        </div>
      </main>
      <p className="auth-footer">GoodNews Halobox · Admin access</p>
    </div>
  )
}

type LoginMode = 'password' | 'email-code' | 'reset'

function Login() {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [mode, setMode] = useState<LoginMode>('password')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function switchMode(next: LoginMode) {
    setMode(next)
    setSent(false)
    setCode('')
    setPassword('')
    setShowPw(false)
    setError(null)
    setMessage(null)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !ready) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      if (mode === 'reset') {
        const res = sent
          ? await authClient.emailOtp.resetPassword({ email: email.trim().toLowerCase(), otp: code, password })
          : await authClient.emailOtp.requestPasswordReset({ email: email.trim().toLowerCase() })
        if (res.error) {
          setError(res.error.status === 503
            ? 'Email recovery is temporarily unavailable.'
            : 'Unable to reset your password. Check your code and use 8–72 characters.')
        } else if (!sent) {
          setSent(true)
          setMessage('If an eligible account matches, a code has been sent. It expires in 5 minutes.')
        } else {
          switchMode('password')
          setMessage('Password updated. Sign in with your new password.')
        }
        return
      }
      const res = mode === 'password'
        ? await login({ data: { email, password } })
        : sent
          ? await verifyOtp({ data: { contact: email, code } })
          : await requestOtp({ data: { contact: email } })
      if (res.ok) {
        if (mode === 'email-code' && !sent) {
          setSent(true)
          setMessage('If an eligible account matches, a code has been sent. It expires in 5 minutes.')
        } else {
          window.location.href = '/admin'
        }
      } else {
        setError(res.error ?? 'Login failed.')
      }
    } catch {
      setError('Sign-in is temporarily unavailable. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const passwordVisible = mode === 'password' || (mode === 'reset' && sent)
  const codeVisible = sent && mode !== 'password'
  const describedBy = error ? 'login-error' : message ? 'login-message' : undefined

  return (
    <AuthShell title={mode === 'reset' ? 'Reset your password' : 'Welcome back'}>
      <form method="post" onSubmit={onSubmit} aria-busy={busy || !ready}>
        <noscript>Enable JavaScript to sign in securely.</noscript>
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
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            disabled={!ready || busy || sent}
            aria-describedby={describedBy}
          />
        </div>
        {passwordVisible && <div className="field field-pw">
          <label htmlFor="login-password">{mode === 'reset' ? 'New password' : 'Password'}</label>
          <input
            id="login-password"
            name="password"
            type={showPw ? 'text' : 'password'}
            placeholder={mode === 'reset' ? 'New password (8–72 characters)' : 'Enter your password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete={mode === 'reset' ? 'new-password' : 'current-password'}
            minLength={mode === 'reset' ? 8 : undefined}
            maxLength={72}
            disabled={!ready || busy}
            aria-describedby={describedBy}
          />
          <button
            type="button"
            className="pw-eye"
            onClick={() => setShowPw((visible) => !visible)}
            aria-label={showPw ? 'Hide password' : 'Show password'}
            aria-pressed={showPw}
            aria-controls="login-password"
            title={showPw ? 'Hide password' : 'Show password'}
            disabled={!ready || busy}
          >
            {showPw ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        </div>}
        {codeVisible && <div className="field">
          <label htmlFor="login-code">{mode === 'reset' ? 'Reset code' : 'Sign-in code'}</label>
          <input
            id="login-code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="6-digit code"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            required
            disabled={!ready || busy}
            aria-describedby={describedBy}
          />
        </div>}
        <div className="auth-row">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!ready || busy}
            onClick={() => switchMode(mode === 'password' ? 'email-code' : 'password')}
          >
            {mode === 'password' ? 'Sign in with an email code' : 'Use a password'}
          </button>
          {mode === 'password' && <button type="button" className="btn btn-ghost" disabled={!ready || busy} onClick={() => switchMode('reset')}>Forgot password?</button>}
        </div>
        {error && <div className="error" id="login-error" role="alert">{error}</div>}
        {message && <p id="login-message" role="status">{message}</p>}
        <button type="submit" className="btn btn-primary auth-btn" disabled={!ready || busy}>
          {busy ? 'Please wait…'
            : mode === 'reset' ? sent ? 'Update password' : 'Send reset code'
            : mode === 'email-code' && !sent ? 'Send sign-in code'
            : 'Sign in'}
        </button>
      </form>
      <SocialSignIn callbackURL="/admin" />
    </AuthShell>
  )
}
