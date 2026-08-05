import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ChevronRight, FileDown, Loader2, Plus, Pencil, Trash2,
  AlertTriangle, CheckCircle, Info,
  HelpCircle, X, Upload, BookmarkPlus, Eye,
  Building2, Calendar, FileText, Target, Users2, Shield, History, BookOpen, ClipboardList, Wrench,
  Layers,
} from 'lucide-react'
import { api, downloadBlob } from '../api'
import type { ProjectDetail as PD, ReportData, Finding, TeamMember, VersionEntry, ExploitScenario, Severity, ToolEntry, RoadmapItem, ContentBlock } from '../types'
import SeverityBadge from '../components/SeverityBadge'
import FindingDrawer from '../components/FindingDrawer'
import Modal from '../components/Modal'
import ContentBlockEditor from '../components/ContentBlockEditor'

type Tab = 'overview' | 'intro' | 'findings' | 'scenarios' | 'summary' | 'roadmap' | 'appendices' | 'generate'

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview',   label: 'Overview' },
  { key: 'intro',      label: 'Introduction' },
  { key: 'findings',   label: 'Findings' },
  { key: 'scenarios',  label: 'Scenarios' },
  { key: 'summary',    label: 'Summary' },
  { key: 'roadmap',    label: 'Roadmap' },
  { key: 'appendices', label: 'Appendices' },
  { key: 'generate',   label: 'Generate PDF' },
]

// ─── Auto-ID helpers ──────────────────────────────────────────────────────────

const SEV_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'informational']

function sectionPrefix(title: string): string {
  const MAP: Record<string, string> = {
    'internal': 'INT', 'external': 'EXT',
    'web application': 'WEB', 'web app': 'WEB', 'web': 'WEB',
    'api': 'API', 'cloud': 'CLD', 'red team': 'RED',
    'phishing': 'PHI', 'mobile': 'MOB', 'network': 'NET',
    'active directory': 'AD', 'wireless': 'WLS', 'nessus import': 'NSS',
    'physical': 'PHY', 'social engineering': 'SE', 'infrastructure': 'INF',
    'post exploitation': 'PE', 'lateral movement': 'LAT', 'escalation': 'ESC',
  }
  const k = title.toLowerCase().trim()
  if (MAP[k]) return MAP[k]
  for (const [key, val] of Object.entries(MAP)) { if (k.includes(key)) return val }
  return title.trim().split(/\s+/)[0].slice(0, 3).toUpperCase()
}

function applyAutoIds(rd: ReportData): ReportData {
  const idMap = new Map<string, string>()
  const newSections = rd.sections.map(sec => {
    const prefix = sectionPrefix(sec.title)
    const indexed = sec.findings.map((f, origIdx) => ({ f, origIdx }))
    indexed.sort((a, b) => {
      const da = SEV_ORDER.indexOf(a.f.severity as Severity)
      const db = SEV_ORDER.indexOf(b.f.severity as Severity)
      return da !== db ? da - db : a.origIdx - b.origIdx
    })
    const newFindings = [...sec.findings]
    indexed.forEach(({ f, origIdx }, order) => {
      const newId = `${prefix}-${String(order + 1).padStart(3, '0')}`
      idMap.set(f.id, newId)
      newFindings[origIdx] = { ...f, id: newId }
    })
    return { ...sec, findings: newFindings }
  })
  const newScenarios = (rd.exploitation_scenarios || []).map(sc => ({
    ...sc,
    finding_refs: sc.finding_refs.map(r => idMap.get(r) ?? r),
  }))
  return { ...rd, sections: newSections, exploitation_scenarios: newScenarios }
}

const SEV_BAND: Record<Severity, { label: string; color: string; headerBg: string; dropBg: string }> = {
  critical:      { label: 'Critical',      color: '#ff9090', headerBg: 'rgba(217,94,94,0.18)',    dropBg: 'rgba(217,94,94,0.07)' },
  high:          { label: 'High',          color: '#ffc07a', headerBg: 'rgba(200,135,58,0.18)',   dropBg: 'rgba(200,135,58,0.07)' },
  medium:        { label: 'Medium',        color: '#ffe07a', headerBg: 'rgba(200,175,58,0.18)',   dropBg: 'rgba(200,175,58,0.07)' },
  low:           { label: 'Low',           color: '#80ddb4', headerBg: 'rgba(76,175,130,0.18)',   dropBg: 'rgba(76,175,130,0.07)' },
  informational: { label: 'Informational', color: '#b0a8e8', headerBg: 'rgba(123,111,205,0.18)', dropBg: 'rgba(123,111,205,0.07)' },
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const projectId = Number(id)

  const [project, setProject] = useState<PD | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingFinding, setEditingFinding] = useState<Finding | null>(null)
  const [editingSection, setEditingSection] = useState('')
  const [sectionModalOpen, setSectionModalOpen] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [generating, setGenerating] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const nessusRef = useRef<HTMLInputElement>(null)

  const [scenarioModalOpen, setScenarioModalOpen] = useState(false)
  const [editingScenario, setEditingScenario] = useState<ExploitScenario | null>(null)
  const [scenarioForm, setScenarioForm] = useState<ExploitScenario>({
    id: '', title: '', severity: 'high', finding_refs: [], narrative: '',
    recommendation: '', evidence: [], enabled: true,
  })
  const [newFindingRef, setNewFindingRef] = useState('')
  const [scenarioContentBlocks, setScenarioContentBlocks] = useState<ContentBlock[]>([])

  const [clients, setClients] = useState<Array<{id: number; name: string; contact_name?: string; contact_title?: string; contact_email?: string}>>([])

  const [kbModalOpen, setKbModalOpen] = useState(false)
  const [kbFindings, setKbFindings] = useState<Finding[]>([])
  const [kbSelected, setKbSelected] = useState<Set<string>>(new Set())
  const [kbSectionMap, setKbSectionMap] = useState<Record<string, string>>({})

  const [findingsViewMode, setFindingsViewMode] = useState<'kanban' | 'section'>('kanban')
  const [dragFindingId, setDragFindingId] = useState<string | null>(null)
  const [dragOverSev, setDragOverSev] = useState<Severity | null>(null)
  const dragFindingIdRef = useRef<string | null>(null)
  const dragOverSevRef = useRef<Severity | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    try {
      setProject(await api.projects.get(projectId))
    } catch { navigate('/') }
    finally { setLoading(false) }
  }, [projectId, navigate])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.clients.list().then(setClients).catch(() => {})
  }, [])

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const saveProject = async (updated: PD) => {
    setSaving(true)
    try {
      const saved = await api.projects.update(projectId, {
        name: updated.name, report_id: updated.report_id,
        client_name: updated.client_name, status: updated.status,
        report_data: updated.report_data,
      })
      setProject(saved)
      showToast('Saved')
    } catch (e: unknown) {
      showToast((e as Error).message || 'Save failed', 'err')
    } finally { setSaving(false) }
  }

  const setReportData = (updater: (prev: ReportData) => ReportData) => {
    setProject(prev => {
      if (!prev) return prev
      const raw = updater(prev.report_data)
      const withIds = applyAutoIds(raw)
      const next = { ...prev, report_data: withIds }
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => saveProject(next), 1500)
      return next
    })
  }

  // Flush any pending debounced save immediately before PDF generation
  const flushSave = async (proj: PD) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    await api.projects.update(projectId, {
      name: proj.name, report_id: proj.report_id,
      client_name: proj.client_name, status: proj.status,
      report_data: proj.report_data,
    })
  }

  const setMeta = (path: string, value: string) =>
    setReportData(rd => deepSet(rd as unknown as Record<string, unknown>, `meta.${path}`, value))

  const pdfFilename = () =>
    `${project?.report_id || 'report'}-${((project?.client_name || project?.name) ?? 'report').toLowerCase().replace(/\s+/g, '-')}.pdf`

  const handleTogglePreview = async () => {
    if (previewOpen) { setPreviewOpen(false); return }
    // Already have a URL — just re-expand without regenerating
    if (previewUrl) { setPreviewOpen(true); return }
    if (!project) return
    setPreviewing(true)
    setPreviewOpen(true)
    try {
      await flushSave(project)
      const blob = await api.projects.generatePdf(projectId)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewName(pdfFilename())
      setPreviewUrl(URL.createObjectURL(blob))
    } catch (e: unknown) {
      showToast((e as Error).message || 'PDF generation failed', 'err')
      setPreviewOpen(false)
    } finally { setPreviewing(false) }
  }

  const handleRegeneratePreview = async () => {
    if (!project) return
    setPreviewing(true)
    try {
      await flushSave(project)
      const blob = await api.projects.generatePdf(projectId)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewName(pdfFilename())
      setPreviewUrl(URL.createObjectURL(blob))
    } catch (e: unknown) {
      showToast((e as Error).message || 'PDF generation failed', 'err')
    } finally { setPreviewing(false) }
  }

  const downloadFromPreview = () => {
    if (!previewUrl) return
    const a = document.createElement('a')
    a.href = previewUrl
    a.download = previewName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleGeneratePdf = async () => {
    if (!project) return
    setGenerating(true)
    try {
      await flushSave(project)
      const blob = await api.projects.generatePdf(projectId)
      downloadBlob(blob, `${project.report_id || 'report'}-${(project.client_name || project.name).toLowerCase().replace(/\s+/g, '-')}.pdf`)
      showToast('PDF downloaded')

      // Check for findings not in the template knowledge base
      const projectSections = project.report_data.sections || []
      const projectFindings = projectSections.flatMap(s => s.findings)
      const templates = await api.templates.list().catch(() => [] as Array<{title: string}>)
      const templateTitles = new Set(templates.map(t => t.title.toLowerCase().trim()))
      const unmatched = projectFindings.filter(f => f.title.trim() && !templateTitles.has(f.title.toLowerCase().trim()))
      if (unmatched.length > 0) {
        const sectionMap: Record<string, string> = {}
        projectSections.forEach(s => s.findings.forEach(f => { sectionMap[f.id] = s.title }))
        setKbSectionMap(sectionMap)
        setKbFindings(unmatched)
        setKbSelected(new Set(unmatched.map(f => f.id)))
        setKbModalOpen(true)
      }
    } catch (e: unknown) {
      showToast((e as Error).message || 'PDF generation failed', 'err')
    } finally { setGenerating(false) }
  }

  const handleAddToKb = async () => {
    const toAdd = kbFindings.filter(f => kbSelected.has(f.id))
    const newTemplates = toAdd.map(f => ({
      title: f.title,
      severity: f.severity,
      category: kbSectionMap[f.id] || '',
      description: f.description || '',
      impact: f.impact?.technical || '',
      recommendations: [
        ...(f.recommendations?.tactical || []),
        ...(f.recommendations?.strategic || []),
      ].filter(Boolean).join('\n') || '',
      tags: [] as string[],
    }))
    try {
      await api.templates.bulkCreate(newTemplates)
    } catch {
      // proceed regardless — toast still fires
    }
    setKbModalOpen(false)
    showToast(`${newTemplates.length} finding${newTemplates.length !== 1 ? 's' : ''} added to knowledge base`)
  }

  const handleNessusImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const updated = await api.projects.importNessus(projectId, file)
      setProject(updated)
      showToast('Nessus findings imported')
    } catch (err: unknown) {
      showToast((err as Error).message || 'Nessus import failed', 'err')
    } finally {
      setImporting(false)
      if (nessusRef.current) nessusRef.current.value = ''
    }
  }

  const openNewFinding = (sectionId: string) => {
    setEditingFinding(null); setEditingSection(sectionId); setDrawerOpen(true)
  }
  const openEditFinding = (finding: Finding, sectionId: string) => {
    setEditingFinding(finding); setEditingSection(sectionId); setDrawerOpen(true)
  }

  const handleSaveFinding = (finding: Finding, sectionId: string) => {
    setReportData(rd => ({
      ...rd,
      sections: rd.sections.map(sec => sec.id !== sectionId ? sec : {
        ...sec,
        findings: sec.findings.some(f => f.id === finding.id)
          ? sec.findings.map(f => f.id === finding.id ? finding : f)
          : [...sec.findings, finding],
      }),
    }))
    setDrawerOpen(false)
    showToast(editingFinding ? 'Finding updated' : 'Finding added')
  }

  const handleDeleteFinding = (findingId: string) => {
    setReportData(rd => ({
      ...rd,
      sections: rd.sections.map(sec => ({ ...sec, findings: sec.findings.filter(f => f.id !== findingId) })),
    }))
    showToast('Finding deleted')
  }

  const handleDropOnSeverity = useCallback((newSev: Severity, findingId: string) => {
    if (!findingId) return
    setReportData(rd => ({
      ...rd,
      sections: rd.sections.map(sec => ({
        ...sec,
        findings: sec.findings.map(f => f.id === findingId ? { ...f, severity: newSev } : f),
      })),
    }))
    showToast(`Severity changed to ${newSev}`)
    dragFindingIdRef.current = null
    dragOverSevRef.current = null
    setDragFindingId(null)
    setDragOverSev(null)
  }, [])

  const handleDropRef = useRef(handleDropOnSeverity)
  useEffect(() => { handleDropRef.current = handleDropOnSeverity }, [handleDropOnSeverity])

  useEffect(() => {
    if (!dragFindingId) return
    document.body.style.cursor = 'grabbing'

    const onMove = (e: MouseEvent) => {
      const els = document.elementsFromPoint(e.clientX, e.clientY) as HTMLElement[]
      const bandEl = els.find(el => el.dataset.sev)
      const sev = (bandEl?.dataset.sev ?? null) as Severity | null
      dragOverSevRef.current = sev
      setDragOverSev(sev)
    }

    const onUp = () => {
      const id = dragFindingIdRef.current
      const sev = dragOverSevRef.current
      if (id && sev) handleDropRef.current(sev, id)
      dragFindingIdRef.current = null
      dragOverSevRef.current = null
      setDragFindingId(null)
      setDragOverSev(null)
      document.body.style.cursor = ''
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
    }
  }, [dragFindingId])

  const handleAddSection = () => {
    if (!newSectionName.trim()) return
    setReportData(rd => ({
      ...rd,
      sections: [...rd.sections, {
        id: newSectionName.toLowerCase().replace(/\s+/g, '-'),
        title: newSectionName.trim(), enabled: true, findings: [],
      }],
    }))
    setNewSectionName(''); setSectionModalOpen(false)
  }

  const openNewScenario = () => {
    setEditingScenario(null)
    setScenarioForm({ id: '', title: '', severity: 'high', finding_refs: [], narrative: '', recommendation: '', evidence: [], enabled: true })
    setNewFindingRef('')
    setScenarioContentBlocks([])
    setScenarioModalOpen(true)
  }
  const openEditScenario = (s: ExploitScenario) => {
    setEditingScenario(s)
    setScenarioForm({ ...s })
    setNewFindingRef('')
    setScenarioModalOpen(true)
    if (s.content_blocks && s.content_blocks.length > 0) {
      setScenarioContentBlocks(s.content_blocks)
    } else {
      const blocks: ContentBlock[] = []
      if (s.narrative) blocks.push({ type: 'text', content: s.narrative })
      for (const ev of s.evidence || []) {
        if (ev.type === 'screenshot' && ev.path) {
          blocks.push({ type: 'screenshot', path: ev.path, caption: ev.caption || '' })
        } else if (ev.type === 'code' && ev.content !== undefined) {
          blocks.push({ type: 'code', label: ev.label, language: ev.language || 'bash', content: ev.content || '', highlight_lines: ev.highlight_lines || [], caption: ev.caption || '' })
        }
      }
      setScenarioContentBlocks(blocks)
    }
  }
  const handleSaveScenario = () => {
    if (!scenarioForm.title.trim()) return
    setReportData(rd => ({
      ...rd,
      exploitation_scenarios: editingScenario
        ? rd.exploitation_scenarios.map(s => s.id === editingScenario.id
            ? { ...scenarioForm, content_blocks: scenarioContentBlocks }
            : s)
        : [...(rd.exploitation_scenarios || []), { ...scenarioForm, content_blocks: scenarioContentBlocks }],
    }))
    setScenarioModalOpen(false)
  }
  const handleDeleteScenario = (sid: string) => {
    if (!confirm('Delete this scenario?')) return
    setReportData(rd => ({ ...rd, exploitation_scenarios: rd.exploitation_scenarios.filter(s => s.id !== sid) }))
  }

  if (loading || !project) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%', gap: 10, color: 'var(--c-text-3)' }}>
        <div className="spinner" />
        <span style={{ fontSize: 13 }}>Loading engagement…</span>
      </div>
    )
  }

  const rd = project.report_data
  const sections = rd.sections || []
  const allFindings = sections.flatMap(s => s.findings)
  const sectionList = sections.map(s => ({ id: s.id, title: s.title }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'var(--c-bg)' }}>

      {/* Engagement sub-header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, padding: '0 20px', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--c-sidebar)', borderBottom: '1px solid var(--c-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, minWidth: 0 }}>
          <span style={{ fontWeight: 500, color: 'var(--c-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
            {project.client_name || project.name}
          </span>
          {project.report_id && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '2px 8px', background: 'var(--c-purple-dim)', color: 'var(--c-purple-text)', border: '1px solid rgba(123,111,205,0.25)', borderRadius: 4 }}>
              {project.report_id}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            className="field"
            style={{ fontSize: 12, padding: '4px 8px', height: 30, width: 'auto' }}
            value={project.status}
            onChange={async e => {
              const updated = { ...project, status: e.target.value as PD['status'] }
              setProject(updated); await saveProject(updated)
            }}
          >
            <option value="active">Active</option>
            <option value="complete">Complete</option>
            <option value="archived">Archived</option>
          </select>
          {saving && <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`tab${tab === t.key ? ' active' : ''}`}
          >
            {t.label}
            {t.key === 'findings' && allFindings.length > 0 && (
              <span style={{ marginLeft: 6, background: 'var(--c-purple-dim)', color: 'var(--c-purple-text)', padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700 }}>
                {allFindings.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <main style={{ flex: 1, padding: '28px 24px', maxWidth: 900 }}>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

            <StepSection step={1} icon={<FileText size={15} />} title="Report Details" desc="Set the report identifier, classification level, title, and subtitle that appear on the cover page.">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <Field label="Report ID">
                  <input className="fo-input-mono" value={rd.meta?.report_id || ''} placeholder="RS-2026-001"
                    onChange={e => setMeta('report_id', e.target.value)} />
                </Field>
                <Field label="Classification">
                  <select className="fo-select" value={rd.meta?.classification || 'CONFIDENTIAL'}
                    onChange={e => setMeta('classification', e.target.value)}>
                    {['CONFIDENTIAL', 'RESTRICTED', 'INTERNAL', 'PUBLIC'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field label="Title">
                  <input className="fo-input" value={rd.meta?.title || ''} placeholder="Penetration Test Report"
                    onChange={e => setMeta('title', e.target.value)} />
                </Field>
                <Field label="Subtitle">
                  <input className="fo-input" value={rd.meta?.subtitle || ''} placeholder="Internal Infrastructure Assessment"
                    onChange={e => setMeta('subtitle', e.target.value)} />
                </Field>
              </div>
            </StepSection>

            <StepSection step={2} icon={<Building2 size={15} />} title="Client" desc="Enter the client organisation details. Use the quick-fill selector to pull data from a saved client record.">
              {clients.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <label className="fo-label">Quick-fill from client list</label>
                  <select
                    className="fo-select"
                    style={{ maxWidth: 320 }}
                    defaultValue=""
                    onChange={e => {
                      const c = clients.find(cl => cl.id === Number(e.target.value))
                      if (!c) return
                      setMeta('client.name', c.name)
                      setMeta('client.contact_name', c.contact_name || '')
                      setMeta('client.contact_title', c.contact_title || '')
                      setMeta('client.contact_email', c.contact_email || '')
                    }}
                  >
                    <option value="" disabled>Select a client…</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Client / Org Name">
                  <input className="fo-input" value={rd.meta?.client?.name || ''}
                    onChange={e => setMeta('client.name', e.target.value)} />
                </Field>
                <Field label="Primary Contact Name">
                  <input className="fo-input" value={rd.meta?.client?.contact_name || ''}
                    onChange={e => setMeta('client.contact_name', e.target.value)} />
                </Field>
                <Field label="Contact Title">
                  <input className="fo-input" value={rd.meta?.client?.contact_title || ''}
                    onChange={e => setMeta('client.contact_title', e.target.value)} />
                </Field>
                <Field label="Contact Email">
                  <input type="email" className="fo-input" value={rd.meta?.client?.contact_email || ''}
                    onChange={e => setMeta('client.contact_email', e.target.value)} />
                </Field>
              </div>
            </StepSection>

            <StepSection step={3} icon={<Users2 size={15} />} title="Consultant / Testing Firm" desc="Details of the security firm and lead tester conducting this assessment.">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Firm">
                  <input className="fo-input" value={rd.meta?.consultant?.firm || ''}
                    onChange={e => setMeta('consultant.firm', e.target.value)} />
                </Field>
                <Field label="Lead Tester">
                  <input className="fo-input" value={rd.meta?.consultant?.name || ''}
                    onChange={e => setMeta('consultant.name', e.target.value)} />
                </Field>
                <Field label="Title / Role">
                  <input className="fo-input" value={rd.meta?.consultant?.title || ''}
                    onChange={e => setMeta('consultant.title', e.target.value)} />
                </Field>
                <Field label="Email">
                  <input type="email" className="fo-input" value={rd.meta?.consultant?.email || ''}
                    onChange={e => setMeta('consultant.email', e.target.value)} />
                </Field>
              </div>
            </StepSection>

            <StepSection step={4} icon={<Calendar size={15} />} title="Dates" desc="Assessment window and report issue date. These populate the cover page and Appendix B.">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Assessment Start">
                  <input type="date" className="fo-input" value={rd.meta?.dates?.assessment_start || ''}
                    onChange={e => setMeta('dates.assessment_start', e.target.value)} />
                </Field>
                <Field label="Assessment End">
                  <input type="date" className="fo-input" value={rd.meta?.dates?.assessment_end || ''}
                    onChange={e => setMeta('dates.assessment_end', e.target.value)} />
                </Field>
                <Field label="Report Date">
                  <input type="date" className="fo-input" value={rd.meta?.dates?.report_date || ''}
                    onChange={e => setMeta('dates.report_date', e.target.value)} />
                </Field>
                <Field label="Report Version">
                  <input className="fo-input-mono" value={rd.meta?.dates?.report_version || ''} placeholder="1.0"
                    onChange={e => setMeta('dates.report_version', e.target.value)} />
                </Field>
              </div>
            </StepSection>

            <StepSection step={5} icon={<History size={15} />} title="Version History" desc="Track document revisions. Populates the Document Control table in Appendix B." last>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button className="btn btn-ghost btn-sm"
                  onClick={() => setReportData(r => ({ ...r, version_history: [...r.version_history, { version: '', date: '', author: '', changes: '' }] }))}>
                  <Plus size={12} /> Add Entry
                </button>
              </div>
              {(rd.version_history || []).length === 0 ? (
                <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--c-text-3)' }}>No entries yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 120px 1fr 1fr 28px', gap: 8, marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--c-border)' }}>
                    {['Version', 'Date', 'Author', 'Changes', ''].map((h, i) => (
                      <span key={i} style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-3)' }}>{h}</span>
                    ))}
                  </div>
                  {(rd.version_history || []).map((entry: VersionEntry, i: number) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 120px 1fr 1fr 28px', gap: 8, paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid var(--c-border)' }}>
                      <input className="fo-input-mono" style={{ fontSize: 12, padding: '4px 8px' }} placeholder="1.0" value={entry.version}
                        onChange={e => { const vh = [...rd.version_history]; vh[i] = { ...vh[i], version: e.target.value }; setReportData(r => ({ ...r, version_history: vh })) }} />
                      <input type="date" className="fo-input" style={{ fontSize: 12, padding: '4px 8px' }} value={entry.date}
                        onChange={e => { const vh = [...rd.version_history]; vh[i] = { ...vh[i], date: e.target.value }; setReportData(r => ({ ...r, version_history: vh })) }} />
                      <input className="fo-input" style={{ fontSize: 12, padding: '4px 8px' }} placeholder="Author" value={entry.author}
                        onChange={e => { const vh = [...rd.version_history]; vh[i] = { ...vh[i], author: e.target.value }; setReportData(r => ({ ...r, version_history: vh })) }} />
                      <input className="fo-input" style={{ fontSize: 12, padding: '4px 8px' }} placeholder="Changes" value={entry.changes}
                        onChange={e => { const vh = [...rd.version_history]; vh[i] = { ...vh[i], changes: e.target.value }; setReportData(r => ({ ...r, version_history: vh })) }} />
                      <button className="btn-icon" style={{ color: 'var(--c-red)' }}
                        onClick={() => setReportData(r => ({ ...r, version_history: r.version_history.filter((_, j) => j !== i) }))}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </StepSection>

          </div>
        )}

        {/* INTRODUCTION */}
        {tab === 'intro' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <HelpBanner title="Markdown supported" text="All narrative fields support Markdown: **bold**, *italic*, `code`, lists with - or 1., and fenced code blocks with ```language." />
            <div style={{ marginBottom: 24 }} />

            <StepSection step={1} icon={<BookOpen size={15} />} title="Preamble & Objective" desc="Opening paragraphs that set context. The preamble describes the report structure; the objective states the engagement goal.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="fo-label">Introduction Preamble</label>
                  <p style={{ fontSize: 11, color: 'var(--c-text-3)', marginBottom: 6 }}>Opening paragraph rendered before any headings — briefly describes the report structure and purpose.</p>
                  <textarea className="fo-textarea" style={{ minHeight: 88 }}
                    placeholder="This report aims to concisely outline the results collected during testing…"
                    value={rd.introduction?.preamble || ''}
                    onChange={e => setReportData(r => ({ ...r, introduction: { ...r.introduction, preamble: e.target.value } }))} />
                </div>
                <div>
                  <label className="fo-label">Engagement Objective</label>
                  <p style={{ fontSize: 11, color: 'var(--c-text-3)', marginBottom: 6 }}>State what this assessment was designed to achieve and the business context behind it.</p>
                  <textarea className="fo-textarea" style={{ minHeight: 104 }}
                    placeholder="Describe the objective and purpose of this assessment…"
                    value={rd.introduction?.objective || ''}
                    onChange={e => setReportData(r => ({ ...r, introduction: { ...r.introduction, objective: e.target.value } }))} />
                </div>
              </div>
            </StepSection>

            <StepSection step={2} icon={<ClipboardList size={15} />} title="Testing Approach & Methodology" desc="Explain how the testing was conducted and which frameworks or standards were followed.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="fo-label">Assessment Approach</label>
                  <textarea className="fo-textarea" style={{ minHeight: 136 }}
                    placeholder="Describe the testing approach, phases, and methodology used…"
                    value={rd.introduction?.approach || ''}
                    onChange={e => setReportData(r => ({ ...r, introduction: { ...r.introduction, approach: e.target.value } }))} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <label className="fo-label" style={{ marginBottom: 0 }}>Standards & Frameworks</label>
                      <p style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 2 }}>Standards applied (e.g. OWASP, PTES, NIST).</p>
                    </div>
                    <button className="btn btn-ghost btn-sm"
                      onClick={() => setReportData(r => ({ ...r, scope: { ...r.scope, methodology: [...(r.scope?.methodology || []), ''] } }))}>
                      <Plus size={12} /> Add
                    </button>
                  </div>
                  {(rd.scope?.methodology || []).length === 0 ? (
                    <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--c-text-3)' }}>No standards added.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(rd.scope?.methodology || []).map((item: string, i: number) => (
                        <div key={i} style={{ display: 'flex', gap: 8 }}>
                          <input className="fo-input" style={{ fontSize: 12, padding: '6px 8px', flex: 1 }} placeholder="e.g. OWASP Testing Guide v4.2"
                            value={item}
                            onChange={e => { const m = [...(rd.scope?.methodology || [])]; m[i] = e.target.value; setReportData(r => ({ ...r, scope: { ...r.scope, methodology: m } })) }} />
                          <button className="btn-icon" style={{ color: 'var(--c-red)' }}
                            onClick={() => setReportData(r => ({ ...r, scope: { ...r.scope, methodology: (r.scope?.methodology || []).filter((_, j) => j !== i) } }))}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </StepSection>

            <StepSection step={3} icon={<Target size={15} />} title="Scope" desc="Define exactly what was and was not tested. In-scope targets are rendered as a table in the report.">
              {/* In-Scope */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <label className="fo-label" style={{ marginBottom: 0 }}>In-Scope Targets</label>
                  <button className="btn btn-ghost btn-sm"
                    onClick={() => setReportData(r => ({ ...r, scope: { ...r.scope, in_scope: [...(r.scope?.in_scope || []), { category: '', targets: '' }] } }))}>
                    <Plus size={12} /> Add Row
                  </button>
                </div>
                {(rd.scope?.in_scope || []).length === 0 ? (
                  <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--c-text-3)', marginBottom: 0 }}>No in-scope targets defined.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(rd.scope?.in_scope || []).map((item: { category: string; targets: string }, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input className="fo-input" style={{ fontSize: 12, padding: '6px 8px', width: 144, flexShrink: 0 }} placeholder="Category (e.g. Web App)"
                          value={item.category}
                          onChange={e => { const s = [...(rd.scope?.in_scope || [])]; s[i] = { ...s[i], category: e.target.value }; setReportData(r => ({ ...r, scope: { ...r.scope, in_scope: s } })) }} />
                        <input className="fo-input-mono" style={{ fontSize: 12, padding: '6px 8px', flex: 1 }} placeholder="192.168.1.0/24, https://app.example.com"
                          value={item.targets}
                          onChange={e => { const s = [...(rd.scope?.in_scope || [])]; s[i] = { ...s[i], targets: e.target.value }; setReportData(r => ({ ...r, scope: { ...r.scope, in_scope: s } })) }} />
                        <button className="btn-icon" style={{ color: 'var(--c-red)', flexShrink: 0 }}
                          onClick={() => setReportData(r => ({ ...r, scope: { ...r.scope, in_scope: (r.scope?.in_scope || []).filter((_, j) => j !== i) } }))}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: 'var(--c-border)', margin: '16px 0' }} />

              {/* Out of Scope */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <label className="fo-label" style={{ marginBottom: 0 }}>Out of Scope</label>
                  <button className="btn btn-ghost btn-sm"
                    onClick={() => setReportData(r => ({ ...r, scope: { ...r.scope, out_of_scope: [...(r.scope?.out_of_scope || []), ''] } }))}>
                    <Plus size={12} /> Add
                  </button>
                </div>
                {(rd.scope?.out_of_scope || []).length === 0 ? (
                  <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--c-text-3)' }}>No out-of-scope items defined.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(rd.scope?.out_of_scope || []).map((item: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 8 }}>
                        <input className="fo-input" style={{ fontSize: 12, padding: '6px 8px', flex: 1 }} placeholder="e.g. Production database servers"
                          value={item}
                          onChange={e => { const s = [...(rd.scope?.out_of_scope || [])]; s[i] = e.target.value; setReportData(r => ({ ...r, scope: { ...r.scope, out_of_scope: s } })) }} />
                        <button className="btn-icon" style={{ color: 'var(--c-red)' }}
                          onClick={() => setReportData(r => ({ ...r, scope: { ...r.scope, out_of_scope: (r.scope?.out_of_scope || []).filter((_, j) => j !== i) } }))}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </StepSection>

            <StepSection step={4} icon={<Users2 size={15} />} title="Testing Team & Dates" desc="List the individuals who performed testing and record the exact testing window.">
              {/* Team members */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <label className="fo-label" style={{ marginBottom: 0 }}>Team Members</label>
                <button className="btn btn-ghost btn-sm"
                  onClick={() => setReportData(r => ({ ...r, introduction: { ...r.introduction, testing_team: [...(r.introduction.testing_team || []), { name: '', role: '' }] } }))}>
                  <Plus size={12} /> Add
                </button>
              </div>
              {(rd.introduction?.testing_team || []).length === 0 ? (
                <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--c-text-3)', marginBottom: 0 }}>No team members added.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 0 }}>
                  {(rd.introduction?.testing_team || []).map((m: TeamMember, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 8 }}>
                      <input className="fo-input" style={{ fontSize: 12, padding: '6px 8px', flex: 1 }} placeholder="Name" value={m.name}
                        onChange={e => { const t = [...rd.introduction.testing_team]; t[i] = { ...t[i], name: e.target.value }; setReportData(r => ({ ...r, introduction: { ...r.introduction, testing_team: t } })) }} />
                      <input className="fo-input" style={{ fontSize: 12, padding: '6px 8px', flex: 1 }} placeholder="Role" value={m.role}
                        onChange={e => { const t = [...rd.introduction.testing_team]; t[i] = { ...t[i], role: e.target.value }; setReportData(r => ({ ...r, introduction: { ...r.introduction, testing_team: t } })) }} />
                      <button className="btn-icon" style={{ color: 'var(--c-red)' }}
                        onClick={() => setReportData(r => ({ ...r, introduction: { ...r.introduction, testing_team: r.introduction.testing_team.filter((_, j) => j !== i) } }))}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ height: 1, background: 'var(--c-border)', margin: '16px 0' }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Testing Start">
                  <input type="date" className="fo-input"
                    value={rd.introduction?.testing_dates?.start || ''}
                    onChange={e => setReportData(r => ({ ...r, introduction: { ...r.introduction, testing_dates: { ...r.introduction.testing_dates, start: e.target.value } } }))} />
                </Field>
                <Field label="Testing End">
                  <input type="date" className="fo-input"
                    value={rd.introduction?.testing_dates?.end || ''}
                    onChange={e => setReportData(r => ({ ...r, introduction: { ...r.introduction, testing_dates: { ...r.introduction.testing_dates, end: e.target.value } } }))} />
                </Field>
              </div>
            </StepSection>

            <StepSection step={5} icon={<Shield size={15} />} title="Authorisation & Caveats" desc="Formal authorisation statement and any limitations or constraints that applied during testing." last>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="fo-label">Authorisation Statement (Markdown)</label>
                  <p style={{ fontSize: 11, color: 'var(--c-text-3)', marginBottom: 6 }}>Written authorisation for the assessment — names the authorising party and date.</p>
                  <textarea className="fo-textarea" style={{ minHeight: 88 }}
                    placeholder="This assessment was authorised by Jane Smith, CISO, on 2026-04-01…"
                    value={rd.introduction?.authorization || ''}
                    onChange={e => setReportData(r => ({ ...r, introduction: { ...r.introduction, authorization: e.target.value } }))} />
                </div>

                <div style={{ height: 1, background: 'var(--c-border)' }} />

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <label className="fo-label" style={{ marginBottom: 0 }}>Caveats & Limitations</label>
                    <button className="btn btn-ghost btn-sm"
                      onClick={() => setReportData(r => ({ ...r, introduction: { ...r.introduction, caveats: [...(r.introduction.caveats || []), ''] } }))}>
                      <Plus size={12} /> Add
                    </button>
                  </div>
                  {(rd.introduction?.caveats || []).length === 0 ? (
                    <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--c-text-3)' }}>No caveats added.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(rd.introduction?.caveats || []).map((c: string, i: number) => (
                        <div key={i} style={{ display: 'flex', gap: 8 }}>
                          <input className="fo-input" style={{ fontSize: 12, padding: '6px 8px', flex: 1 }} value={c}
                            onChange={e => { const cavs = [...rd.introduction.caveats]; cavs[i] = e.target.value; setReportData(r => ({ ...r, introduction: { ...r.introduction, caveats: cavs } })) }} />
                          <button className="btn-icon" style={{ color: 'var(--c-red)' }}
                            onClick={() => setReportData(r => ({ ...r, introduction: { ...r.introduction, caveats: r.introduction.caveats.filter((_, j) => j !== i) } }))}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </StepSection>

          </div>
        )}

        {/* FINDINGS */}
        {tab === 'findings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <p style={{ fontSize: 13, color: 'var(--c-text-2)' }}>
                {allFindings.length} finding{allFindings.length !== 1 ? 's' : ''} across {sections.length} section{sections.length !== 1 ? 's' : ''}
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* View toggle */}
                <div style={{ display: 'flex', background: 'var(--c-surface)', borderRadius: 6, border: '1px solid var(--c-border)', overflow: 'hidden' }}>
                  <button
                    onClick={() => setFindingsViewMode('kanban')}
                    style={{ padding: '4px 12px', fontSize: 11, fontWeight: 500, background: findingsViewMode === 'kanban' ? 'var(--c-purple-dim)' : 'transparent', color: findingsViewMode === 'kanban' ? 'var(--c-purple-text)' : 'var(--c-text-3)', border: 'none', cursor: 'pointer', transition: 'all 0.12s' }}
                  >
                    <Layers size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />By Severity
                  </button>
                  <button
                    onClick={() => setFindingsViewMode('section')}
                    style={{ padding: '4px 12px', fontSize: 11, fontWeight: 500, background: findingsViewMode === 'section' ? 'var(--c-purple-dim)' : 'transparent', color: findingsViewMode === 'section' ? 'var(--c-purple-text)' : 'var(--c-text-3)', border: 'none', cursor: 'pointer', transition: 'all 0.12s' }}
                  >
                    <FileText size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />By Section
                  </button>
                </div>
                <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }} title="Import from Nessus XML">
                  {importing
                    ? <><div className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> Importing…</>
                    : <><Upload size={13} /> Import Nessus</>}
                  <input ref={nessusRef} type="file" accept=".nessus,.xml" style={{ display: 'none' }} onChange={handleNessusImport} disabled={importing} />
                </label>
                <button className="btn btn-ghost btn-sm" onClick={() => setSectionModalOpen(true)}>
                  <Plus size={13} /> Add Section
                </button>
                {sections.length > 0 && (
                  <button className="btn btn-primary btn-sm" onClick={() => openNewFinding(sections[0].id)}>
                    <Plus size={13} /> Add Finding
                  </button>
                )}
              </div>
            </div>

            {sections.length === 0 ? (
              <div className="fo-card-flat" style={{ padding: 40, textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginBottom: 12 }}>No sections yet. Add a section to start adding findings.</p>
                <button className="btn btn-primary" onClick={() => setSectionModalOpen(true)}><Plus size={13} /> Add Section</button>
              </div>
            ) : findingsViewMode === 'kanban' ? (
              /* ── KANBAN VIEW ─────────────────────────────────────────────────── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dragFindingId && (
                  <div style={{ fontSize: 12, color: 'var(--c-text-3)', textAlign: 'center', padding: '4px 0', fontStyle: 'italic' }}>
                    Drag to a severity band to change rating
                  </div>
                )}
                {SEV_ORDER.map(sev => {
                  const band = SEV_BAND[sev]
                  const sevFindings = allFindings.filter(f => (f.severity as string) === sev)
                  const isOver = dragOverSev === sev
                  return (
                    <div
                      key={sev}
                      data-sev={sev}
                      style={{
                        borderRadius: 8, overflow: 'hidden',
                        border: `2px solid ${isOver ? band.color : 'var(--c-border)'}`,
                        background: isOver ? band.dropBg : 'transparent',
                        transition: 'border-color 0.12s, background 0.12s',
                      }}
                    >
                      {/* Band header */}
                      <div style={{ padding: '8px 16px', background: band.headerBg, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: band.color, letterSpacing: '0.06em' }}>{band.label.toUpperCase()}</span>
                          <span style={{ fontSize: 11, color: band.color, opacity: 0.7 }}>{sevFindings.length} finding{sevFindings.length !== 1 ? 's' : ''}</span>
                        </div>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 10, padding: '2px 8px', color: band.color, opacity: 0.8 }}
                          onClick={() => { openNewFinding(sections[0].id) }}
                        >
                          <Plus size={10} /> Add
                        </button>
                      </div>

                      {/* Findings rows */}
                      {sevFindings.length === 0 ? (
                        <div style={{ padding: '14px 20px', fontSize: 12, color: 'var(--c-text-3)', textAlign: 'center', fontStyle: 'italic' }}>
                          {isOver ? `Drop here → ${band.label}` : `No ${band.label.toLowerCase()} findings`}
                        </div>
                      ) : (
                        <div>
                          {sevFindings.map(f => {
                            const parentSec = sections.find(s => s.findings.some(sf => sf.id === f.id))
                            const isDraggingThis = dragFindingId === f.id
                            return (
                              <div
                                key={f.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  borderBottom: '1px solid var(--c-border)',
                                  opacity: isDraggingThis ? 0.35 : 1,
                                  userSelect: 'none',
                                  background: 'transparent',
                                }}
                              >
                                {/* Drag handle */}
                                <div
                                  onMouseDown={e => {
                                    e.preventDefault()
                                    dragFindingIdRef.current = f.id
                                    setDragFindingId(f.id)
                                  }}
                                  style={{ padding: '10px 6px 10px 16px', cursor: dragFindingId ? 'grabbing' : 'grab', flexShrink: 0, lineHeight: 0 }}
                                >
                                  <Layers size={13} style={{ color: 'var(--c-text-3)' }} />
                                </div>
                                {/* Clickable row */}
                                <div
                                  onClick={() => { if (!dragFindingId && parentSec) openEditFinding(f, parentSec.id) }}
                                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 8px 4px', cursor: 'pointer' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--c-surface-2)' }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                                >
                                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: band.color, width: 72, flexShrink: 0 }}>{f.id}</span>
                                  <span style={{ flex: 1, fontSize: 13, color: 'var(--c-text-1)', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.title}</span>
                                  {parentSec && (
                                    <span style={{ fontSize: 10, padding: '2px 7px', background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', borderRadius: 3, color: 'var(--c-text-3)', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                      {parentSec.title}
                                    </span>
                                  )}
                                  <span style={{ fontSize: 11, color: 'var(--c-text-3)', whiteSpace: 'nowrap', flexShrink: 0, minWidth: 48, textAlign: 'right' }}>
                                    {(f.affected_hosts?.length || 0) > 0 ? `${f.affected_hosts.length} host${f.affected_hosts.length !== 1 ? 's' : ''}` : ''}
                                  </span>
                                  <Pencil size={11} style={{ color: 'var(--c-text-2)', opacity: 0.35, flexShrink: 0 }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              /* ── SECTION VIEW ────────────────────────────────────────────────── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {sections.map(section => (
                  <div key={section.id} className="fo-card-flat" style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--c-surface-2)', borderBottom: '1px solid var(--c-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h3 style={{ fontWeight: 600, fontSize: 13, color: 'var(--c-text-1)' }}>{section.title}</h3>
                        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--c-text-3)' }}>
                          {section.findings.length} finding{section.findings.length !== 1 ? 's' : ''}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--c-text-3)', fontFamily: 'var(--mono)' }}>
                          {sectionPrefix(section.title)}-*
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openNewFinding(section.id)}>
                          <Plus size={12} /> Add
                        </button>
                        <button className="btn-icon" style={{ color: 'var(--c-red)' }}
                          onClick={() => { if (confirm('Delete this section and all its findings?')) { setReportData(rd => ({ ...rd, sections: rd.sections.filter(s => s.id !== section.id) })) } }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    {section.findings.length === 0 ? (
                      <div style={{ padding: '24px 20px', textAlign: 'center', fontSize: 12, color: 'var(--c-text-3)' }}>
                        No findings in this section.
                      </div>
                    ) : (
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th style={{ width: 90 }}>ID</th>
                            <th>Title</th>
                            <th style={{ width: 90 }}>Severity</th>
                            <th style={{ width: 60 }}>Hosts</th>
                            <th style={{ width: 36 }} />
                          </tr>
                        </thead>
                        <tbody>
                          {section.findings.slice().sort((a, b) => SEV_ORDER.indexOf(a.severity as Severity) - SEV_ORDER.indexOf(b.severity as Severity)).map(f => (
                            <tr key={f.id} onClick={() => openEditFinding(f, section.id)} style={{ cursor: 'pointer' }}>
                              <td><span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: SEV_BAND[f.severity]?.color || 'var(--c-text-2)' }}>{f.id}</span></td>
                              <td className="td-primary">{f.title}</td>
                              <td><SeverityBadge severity={f.severity} size="xs" /></td>
                              <td style={{ fontSize: 12, color: 'var(--c-text-3)' }}>{f.affected_hosts?.length || 0}</td>
                              <td><Pencil size={11} style={{ color: 'var(--c-text-2)', opacity: 0.4 }} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SCENARIOS */}
        {tab === 'scenarios' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)' }}>Exploitation Scenarios</p>
                <p style={{ fontSize: 12, color: 'var(--c-text-3)', marginTop: 2 }}>
                  Document significant attack chains. Optional — only included in PDF if at least one scenario exists.
                </p>
              </div>
              <button className="btn btn-primary btn-sm" onClick={openNewScenario}>
                <Plus size={13} /> Add Scenario
              </button>
            </div>

            {(rd.exploitation_scenarios || []).length === 0 ? (
              <div className="fo-card-flat" style={{ padding: 40, textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--c-text-2)', marginBottom: 4 }}>No exploitation scenarios added.</p>
                <p style={{ fontSize: 12, color: 'var(--c-text-3)', marginBottom: 16 }}>
                  Add scenarios to document attack chains, privilege escalation paths, or significant findings.
                </p>
                <button className="btn btn-primary btn-sm" onClick={openNewScenario}><Plus size={13} /> Add Scenario</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(rd.exploitation_scenarios || []).map((s: ExploitScenario, i: number) => (
                  <div key={s.id || i} className="fo-card">
                    <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid var(--c-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <SeverityBadge severity={s.severity} size="xs" />
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--c-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title || '(Untitled)'}</p>
                            <p style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--c-text-3)', marginTop: 2 }}>{s.id}</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button className="btn-icon" onClick={() => openEditScenario(s)}><Pencil size={11} /></button>
                          <button className="btn-icon" style={{ color: 'var(--c-red)' }} onClick={() => handleDeleteScenario(s.id)}><Trash2 size={11} /></button>
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '10px 20px' }}>
                      {s.narrative ? (
                        <p style={{ fontSize: 12, color: 'var(--c-text-2)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.narrative}</p>
                      ) : (
                        <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--c-text-3)' }}>No narrative</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Scenario Modal */}
            <Modal open={scenarioModalOpen} onClose={() => setScenarioModalOpen(false)}
              title={editingScenario ? 'Edit Scenario' : 'New Exploitation Scenario'}
              subtitle="Document a significant attack chain or multi-step exploitation path"
              maxWidth="680px">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                  <div>
                    <label className="fo-label">Scenario ID</label>
                    <input className="fo-input-mono" placeholder="SCENARIO-01"
                      value={scenarioForm.id}
                      onChange={e => setScenarioForm(f => ({ ...f, id: e.target.value }))} />
                  </div>
                  <div>
                    <label className="fo-label">Title *</label>
                    <input className="fo-input" placeholder="Domain Compromise via Kerberoasting"
                      value={scenarioForm.title}
                      onChange={e => setScenarioForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="fo-label">Severity</label>
                    <select className="fo-select" value={scenarioForm.severity}
                      onChange={e => setScenarioForm(f => ({ ...f, severity: e.target.value as Severity }))}>
                      {(['critical', 'high', 'medium', 'low', 'informational'] as Severity[]).map(sv => (
                        <option key={sv} value={sv}>{sv.charAt(0).toUpperCase() + sv.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                    <input type="checkbox" id="sc_enabled" checked={scenarioForm.enabled}
                      onChange={e => setScenarioForm(f => ({ ...f, enabled: e.target.checked }))}
                      style={{ accentColor: 'var(--c-purple)' }} />
                    <label htmlFor="sc_enabled" style={{ fontSize: 12, cursor: 'pointer', color: 'var(--c-text-2)' }}>
                      Include in report
                    </label>
                  </div>
                </div>
                <div>
                  <label className="fo-label">Related Finding IDs</label>
                  <p style={{ fontSize: 10, color: 'var(--c-text-3)', marginBottom: 6 }}>Link finding IDs so they appear as references in the PDF (e.g. INT-001, WEB-003)</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {(scenarioForm.finding_refs || []).map((ref, i) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: 'var(--mono)', padding: '2px 8px', background: 'var(--c-purple-dim)', color: 'var(--c-purple-text)', border: '1px solid rgba(123,111,205,0.25)', borderRadius: 4 }}>
                        {ref}
                        <button style={{ color: 'var(--c-text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                          onClick={() => setScenarioForm(f => ({ ...f, finding_refs: f.finding_refs.filter((_, j) => j !== i) }))}>
                          <X size={9} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input className="fo-input-mono" style={{ fontSize: 12, padding: '6px 8px', flex: 1 }} placeholder="INT-001"
                      value={newFindingRef}
                      onChange={e => setNewFindingRef(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newFindingRef.trim()) {
                          e.preventDefault()
                          setScenarioForm(f => ({ ...f, finding_refs: [...(f.finding_refs || []), newFindingRef.trim()] }))
                          setNewFindingRef('')
                        }
                      }} />
                    <button className="btn-icon" onClick={() => {
                      if (!newFindingRef.trim()) return
                      setScenarioForm(f => ({ ...f, finding_refs: [...(f.finding_refs || []), newFindingRef.trim()] }))
                      setNewFindingRef('')
                    }}><Plus size={13} /></button>
                  </div>
                </div>
                <div>
                  <label className="fo-label">
                    Narrative &amp; Evidence
                    <span style={{ color: 'var(--c-text-3)', textTransform: 'none', letterSpacing: 'normal', fontSize: 10, marginLeft: 6 }}>
                      — interleave text, screenshots &amp; code blocks
                    </span>
                  </label>
                  <ContentBlockEditor
                    blocks={scenarioContentBlocks}
                    projectId={projectId}
                    onChange={setScenarioContentBlocks}
                    placeholder="Describe the attack chain step by step…"
                  />
                </div>
                <div>
                  <label className="fo-label">Recommendation (Markdown)</label>
                  <textarea className="fo-textarea" style={{ minHeight: 96 }} placeholder="Describe remediation steps…"
                    value={scenarioForm.recommendation}
                    onChange={e => setScenarioForm(f => ({ ...f, recommendation: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, marginTop: 16, borderTop: '1px solid var(--c-border)' }}>
                <button className="btn btn-outline" onClick={() => setScenarioModalOpen(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveScenario} disabled={!scenarioForm.title.trim()}>
                  {editingScenario ? 'Save Changes' : 'Add Scenario'}
                </button>
              </div>
            </Modal>
          </div>
        )}

        {/* SUMMARY */}
        {tab === 'summary' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <HelpBanner title="Markdown supported" text="Narrative fields support Markdown: **bold**, *italic*, `code`, bullet lists." />
            <div style={{ marginBottom: 24 }} />

            <StepSection step={1} icon={<AlertTriangle size={15} />} title="Overall Risk Rating" desc="The top-line severity for the entire engagement. Displayed as a prominence badge on the Executive Summary page.">
              <div>
                <label className="fo-label">Risk Rating</label>
                <select className="fo-select" style={{ maxWidth: 240 }}
                  value={rd.executive_summary?.overall_risk_rating || 'High'}
                  onChange={e => setReportData(r => ({ ...r, executive_summary: { ...r.executive_summary, overall_risk_rating: e.target.value } }))}>
                  {['Critical', 'High', 'Medium', 'Low', 'Informational'].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
            </StepSection>

            <StepSection step={2} icon={<FileText size={15} />} title="Executive Summary" desc="Opening narrative for a C-suite or board audience. Avoid technical jargon — focus on business risk and impact.">
              <div>
                <label className="fo-label">Executive Summary Narrative</label>
                <p style={{ fontSize: 11, color: 'var(--c-text-3)', marginBottom: 6 }}>Opening paragraph for a C-suite/board audience. Avoid jargon — focus on business risk.</p>
                <textarea className="fo-textarea" style={{ minHeight: 152 }} placeholder="During the assessment period, RootSec identified a number of significant vulnerabilities…"
                  value={rd.executive_summary?.narrative || ''}
                  onChange={e => setReportData(r => ({ ...r, executive_summary: { ...r.executive_summary, narrative: e.target.value } }))} />
              </div>
            </StepSection>

            <StepSection step={3} icon={<ClipboardList size={15} />} title="Management Summary" desc="Plain-text summary for non-technical management. Rendered as a paragraph block in the PDF between Executive Summary and Technical Summary.">
              <div>
                <label className="fo-label">Management Summary</label>
                <p style={{ fontSize: 11, color: 'var(--c-text-3)', marginBottom: 6 }}>High-level overview for non-technical stakeholders. Supports Markdown.</p>
                <textarea className="fo-textarea" style={{ minHeight: 152 }} placeholder="The assessment identified several critical weaknesses that pose an immediate risk to the organisation. Key concerns include…"
                  value={(rd.executive_summary as any)?.management_summary || ''}
                  onChange={e => setReportData(r => ({ ...r, executive_summary: { ...r.executive_summary, management_summary: e.target.value } as any }))} />
              </div>
            </StepSection>

            <StepSection step={4} icon={<ClipboardList size={15} />} title="Technical Summary" desc="Detailed narrative for a technical audience — cover attack surface, key weaknesses, and testing outcomes." last>
              <div>
                <label className="fo-label">Technical Narrative</label>
                <p style={{ fontSize: 11, color: 'var(--c-text-3)', marginBottom: 6 }}>Cover attack surface, key weaknesses, and testing outcomes for a technical audience.</p>
                <textarea className="fo-textarea" style={{ minHeight: 168 }} placeholder="The internal network assessment identified several critical weaknesses in the Active Directory environment…"
                  value={rd.technical_summary?.narrative || ''}
                  onChange={e => setReportData(r => ({ ...r, technical_summary: { narrative: e.target.value } }))} />
              </div>
            </StepSection>

          </div>
        )}

        {/* ROADMAP */}
        {tab === 'roadmap' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <HelpBanner title="Manual Remediation Roadmap" text="Override the auto-generated roadmap by manually assigning findings to tiers. Leave empty to use the automatic roadmap (groups by severity). Effort: Low / Medium / High." />
            {[
              { key: 'immediate',   label: 'Immediate (0–7 days)',     desc: 'Critical findings — act now',       color: '#ef4444' },
              { key: 'short_term',  label: 'Short-Term (8–30 days)',   desc: 'High findings — current sprint',    color: '#f97316' },
              { key: 'medium_term', label: 'Medium-Term (31–90 days)', desc: 'Medium findings — this quarter',   color: '#eab308' },
              { key: 'long_term',   label: 'Long-Term (90+ days)',     desc: 'Low/Info — upcoming cycle',         color: 'var(--c-purple-text)' },
            ].map(tier => {
              const tierItems = (rd.remediation_roadmap?.timeframes?.[tier.key as keyof typeof rd.remediation_roadmap.timeframes]?.items || []) as RoadmapItem[]
              return (
                <div key={tier.key} className="fo-card-flat" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--c-border)' }}>
                    <div>
                      <h3 style={{ fontSize: 13, fontWeight: 600, color: tier.color }}>{tier.label}</h3>
                      <p style={{ fontSize: 10, color: 'var(--c-text-3)' }}>{tier.desc}</p>
                    </div>
                    <button className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setReportData(r => {
                          const rm = r.remediation_roadmap || {}
                          const tf = rm.timeframes || {}
                          const t = tf[tier.key as keyof typeof tf] || { items: [] }
                          return {
                            ...r,
                            remediation_roadmap: {
                              ...rm,
                              timeframes: {
                                ...tf,
                                [tier.key]: { ...t, items: [...(t.items || []), { finding_id: '', effort: '', owner: '', notes: '' }] }
                              }
                            }
                          }
                        })
                      }}>
                      <Plus size={12} /> Add Row
                    </button>
                  </div>
                  {tierItems.length === 0 ? (
                    <p style={{ padding: '12px 20px', fontSize: 12, fontStyle: 'italic', color: 'var(--c-text-3)' }}>No entries — auto-roadmap will be used for this tier.</p>
                  ) : (
                    <div>
                      {tierItems.map((item, i) => (
                        <div key={i} style={{ padding: '8px 20px', display: 'grid', gap: 8, gridTemplateColumns: '1fr 80px 1fr 1fr 28px', borderBottom: '1px solid var(--c-border)' }}>
                          <input className="fo-input-mono" style={{ fontSize: 12, padding: '4px 8px' }} placeholder="Finding ID (e.g. INT-001)"
                            value={item.finding_id}
                            onChange={e => setReportData(r => {
                              const rm = { ...(r.remediation_roadmap || {}) }
                              const tf = { ...(rm.timeframes || {}) }
                              const t = { ...(tf[tier.key as keyof typeof tf] || { items: [] }) }
                              const items = [...(t.items || [])]
                              items[i] = { ...items[i], finding_id: e.target.value }
                              tf[tier.key as keyof typeof tf] = { ...t, items }
                              rm.timeframes = tf
                              return { ...r, remediation_roadmap: rm }
                            })} />
                          <select className="fo-select" style={{ fontSize: 12 }}
                            value={item.effort || ''}
                            onChange={e => setReportData(r => {
                              const rm = { ...(r.remediation_roadmap || {}) }
                              const tf = { ...(rm.timeframes || {}) }
                              const t = { ...(tf[tier.key as keyof typeof tf] || { items: [] }) }
                              const items = [...(t.items || [])]
                              items[i] = { ...items[i], effort: e.target.value }
                              tf[tier.key as keyof typeof tf] = { ...t, items }
                              rm.timeframes = tf
                              return { ...r, remediation_roadmap: rm }
                            })}>
                            <option value="">Effort</option>
                            {['Low', 'Medium', 'High'].map(e => <option key={e} value={e}>{e}</option>)}
                          </select>
                          <input className="fo-input" style={{ fontSize: 12, padding: '4px 8px' }} placeholder="Owner"
                            value={item.owner || ''}
                            onChange={e => setReportData(r => {
                              const rm = { ...(r.remediation_roadmap || {}) }
                              const tf = { ...(rm.timeframes || {}) }
                              const t = { ...(tf[tier.key as keyof typeof tf] || { items: [] }) }
                              const items = [...(t.items || [])]
                              items[i] = { ...items[i], owner: e.target.value }
                              tf[tier.key as keyof typeof tf] = { ...t, items }
                              rm.timeframes = tf
                              return { ...r, remediation_roadmap: rm }
                            })} />
                          <input className="fo-input" style={{ fontSize: 12, padding: '4px 8px' }} placeholder="Notes"
                            value={item.notes || ''}
                            onChange={e => setReportData(r => {
                              const rm = { ...(r.remediation_roadmap || {}) }
                              const tf = { ...(rm.timeframes || {}) }
                              const t = { ...(tf[tier.key as keyof typeof tf] || { items: [] }) }
                              const items = [...(t.items || [])]
                              items[i] = { ...items[i], notes: e.target.value }
                              tf[tier.key as keyof typeof tf] = { ...t, items }
                              rm.timeframes = tf
                              return { ...r, remediation_roadmap: rm }
                            })} />
                          <button className="btn-icon" style={{ color: 'var(--c-red)' }}
                            onClick={() => setReportData(r => {
                              const rm = { ...(r.remediation_roadmap || {}) }
                              const tf = { ...(rm.timeframes || {}) }
                              const t = { ...(tf[tier.key as keyof typeof tf] || { items: [] }) }
                              tf[tier.key as keyof typeof tf] = { ...t, items: (t.items || []).filter((_: RoadmapItem, j: number) => j !== i) }
                              rm.timeframes = tf
                              return { ...r, remediation_roadmap: rm }
                            })}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* APPENDICES */}
        {tab === 'appendices' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <HelpBanner title="Appendices" text="If Tools & Utilities are entered: A = Tools, B = Engagement Info, C = Risk Methodology. If left empty: A = Engagement Info, B = Risk Methodology." />
            <div style={{ marginBottom: 24 }} />

            <StepSection step={1} icon={<Wrench size={15} />} title="Tools & Utilities" desc="List all tools used during testing. Becomes Appendix A in the PDF. Leave empty to omit this appendix.">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button className="btn btn-ghost btn-sm"
                  onClick={() => setReportData(r => ({ ...r, tools_used: [...(r.tools_used || []), { tool: '', purpose: '', reference: '' }] }))}>
                  <Plus size={12} /> Add Tool
                </button>
              </div>
              {(rd.tools_used || []).length === 0 ? (
                <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--c-text-3)' }}>No tools added. Appendix A will be omitted from the PDF.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 28px', gap: 8, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--c-border)' }}>
                    {['Tool', 'Purpose', 'Reference', ''].map((h, i) => (
                      <span key={i} style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-3)' }}>{h}</span>
                    ))}
                  </div>
                  {(rd.tools_used || []).map((tool: ToolEntry, i: number) => (
                    <div key={i} style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 2fr 1fr 28px', marginBottom: 8 }}>
                      <input className="fo-input-mono" style={{ fontSize: 12, padding: '4px 8px' }} placeholder="nmap"
                        value={tool.tool}
                        onChange={e => { const t = [...(rd.tools_used || [])]; t[i] = { ...t[i], tool: e.target.value }; setReportData(r => ({ ...r, tools_used: t })) }} />
                      <input className="fo-input" style={{ fontSize: 12, padding: '4px 8px' }} placeholder="Purpose"
                        value={tool.purpose}
                        onChange={e => { const t = [...(rd.tools_used || [])]; t[i] = { ...t[i], purpose: e.target.value }; setReportData(r => ({ ...r, tools_used: t })) }} />
                      <input className="fo-input" style={{ fontSize: 12, padding: '4px 8px' }} placeholder="Reference URL (optional)"
                        value={tool.reference}
                        onChange={e => { const t = [...(rd.tools_used || [])]; t[i] = { ...t[i], reference: e.target.value }; setReportData(r => ({ ...r, tools_used: t })) }} />
                      <button className="btn-icon" style={{ color: 'var(--c-red)' }}
                        onClick={() => setReportData(r => ({ ...r, tools_used: (r.tools_used || []).filter((_, j) => j !== i) }))}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </StepSection>

            <StepSection step={2} icon={<Users2 size={15} />} title="Distribution List" desc="Who receives this report. Part of the Engagement Information appendix (Appendix B).">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button className="btn btn-ghost btn-sm"
                  onClick={() => setReportData(r => ({ ...r, meta: { ...r.meta, distribution: [...(r.meta?.distribution || []), { name: '', role: '' }] } }))}>
                  <Plus size={12} /> Add Recipient
                </button>
              </div>
              {(rd.meta?.distribution || []).length === 0 ? (
                <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--c-text-3)' }}>No recipients added.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 28px', gap: 8, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--c-border)' }}>
                    {['Name', 'Role / Company', ''].map((h, i) => (
                      <span key={i} style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-3)' }}>{h}</span>
                    ))}
                  </div>
                  {(rd.meta?.distribution || []).map((recipient: { name: string; role: string }, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input className="fo-input" style={{ fontSize: 12, padding: '6px 8px', flex: 1 }} placeholder="Full name"
                        value={recipient.name || ''}
                        onChange={e => {
                          const dist = [...(rd.meta?.distribution || [])]
                          dist[i] = { ...dist[i], name: e.target.value }
                          setReportData(r => ({ ...r, meta: { ...r.meta, distribution: dist } }))
                        }} />
                      <input className="fo-input" style={{ fontSize: 12, padding: '6px 8px', flex: 1 }} placeholder="Role / Company"
                        value={recipient.role || ''}
                        onChange={e => {
                          const dist = [...(rd.meta?.distribution || [])]
                          dist[i] = { ...dist[i], role: e.target.value }
                          setReportData(r => ({ ...r, meta: { ...r.meta, distribution: dist } }))
                        }} />
                      <button className="btn-icon" style={{ color: 'var(--c-red)' }}
                        onClick={() => setReportData(r => ({ ...r, meta: { ...r.meta, distribution: (r.meta?.distribution || []).filter((_, j) => j !== i) } }))}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </StepSection>

            <StepSection step={3} icon={<Shield size={15} />} title="Risk Rating Methodology" desc="Always the final appendix. Auto-generated from the CVSS 4.0 severity definitions — no customisation required." last>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--c-border)', borderRadius: 6, padding: '14px 16px' }}>
                <p style={{ fontSize: 12, color: 'var(--c-text-2)', marginBottom: 10, fontWeight: 500 }}>Standard CVSS 4.0 severity scale</p>
                {[
                  { label: 'Critical', range: 'CVSS 9.0–10.0', desc: 'Immediate exploitation likely. Full compromise of confidentiality, integrity, or availability.' },
                  { label: 'High',     range: 'CVSS 7.0–8.9',  desc: 'Significant impact. Exploitation possible without special conditions.' },
                  { label: 'Medium',   range: 'CVSS 4.0–6.9',  desc: 'Moderate impact. Exploitation requires specific conditions or user interaction.' },
                  { label: 'Low',      range: 'CVSS 0.1–3.9',  desc: 'Limited impact. Minimal risk; hardening recommended.' },
                  { label: 'Info',     range: 'CVSS 0.0',       desc: 'Informational. No direct risk; noted for awareness.' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', gap: 12, paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid var(--c-border)', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-3)', width: 64, flexShrink: 0, paddingTop: 1 }}>{row.label}</span>
                    <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--c-text-3)', width: 96, flexShrink: 0, paddingTop: 2 }}>{row.range}</span>
                    <span style={{ fontSize: 12, color: 'var(--c-text-2)' }}>{row.desc}</span>
                  </div>
                ))}
                <p style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 4 }}>This table is auto-generated in the PDF. No editing required.</p>
              </div>
            </StepSection>

          </div>
        )}

        {/* GENERATE */}
        {tab === 'generate' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Top card */}
            <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="fo-card-flat" style={{ padding: 24 }}>
                <h3 style={{ fontWeight: 600, color: 'var(--c-text-1)', marginBottom: 4 }}>Generate Report PDF</h3>
                <p style={{ fontSize: 13, color: 'var(--c-text-2)', marginBottom: 20 }}>
                  Renders the full report via Playwright and your Jinja2 templates. Changes are auto-saved before generation.
                </p>

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--c-border)', borderRadius: 4, padding: 16, marginBottom: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-3)', marginBottom: 12 }}>Risk Summary</p>
                  {allFindings.length === 0 ? (
                    <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--c-text-3)' }}>No findings added yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {(['critical', 'high', 'medium', 'low', 'informational'] as const).map(sev => {
                        const count = allFindings.filter(f => f.severity === sev).length
                        return count > 0 ? (
                          <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <SeverityBadge severity={sev} size="xs" />
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-1)' }}>×{count}</span>
                          </div>
                        ) : null
                      })}
                    </div>
                  )}
                  <p style={{ fontSize: 12, color: 'var(--c-text-3)', marginTop: 12 }}>
                    {allFindings.length} finding{allFindings.length !== 1 ? 's' : ''} · {sections.length} section{sections.length !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Cover style */}
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-3)', marginBottom: 10 }}>Cover Style</p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {(['dark', 'light'] as const).map(style => {
                      const active = (rd.cover_style ?? 'dark') === style
                      return (
                        <button
                          key={style}
                          onClick={() => setReportData(r => ({ ...r, cover_style: style }))}
                          style={{
                            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                            gap: 8, padding: '12px 8px', borderRadius: 6, cursor: 'pointer',
                            border: active ? '2px solid var(--c-blue)' : '2px solid var(--c-border)',
                            background: active ? 'rgba(26,125,217,0.08)' : 'var(--c-surface)',
                          }}
                        >
                          {/* Mini cover preview */}
                          <div style={{
                            width: 52, height: 68, borderRadius: 3, overflow: 'hidden', position: 'relative',
                            background: style === 'dark' ? '#0d1117' : '#ffffff',
                            border: '1px solid var(--c-border)',
                            borderTop: style === 'light' ? '3px solid #e63946' : '1px solid var(--c-border)',
                            borderLeft: style === 'dark' ? '3px solid #e63946' : '1px solid var(--c-border)',
                          }}>
                            <div style={{ padding: '8px 5px 5px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                              <div style={{ width: 20, height: 2, background: '#e63946', borderRadius: 1 }} />
                              <div style={{ width: 28, height: 3, background: style === 'dark' ? 'rgba(240,246,252,0.8)' : '#111827', borderRadius: 1 }} />
                              <div style={{ width: 22, height: 2, background: style === 'dark' ? 'rgba(139,148,158,0.5)' : 'rgba(75,85,99,0.5)', borderRadius: 1 }} />
                              <div style={{ width: 18, height: 2, background: style === 'dark' ? 'rgba(139,148,158,0.3)' : 'rgba(75,85,99,0.3)', borderRadius: 1, marginTop: 4 }} />
                            </div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 500, color: active ? 'var(--c-blue)' : 'var(--c-text-2)' }}>
                            {style === 'dark' ? 'Dark' : 'Light'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                  onClick={handleGeneratePdf}
                  disabled={generating || previewing}
                >
                  {generating
                    ? <><div className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} /> Generating…</>
                    : <><FileDown size={15} /> Download PDF Report</>
                  }
                </button>
              </div>

              <div style={{ background: 'rgba(200,135,58,0.06)', border: '1px solid rgba(200,135,58,0.3)', borderRadius: 4, padding: 16 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Info size={14} style={{ flexShrink: 0, marginTop: 2, color: 'var(--c-amber)' }} />
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-amber)' }}>Playwright required</p>
                    <p style={{ fontSize: 12, color: 'var(--c-text-2)', marginTop: 4 }}>
                      PDF generation uses Playwright/Chromium inside the container. Run via Docker for full generation support.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Report collapsible section */}
            <div style={{ border: '1px solid var(--c-border)', borderRadius: 6, overflow: 'hidden' }}>
              {/* Section header / toggle */}
              <button
                onClick={handleTogglePreview}
                disabled={generating}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 16px',
                  background: 'var(--c-surface-2)',
                  border: 'none',
                  borderBottom: previewOpen ? '1px solid var(--c-border)' : 'none',
                  cursor: generating ? 'not-allowed' : 'pointer',
                  gap: 10,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--c-text-1)' }}>
                  {previewing
                    ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite', color: 'var(--c-text-3)' }} />
                    : <Eye size={14} style={{ color: 'var(--c-text-3)' }} />
                  }
                  {previewing ? 'Generating preview…' : 'Preview Report'}
                </span>
                <ChevronRight
                  size={14}
                  style={{
                    color: 'var(--c-text-3)',
                    transform: previewOpen ? 'rotate(270deg)' : 'rotate(90deg)',
                    transition: 'transform 0.2s',
                    flexShrink: 0,
                  }}
                />
              </button>

              {/* Preview body */}
              {previewOpen && (
                <div style={{ background: 'var(--c-bg)' }}>
                  {/* Preview toolbar */}
                  {previewUrl && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 14px',
                      background: 'var(--c-surface)',
                      borderBottom: '1px solid var(--c-border)',
                    }}>
                      <span style={{ flex: 1, fontSize: 11, color: 'var(--c-text-3)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {previewName}
                      </span>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={handleRegeneratePreview}
                        disabled={previewing}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}
                      >
                        {previewing
                          ? <Loader2 size={11} style={{ animation: 'spin 0.7s linear infinite' }} />
                          : <Eye size={11} />
                        }
                        Regenerate
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={downloadFromPreview}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}
                      >
                        <FileDown size={11} /> Download
                      </button>
                    </div>
                  )}

                  {/* iframe or loading */}
                  {previewing && !previewUrl ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, height: 200, color: 'var(--c-text-3)', fontSize: 13 }}>
                      <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} />
                      Generating preview…
                    </div>
                  ) : previewUrl ? (
                    <iframe
                      src={previewUrl}
                      title="PDF Preview"
                      style={{ width: '100%', height: 720, border: 'none', display: 'block' }}
                    />
                  ) : null}
                </div>
              )}
            </div>

          </div>
        )}
      </main>

      {/* Finding Drawer */}
      <FindingDrawer
        open={drawerOpen} finding={editingFinding} sectionId={editingSection}
        sections={sectionList} projectId={projectId} onSave={handleSaveFinding}
        onDelete={handleDeleteFinding} onClose={() => setDrawerOpen(false)} />

      {/* Add Section Modal */}
      <Modal open={sectionModalOpen} onClose={() => setSectionModalOpen(false)}
        title="Add Assessment Section" subtitle="e.g. Internal Infrastructure, Web Application, API">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="field-label">Section Name</label>
            <input autoFocus className="field" placeholder="Internal Infrastructure"
              value={newSectionName} onChange={e => setNewSectionName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddSection() }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-outline" onClick={() => setSectionModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddSection} disabled={!newSectionName.trim()}>
              <Plus size={13} /> Add Section
            </button>
          </div>
        </div>
      </Modal>

      {/* Knowledge Base Modal */}
      <Modal
        open={kbModalOpen}
        onClose={() => setKbModalOpen(false)}
        title="New Findings Not in Knowledge Base"
        subtitle={`${kbFindings.length} finding${kbFindings.length !== 1 ? 's' : ''} in this report aren't in your template library. Add them now so they're ready for QA on future engagements.`}
        maxWidth="560px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto', marginBottom: 16 }}>
          {kbFindings.map(f => (
            <label key={f.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
              background: kbSelected.has(f.id) ? 'var(--c-green-dim)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${kbSelected.has(f.id) ? 'rgba(26,158,106,0.25)' : 'var(--c-border)'}`,
              borderRadius: 6, cursor: 'pointer', transition: 'background 0.15s',
            }}>
              <input
                type="checkbox"
                checked={kbSelected.has(f.id)}
                onChange={e => {
                  setKbSelected(prev => {
                    const next = new Set(prev)
                    e.target.checked ? next.add(f.id) : next.delete(f.id)
                    return next
                  })
                }}
                style={{ accentColor: 'var(--c-green)', flexShrink: 0 }}
              />
              <SeverityBadge severity={f.severity} size="xs" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.title}</p>
                {kbSectionMap[f.id] && (
                  <p style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 1 }}>{kbSectionMap[f.id]}</p>
                )}
              </div>
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '4px 0', alignItems: 'center' }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, color: 'var(--c-text-3)' }}
            onClick={() => {
              const allSelected = kbFindings.every(f => kbSelected.has(f.id))
              setKbSelected(allSelected ? new Set() : new Set(kbFindings.map(f => f.id)))
            }}
          >
            {kbFindings.every(f => kbSelected.has(f.id)) ? 'Deselect all' : 'Select all'}
          </button>
          <span style={{ fontSize: 11, color: 'var(--c-text-3)', marginLeft: 4 }}>
            {kbSelected.size} of {kbFindings.length} selected
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 14, marginTop: 4, borderTop: '1px solid var(--c-border)' }}>
          <button className="btn btn-outline" onClick={() => setKbModalOpen(false)}>Skip</button>
          <button
            className="btn btn-primary"
            onClick={handleAddToKb}
            disabled={kbSelected.size === 0}
          >
            <BookmarkPlus size={13} />
            Add {kbSelected.size > 0 ? kbSelected.size : ''} to Knowledge Base
          </button>
        </div>
      </Modal>

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type === 'ok' ? 'toast-ok' : 'toast-err'}`}>
          {toast.type === 'ok' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StepSection({
  step, icon, title, desc, children, last,
}: {
  step: number; icon: React.ReactNode; title: string; desc: string; children: React.ReactNode; last?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 20 }}>
      {/* Step indicator + connecting line */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'var(--c-green-dim)', border: '2px solid rgba(26,158,106,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: 'var(--c-green-text)', flexShrink: 0,
        }}>{step}</div>
        {!last && (
          <div style={{ flex: 1, width: 1, minHeight: 24, background: 'var(--c-border)', marginTop: 6 }} />
        )}
      </div>
      {/* Content */}
      <div style={{ flex: 1, paddingBottom: last ? 0 : 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ color: 'var(--c-text-3)' }}>{icon}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-1)' }}>{title}</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--c-text-3)', marginBottom: 14 }}>{desc}</p>
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8, padding: 20 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="fo-card-flat" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--c-border)' }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)' }}>{title}</h3>
      </div>
      <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
    </div>
  )
}

function FormCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="fo-card-flat" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--c-border)' }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)' }}>{title}</h3>
      </div>
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  )
}

function HelpBanner({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 16px', background: 'var(--c-purple-dim)', border: '1px solid rgba(123,111,205,0.2)', borderRadius: 4 }}>
      <HelpCircle size={14} style={{ flexShrink: 0, marginTop: 2, color: 'var(--c-purple)' }} />
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-purple-text)' }}>{title}</p>
        <p style={{ fontSize: 12, marginTop: 2, whiteSpace: 'pre-wrap', color: 'var(--c-text-2)' }}>{text}</p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="fo-label">{label}</label>
      {children}
    </div>
  )
}

function deepSet(obj: Record<string, unknown>, path: string, value: unknown): ReportData {
  const keys = path.split('.')
  const result = { ...obj }
  let cur: Record<string, unknown> = result
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    cur[key] = { ...(cur[key] as Record<string, unknown> || {}) }
    cur = cur[key] as Record<string, unknown>
  }
  cur[keys[keys.length - 1]] = value
  return result as unknown as ReportData
}
