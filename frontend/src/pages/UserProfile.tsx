import { useState, useEffect } from 'react'
import { User, Mail, Key, Shield, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../auth'
import { api } from '../api'

type Msg = { type: 'success' | 'error'; text: string } | null

export default function UserProfile() {
  const { user, login } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<Msg>(null)

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwMsg, setPwMsg] = useState<Msg>(null)

  useEffect(() => {
    if (user) { setDisplayName(user.display_name || ''); setEmail(user.email || '') }
  }, [user])

  const handleSaveProfile = async () => {
    if (!user) return
    setSavingProfile(true); setProfileMsg(null)
    try {
      await api.admin.users.update(user.id, { display_name: displayName, email })
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' })
    } catch (e: any) {
      setProfileMsg({ type: 'error', text: e.message || 'Failed to update profile.' })
    } finally { setSavingProfile(false) }
  }

  const handleChangePassword = async () => {
    if (!user) return
    if (newPw !== confirmPw) { setPwMsg({ type: 'error', text: 'New passwords do not match.' }); return }
    if (newPw.length < 8) { setPwMsg({ type: 'error', text: 'Password must be at least 8 characters.' }); return }
    setSavingPw(true); setPwMsg(null)
    try {
      await api.admin.users.resetPassword(user.id, newPw)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setPwMsg({ type: 'success', text: 'Password changed successfully.' })
    } catch (e: any) {
      setPwMsg({ type: 'error', text: e.message || 'Failed to change password.' })
    } finally { setSavingPw(false) }
  }

  const initials = (user?.display_name || user?.username || 'U')
    .split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)

  const Feedback = ({ msg }: { msg: Msg }) => msg ? (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 5,
      fontSize: 12, marginTop: 12,
      background: msg.type === 'success' ? 'var(--c-green-dim)' : 'rgba(224,82,82,0.1)',
      border: `1px solid ${msg.type === 'success' ? 'rgba(26,158,106,0.3)' : 'rgba(224,82,82,0.3)'}`,
      color: msg.type === 'success' ? 'var(--c-green-text)' : 'var(--c-red)',
    }}>
      {msg.type === 'success' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
      {msg.text}
    </div>
  ) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-header-title">Your Profile</span>
          <span className="page-header-count">Account settings</span>
        </div>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Avatar + overview */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 20,
          background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, padding: '20px 24px',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: 14,
            background: 'var(--c-green-dim)', border: '2px solid rgba(26,158,106,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 700, color: 'var(--c-green-text)', flexShrink: 0,
          }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--c-text-1)' }}>
              {user?.display_name || user?.username}
            </div>
            <div style={{ fontSize: 13, color: 'var(--c-text-3)', marginTop: 2 }}>{user?.email || 'No email set'}</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
                background: user?.role === 'admin' ? 'rgba(26,158,106,0.12)' : 'var(--c-surface-2)',
                color: user?.role === 'admin' ? 'var(--c-green-text)' : 'var(--c-text-3)',
                border: `1px solid ${user?.role === 'admin' ? 'rgba(26,158,106,0.2)' : 'var(--c-border)'}`,
                padding: '2px 8px', borderRadius: 3,
              }}>
                <Shield size={9} style={{ display: 'inline', marginRight: 4 }} />
                {user?.role}
              </span>
              <span style={{ fontSize: 10, color: 'var(--c-text-3)', letterSpacing: '0.05em' }}>
                @{user?.username}
              </span>
            </div>
          </div>
        </div>

        {/* Profile info */}
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={14} style={{ color: 'var(--c-text-3)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)' }}>Personal Information</span>
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="field-label">Display Name</label>
                <input className="field" placeholder="Full Name" value={displayName} onChange={e => setDisplayName(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Username</label>
                <input className="field" value={user?.username || ''} disabled style={{ opacity: 0.5 }} />
              </div>
            </div>
            <div>
              <label className="field-label"><Mail size={11} style={{ display: 'inline', marginRight: 4 }} />Email Address</label>
              <input className="field" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <Feedback msg={profileMsg} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary btn-sm" onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile && <Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} />}
                Save Profile
              </button>
            </div>
          </div>
        </div>

        {/* Change password */}
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Key size={14} style={{ color: 'var(--c-text-3)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)' }}>Change Password</span>
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="field-label">New Password</label>
              <input className="field" type="password" placeholder="Min. 8 characters" value={newPw} onChange={e => setNewPw(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Confirm New Password</label>
              <input className="field" type="password" placeholder="Repeat new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
            </div>
            <Feedback msg={pwMsg} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary btn-sm" onClick={handleChangePassword} disabled={savingPw || !newPw || !confirmPw}>
                {savingPw && <Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} />}
                Update Password
              </button>
            </div>
          </div>
        </div>

        {/* Account info (read-only) */}
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--c-border)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)' }}>Account Details</span>
          </div>
          <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { label: 'Username', value: user?.username },
              { label: 'Role', value: user?.role },
              { label: 'Account Status', value: user?.is_active ? 'Active' : 'Disabled' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, color: 'var(--c-text-1)', fontWeight: 500 }}>{value || '—'}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
