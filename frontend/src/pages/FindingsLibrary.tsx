import { useState, useEffect, useMemo } from 'react'
import { Plus, Search, Trash2, ChevronDown, ArrowLeft, X } from 'lucide-react'
import type { Severity } from '../types'
import { api } from '../api'
import type { Template } from '../api'
import SeverityBadge from '../components/SeverityBadge'

const SEV_OPTIONS: Severity[] = ['critical', 'high', 'medium', 'low', 'informational']
const SEV_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 }

const CATEGORIES = [
  'Web Application', 'API', 'Network', 'Infrastructure',
  'Cloud', 'Physical', 'Social Engineering', 'Mobile', 'Wireless',
  'Source Code Review', 'C# / .NET', 'Java', 'Python', 'Go',
  'AngularJS / Angular', 'Thick Client',
  'AWS / Cloud', 'Azure / Cloud', 'WiFi', 'Other',
  'Red Team', 'External Infrastructure', 'Internal Infrastructure',
]

export default function FindingsLibrary() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCats, setFilterCats] = useState<Set<string>>(new Set())
  const [filterSevs, setFilterSevs] = useState<Set<string>>(new Set())
  const [editorOpen, setEditorOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Template | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', severity: 'high' as Severity, category: 'Web Application',
    description: '', impact: '', recommendations: '', tags: '',
    cvss_score: '', cvss_vector: '',
  })
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [collapsedSevs, setCollapsedSevs] = useState<Set<string>>(new Set())

  const loadTemplates = async () => {
    setLoading(true)
    try { setTemplates(await api.templates.list()) } catch { /* leave empty */ }
    finally { setLoading(false) }
  }

  useEffect(() => { loadTemplates() }, [])

  useEffect(() => {
    if (editorOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [editorOpen])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && editorOpen) closeEditor() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [editorOpen])

  const openCreate = () => {
    setEditTarget(null)
    setForm({ title: '', severity: 'high', category: 'Web Application', description: '', impact: '', recommendations: '', tags: '', cvss_score: '', cvss_vector: '' })
    setEditorOpen(true)
  }

  const openEdit = (t: Template) => {
    setEditTarget(t)
    setForm({
      title: t.title, severity: t.severity as Severity, category: t.category,
      description: t.description, impact: t.impact ?? '', recommendations: t.recommendations,
      tags: t.tags.join(', '),
      cvss_score: t.cvss_score != null ? String(t.cvss_score) : '',
      cvss_vector: t.cvss_vector ?? '',
    })
    setEditorOpen(true)
  }

  const closeEditor = () => setEditorOpen(false)

  const handleSave = async () => {
    setSaving(true)
    const rawScore = parseFloat(form.cvss_score)
    const payload = {
      title: form.title,
      severity: form.severity,
      category: form.category,
      description: form.description,
      impact: form.impact.trim(),
      recommendations: form.recommendations,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      cvss_score: form.cvss_score.trim() !== '' && !isNaN(rawScore) ? Math.min(10, Math.max(0, rawScore)) : null,
      cvss_vector: form.cvss_vector.trim(),
    }
    try {
      if (editTarget) {
        await api.templates.update(editTarget.id, payload)
      } else {
        await api.templates.create(payload)
      }
      await loadTemplates()
      setEditorOpen(false)
    } catch { /* keep editor open on error */ }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    try {
      await api.templates.delete(id)
      setConfirmDelete(null)
      await loadTemplates()
    } catch { /* ignore */ }
  }

  const toggleSev = (sev: string) =>
    setCollapsedSevs(prev => { const n = new Set(prev); n.has(sev) ? n.delete(sev) : n.add(sev); return n })

  const allCategories = useMemo(() => [...new Set(templates.map(t => t.category))].sort(), [templates])

  const toggleCat = (cat: string) =>
    setFilterCats(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n })

  const toggleSevFilter = (sev: string) =>
    setFilterSevs(prev => { const n = new Set(prev); n.has(sev) ? n.delete(sev) : n.add(sev); return n })

  const clearAllFilters = () => { setFilterCats(new Set()); setFilterSevs(new Set()); setSearch('') }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return templates
      .filter(t => {
        if (q && !t.title.toLowerCase().includes(q) && !t.category.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false
        if (filterCats.size > 0 && !filterCats.has(t.category)) return false
        if (filterSevs.size > 0 && !filterSevs.has(t.severity)) return false
        return true
      })
      .sort((a, b) => (SEV_RANK[a.severity] ?? 5) - (SEV_RANK[b.severity] ?? 5) || a.title.localeCompare(b.title))
  }, [templates, search, filterCats, filterSevs])

  const grouped = useMemo(() =>
    SEV_OPTIONS.map(sev => ({ sev, items: filtered.filter(t => t.severity === sev) })).filter(g => g.items.length > 0)
  , [filtered])

  // CVSS label helper
  const cvssLabel = (score: string) => {
    const n = parseFloat(score)
    if (!score.trim() || isNaN(n)) return null
    const { label, color } =
      n === 0   ? { label: 'None',     color: '#9ca3af' } :
      n < 4     ? { label: 'Low',      color: '#16a34a' } :
      n < 7     ? { label: 'Medium',   color: '#d97706' } :
      n < 9     ? { label: 'High',     color: '#ea580c' } :
                  { label: 'Critical', color: '#dc2626' }
    return { label, color, n }
  }

  const canSave = form.title.trim() && form.impact.trim()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-header-title">Finding Templates</span>
          <span className="page-header-count">
            {filtered.length !== templates.length ? `${filtered.length} of ${templates.length}` : templates.length} templates
          </span>
        </div>
        <div className="page-header-right">
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={13} /> New Template
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div style={{ padding: '10px 24px 14px', borderBottom: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Search row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', maxWidth: 340, flex: 1 }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-3)', pointerEvents: 'none' }} />
            <input
              className="field"
              style={{ paddingLeft: 30, height: 32, fontSize: 12, width: '100%' }}
              placeholder="Search by name, category, description…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {(filterCats.size > 0 || filterSevs.size > 0 || search) && (
            <button
              onClick={clearAllFilters}
              style={{ fontSize: 11, color: 'var(--c-text-3)', background: 'none', border: '1px solid var(--c-border)', borderRadius: 4, cursor: 'pointer', padding: '4px 10px', whiteSpace: 'nowrap' }}
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Severity filter pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--c-text-3)', fontWeight: 500, flexShrink: 0, marginRight: 2 }}>Severity:</span>
          {(['critical', 'high', 'medium', 'low', 'informational'] as const).map(sev => {
            const COLORS: Record<string, string> = {
              critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#16a34a', informational: '#2563EB',
            }
            const active = filterSevs.has(sev)
            const count = templates.filter(t => t.severity === sev).length
            const bg = COLORS[sev]
            return (
              <button
                key={sev}
                onClick={() => toggleSevFilter(sev)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', fontSize: 11, fontWeight: 500,
                  borderRadius: 20, border: '1px solid',
                  cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 0.12s',
                  background: active ? bg : 'var(--c-surface-2)',
                  color: active ? '#fff' : 'var(--c-text-2)',
                  borderColor: active ? bg : 'var(--c-border-2)',
                }}
              >
                {sev === 'informational' ? 'Info' : sev.charAt(0).toUpperCase() + sev.slice(1)}
                <span style={{ opacity: 0.75, fontSize: 10 }}>({count})</span>
              </button>
            )
          })}
        </div>

        {/* Category filter pills */}
        {allCategories.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--c-text-3)', fontWeight: 500, flexShrink: 0, marginRight: 2 }}>Category:</span>
            {allCategories.map(cat => {
              const active = filterCats.has(cat)
              const count = templates.filter(t => t.category === cat).length
              return (
                <button
                  key={cat}
                  onClick={() => toggleCat(cat)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '3px 10px', fontSize: 11, fontWeight: 500,
                    borderRadius: 20, border: '1px solid',
                    cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 0.12s',
                    background: active ? 'var(--c-purple)' : 'var(--c-surface-2)',
                    color: active ? '#fff' : 'var(--c-text-2)',
                    borderColor: active ? 'var(--c-purple)' : 'var(--c-border-2)',
                  }}
                >
                  {cat}
                  <span style={{ opacity: 0.75, fontSize: 10 }}>({count})</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* List */}
      <div style={{ padding: '16px 24px 32px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 10, color: 'var(--c-text-3)' }}>
            <div className="spinner" /> <span style={{ fontSize: 13 }}>Loading…</span>
          </div>
        ) : grouped.length === 0 ? (
          <div className="empty-state">
            {search || filterCats.size > 0 || filterSevs.size > 0
              ? 'No templates match the current filters.'
              : 'Add your first finding template to get started.'}
          </div>
        ) : (
          grouped.map(({ sev, items }) => {
            const collapsed = collapsedSevs.has(sev)
            return (
              <div key={sev} style={{ marginBottom: 16 }}>
                {/* Severity group header */}
                <button
                  onClick={() => toggleSev(sev)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 0', background: 'none', border: 'none',
                    borderBottom: '1px solid var(--c-border)',
                    cursor: 'pointer', marginBottom: collapsed ? 0 : 8,
                  }}
                >
                  <SeverityBadge severity={sev as Severity} size="xs" />
                  <span style={{ fontSize: 11, color: 'var(--c-text-3)', fontWeight: 500 }}>
                    {items.length} {items.length === 1 ? 'finding' : 'findings'}
                  </span>
                  <ChevronDown size={13} style={{ marginLeft: 'auto', color: 'var(--c-text-3)', transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s' }} />
                </button>

                {/* Cards */}
                {!collapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {items.map(t => (
                      <div
                        key={t.id}
                        style={{
                          background: 'var(--c-surface)',
                          border: `1px solid ${confirmDelete === t.id ? 'var(--c-red)' : 'var(--c-border)'}`,
                          borderRadius: 6, display: 'flex', alignItems: 'stretch',
                          transition: 'border-color 0.15s', overflow: 'hidden',
                        }}
                        onMouseEnter={e => { if (confirmDelete !== t.id) e.currentTarget.style.borderColor = 'var(--c-border-2)' }}
                        onMouseLeave={e => { if (confirmDelete !== t.id) e.currentTarget.style.borderColor = 'var(--c-border)' }}
                      >
                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0, padding: '11px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                            <SeverityBadge severity={t.severity as Severity} size="xs" />
                            <span style={{ background: 'var(--c-surface-2)', color: 'var(--c-text-3)', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', border: '1px solid var(--c-border)' }}>
                              {t.category}
                            </span>
                            {t.cvss_score != null && (
                              <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--c-text-3)' }}>
                                CVSS {Number(t.cvss_score).toFixed(1)}
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)', marginBottom: 3 }}>{t.title}</p>
                          <p style={{ fontSize: 12, color: 'var(--c-text-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}>
                            {t.description}
                          </p>
                          {t.tags.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 7 }}>
                              {t.tags.map(tag => (
                                <span key={tag} style={{ background: 'var(--c-purple-dim)', color: 'var(--c-purple-text)', padding: '1px 7px', borderRadius: 3, fontSize: 10 }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Action column */}
                        <div style={{ flexShrink: 0, borderLeft: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'center', minWidth: 148, padding: '12px 14px', gap: 8 }}>
                          {confirmDelete === t.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 11, color: 'var(--c-red)', fontWeight: 500, textAlign: 'center' }}>Delete this template?</span>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button className="btn btn-outline btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)}>Delete</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => openEdit(t)}>
                                Edit Finding
                              </button>
                              <button className="btn btn-danger btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setConfirmDelete(t.id)}>
                                <Trash2 size={11} /> Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ── Full-page template editor ──────────────────────────────────────── */}
      {editorOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', background: 'var(--c-bg)' }}>

          {/* Header */}
          <div style={{ background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={closeEditor}
                style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--c-text-3)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font)', padding: '4px 0' }}
              >
                <ArrowLeft size={15} /> Back
              </button>
              <span style={{ color: 'var(--c-border-2)', fontSize: 14 }}>/</span>
              <span style={{ fontSize: 13, color: 'var(--c-text-3)' }}>Finding Templates</span>
              <span style={{ color: 'var(--c-border-2)', fontSize: 14 }}>/</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text-1)' }}>
                {editTarget ? (form.title || editTarget.title) : 'New Template'}
              </span>
            </div>
            <button className="btn-icon" onClick={closeEditor}><X size={16} /></button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '36px 28px' }}>
            <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

              <div>
                <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--c-text-1)', marginBottom: 4 }}>
                  {editTarget ? `Editing: ${editTarget.title}` : 'New Finding Template'}
                </h1>
                <p style={{ fontSize: 13, color: 'var(--c-text-3)' }}>
                  Templates appear in the "From Template" picker when adding findings to an engagement.
                </p>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--c-border)' }} />

              {/* Title */}
              <div>
                <label className="field-label">Title *</label>
                <input className="field" style={{ fontSize: 15 }} placeholder="e.g. LLMNR/NBT-NS Poisoning"
                  value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>

              {/* Severity + Category */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label className="field-label">Severity</label>
                  <select className="field" value={form.severity}
                    onChange={e => setForm(f => ({ ...f, severity: e.target.value as Severity }))}>
                    {SEV_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Category</label>
                  <select className="field" value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="field-label">Description</label>
                <p className="field-hint">Describe the vulnerability. Supports Markdown.</p>
                <textarea className="field" style={{ minHeight: 120, resize: 'vertical', marginTop: 6 }}
                  placeholder="Describe the vulnerability and how it was discovered…"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              {/* Impact */}
              <div>
                <label className="field-label">Impact *</label>
                <p className="field-hint">Describe the technical and business impact if exploited.</p>
                <textarea className="field" style={{ minHeight: 96, resize: 'vertical', marginTop: 6 }}
                  placeholder="An attacker who exploits this vulnerability could…"
                  value={form.impact} onChange={e => setForm(f => ({ ...f, impact: e.target.value }))} />
              </div>

              {/* Recommendations */}
              <div>
                <label className="field-label">Recommendations</label>
                <p className="field-hint">Remediation steps. Supports Markdown and bullet points.</p>
                <textarea className="field" style={{ minHeight: 96, resize: 'vertical', marginTop: 6 }}
                  placeholder="1. Apply patches…&#10;2. Disable unused services…"
                  value={form.recommendations} onChange={e => setForm(f => ({ ...f, recommendations: e.target.value }))} />
              </div>

              {/* CVSS */}
              <div>
                <label className="field-label">CVSS v4.0 Score</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 6 }}>
                  <div style={{ width: 150, flexShrink: 0 }}>
                    <input type="number" min={0} max={10} step={0.1} className="field"
                      placeholder="0.0 – 10.0"
                      value={form.cvss_score}
                      onChange={e => setForm(f => ({ ...f, cvss_score: e.target.value }))} />
                    {(() => {
                      const badge = cvssLabel(form.cvss_score)
                      return badge ? (
                        <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 4, background: 'var(--c-surface-2)', border: `1px solid ${badge.color}44` }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: badge.color }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: badge.color }}>{badge.label}</span>
                          <span style={{ fontSize: 12, color: 'var(--c-text-3)' }}>{badge.n.toFixed(1)}</span>
                        </div>
                      ) : null
                    })()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <input className="field" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}
                      placeholder="CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N"
                      value={form.cvss_vector}
                      onChange={e => setForm(f => ({ ...f, cvss_vector: e.target.value }))} />
                    <p className="field-hint">
                      Generate at{' '}
                      <a href="https://www.first.org/cvss/calculator/4.0" target="_blank" rel="noreferrer"
                        style={{ color: 'var(--c-purple-text)', textDecoration: 'underline' }}>
                        first.org/cvss/calculator/4.0
                      </a>
                    </p>
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="field-label">Tags</label>
                <p className="field-hint">Comma-separated. Used for filtering in the template picker.</p>
                <input className="field" style={{ marginTop: 6 }} placeholder="AD, credential cracking, lateral movement"
                  value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
              </div>

              <div style={{ height: 16 }} />
            </div>
          </div>

          {/* Footer */}
          <div style={{ background: 'var(--c-surface)', borderTop: '1px solid var(--c-border)', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <p style={{ fontSize: 12, color: 'var(--c-text-3)' }}>
              {canSave ? 'Ready to save.' : 'Title and Impact are required.'}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" onClick={closeEditor}>Cancel</button>
              <button className="btn btn-primary" style={{ minWidth: 140 }} onClick={handleSave} disabled={!canSave || saving}>
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
