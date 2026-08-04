import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Search, KeyRound, ShieldCheck, Shield, Loader2, UserX, UserCheck, AlertTriangle } from 'lucide-react'
import { api } from '../api'
import Modal from '../components/Modal'
import { useAuth } from '../auth'

interface User {
  id: number
  username: string
  email: string | null
  display_name: string
  role: 'admin' | 'user'
  is_active: boolean
  created_at: string
  last_login: string | null
}

const EMPTY_FORM = {
  username: '', email: '', display_name: '', role: 'user' as 'admin' | 'user', password: '',
}

export default function AdminUsers() {
  const { user: me, isAdmin } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<User | null>(null)
  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try { setUsers(await api.admin.users.list()) }
    catch { setError('Failed to load users') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%' }}>
        <div className="empty-state" style={{ maxWidth: 360 }}>
          <Shield size={16} style={{ display: 'inline', marginRight: 8 }} />
          Admin access required to view this page
        </div>
      </div>
    )
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    return !q || u.username.includes(q) || u.display_name.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
  })

  const openCreate = () => {
    setEditTarget(null); setForm(EMPTY_FORM); setError(''); setCreateOpen(true)
  }

  const openEdit = (u: User) => {
    setEditTarget(u)
    setForm({ username: u.username, email: u.email || '', display_name: u.display_name, role: u.role, password: '' })
    setError(''); setCreateOpen(true)
  }

  const handleSave = async () => {
    if (!form.username.trim()) return
    setSaving(true); setError('')
    try {
      if (editTarget) {
        const updated = await api.admin.users.update(editTarget.id, {
          email: form.email || null,
          display_name: form.display_name || form.username,
          role: form.role,
        })
        setUsers(prev => prev.map(u => u.id === editTarget.id ? updated : u))
      } else {
        if (!form.password) { setError('Password is required'); setSaving(false); return }
        const created = await api.admin.users.create({
          username: form.username,
          email: form.email || null,
          display_name: form.display_name || form.username,
          role: form.role,
          password: form.password,
        })
        setUsers(prev => [...prev, created])
      }
      setCreateOpen(false)
    } catch (e: unknown) {
      setError((e as Error).message || 'Save failed')
    } finally { setSaving(false) }
  }

  const handleResetPassword = async () => {
    if (!resetTarget || !newPassword.trim()) return
    setSaving(true); setError('')
    try {
      await api.admin.users.resetPassword(resetTarget.id, newPassword)
      setResetTarget(null); setNewPassword('')
    } catch (e: unknown) {
      setError((e as Error).message || 'Reset failed')
    } finally { setSaving(false) }
  }

  const handleToggleActive = async (u: User) => {
    try {
      const updated = await api.admin.users.update(u.id, { is_active: !u.is_active })
      setUsers(prev => prev.map(x => x.id === u.id ? updated : x))
    } catch { /* ignore */ }
  }

  const handleDelete = async (u: User) => {
    if (u.id === me?.id) { alert("You can't delete your own account."); return }
    if (!confirm(`Permanently delete user "${u.username}"?`)) return
    try {
      await api.admin.users.delete(u.id)
      setUsers(prev => prev.filter(x => x.id !== u.id))
    } catch { /* ignore */ }
  }

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-header-title">User Management</span>
          <span className="page-header-count">{users.length} user{users.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="page-header-right">
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-3)', pointerEvents: 'none' }} />
            <input
              className="field"
              style={{ paddingLeft: 30, height: 32, width: 220, fontSize: 12 }}
              placeholder="Search users…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={13} /> Add User
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          <Plus size={12} /> Add User
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 10, color: 'var(--c-text-3)' }}>
          <div className="spinner" /> <span style={{ fontSize: 13 }}>Loading users…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 24 }}>No users found.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Email</th>
                <th>Status</th>
                <th>Created</th>
                <th>Last Login</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td className="td-primary">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: 4, flexShrink: 0,
                        background: u.role === 'admin' ? 'var(--c-purple-dim)' : 'rgba(255,255,255,0.06)',
                        border: '1px solid ' + (u.role === 'admin' ? 'rgba(123,111,205,0.25)' : 'var(--c-border)'),
                        color: u.role === 'admin' ? 'var(--c-purple-text)' : 'var(--c-text-2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700,
                      }}>
                        {(u.display_name || u.username).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text-1)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {u.display_name || u.username}
                          {u.id === me?.id && (
                            <span style={{ background: 'var(--c-purple-dim)', color: 'var(--c-purple-text)', padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 700 }}>
                              you
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--c-text-3)' }}>{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: u.role === 'admin' ? 'var(--c-purple-dim)' : 'rgba(255,255,255,0.05)',
                      color: u.role === 'admin' ? 'var(--c-purple-text)' : 'var(--c-text-3)',
                      border: '1px solid ' + (u.role === 'admin' ? 'rgba(123,111,205,0.25)' : 'var(--c-border)'),
                      padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      {u.role === 'admin' ? <ShieldCheck size={10} /> : <Shield size={10} />}
                      {u.role}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--c-text-2)' }}>
                    {u.email || <span style={{ color: 'var(--c-text-3)' }}>—</span>}
                  </td>
                  <td>
                    <span className={`status-dot ${u.is_active ? 'status-active' : 'status-archived'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--c-text-2)' }}>{fmtDate(u.created_at)}</td>
                  <td style={{ fontSize: 12, color: 'var(--c-text-3)' }}>{fmtDate(u.last_login)}</td>
                  <td>
                    <div className="data-table-actions">
                      <button className="btn-icon" title="Reset password"
                        onClick={() => { setResetTarget(u); setNewPassword(''); setError('') }}>
                        <KeyRound size={11} />
                      </button>
                      <button className="btn-icon" title={u.is_active ? 'Deactivate' : 'Activate'}
                        onClick={() => handleToggleActive(u)}
                        style={{ color: u.is_active ? 'var(--c-text-3)' : 'var(--c-green-text)' }}>
                        {u.is_active ? <UserX size={11} /> : <UserCheck size={11} />}
                      </button>
                      <button className="btn-icon" title="Edit" onClick={() => openEdit(u)}>
                        <Pencil size={11} />
                      </button>
                      {u.id !== me?.id && (
                        <button className="btn-icon" title="Delete"
                          style={{ color: 'var(--c-red)' }}
                          onClick={() => handleDelete(u)}>
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)}
        title={editTarget ? `Edit ${editTarget.username}` : 'Create User'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="field-label">Username *</label>
              <input className="field field-mono" placeholder="jsmith"
                value={form.username} autoFocus={!editTarget}
                disabled={!!editTarget}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Display Name</label>
              <input className="field" placeholder="John Smith"
                value={form.display_name}
                onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="field-label">Email</label>
            <input type="email" className="field" placeholder="jsmith@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Role</label>
            <select className="field" value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as 'admin' | 'user' }))}>
              <option value="user">User — standard access</option>
              <option value="admin">Admin — full access</option>
            </select>
          </div>
          {!editTarget && (
            <div>
              <label className="field-label">Password *</label>
              <input type="password" className="field" placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
          )}
          {error && (
            <div className="error-box">
              <AlertTriangle size={12} /> {error}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <button className="btn btn-outline" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}
              disabled={saving || !form.username.trim()}>
              {saving ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : null}
              {editTarget ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reset password modal */}
      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)}
        title={`Reset Password — ${resetTarget?.username}`}
        subtitle="Set a new password for this user">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="field-label">New Password *</label>
            <input type="password" className="field" autoFocus
              placeholder="••••••••" value={newPassword}
              onChange={e => setNewPassword(e.target.value)} />
          </div>
          {error && (
            <div className="error-box">
              <AlertTriangle size={12} /> {error}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <button className="btn btn-outline" onClick={() => setResetTarget(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleResetPassword}
              disabled={saving || !newPassword.trim()}>
              {saving ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : <KeyRound size={13} />}
              Reset Password
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
