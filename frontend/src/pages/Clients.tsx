import { useState, useEffect, useCallback } from 'react'
import { Plus, Mail, User, Pencil, Trash2, Search, Loader2, AlertTriangle } from 'lucide-react'
import Modal from '../components/Modal'
import { api } from '../api'
import { useSearchParams } from 'react-router-dom'

interface Client {
  id: number
  name: string
  industry: string
  contact_name: string
  contact_title: string
  contact_email: string
  notes: string
  created_at: string
}

const INDUSTRIES = [
  'Financial Services', 'Healthcare', 'Government', 'Defence', 'Retail',
  'Technology', 'Energy & Utilities', 'Manufacturing', 'Legal', 'Education', 'Other',
]

const EMPTY: Omit<Client, 'id' | 'created_at'> = {
  name: '', industry: 'Technology', contact_name: '',
  contact_title: '', contact_email: '', notes: '',
}

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Client | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const load = useCallback(async () => {
    try { setClients(await api.clients.list()) }
    catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (searchParams.get('new') === '1') { openCreate(); setSearchParams({}) }
  }, [searchParams, setSearchParams])

  const openCreate = () => { setEditTarget(null); setForm(EMPTY); setModalOpen(true) }

  const openEdit = (c: Client) => {
    setEditTarget(c)
    setForm({ name: c.name, industry: c.industry, contact_name: c.contact_name, contact_title: c.contact_title, contact_email: c.contact_email, notes: c.notes })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editTarget) {
        const updated = await api.clients.update(editTarget.id, form)
        setClients(prev => prev.map(c => c.id === editTarget.id ? updated : c))
      } else {
        const created = await api.clients.create(form)
        setClients(prev => [...prev, created])
      }
      setModalOpen(false)
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this client record?')) return
    try {
      await api.clients.delete(id)
      setClients(prev => prev.filter(c => c.id !== id))
    } catch { /* ignore */ }
  }

  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || c.industry.toLowerCase().includes(q) || c.contact_name.toLowerCase().includes(q)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-header-title">Clients</span>
          <span className="page-header-count">{clients.length} record{clients.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="page-header-right">
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-3)', pointerEvents: 'none' }} />
            <input
              className="field"
              style={{ paddingLeft: 30, height: 32, width: 220, fontSize: 12 }}
              placeholder="Search clients…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={13} /> Add Client
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          <Plus size={12} /> Add Client
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 10, color: 'var(--c-text-3)' }}>
          <div className="spinner" /> <span style={{ fontSize: 13 }}>Loading clients…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 24 }}>
          {search
            ? 'No clients match your search.'
            : 'No clients on file yet. Add your first client to link engagements to organisations.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Industry</th>
                <th>Contact</th>
                <th>Email</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td className="td-primary">
                    <div>{c.name}</div>
                    {c.notes && (
                      <div style={{ fontSize: 10, color: 'var(--c-text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>{c.notes}</div>
                    )}
                  </td>
                  <td>
                    <span style={{ background: 'var(--c-purple-dim)', color: 'var(--c-purple-text)', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600 }}>
                      {c.industry}
                    </span>
                  </td>
                  <td>
                    {c.contact_name ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--c-text-2)' }}>
                        <User size={10} style={{ color: 'var(--c-text-3)', flexShrink: 0 }} />
                        {c.contact_name}{c.contact_title && ` — ${c.contact_title}`}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--c-text-3)' }}>—</span>
                    )}
                  </td>
                  <td>
                    {c.contact_email ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--c-text-2)' }}>
                        <Mail size={10} style={{ color: 'var(--c-text-3)', flexShrink: 0 }} />
                        {c.contact_email}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--c-text-3)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <div className="data-table-actions">
                      <button className="btn-icon" onClick={() => openEdit(c)} title="Edit">
                        <Pencil size={11} />
                      </button>
                      <button className="btn-icon" style={{ color: 'var(--c-red)' }} onClick={() => handleDelete(c.id)} title="Delete">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editTarget ? 'Edit Client' : 'New Client'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="field-label">Company Name *</label>
            <input className="field" placeholder="ACME Corporation"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="field-label">Industry</label>
            <select className="field" value={form.industry}
              onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}>
              {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="field-label">Contact Name</label>
              <input className="field" placeholder="Jane Smith"
                value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Contact Title</label>
              <input className="field" placeholder="CISO"
                value={form.contact_title} onChange={e => setForm(f => ({ ...f, contact_title: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="field-label">Contact Email</label>
            <input type="email" className="field" placeholder="jane@acme.com"
              value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Notes</label>
            <textarea className="field" style={{ minHeight: 80, resize: 'vertical' }} placeholder="Internal notes about this client…"
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : null}
              {editTarget ? 'Save Changes' : 'Add Client'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
