import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Pencil, Trash2, Search, AlertTriangle, CheckCircle,
  XCircle, Heart, HelpCircle, ChevronDown, ChevronUp, RotateCcw
} from 'lucide-react'
import Modal from '../components/Modal'
import { api } from '../api'
import { useSearchParams } from 'react-router-dom'

type ServerStatus = 'available' | 'reserved' | 'active' | 'burned' | 'retired'
type HealthStatus = 'healthy' | 'unknown' | 'unhealthy' | 'burned'

interface ServerRecord {
  id: number
  ip_address: string
  hostname: string
  status: ServerStatus
  server_provider: string
  tags: string
  purpose: string
  engagement: string
  project_id: number | null
  notes: string
  purchase_date: string
  expiry_date: string
  health_status: HealthStatus
  created_at: string
}

const PURPOSES = ['C2', 'Phishing', 'Redirector', 'Listener', 'Proxy', 'Other']
const PROVIDERS = ['AWS', 'Azure', 'GCP', 'DigitalOcean', 'Vultr', 'Linode', 'Hetzner', 'OVH', 'Dedicated', 'Other']
const STATUSES: ServerStatus[] = ['available', 'reserved', 'active', 'burned', 'retired']

const EMPTY: Omit<ServerRecord, 'id' | 'created_at'> = {
  ip_address: '', hostname: '', status: 'available', server_provider: '',
  tags: '', purpose: 'C2', engagement: '', project_id: null, notes: '',
  purchase_date: '', expiry_date: '', health_status: 'healthy',
}

const STATUS_COLOR: Record<ServerStatus, string> = {
  available: 'var(--c-green-text)',
  reserved:  'var(--c-purple-text)',
  active:    'var(--c-green-text)',
  burned:    '#ff9090',
  retired:   'var(--c-text-3)',
}

const STATUS_BG: Record<ServerStatus, string> = {
  available: 'rgba(76,175,130,0.12)',
  reserved:  'rgba(123,111,205,0.12)',
  active:    'rgba(76,175,130,0.15)',
  burned:    'rgba(217,94,94,0.12)',
  retired:   'rgba(255,255,255,0.04)',
}

const HEALTH_STYLES: Record<HealthStatus, { color: string; bg: string; icon: React.ReactNode }> = {
  healthy:   { color: 'var(--c-green-text)', bg: 'var(--c-green-dim)',    icon: <Heart size={10} /> },
  unknown:   { color: 'var(--c-text-3)',      bg: 'rgba(255,255,255,0.05)', icon: <HelpCircle size={10} /> },
  unhealthy: { color: '#ffe07a',             bg: 'rgba(255,224,122,0.1)', icon: <AlertTriangle size={10} /> },
  burned:    { color: '#ff9090',             bg: 'rgba(217,94,94,0.12)', icon: <XCircle size={10} /> },
}

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function fmtDate(d: string) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return d }
}

function StatusPill({ value, color, bg }: { value: string; color: string; bg: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
      letterSpacing: '0.06em', textTransform: 'uppercase', color, background: bg,
    }}>
      {value}
    </span>
  )
}

function HealthPill({ value }: { value: HealthStatus }) {
  const s = HEALTH_STYLES[value]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
      letterSpacing: '0.06em', textTransform: 'uppercase', color: s.color, background: s.bg,
    }}>
      {s.icon}{value}
    </span>
  )
}

export default function Servers() {
  const [servers, setServers] = useState<ServerRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [purposeFilter, setPurposeFilter] = useState('all')
  const [providerFilter, setProviderFilter] = useState('all')
  const [healthFilter, setHealthFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ServerRecord | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set())
  const [searchParams, setSearchParams] = useSearchParams()

  const load = useCallback(async () => {
    try { setServers(await api.servers.list()) }
    catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (searchParams.get('new') === '1') { openCreate(); setSearchParams({}) }
  }, [searchParams, setSearchParams])

  const openCreate = () => { setEditTarget(null); setForm(EMPTY); setModalOpen(true) }
  const openEdit = (s: ServerRecord) => {
    setEditTarget(s)
    setForm({
      ip_address: s.ip_address, hostname: s.hostname, status: s.status,
      server_provider: s.server_provider, tags: s.tags, purpose: s.purpose,
      engagement: s.engagement, project_id: s.project_id, notes: s.notes,
      purchase_date: s.purchase_date, expiry_date: s.expiry_date, health_status: s.health_status,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.ip_address.trim() && !form.hostname.trim()) return
    setSaving(true)
    try {
      if (editTarget) {
        const updated = await api.servers.update(editTarget.id, form)
        setServers(prev => prev.map(s => s.id === editTarget.id ? updated : s))
      } else {
        const created = await api.servers.create(form)
        setServers(prev => [...prev, created])
      }
      setModalOpen(false)
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this server?')) return
    try { await api.servers.delete(id); setServers(prev => prev.filter(s => s.id !== id)) }
    catch { /* ignore */ }
  }

  const resetFilters = () => { setSearch(''); setStatusFilter('all'); setPurposeFilter('all'); setProviderFilter('all'); setHealthFilter('all') }
  const hasActiveFilters = search || statusFilter !== 'all' || purposeFilter !== 'all' || providerFilter !== 'all' || healthFilter !== 'all'

  const providerOptions = Array.from(new Set(servers.map(s => s.server_provider).filter(Boolean))).sort()

  const filtered = servers.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    if (purposeFilter !== 'all' && s.purpose !== purposeFilter) return false
    if (providerFilter !== 'all' && s.server_provider !== providerFilter) return false
    if (healthFilter !== 'all' && s.health_status !== healthFilter) return false
    const q = search.toLowerCase()
    if (q && !s.ip_address.includes(q) && !s.hostname.toLowerCase().includes(q) &&
        !s.tags.toLowerCase().includes(q) && !s.engagement.toLowerCase().includes(q) &&
        !s.notes.toLowerCase().includes(q)) return false
    return true
  })

  const toggleNotes = (id: number) => setExpandedNotes(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-header-title">Server Library</span>
          <span className="page-header-count">{servers.length} tracked</span>
        </div>
        <div className="page-header-right">
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-3)', pointerEvents: 'none' }} />
            <input className="field" style={{ paddingLeft: 30, height: 32, width: 200, fontSize: 12 }} placeholder="Search servers…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={openCreate}><Plus size={13} /> Add Server</button>
        </div>
      </div>

      {/* Filter bar */}
      <div
        className="filter-bar"
        onClick={() => setFilterOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="filter-bar-title">Server Filters</span>
          {hasActiveFilters && (
            <span style={{ fontSize: 10, background: 'var(--c-green-dim)', color: 'var(--c-green-text)', padding: '1px 6px', borderRadius: 3, fontWeight: 600 }}>
              Active
            </span>
          )}
        </div>
        <span className="filter-bar-icon">{filterOpen ? '−' : '+'}</span>
      </div>
      {filterOpen && (
        <div className="filter-body">
          <div>
            <label className="field-label">Status</label>
            <select className="field" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Purpose</label>
            <select className="field" value={purposeFilter} onChange={e => setPurposeFilter(e.target.value)}>
              <option value="all">All purposes</option>
              {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Provider</label>
            <select className="field" value={providerFilter} onChange={e => setProviderFilter(e.target.value)}>
              <option value="all">All providers</option>
              {(providerOptions.length ? providerOptions : PROVIDERS).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Health</label>
            <select className="field" value={healthFilter} onChange={e => setHealthFilter(e.target.value)}>
              <option value="all">All health</option>
              {(['healthy', 'unknown', 'unhealthy', 'burned'] as HealthStatus[]).map(h => (
                <option key={h} value={h}>{h.charAt(0).toUpperCase() + h.slice(1)}</option>
              ))}
            </select>
          </div>
          {hasActiveFilters && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn-outline btn-sm" onClick={resetFilters}><RotateCcw size={11} /> Reset</button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 10, color: 'var(--c-text-3)' }}>
          <div className="spinner" /><span style={{ fontSize: 13 }}>Loading servers…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 24 }}>
          {servers.length === 0 ? 'No servers tracked yet. Add red team infrastructure to monitor here.' : 'No servers match your filters.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>IP / Hostname</th>
                <th>Purpose</th>
                <th>Status</th>
                <th>Health</th>
                <th>Provider</th>
                <th>Purchase / Expiry</th>
                <th>Engagement</th>
                <th>Tags</th>
                <th style={{ width: 70 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const days = daysUntil(s.expiry_date)
                const expirySoon = days !== null && days >= 0 && days < 30
                const isExpired = days !== null && days < 0
                const notesExpanded = expandedNotes.has(s.id)
                return (
                  <>
                    <tr key={s.id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--c-text-1)' }}>
                              {s.ip_address || s.hostname || '—'}
                            </span>
                            {s.notes && (
                              <button
                                className="btn-icon"
                                style={{ color: notesExpanded ? 'var(--c-green)' : 'var(--c-text-3)', padding: 2 }}
                                onClick={() => toggleNotes(s.id)}
                                title={notesExpanded ? 'Hide notes' : 'Show notes'}
                              >
                                {notesExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                              </button>
                            )}
                          </div>
                          {s.ip_address && s.hostname && (
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--c-text-3)' }}>{s.hostname}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--c-text-2)', padding: '2px 8px', borderRadius: 3, fontSize: 11, fontWeight: 500 }}>
                          {s.purpose}
                        </span>
                      </td>
                      <td>
                        <StatusPill value={s.status} color={STATUS_COLOR[s.status]} bg={STATUS_BG[s.status]} />
                      </td>
                      <td><HealthPill value={s.health_status} /></td>
                      <td style={{ fontSize: 12, color: 'var(--c-text-3)' }}>{s.server_provider || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {s.purchase_date && (
                            <span style={{ fontSize: 11, color: 'var(--c-text-3)' }}>
                              <span style={{ opacity: 0.6 }}>Acq </span>{fmtDate(s.purchase_date)}
                            </span>
                          )}
                          {s.expiry_date ? (
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: isExpired ? '#ff9090' : expirySoon ? '#ffe07a' : 'var(--c-text-2)' }}>
                              <span style={{ opacity: 0.6, fontFamily: 'var(--sans, inherit)' }}>Exp </span>
                              {fmtDate(s.expiry_date)}
                              {days !== null && (
                                <span style={{ marginLeft: 5, color: isExpired ? '#ff9090' : expirySoon ? '#ffe07a' : 'var(--c-text-3)' }}>
                                  ({isExpired ? `${Math.abs(days)}d ago` : `${days}d`})
                                </span>
                              )}
                            </span>
                          ) : (
                            !s.purchase_date && <span style={{ color: 'var(--c-text-3)' }}>—</span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--c-text-2)' }}>{s.engagement || '—'}</td>
                      <td style={{ fontSize: 11, color: 'var(--c-text-3)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.tags || '—'}</td>
                      <td>
                        <div className="data-table-actions">
                          <button className="btn-icon" onClick={() => openEdit(s)} title="Edit"><Pencil size={11} /></button>
                          <button className="btn-icon" style={{ color: 'var(--c-red)' }} onClick={() => handleDelete(s.id)} title="Delete"><Trash2 size={11} /></button>
                        </div>
                      </td>
                    </tr>
                    {notesExpanded && s.notes && (
                      <tr key={`${s.id}-notes`} style={{ background: 'rgba(26,158,106,0.04)' }}>
                        <td colSpan={9} style={{ padding: '8px 16px 10px 20px', borderTop: 'none' }}>
                          <div style={{ fontSize: 12, color: 'var(--c-text-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', borderLeft: '2px solid var(--c-green)', paddingLeft: 10 }}>
                            {s.notes}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit Server' : 'Add Server'} maxWidth="620px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="field-label">IP Address</label>
              <input className="field field-mono" placeholder="10.10.14.5" value={form.ip_address} onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))} autoFocus />
            </div>
            <div>
              <label className="field-label">Hostname</label>
              <input className="field field-mono" placeholder="c2.example.com" value={form.hostname} onChange={e => setForm(f => ({ ...f, hostname: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Purpose</label>
              <select className="field" value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}>
                {PURPOSES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Status</label>
              <select className="field" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ServerStatus }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Health Status</label>
              <select className="field" value={form.health_status} onChange={e => setForm(f => ({ ...f, health_status: e.target.value as HealthStatus }))}>
                {(['healthy', 'unknown', 'unhealthy', 'burned'] as HealthStatus[]).map(h => (
                  <option key={h} value={h}>{h.charAt(0).toUpperCase() + h.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Provider</label>
              <select className="field" value={form.server_provider} onChange={e => setForm(f => ({ ...f, server_provider: e.target.value }))}>
                <option value="">— Select —</option>
                {PROVIDERS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Purchase / Acquisition Date</label>
              <input type="date" className="field" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Subscription Expiry</label>
              <input type="date" className="field" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Linked Engagement</label>
              <input className="field" placeholder="RS-2026-042" value={form.engagement} onChange={e => setForm(f => ({ ...f, engagement: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="field-label">Tags</label>
            <input className="field" placeholder="cobalt-strike, http-listener, … (comma-separated)" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Notes</label>
            <textarea className="field" rows={3} style={{ resize: 'vertical' }} placeholder="Setup notes, credentials, usage details…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || (!form.ip_address.trim() && !form.hostname.trim())}>
              {editTarget ? 'Save Changes' : 'Add Server'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
