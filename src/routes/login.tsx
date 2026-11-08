import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '../lib/auth-client'
import { SocialSignIn } from '../components/SocialSignIn'
import { login, requestOtp, verifyOtp } from '../lib/api'
import { GlassEffect, GlassFilter } from '../components/ui/liquid-glass'

export const SITE_URL = 'https://halobox.tv'

export const Route = createFileRoute('/login')({
  component: Login,
})

export function AuthShell({ children, title }: { children: React.ReactNode; title: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <GlassFilter />
      <div className="auth-card">
        <GlassEffect
          className="rounded-[28px]"
          style={{ color: '#fff', cursor: 'default', width: '100%' }}
        >
          <div className="auth-glass-inner">
            <img className="auth-logo" src="/default-image.jpg" alt="Streamit" />
            <h1>{title}</h1>
            {children}
          </div>
        </GlassEffect>
      </div>
    </div>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [mode,setMode] = useState<'password'|'email-code'|'reset'>('password')
  const [code,setCode] = useState('')
  const [sent,setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      if (mode === 'reset') {
        const res = sent ? await authClient.emailOtp.resetPassword({email:email.trim().toLowerCase(),otp:code,password}) : await authClient.emailOtp.requestPasswordReset({email:email.trim().toLowerCase()})
        if (res.error) setError(res.error.status === 503 ? 'Email recovery is temporarily unavailable.' : 'Unable to reset your password. Check your code and use 8–72 characters.')
        else if (!sent) { setSent(true); setError('If an eligible administrator account matches, a code has been sent. It expires in 5 minutes.') }
        else { setMode('password'); setSent(false); setPassword(''); setCode(''); setError('Password updated. Sign in with your new password.') }
        return
      }
      const res = mode==='password' ? await login({data:{email,password}}) : sent ? await verifyOtp({data:{contact:email,code}}) : await requestOtp({data:{contact:email}})
      if (res.ok) {
        if(mode==='email-code'&&!sent)setSent(true)
        else window.location.href = '/admin'
      } else {
        setError(res.error ?? 'Login failed.')
      }
    } catch (err: any) {
      setError('Sign-in is temporarily unavailable. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title={<>GoodNews Halobox Admin</>}>
      <form onSubmit={onSubmit}>
        <div className="field">
          <input type="email" aria-label="Email" autoComplete="email" maxLength={254} disabled={busy || sent} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        {mode==='password' || (mode==='reset' && sent)?<div className="field field-pw">
          <input type={showPw ? 'text' : 'password'} aria-label={mode === 'reset' ? 'New password' : 'Password'} autoComplete={mode === 'reset' ? 'new-password' : 'current-password'} minLength={mode === 'reset' ? 8 : undefined} maxLength={72} placeholder={mode === 'reset' ? 'New password (8–72 characters)' : 'Enter password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="button" className="pw-eye" onClick={() => setShowPw(!showPw)} aria-label="Show password">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
        :sent?<div className="field"><input aria-label="6-digit sign-in code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} required/></div>:null}
        {mode==='reset' && sent && <div className="field"><input aria-label="6-digit reset code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} required disabled={busy}/></div>}
        <div className="auth-row">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>{setMode(mode==='password'?'email-code':'password');setSent(false);setCode('');setError(null)}}>{mode==='password' || (mode==='reset' && sent)?'Sign in with an email code':'Use a password'}</button>
        </div>
        {mode === 'password' && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => { setMode('reset'); setSent(false); setCode(''); setPassword(''); setError(null) }}>Forgot password?</button>}
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary auth-btn" disabled={busy}>
          {busy ? 'Please wait…' : mode==='reset' ? sent ? 'Update password' : 'Send reset code' : mode==='email-code'&&!sent?'Send sign-in code':'Sign In'}
        </button>
      </form>
      <SocialSignIn callbackURL="/admin"/>

    </AuthShell>
  )
}
