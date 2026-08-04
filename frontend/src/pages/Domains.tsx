import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Globe, Pencil, Trash2, Search, AlertTriangle, CheckCircle,
  XCircle, Heart, HelpCircle, ChevronDown, ChevronUp, RotateCcw
} from 'lucide-react'
import Modal from '../components/Modal'
import { api } from '../api'
import { useSearchParams } from 'react-router-dom'

type DomainStatus = 'active' | 'expired' | 'burned' | 'parked'
type WhoisStatus = 'enabled' | 'disabled'
type HealthStatus = 'healthy' | 'unknown' | 'unhealthy' | 'burned'

interface Domain {
  id: number
  domain: string
  registrar: string
  purchase_date: string
  expiry_date: string
  auto_renew: boolean
  purpose: string
  status: DomainStatus
  whois_status: WhoisStatus
  health_status: HealthStatus
  reset_dns: boolean
  dns_provider: string
  notes: string
  engagement: string
  project_id: number | null
}

const PURPOSES = ['C2', 'Phishing', 'Redirector', 'Infrastructure', 'Scope', 'Monitoring', 'Other']
const DNS_PROVIDERS = ['Cloudflare', 'Route 53', 'Namecheap DNS', 'Google Domains', 'Porkbun', 'GoDaddy', 'Other']

const STATUS_STYLES: Record<DomainStatus, { color: string; bg: string; icon: React.ReactNode }> = {
  active:  { color: 'var(--c-green-text)',  bg: 'var(--c-green-dim)',            icon: <CheckCircle size={10} /> },
  expired: { color: 'var(--c-text-3)',       bg: 'rgba(255,255,255,0.05)',        icon: <XCircle size={10} /> },
  burned:  { color: '#ff9090',              bg: 'rgba(217,94,94,0.12)',          icon: <AlertTriangle size={10} /> },
  parked:  { color: 'var(--c-text-2)',       bg: 'rgba(255,255,255,0.05)',        icon: <Globe size={10} /> },
}

const HEALTH_STYLES: Record<HealthStatus, { color: string; bg: string; icon: React.ReactNode }> = {
  healthy:   { color: 'var(--c-green-text)', bg: 'var(--c-green-dim)',   icon: <Heart size={10} /> },
  unknown:   { color: 'var(--c-text-3)',      bg: 'rgba(255,255,255,0.05)', icon: <HelpCircle size={10} /> },
  unhealthy: { color: '#ffe07a',             bg: 'rgba(255,224,122,0.1)', icon: <AlertTriangle size={10} /> },
  burned:    { color: '#ff9090',             bg: 'rgba(217,94,94,0.12)', icon: <XCircle size={10} /> },
}

const EMPTY: Omit<Domain, 'id'> = {
  domain: '', registrar: '', purchase_date: '', expiry_date: '',
  auto_renew: false, purpose: 'Infrastructure', status: 'active',
  whois_status: 'enabled', health_status: 'healthy', reset_dns: false,
  dns_provider: '', notes: '', engagement: '', project_id: null,
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

function StatusPill({ value, styles }: { value: string; styles: { color: string; bg: string; icon: React.ReactNode } }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      color: styles.color, background: styles.bg,
    }}>
      {styles.icon}{value}
    </span>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 32, height: 18, borderRadius: 9, flexShrink: 0, position: 'relative', cursor: 'pointer',
          background: checked ? 'var(--c-green)' : 'var(--c-border)',
          transition: 'background 0.15s',
        }}
      >
        <div style={{
          position: 'absolute', top: 2, left: checked ? 16 : 2, width: 14, height: 14,
          borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
        }} />
      </div>
      <span style={{ fontSize: 12, color: 'var(--c-text-2)' }}>{label}</span>
    </label>
  )
}

export default function Domains() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [purposeFilter, setPurposeFilter] = useState('all')
  const [dnsFilter, setDnsFilter] = useState('all')
  const [healthFilter, setHealthFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Domain | null>(null)
  const [form, setForm] = useState<Omit<Domain, 'id'>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set())
  const [searchParams, setSearchParams] = useSearchParams()

  const load = useCallback(async () => {
    try { setDomains(await api.domains.list()) }
    catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (searchParams.get('new') === '1') { openCreate(); setSearchParams({}) }
  }, [searchParams, setSearchParams])

  const openCreate = () => { setEditTarget(null); setForm(EMPTY); setModalOpen(true) }
  const openEdit = (d: Domain) => {
    setEditTarget(d)
    setForm({
      domain: d.domain, registrar: d.registrar, purchase_date: d.purchase_date,
      expiry_date: d.expiry_date, auto_renew: d.auto_renew, purpose: d.purpose,
      status: d.status, whois_status: d.whois_status, health_status: d.health_status,
      reset_dns: d.reset_dns, dns_provider: d.dns_provider, notes: d.notes,
      engagement: d.engagement, project_id: d.project_id,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.domain.trim()) return
    setSaving(true)
    try {
      if (editTarget) {
        const updated = await api.domains.update(editTarget.id, form)
        setDomains(prev => prev.map(d => d.id === editTarget.id ? updated : d))
      } else {
        const created = await api.domains.create(form)
        setDomains(prev => [...prev, created])
      }
      setModalOpen(false)
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this domain?')) return
    try { await api.domains.delete(id); setDomains(prev => prev.filter(d => d.id !== id)) }
    catch { /* ignore */ }
  }

  const resetFilters = () => { setSearch(''); setStatusFilter('all'); setPurposeFilter('all'); setDnsFilter('all'); setHealthFilter('all') }
  const hasActiveFilters = search || statusFilter !== 'all' || purposeFilter !== 'all' || dnsFilter !== 'all' || healthFilter !== 'all'

  // Unique DNS providers present in data
  const dnsOptions = Array.from(new Set(domains.map(d => d.dns_provider).filter(Boolean))).sort()

  const filtered = domains.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false
    if (purposeFilter !== 'all' && d.purpose !== purposeFilter) return false
    if (dnsFilter !== 'all' && d.dns_provider !== dnsFilter) return false
    if (healthFilter !== 'all' && d.health_status !== healthFilter) return false
    const q = search.toLowerCase()
    if (q && !d.domain.toLowerCase().includes(q) && !d.registrar.toLowerCase().includes(q) &&
        !d.engagement.toLowerCase().includes(q) && !d.notes.toLowerCase().includes(q) &&
        !d.dns_provider.toLowerCase().includes(q)) return false
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
          <span className="page-header-title">Domain Tracker</span>
          <span className="page-header-count">{domains.length} tracked</span>
        </div>
        <div className="page-header-right">
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-3)', pointerEvents: 'none' }} />
            <input className="field" style={{ paddingLeft: 30, height: 32, width: 200, fontSize: 12 }} placeholder="Search domains…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={openCreate}><Plus size={13} /> Add Domain</button>
        </div>
      </div>

      {/* Filter bar */}
      <div
        className="filter-bar"
        onClick={() => setFilterOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="filter-bar-title">Domain Filters</span>
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
              {(['active', 'parked', 'expired', 'burned'] as DomainStatus[]).map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
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
            <label className="field-label">DNS Provider</label>
            <select className="field" value={dnsFilter} onChange={e => setDnsFilter(e.target.value)}>
              <option value="all">All providers</option>
              {dnsOptions.map(p => <option key={p} value={p}>{p}</option>)}
              {!dnsOptions.length && DNS_PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
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
          <div className="spinner" /> <span style={{ fontSize: 13 }}>Loading domains…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 24 }}>
          {domains.length === 0 ? 'No domains tracked yet. Add operational or client domains to track them here.' : 'No domains match your filters.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Domain</th>
                <th>Purpose</th>
                <th>Status</th>
                <th>Health</th>
                <th>WHOIS</th>
                <th>DNS Provider</th>
                <th>Purchase / Expiry</th>
                <th>Auto Renew</th>
                <th>Engagement</th>
                <th style={{ width: 70 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const days = daysUntil(d.expiry_date)
                const expirySoon = days !== null && days >= 0 && days < 30
                const isExpired = days !== null && days < 0
                const notesExpanded = expandedNotes.has(d.id)
                return (
                  <>
                    <tr key={d.id} style={{ verticalAlign: 'middle' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--c-purple-text)' }}>
                            {d.domain}
                          </span>
                          {d.notes && (
                            <button
                              className="btn-icon"
                              style={{ color: notesExpanded ? 'var(--c-green)' : 'var(--c-text-3)', padding: 2 }}
                              onClick={() => toggleNotes(d.id)}
                              title={notesExpanded ? 'Hide notes' : 'Show notes'}
                            >
                              {notesExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--c-text-2)', padding: '2px 8px', borderRadius: 3, fontSize: 11, fontWeight: 500 }}>
                          {d.purpose}
                        </span>
                      </td>
                      <td><StatusPill value={d.status} styles={STATUS_STYLES[d.status]} /></td>
                      <td><StatusPill value={d.health_status} styles={HEALTH_STYLES[d.health_status]} /></td>
                      <td>
                        <span style={{ fontSize: 11, color: d.whois_status === 'enabled' ? 'var(--c-green-text)' : 'var(--c-text-3)' }}>
                          {d.whois_status === 'enabled' ? '✓ Enabled' : '✗ Disabled'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--c-text-2)' }}>{d.dns_provider || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {d.purchase_date && (
                            <span style={{ fontSize: 11, color: 'var(--c-text-3)' }}>
                              <span style={{ opacity: 0.6 }}>Bought </span>{fmtDate(d.purchase_date)}
                            </span>
                          )}
                          {d.expiry_date ? (
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: isExpired ? '#ff9090' : expirySoon ? '#ffe07a' : 'var(--c-text-2)' }}>
                              <span style={{ opacity: 0.6, fontFamily: 'var(--sans, inherit)' }}>Exp </span>
                              {fmtDate(d.expiry_date)}
                              {days !== null && (
                                <span style={{ marginLeft: 5, color: isExpired ? '#ff9090' : expirySoon ? '#ffe07a' : 'var(--c-text-3)' }}>
                                  ({isExpired ? `${Math.abs(days)}d ago` : `${days}d`})
                                </span>
                              )}
                            </span>
                          ) : (
                            !d.purchase_date && <span style={{ color: 'var(--c-text-3)' }}>—</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, color: d.auto_renew ? 'var(--c-green-text)' : 'var(--c-text-3)' }}>
                          {d.auto_renew ? '✓ Yes' : '✗ No'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--c-text-2)' }}>{d.engagement || '—'}</td>
                      <td>
                        <div className="data-table-actions">
                          <button className="btn-icon" onClick={() => openEdit(d)} title="Edit"><Pencil size={11} /></button>
                          <button className="btn-icon" style={{ color: 'var(--c-red)' }} onClick={() => handleDelete(d.id)} title="Delete"><Trash2 size={11} /></button>
                        </div>
                      </td>
                    </tr>
                    {notesExpanded && d.notes && (
                      <tr key={`${d.id}-notes`} style={{ background: 'rgba(26,158,106,0.04)' }}>
                        <td colSpan={10} style={{ padding: '8px 16px 10px 20px', borderTop: 'none' }}>
                          <div style={{ fontSize: 12, color: 'var(--c-text-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', borderLeft: '2px solid var(--c-green)', paddingLeft: 10 }}>
                            {d.notes}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit Domain' : 'Add Domain'} maxWidth="640px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="field-label">Domain *</label>
            <input className="field field-mono" placeholder="strike.example.com" value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} autoFocus />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="field-label">Purpose</label>
              <select className="field" value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}>
                {PURPOSES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Status</label>
              <select className="field" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as DomainStatus }))}>
                {(['active', 'parked', 'expired', 'burned'] as DomainStatus[]).map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
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
              <label className="field-label">WHOIS Privacy</label>
              <select className="field" value={form.whois_status} onChange={e => setForm(f => ({ ...f, whois_status: e.target.value as WhoisStatus }))}>
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <div>
              <label className="field-label">Registrar</label>
              <input className="field" placeholder="Namecheap" value={form.registrar} onChange={e => setForm(f => ({ ...f, registrar: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">DNS Provider</label>
              <input className="field" placeholder="Cloudflare" value={form.dns_provider} onChange={e => setForm(f => ({ ...f, dns_provider: e.target.value }))} list="dns-providers" />
              <datalist id="dns-providers">{DNS_PROVIDERS.map(p => <option key={p} value={p} />)}</datalist>
            </div>
            <div>
              <label className="field-label">Purchase Date</label>
              <input type="date" className="field" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Expiry Date</label>
              <input type="date" className="field" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Linked Engagement</label>
              <input className="field" placeholder="RS-2026-042" value={form.engagement} onChange={e => setForm(f => ({ ...f, engagement: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, paddingTop: 4 }}>
            <Toggle checked={form.auto_renew} onChange={v => setForm(f => ({ ...f, auto_renew: v }))} label="Auto Renew" />
            <Toggle checked={form.reset_dns} onChange={v => setForm(f => ({ ...f, reset_dns: v }))} label="Reset DNS on use" />
          </div>
          <div>
            <label className="field-label">Notes</label>
            <textarea className="field" rows={3} style={{ resize: 'vertical' }} placeholder="Purchased for phishing campaign, categorized as news…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.domain.trim()}>
              {editTarget ? 'Save Changes' : 'Add Domain'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
