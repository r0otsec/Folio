import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Plus, Trash2, Loader2, AlertTriangle, ChevronRight, Archive, CheckCircle, RotateCcw, ChevronLeft, X, BookOpen, ArrowRight } from 'lucide-react'
import { api } from '../api'
import type { ProjectSummary } from '../types'
import { useAuth } from '../auth'

const WELCOME_KEY = 'folio_welcome_dismissed'

function WelcomeBanner() {
  const { user } = useAuth()
  const [visible, setVisible] = useState(() => !localStorage.getItem(WELCOME_KEY))

  const dismiss = () => {
    localStorage.setItem(WELCOME_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  const name = user?.display_name || user?.username || 'there'

  return (
    <div style={{
      margin: '16px 24px 0',
      borderRadius: 8,
      background: 'linear-gradient(135deg, rgba(145,132,217,0.12) 0%, rgba(26,125,217,0.08) 100%)',
      border: '1px solid rgba(145,132,217,0.25)',
      borderLeft: '4px solid #9184d9',
      padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{
        flexShrink: 0, width: 38, height: 38, borderRadius: 8,
        background: 'rgba(145,132,217,0.15)', border: '1px solid rgba(145,132,217,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#9184d9',
      }}>
        <BookOpen size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-1)', marginBottom: 2 }}>
          Welcome to Folio, {name}!
        </div>
        <div style={{ fontSize: 13, color: 'var(--c-text-3)', lineHeight: 1.5 }}>
          New here? The Wiki covers everything — engagements, findings, severity ratings, PDF generation, and more.
        </div>
      </div>
      <Link to="/wiki" onClick={dismiss} style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 14px', borderRadius: 6,
        background: '#9184d9', color: '#fff',
        fontSize: 12, fontWeight: 600, textDecoration: 'none',
        whiteSpace: 'nowrap', transition: 'opacity 0.15s',
      }}>
        Go to Wiki <ArrowRight size={12} />
      </Link>
      <button onClick={dismiss} style={{
        flexShrink: 0, background: 'none', border: 'none',
        color: 'var(--c-text-3)', cursor: 'pointer', padding: 4,
        display: 'flex', alignItems: 'center', borderRadius: 4,
        transition: 'color 0.12s',
      }}>
        <X size={15} />
      </button>
    </div>
  )
}

const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'informational'] as const

function NewEngagementModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (id: number) => void
}) {
  const [name, setName] = useState('')
  const [clientName, setClientName] = useState('')
  const [reportId, setReportId] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) { setName(''); setClientName(''); setReportId(''); setError('') }
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  const handleCreate = async () => {
    if (!name.trim()) return
    setCreating(true); setError('')
    try {
      const p = await api.projects.create({ name: name.trim(), report_id: reportId, client_name: clientName || name })
      onCreated(p.id)
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed')
    } finally { setCreating(false) }
  }

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <div className="modal-header">
          <div>
            <div className="modal-title">New Engagement</div>
            <div className="modal-subtitle">Create a new penetration test engagement</div>
          </div>
          <button className="btn-icon" onClick={onClose} style={{ fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="field-label">Engagement Name *</label>
            <input
              autoFocus
              className="field"
              placeholder="ACME Corp — Internal Infrastructure"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="field-label">Client Name</label>
              <input className="field" placeholder="ACME Corporation" value={clientName} onChange={e => setClientName(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Report ID</label>
              <input className="field field-mono" placeholder="RS-2026-001" value={reportId} onChange={e => setReportId(e.target.value)} />
            </div>
          </div>
          {error && <div className="error-box"><AlertTriangle size={13} />{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating && <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} />}
            {creating ? 'Creating…' : 'Create Engagement'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Timeline helpers ───────────────────────────────────────────────────────────
function getWeekDays(anchor: Date) {
  const d = new Date(anchor)
  d.setDate(d.getDate() - d.getDay() + 1) // Monday
  return Array.from({ length: 7 }, (_, i) => { const day = new Date(d); day.setDate(d.getDate() + i); return day })
}

function fmtDay(d: Date) { return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }) }
function fmtWeekRange(days: Date[]) {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  return `${days[0].toLocaleDateString('en-GB', opts)} – ${days[6].toLocaleDateString('en-GB', opts)}`
}

// Parse YYYY-MM-DD as local midnight, not UTC
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function ProjectTimeline({ projects, onNavigate }: { projects: ProjectSummary[]; onNavigate: (id: number) => void }) {
  const todayMidnight = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
  const [anchor, setAnchor] = useState(todayMidnight)
  const today = todayMidnight()

  const days = getWeekDays(anchor)
  const weekStart = new Date(days[0]); weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(days[6]); weekEnd.setHours(23, 59, 59, 999)

  const prev = () => { const d = new Date(anchor); d.setDate(d.getDate() - 7); setAnchor(d) }
  const next = () => { const d = new Date(anchor); d.setDate(d.getDate() + 7); setAnchor(d) }
  const goToday = () => setAnchor(todayMidnight())

  const isOverdue = (p: ProjectSummary) =>
    p.status === 'active' && !!p.assessment_end && parseLocalDate(p.assessment_end) < today

  const visible = projects.filter(p => {
    if (p.status === 'archived') return false
    if (!p.assessment_start && !p.assessment_end) return false
    const s = p.assessment_start ? parseLocalDate(p.assessment_start) : parseLocalDate(p.assessment_end!)
    const e = p.assessment_end ? parseLocalDate(p.assessment_end) : parseLocalDate(p.assessment_start!)
    return s <= weekEnd && e >= weekStart
  })

  const getBar = (p: ProjectSummary) => {
    const s = p.assessment_start ? parseLocalDate(p.assessment_start) : parseLocalDate(p.assessment_end!)
    const e = p.assessment_end ? parseLocalDate(p.assessment_end) : parseLocalDate(p.assessment_start!)
    const totalMs = weekEnd.getTime() - weekStart.getTime()
    const clampedS = s < weekStart ? weekStart : s
    const clampedE = e > weekEnd ? weekEnd : e
    const leftPct = ((clampedS.getTime() - weekStart.getTime()) / totalMs) * 100
    const rightPct = ((weekEnd.getTime() - clampedE.getTime()) / totalMs) * 100
    const startClipped = s < weekStart
    const endClipped = e > weekEnd
    return {
      left: `${leftPct}%`,
      right: `${rightPct}%`,
      borderRadius: `${startClipped ? 0 : 4}px ${endClipped ? 0 : 4}px ${endClipped ? 0 : 4}px ${startClipped ? 0 : 4}px`,
    }
  }

  const todayColPct = (() => {
    const idx = days.findIndex(d => d.toDateString() === today.toDateString())
    return idx >= 0 ? ((idx + 0.5) / 7) * 100 : null
  })()

  return (
    <div style={{ borderBottom: '1px solid var(--c-border)' }}>
      {/* Timeline header */}
      <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface)' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 4 }}>Engagement Timeline</span>
        <span style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={goToday} style={{ fontSize: 11 }}>Today</button>
        <button className="btn-icon" onClick={prev}><ChevronLeft size={14} /></button>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-1)', minWidth: 220, textAlign: 'center' }}>{fmtWeekRange(days)}</span>
        <button className="btn-icon" onClick={next}><ChevronRight size={14} /></button>
      </div>

      {/* Timeline body */}
      <div style={{ background: 'var(--c-surface)', padding: '0 20px 10px' }}>
        {/* Day header row */}
        <div style={{ display: 'flex', marginLeft: 160, borderBottom: '1px solid var(--c-border)', marginBottom: 2 }}>
          {days.map((d, i) => {
            const isToday = d.toDateString() === today.toDateString()
            return (
              <div key={i} style={{ flex: 1, textAlign: 'center', padding: '7px 2px 5px', fontSize: 10, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--c-green-text)' : 'var(--c-text-3)', position: 'relative' }}>
                {fmtDay(d)}
                {isToday && <div style={{ position: 'absolute', bottom: -1, left: '10%', right: '10%', height: 2, background: 'var(--c-green)', borderRadius: 1 }} />}
              </div>
            )
          })}
        </div>

        {visible.length === 0 ? (
          <div style={{ padding: '18px 0 8px', textAlign: 'center', fontSize: 12, color: 'var(--c-text-3)' }}>
            No engagements with assessment dates this week.{' '}
            <span style={{ color: 'var(--c-green-text)', cursor: 'pointer', textDecoration: 'underline' }} onClick={goToday}>Jump to today</span>
          </div>
        ) : visible.map(p => {
          const overdue = isOverdue(p)
          const bar = getBar(p)
          const barColor = overdue ? 'var(--c-amber)' : p.status === 'complete' ? 'rgba(110,110,130,0.55)' : 'var(--c-green)'
          return (
            <div
              key={p.id}
              onClick={() => onNavigate(p.id)}
              style={{ display: 'flex', alignItems: 'center', height: 32, borderBottom: '1px solid var(--c-border)', cursor: 'pointer' }}
            >
              {/* Name label */}
              <div title={p.client_name || p.name} style={{ width: 160, flexShrink: 0, paddingRight: 12, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: overdue ? 'var(--c-amber)' : 'var(--c-text-2)', display: 'flex', alignItems: 'center', gap: 5 }}>
                {overdue && <AlertTriangle size={9} style={{ flexShrink: 0, color: 'var(--c-amber)' }} />}
                {p.client_name || p.name}
              </div>
              {/* Bar area */}
              <div style={{ flex: 1, position: 'relative', height: '100%' }}>
                {/* Day dividers */}
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} style={{ position: 'absolute', left: `${(i / 7) * 100}%`, top: 0, bottom: 0, width: 1, background: 'var(--c-border)' }} />
                ))}
                {/* Today marker */}
                {todayColPct !== null && (
                  <div style={{ position: 'absolute', left: `${todayColPct}%`, top: 0, bottom: 0, width: 1, background: 'var(--c-green)', opacity: 0.35 }} />
                )}
                {/* Project bar */}
                <div style={{
                  position: 'absolute', top: '18%', bottom: '18%',
                  left: bar.left, right: bar.right,
                  background: barColor,
                  borderRadius: bar.borderRadius,
                  display: 'flex', alignItems: 'center',
                  overflow: 'hidden', minWidth: 4,
                }}>
                  <span style={{ fontSize: 9, color: '#fff', fontWeight: 700, padding: '0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1, opacity: 0.95 }}>
                    {p.client_name || p.name}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('new') === '1') { setModalOpen(true); setSearchParams({}) }
  }, [searchParams, setSearchParams])

  const load = useCallback(async () => {
    try { setProjects(await api.projects.list()) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (!confirm('Permanently delete this engagement?')) return
    await api.projects.delete(id)
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  const handleStatus = async (e: React.MouseEvent, id: number, status: string) => {
    e.stopPropagation()
    await api.projects.update(id, { status })
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status: status as ProjectSummary['status'] } : p))
  }

  const filtered = projects.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.client_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalCritical = projects.reduce((a, p) => a + (p.risk_counts.critical || 0), 0)
  const totalHigh = projects.reduce((a, p) => a + (p.risk_counts.high || 0), 0)
  const activeCount = projects.filter(p => p.status === 'active').length

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const overdueProjects = projects.filter(p =>
    p.status === 'active' && !!p.assessment_end && parseLocalDate(p.assessment_end) < today
  )

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      <WelcomeBanner />

      <div className="page-header">
        <div className="page-header-left">
          <span className="page-header-title">Dashboard</span>
          <span className="page-header-count">{projects.length} engagements</span>
        </div>
        <div className="page-header-right">
          <div style={{ position: 'relative' }}>
            <input className="field" style={{ paddingLeft: 10, height: 32, width: 200, fontSize: 12 }}
              placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="field" style={{ height: 32, fontSize: 12, width: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="complete">Complete</option>
            <option value="archived">Archived</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}>
            <Plus size={13} /> New Engagement
          </button>
        </div>
      </div>

      {/* Stats strip */}
      {projects.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, borderBottom: '1px solid var(--c-border)', background: 'var(--c-border)' }}>
          {[
            { label: 'Total', value: projects.length, sub: 'engagements' },
            { label: 'Active', value: activeCount, sub: 'in progress', accent: true },
            { label: 'Critical', value: totalCritical, sub: `+ ${totalHigh} high` },
            { label: 'Complete', value: projects.filter(p => p.status === 'complete').length, sub: 'engagements' },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ borderRadius: 0, border: 'none' }}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={s.accent ? { color: 'var(--c-green-text)' } : {}}>{s.value}</div>
              <div className="stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Engagement timeline */}
      {projects.length > 0 && <ProjectTimeline projects={projects} onNavigate={id => navigate(`/engagements/${id}`)} />}

      {/* Overdue banner */}
      {overdueProjects.length > 0 && (
        <div style={{ margin: '14px 20px 0', padding: '11px 16px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.28)', borderRadius: 6, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <AlertTriangle size={14} style={{ color: 'var(--c-amber)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-amber)' }}>
              {overdueProjects.length} engagement{overdueProjects.length !== 1 ? 's' : ''} past assessment end date and not yet marked complete
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
              {overdueProjects.map(p => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/engagements/${p.id}`)}
                  style={{ fontSize: 11, color: 'var(--c-amber)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 4, padding: '2px 9px', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {p.client_name || p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Engagements table */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 10, color: 'var(--c-text-3)' }}>
          <div className="spinner" /> <span style={{ fontSize: 13 }}>Loading…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 24 }}>
          {projects.length === 0
            ? 'No engagements yet. Create one above to get started.'
            : 'No engagements match your filters.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Report ID</th>
                <th>Status</th>
                <th>Critical</th>
                <th>High</th>
                <th>Med</th>
                <th>Low</th>
                <th>Updated</th>
                <th style={{ width: 130 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/engagements/${p.id}`)}>
                  <td className="td-primary" style={{ fontWeight: 500 }}>{p.client_name || p.name}</td>
                  <td className="td-mono">{p.report_id || '—'}</td>
                  <td><span className={`status-dot status-${p.status}`}>{p.status}</span></td>
                  <td>{(p.risk_counts.critical || 0) > 0 ? <span className="badge badge-critical">{p.risk_counts.critical}</span> : <span style={{ color: 'var(--c-text-3)' }}>—</span>}</td>
                  <td>{(p.risk_counts.high || 0) > 0 ? <span className="badge badge-high">{p.risk_counts.high}</span> : <span style={{ color: 'var(--c-text-3)' }}>—</span>}</td>
                  <td>{(p.risk_counts.medium || 0) > 0 ? <span className="badge badge-medium">{p.risk_counts.medium}</span> : <span style={{ color: 'var(--c-text-3)' }}>—</span>}</td>
                  <td>{(p.risk_counts.low || 0) > 0 ? <span className="badge badge-low">{p.risk_counts.low}</span> : <span style={{ color: 'var(--c-text-3)' }}>—</span>}</td>
                  <td style={{ fontSize: 11, color: 'var(--c-text-3)' }}>{fmtDate(p.updated_at)}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="data-table-actions">
                      {p.status !== 'complete' && (
                        <button className="btn-icon" title="Mark complete" style={{ color: 'var(--c-green-text)' }} onClick={e => handleStatus(e, p.id, 'complete')}>
                          <CheckCircle size={12} />
                        </button>
                      )}
                      {p.status !== 'archived' && (
                        <button className="btn-icon" title="Archive" style={{ color: 'var(--c-text-3)' }} onClick={e => handleStatus(e, p.id, 'archived')}>
                          <Archive size={12} />
                        </button>
                      )}
                      {p.status !== 'active' && (
                        <button className="btn-icon" title="Reactivate" style={{ color: 'var(--c-purple-text)' }} onClick={e => handleStatus(e, p.id, 'active')}>
                          <RotateCcw size={12} />
                        </button>
                      )}
                      <button className="btn-icon" title="Delete" style={{ color: 'var(--c-red)' }} onClick={e => handleDelete(e, p.id)}>
                        <Trash2 size={12} />
                      </button>
                      <ChevronRight size={13} style={{ color: 'var(--c-text-3)' }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewEngagementModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={id => { setModalOpen(false); navigate(`/engagements/${id}`) }}
      />
    </div>
  )
}
