import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import Modal from '../components/Modal'
import SeverityBadge from '../components/SeverityBadge'
import { api } from '../api'
import { useSearchParams } from 'react-router-dom'
import type { Severity } from '../types'

interface Observation {
  id: number
  title: string
  severity: Severity
  description: string
  remediation: string
  tags: string
  created_at: string
  updated_at: string
}

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'informational']
const EMPTY = { title: '', severity: 'informational' as Severity, description: '', remediation: '', tags: '' }

export default function Observations() {
  const [items, setItems] = useState<Observation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [sevFilter, setSevFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Observation | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const load = useCallback(async () => {
    try { setItems(await api.observations.list()) }
    catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (searchParams.get('new') === '1') { openCreate(); setSearchParams({}) }
  }, [searchParams, setSearchParams])

  const openCreate = () => { setEditTarget(null); setForm(EMPTY); setModalOpen(true) }
  const openEdit = (o: Observation) => {
    setEditTarget(o)
    setForm({ title: o.title, severity: o.severity, description: o.description, remediation: o.remediation, tags: o.tags })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      if (editTarget) {
        const updated = await api.observations.update(editTarget.id, form)
        setItems(prev => prev.map(o => o.id === editTarget.id ? updated : o))
      } else {
        const created = await api.observations.create(form)
        setItems(prev => [...prev, created])
      }
      setModalOpen(false)
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this observation?')) return
    try { await api.observations.delete(id); setItems(prev => prev.filter(o => o.id !== id)) }
    catch { /* ignore */ }
  }

  const filtered = items.filter(o => {
    if (sevFilter !== 'all' && o.severity !== sevFilter) return false
    const q = search.toLowerCase()
    if (q && !o.title.toLowerCase().includes(q) && !o.tags.toLowerCase().includes(q)) return false
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-header-title">Observations</span>
          <span className="page-header-count">{items.length} total</span>
        </div>
        <div className="page-header-right">
          <button className="btn btn-primary btn-sm" onClick={openCreate}><Plus size={13} /> New Observation</button>
        </div>
      </div>

      <div className="filter-bar" onClick={() => setFilterOpen(v => !v)}>
        <span className="filter-bar-title">Observation Filters</span>
        <span className="filter-bar-icon">{filterOpen ? '−' : '+'}</span>
      </div>
      {filterOpen && (
        <div className="filter-body">
          <div>
            <label className="field-label">Search</label>
            <input className="field" placeholder="Title or tags…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Severity</label>
            <select className="field" value={sevFilter} onChange={e => setSevFilter(e.target.value)}>
              <option value="all">All severities</option>
              {SEVERITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="toolbar">
        <button className="btn btn-primary btn-sm" onClick={openCreate}><Plus size={12} /> New Observation</button>
        <button className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setSevFilter('all') }}>Reset Sort</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 10, color: 'var(--c-text-3)' }}>
          <div className="spinner" /><span style={{ fontSize: 13 }}>Loading…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 24 }}>
          {items.length === 0 ? 'No observations yet. Add security observations to build your library.' : 'No observations match your filters.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr><th>Title</th><th>Severity</th><th>Tags</th><th>Description</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id}>
                  <td className="td-primary">{o.title}</td>
                  <td><SeverityBadge severity={o.severity} /></td>
                  <td style={{ fontSize: 11, color: 'var(--c-text-3)' }}>{o.tags || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--c-text-3)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.description || '—'}
                  </td>
                  <td>
                    <div className="data-table-actions">
                      <button className="btn-icon" onClick={() => openEdit(o)}><Pencil size={11} /></button>
                      <button className="btn-icon" style={{ color: 'var(--c-red)' }} onClick={() => handleDelete(o.id)}><Trash2 size={11} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit Observation' : 'New Observation'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="field-label">Title *</label>
            <input className="field" autoFocus placeholder="Default Credentials in Use" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="field-label">Severity</label>
              <select className="field" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value as Severity }))}>
                {SEVERITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Tags</label>
              <input className="field" placeholder="config, hardening, …" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="field-label">Description</label>
            <textarea className="field" style={{ minHeight: 80 }} placeholder="What was observed…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Remediation</label>
            <textarea className="field" style={{ minHeight: 64 }} placeholder="How to address this…" value={form.remediation} onChange={e => setForm(f => ({ ...f, remediation: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.title.trim()}>
              {saving && <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} />}
              {editTarget ? 'Save Changes' : 'Add Observation'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
