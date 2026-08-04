import { useEffect, useState } from 'react'
import { X, Plus, Trash2, BookOpen, Search, ChevronRight, ChevronDown, Info, ArrowLeft } from 'lucide-react'
import type { Finding, Severity, ContentBlock } from '../types'
import { api } from '../api'
import type { Template } from '../api'
import SeverityBadge from './SeverityBadge'
import ContentBlockEditor from './ContentBlockEditor'

const EMPTY_FINDING: Finding = {
  id: '', title: '', severity: 'high', description: '',
  risk_rating_justification: '',
  cvss_score: null,
  cvss_vector: '',
  impact: { technical: '', business: '' },
  recommendations: { text: '' },
  affected_hosts: [], references: [], evidence: [],
  retest: { enabled: false },
}

function cvssLabel(score: number | null | undefined): { label: string; color: string } | null {
  if (score == null || isNaN(score)) return null
  if (score === 0.0) return { label: 'None', color: '#9ca3af' }
  if (score < 4.0)  return { label: 'Low', color: '#059669' }
  if (score < 7.0)  return { label: 'Medium', color: '#d97706' }
  if (score < 9.0)  return { label: 'High', color: '#ea580c' }
  return { label: 'Critical', color: '#dc2626' }
}

interface Props {
  open: boolean
  finding: Finding | null
  sectionId: string
  sections: { id: string; title: string }[]
  projectId?: number
  projectName?: string
  onSave: (finding: Finding, sectionId: string) => void
  onDelete?: (findingId: string) => void
  onClose: () => void
}

export default function FindingDrawer({ open, finding, sectionId, sections, projectId, projectName, onSave, onDelete, onClose }: Props) {
  const [form, setForm] = useState<Finding>(EMPTY_FINDING)
  const [secId, setSecId] = useState(sectionId)
  const [newHost, setNewHost] = useState('')
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [templateSearch, setTemplateSearch] = useState('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [helpOpen, setHelpOpen] = useState(false)
  const [newRefTitle, setNewRefTitle] = useState('')
  const [newRefUrl, setNewRefUrl] = useState('')
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([])

  useEffect(() => {
    if (finding) {
      const recs = finding.recommendations || {}
      let text = recs.text ?? ''
      if (!text && (recs.tactical?.length || recs.strategic?.length)) {
        text = [...(recs.tactical || []), ...(recs.strategic || [])].map(r => `- ${r}`).join('\n')
      }
      setForm({ ...finding, recommendations: { text } })
    } else {
      setForm({ ...EMPTY_FINDING, id: '_new_' })
    }
    setSecId(sectionId)
    setNewHost('')
    setTemplatePickerOpen(!finding); setTemplateSearch('')
    setNewRefTitle(''); setNewRefUrl('')

    if (finding) {
      if (finding.content_blocks && finding.content_blocks.length > 0) {
        setContentBlocks(finding.content_blocks)
      } else {
        const blocks: ContentBlock[] = []
        if (finding.description) blocks.push({ type: 'text', content: finding.description })
        for (const ev of finding.evidence || []) {
          if (ev.type === 'screenshot' && ev.path) {
            blocks.push({ type: 'screenshot', path: ev.path, caption: ev.caption || '' })
          } else if (ev.type === 'code' && ev.content !== undefined) {
            blocks.push({ type: 'code', label: ev.label, language: ev.language || 'bash', content: ev.content || '', highlight_lines: ev.highlight_lines || [], caption: ev.caption || '' })
          }
        }
        setContentBlocks(blocks)
      }
    } else {
      setContentBlocks([])
    }
  }, [finding, sectionId, open])

  useEffect(() => {
    if (open) {
      api.templates.list().then(setTemplates).catch(() => {})
    }
  }, [open])

  const applyTemplate = (t: Template) => {
    const recs = t.recommendations.split(/[.!]/).map(s => s.trim()).filter(Boolean)
    setForm(prev => ({
      ...prev,
      title: t.title,
      severity: t.severity as Severity,
      description: t.description,
      impact: { technical: t.impact ?? '', business: '' },
      recommendations: { text: recs.map(r => `- ${r}`).join('\n') },
      cvss_score: t.cvss_score ?? null,
      cvss_vector: t.cvss_vector ?? '',
    }))
    setContentBlocks([{ type: 'text', content: t.description }])
    setTemplatePickerOpen(false)
    setTemplateSearch('')
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const set = (field: string, value: unknown) => setForm(prev => ({ ...prev, [field]: value }))
  const setNested = (top: 'impact' | 'recommendations', key: string, value: unknown) =>
    setForm(prev => ({ ...prev, [top]: { ...prev[top], [key]: value } }))

  const addHost = () => {
    if (!newHost.trim()) return
    set('affected_hosts', [...form.affected_hosts, newHost.trim()]); setNewHost('')
  }

  const canSave = form.title.trim() && form.impact.technical.trim()

  if (!open) return null

  const currentSection = sections.find(s => s.id === secId)

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ background: 'var(--c-bg)' }}
    >
      {/* ── Page header ───────────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--c-surface)',
          borderBottom: '1px solid var(--c-border)',
          padding: '0 28px',
          height: 58,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--c-text-3)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font)', padding: '4px 0' }}
          >
            <ArrowLeft size={15} />
            Back
          </button>
          <span style={{ color: 'var(--c-border-2)', fontSize: 14 }}>/</span>
          {projectName && (
            <>
              <span style={{ fontSize: 13, color: 'var(--c-text-3)' }}>{projectName}</span>
              <span style={{ color: 'var(--c-border-2)', fontSize: 14 }}>/</span>
            </>
          )}
          <span style={{ fontSize: 13, color: 'var(--c-text-3)' }}>Findings</span>
          <span style={{ color: 'var(--c-border-2)', fontSize: 14 }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text-1)' }}>
            {finding ? (form.title || finding.title || 'Edit Finding') : 'New Finding'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!finding && (
            <button
              className="btn btn-outline btn-sm"
              style={templatePickerOpen ? { background: 'var(--c-purple-dim)', borderColor: 'rgba(37,99,235,0.3)', color: 'var(--c-purple-text)' } : {}}
              onClick={() => setTemplatePickerOpen(v => !v)}
            >
              <BookOpen size={13} /> From Template
            </button>
          )}
          {finding && onDelete && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => { if (confirm('Delete this finding?')) { onDelete(finding.id); onClose() } }}
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
          <button className="btn-icon" onClick={onClose} title="Close"><X size={16} /></button>
        </div>
      </div>

      {/* ── Template picker ────────────────────────────────────────────── */}
      {templatePickerOpen && (
        <div style={{ background: 'var(--c-surface-2)', borderBottom: '1px solid var(--c-border)', flexShrink: 0 }}>
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '16px 28px' }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text-1)', marginBottom: 10 }}>
              Select a template to pre-fill this finding:
            </p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-3)' }} />
                <input
                  autoFocus
                  className="field"
                  style={{ paddingLeft: 32, fontSize: 13 }}
                  placeholder="Search templates…"
                  value={templateSearch}
                  onChange={e => setTemplateSearch(e.target.value)}
                />
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setTemplatePickerOpen(false)}>
                <Plus size={12} /> Blank Finding
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
              {templates
                .filter(t => !templateSearch || t.title.toLowerCase().includes(templateSearch.toLowerCase()) || t.category.toLowerCase().includes(templateSearch.toLowerCase()))
                .map(t => (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                      background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                      borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                      transition: 'border-color 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--c-purple)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--c-border)')}
                  >
                    <SeverityBadge severity={t.severity as Severity} size="xs" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                      <p style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 1 }}>{t.category}</p>
                    </div>
                    <ChevronRight size={13} style={{ color: 'var(--c-text-3)', flexShrink: 0 }} />
                  </button>
                ))
              }
              {templates.filter(t => !templateSearch || t.title.toLowerCase().includes(templateSearch.toLowerCase()) || t.category.toLowerCase().includes(templateSearch.toLowerCase())).length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--c-text-3)', fontStyle: 'italic', padding: '12px 0' }}>No templates match</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '36px 28px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Page title */}
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--c-text-1)', marginBottom: 4 }}>
              {finding ? `Modifying Finding: ${finding.title}` : 'New Finding'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--c-text-3)' }}>
              {finding ? `ID: ${finding.id} · Section: ${currentSection?.title || secId}` : 'Fill in the details below to add this finding to the engagement.'}
            </p>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--c-border)' }} />

          {/* Classification row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label className="field-label">Finding ID</label>
              <div className="field field-mono" style={{ padding: '8px 11px', cursor: 'default', opacity: finding ? 1 : 0.45, fontSize: 12 }}>
                {finding ? form.id : 'Auto-assigned on save'}
              </div>
            </div>
            <div>
              <label className="field-label">Severity *</label>
              <select className="field" value={form.severity}
                onChange={e => set('severity', e.target.value as Severity)}>
                {(['critical', 'high', 'medium', 'low', 'informational'] as Severity[]).map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Section</label>
              <select className="field" value={secId} onChange={e => setSecId(e.target.value)}>
                {sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--c-text-3)' }}>Severity preview:</span>
            <SeverityBadge severity={form.severity} size="xs" />
          </div>

          {/* Title */}
          <div>
            <label className="field-label">Title *</label>
            <input
              className="field"
              style={{ fontSize: 15 }}
              placeholder="e.g. LLMNR/NBT-NS Poisoning and Credential Interception"
              value={form.title}
              onChange={e => set('title', e.target.value)}
            />
          </div>

          {/* Description & Evidence */}
          <div>
            <label className="field-label">
              Description &amp; Evidence
              <span style={{ color: 'var(--c-text-3)', textTransform: 'none', letterSpacing: 'normal', fontSize: 11, fontWeight: 400, marginLeft: 8 }}>
                Interleave text, code blocks and screenshots freely using the + buttons.
              </span>
            </label>
            <div style={{ marginTop: 8 }}>
              <ContentBlockEditor
                blocks={contentBlocks}
                projectId={projectId}
                onChange={setContentBlocks}
                placeholder="Describe the vulnerability, how it was discovered, and its impact…"
              />
            </div>
          </div>

          {/* Risk Justification */}
          <div>
            <label className="field-label">Risk Rating Justification</label>
            <p className="field-hint">Explain why this severity rating was assigned.</p>
            <textarea
              className="field"
              style={{ minHeight: 88, marginTop: 6 }}
              placeholder="Justify the risk rating based on exploitability, impact, and context…"
              value={form.risk_rating_justification}
              onChange={e => set('risk_rating_justification', e.target.value)}
            />
          </div>

          {/* CVSS v4 */}
          <div>
            <label className="field-label">CVSS v4 Score</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 6 }}>
              <div style={{ width: 140, flexShrink: 0 }}>
                <input
                  type="number" min={0} max={10} step={0.1}
                  className="field"
                  placeholder="0.0 – 10.0"
                  value={form.cvss_score ?? ''}
                  onChange={e => {
                    const v = e.target.value === '' ? null : parseFloat(e.target.value)
                    set('cvss_score', (v != null && !isNaN(v)) ? Math.min(10, Math.max(0, v)) : null)
                  }}
                />
                {(() => {
                  const badge = cvssLabel(form.cvss_score)
                  return badge ? (
                    <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 4, background: 'var(--c-surface-2)', border: `1px solid ${badge.color}44` }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: badge.color }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: badge.color }}>{badge.label}</span>
                      <span style={{ fontSize: 12, color: 'var(--c-text-3)' }}>{form.cvss_score?.toFixed(1)}</span>
                    </div>
                  ) : null
                })()}
              </div>
              <div style={{ flex: 1 }}>
                <input
                  className="field field-mono"
                  style={{ fontSize: 12 }}
                  placeholder="CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N"
                  value={form.cvss_vector ?? ''}
                  onChange={e => set('cvss_vector', e.target.value)}
                />
                <p className="field-hint">
                  Use{' '}
                  <a href="https://www.first.org/cvss/calculator/4.0" target="_blank" rel="noreferrer"
                    style={{ color: 'var(--c-purple-text)', textDecoration: 'underline' }}>
                    first.org/cvss/calculator/4.0
                  </a>{' '}
                  to calculate the vector string.
                </p>
              </div>
            </div>
          </div>

          {/* Impact */}
          <div>
            <label className="field-label">Impact *</label>
            <p className="field-hint">Describe the technical and business impact if this vulnerability is exploited.</p>
            <textarea
              className="field"
              style={{ minHeight: 120, marginTop: 6 }}
              placeholder="Describe both the technical consequence and the business risk…"
              value={form.impact.technical}
              onChange={e => setNested('impact', 'technical', e.target.value)}
            />
          </div>

          {/* Recommendations */}
          <div>
            <label className="field-label">Recommendations</label>
            <p className="field-hint">Describe the steps needed to remediate this vulnerability. Use - for bullet points.</p>
            <textarea
              className="field"
              style={{ minHeight: 120, marginTop: 6 }}
              placeholder="1. Apply the latest security patches…&#10;2. Implement network segmentation…"
              value={form.recommendations.text ?? ''}
              onChange={e => setForm(prev => ({ ...prev, recommendations: { text: e.target.value } }))}
            />
          </div>

          {/* Affected Hosts */}
          <div>
            <label className="field-label">Affected Hosts / Systems</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, marginTop: 6 }}>
              {form.affected_hosts.map((h, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontFamily: 'var(--mono)', padding: '3px 10px', background: 'var(--c-purple-dim)', color: 'var(--c-purple-text)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 4 }}>
                  {h}
                  <button style={{ color: 'var(--c-text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                    onClick={() => set('affected_hosts', form.affected_hosts.filter((_, j) => j !== i))}>
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="field field-mono"
                style={{ fontSize: 12, flex: 1 }}
                placeholder="192.168.1.0/24 or hostname.internal"
                value={newHost}
                onChange={e => setNewHost(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addHost() } }}
              />
              <button className="btn btn-outline btn-sm" onClick={addHost}><Plus size={13} /> Add</button>
            </div>
          </div>

          {/* References */}
          <div>
            <label className="field-label">References</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10, marginTop: 6 }}>
              {(form.references || []).map((ref, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 13, padding: '7px 11px', background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', borderRadius: 4, color: 'var(--c-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ref.title}{ref.url ? ` — ${ref.url}` : ''}
                  </span>
                  <button className="btn-icon" style={{ color: 'var(--c-red)', flexShrink: 0 }}
                    onClick={() => set('references', form.references.filter((_, j) => j !== i))}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
              <input className="field" style={{ fontSize: 13 }} placeholder="Title (e.g. CVE-2024-1234)"
                value={newRefTitle} onChange={e => setNewRefTitle(e.target.value)} />
              <input className="field" style={{ fontSize: 13 }} placeholder="https://..."
                value={newRefUrl}
                onChange={e => setNewRefUrl(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (newRefTitle.trim() || newRefUrl.trim())) {
                    e.preventDefault()
                    set('references', [...(form.references || []), { title: newRefTitle.trim(), url: newRefUrl.trim() }])
                    setNewRefTitle(''); setNewRefUrl('')
                  }
                }} />
              <button className="btn btn-outline btn-sm" onClick={() => {
                if (!newRefTitle.trim() && !newRefUrl.trim()) return
                set('references', [...(form.references || []), { title: newRefTitle.trim(), url: newRefUrl.trim() }])
                setNewRefTitle(''); setNewRefUrl('')
              }}><Plus size={13} /></button>
            </div>
          </div>

          {/* Formatting guide */}
          <div style={{ border: '1px solid var(--c-border)', borderRadius: 6, overflow: 'hidden' }}>
            <button
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--c-purple-dim)', color: 'var(--c-purple-text)', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font)', fontWeight: 500 }}
              onClick={() => setHelpOpen(v => !v)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Info size={14} /> Formatting &amp; Evidence Guide</span>
              <ChevronDown size={14} style={{ transform: helpOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>
            {helpOpen && (
              <div style={{ padding: '16px', background: 'var(--c-surface-2)', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
                <div>
                  <p style={{ fontWeight: 600, color: 'var(--c-text-1)', marginBottom: 6 }}>Markdown Syntax</p>
                  <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--c-text-3)', lineHeight: 1.8 }}>
                    **bold**&nbsp;&nbsp;*italic*&nbsp;&nbsp;`inline code`<br />
                    - Bullet item&nbsp;&nbsp;&nbsp;1. Numbered item<br />
                    [Link text](https://url)
                  </p>
                </div>
                <div>
                  <p style={{ fontWeight: 600, color: 'var(--c-text-1)', marginBottom: 4 }}>Code Blocks</p>
                  <p style={{ fontSize: 12, color: 'var(--c-text-3)' }}>Each code block can have a Label (shown as a header bar in the PDF) and Highlight Lines (comma-separated line numbers, e.g. <span style={{ color: 'var(--c-purple-text)' }}>1,3,5</span>).</p>
                </div>
                <div>
                  <p style={{ fontWeight: 600, color: 'var(--c-text-1)', marginBottom: 4 }}>Screenshots</p>
                  <p style={{ fontSize: 12, color: 'var(--c-text-3)' }}>Upload PNG/JPG screenshots. Each gets a Figure number and optional caption in the PDF. Drag the resize handle to control width.</p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom spacer so footer doesn't overlap content */}
          <div style={{ height: 20 }} />

        </div>
      </div>

      {/* ── Sticky footer ─────────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--c-surface)',
          borderTop: '1px solid var(--c-border)',
          padding: '14px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <p style={{ fontSize: 12, color: 'var(--c-text-3)' }}>
          {canSave ? 'Ready to save.' : 'Title and Impact are required.'}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-secondary"
            style={{ minWidth: 140 }}
            disabled={!canSave}
            onClick={() => {
              if (canSave)
                onSave({ ...form, id: form.id || '_new_', content_blocks: contentBlocks }, secId)
            }}
          >
            {finding ? 'Update and Exit' : 'Add Finding'}
          </button>
        </div>
      </div>
    </div>
  )
}
