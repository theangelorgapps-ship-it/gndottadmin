import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ChevronDown, ExternalLink, LogOut, Settings, ShieldCheck } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { logout } from '../lib/api'

type AdminProfile = { email: string; first_name?: string | null; last_name?: string | null; user_type?: string }

export function AdminProfileMenu({ admin }: { admin: AdminProfile }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = [admin.first_name, admin.last_name].filter(Boolean).join(' ').trim() || admin.email
  const initials = [admin.first_name, admin.last_name].filter(Boolean).map(value => value!.trim()[0]).join('').slice(0, 2).toUpperCase() || admin.email[0]?.toUpperCase() || 'A'
  async function signOut() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await logout()
      window.location.assign('/login')
    } catch {
      setError('Sign-out failed. Please try again.')
      setBusy(false)
    }
  }
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button type="button" className="admin-profile-trigger" aria-label={`Account menu for ${name}`}>
        <span className="topbar-avatar" aria-hidden="true">{initials}</span>
        <span className="topbar-email">{name}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="end" className="admin-profile-popover" aria-label="Administrator account">
      <div className="admin-profile-identity"><strong>{name}</strong><span>{admin.email}</span><small><ShieldCheck size={14} aria-hidden="true" />{admin.user_type === 'demo_admin' ? 'Demo administrator · read only' : 'Administrator'}</small></div>
      <Link to="/admin/settings" search={{ section: 'sign-in' }} onClick={() => setOpen(false)} className="admin-profile-action"><Settings size={17} aria-hidden="true" />Account settings</Link>
      <a href="https://halobox.tv" target="_blank" rel="noreferrer" className="admin-profile-action"><ExternalLink size={17} aria-hidden="true" />Open Halobox</a>
      <button type="button" disabled={busy} onClick={signOut} className="admin-profile-action"><LogOut size={17} aria-hidden="true" />{busy ? 'Signing out…' : 'Sign out'}</button>
      {error && <p className="error" role="alert">{error}</p>}
    </PopoverContent>
  </Popover>
}
