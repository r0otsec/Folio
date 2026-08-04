import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, Bell, BellOff, Download, Trash2, Pencil, Upload, Search,
  FileText, ChevronLeft, Terminal, Image as ImageIcon, Paperclip,
  X, Clock, Monitor, Eye, Tag
} from 'lucide-react'
import Modal from '../components/Modal'
import { api } from '../api'
import { useSearchParams } from 'react-router-dom'

// ─── Types ───────────────────────────────────────────────────────────────────

interface OpLog {
  id: number
  name: string
  project_id: number | null
  project_name: string | null
  notifications_enabled: boolean
  created_at: string
}

interface OpLogEvidence {
  id: number
  oplog_id: number
  entry_id: number | null
  friendly_name: string
  caption: string
  description: string
  tags: string
  evidence_type: 'image' | 'cast' | 'file'
  filename: string
  url: string
  created_at: string
}

interface OpLogEntry {
  id: number
  oplog_id: number
  start_date: string
  end_date: string
  source_ip: string
  dest_ip: string
  tool: string
  user_context: string
  command: string
  description: string
  output: string
  comments: string
  operator_name: string
  tags: string
  created_at: string
  evidence: OpLogEvidence[]
}

interface Project { id: number; name: string; client_name: string; status: string }

const EMPTY_OPLOG_FORM = { name: '', project_id: '' as string | number, notifications_enabled: true }

const EMPTY_ENTRY_FORM = {
  start_date: '', end_date: '', source_ip: '', dest_ip: '',
  tool: '', user_context: '', command: '', description: '',
  output: '', comments: '', operator_name: '', tags: '',
}

const EMPTY_EV_FORM = { friendly_name: '', caption: '', description: '', tags: '' }

// ─── Asciinema Player ────────────────────────────────────────────────────────

function AsciinemaEmbed({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const w = window as any
    if (w.AsciinemaPlayer) {
      ref.current.innerHTML = ''
      w.AsciinemaPlayer.create(url, ref.current, {
        autoPlay: false,
        loop: false,
        fit: 'width',
        theme: 'monokai',
        terminalFontFamily: 'JetBrains Mono, monospace',
      })
    }
  }, [url])
  return <div ref={ref} style={{ borderRadius: 6, overflow: 'hidden', background: '#1d1f21' }} />
}

// ─── Tag chips ───────────────────────────────────────────────────────────────

function TagChips({ value }: { value: string }) {
  const tags = value.split(',').map(t => t.trim()).filter(Boolean)
  if (!tags.length) return <span style={{ color: 'var(--c-text-3)', fontSize: 11 }}>—</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {tags.map(t => (
        <span key={t} style={{
          fontSize: 10, fontFamily: 'var(--mono)', padding: '2px 6px',
          background: 'var(--c-green-dim)', color: 'var(--c-green-text)',
          borderRadius: 3, border: '1px solid rgba(26,158,106,0.2)',
        }}>{t}</span>
      ))}
    </div>
  )
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OperationLogs() {
  // Top-level view
  const [view, setView] = useState<'list' | 'entries'>('list')
  const [selectedLog, setSelectedLog] = useState<OpLog | null>(null)

  // Oplog list state
  const [logs, setLogs] = useState<OpLog[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [oplogModalOpen, setOplogModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<OpLog | null>(null)
  const [oplogForm, setOplogForm] = useState(EMPTY_OPLOG_FORM)
  const [savingLog, setSavingLog] = useState(false)

  // Entries state
  const [entries, setEntries] = useState<OpLogEntry[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<OpLogEntry | null>(null)
  const [entryModalOpen, setEntryModalOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<OpLogEntry | null>(null)
  const [entryForm, setEntryForm] = useState(EMPTY_ENTRY_FORM)
  const [savingEntry, setSavingEntry] = useState(false)

  // Evidence state
  const [evModalOpen, setEvModalOpen] = useState(false)
  const [evForm, setEvForm] = useState(EMPTY_EV_FORM)
  const [evFile, setEvFile] = useState<File | null>(null)
  const [uploadingEv, setUploadingEv] = useState(false)

  const [searchParams, setSearchParams] = useSearchParams()

  const loadLogs = useCallback(async () => {
    try {
      const [l, p] = await Promise.all([api.oplogs.list(), api.projects.list()])
      setLogs(l)
      setProjects(p as Project[])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadLogs() }, [loadLogs])

  useEffect(() => {
    if (searchParams.get('new') === '1') { openCreateLog(); setSearchParams({}) }
  }, [searchParams, setSearchParams])

  const loadEntries = useCallback(async (logId: number) => {
    setEntriesLoading(true)
    try {
      const data = await api.oplogs.entries.list(logId)
      setEntries(data)
    } catch { /* ignore */ }
    finally { setEntriesLoading(false) }
  }, [])

  const openLog = (lg: OpLog) => {
    setSelectedLog(lg)
    setSelectedEntry(null)
    setEntries([])
    setView('entries')
    loadEntries(lg.id)
  }

  const backToList = () => {
    setView('list')
    setSelectedLog(null)
    setSelectedEntry(null)
  }

  // ── Oplog CRUD ──────────────────────────────────────────────────────────────

  const openCreateLog = () => { setEditTarget(null); setOplogForm(EMPTY_OPLOG_FORM); setOplogModalOpen(true) }
  const openEditLog = (lg: OpLog) => {
    setEditTarget(lg)
    setOplogForm({ name: lg.name, project_id: lg.project_id ?? '', notifications_enabled: lg.notifications_enabled })
    setOplogModalOpen(true)
  }

  const handleSaveLog = async () => {
    if (!oplogForm.name.trim()) return
    setSavingLog(true)
    try {
      const payload = {
        name: oplogForm.name.trim(),
        project_id: oplogForm.project_id ? Number(oplogForm.project_id) : null,
        notifications_enabled: oplogForm.notifications_enabled,
      }
      if (editTarget) {
        const updated = await api.oplogs.update(editTarget.id, payload)
        setLogs(prev => prev.map(l => l.id === editTarget.id ? updated : l))
        if (selectedLog?.id === editTarget.id) setSelectedLog(updated)
      } else {
        const created = await api.oplogs.create(payload)
        setLogs(prev => [created, ...prev])
      }
      setOplogModalOpen(false)
    } catch { /* ignore */ }
    finally { setSavingLog(false) }
  }

  const handleDeleteLog = async (id: number) => {
    if (!confirm('Delete this operation log and all its entries?')) return
    try {
      await api.oplogs.delete(id)
      setLogs(prev => prev.filter(l => l.id !== id))
      if (selectedLog?.id === id) backToList()
    } catch { /* ignore */ }
  }

  const handleExportLog = (lg: OpLog) => {
    const blob = new Blob([JSON.stringify({ log: lg, entries }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `oplog-${lg.id}-${lg.name.replace(/\s+/g, '-')}.json`
    a.click(); URL.revokeObjectURL(url)
  }

  // ── Entry CRUD ──────────────────────────────────────────────────────────────

  const openCreateEntry = () => { setEditEntry(null); setEntryForm(EMPTY_ENTRY_FORM); setEntryModalOpen(true) }
  const openEditEntry = (e: OpLogEntry) => {
    setEditEntry(e)
    setEntryForm({
      start_date: e.start_date, end_date: e.end_date,
      source_ip: e.source_ip, dest_ip: e.dest_ip,
      tool: e.tool, user_context: e.user_context,
      command: e.command, description: e.description,
      output: e.output, comments: e.comments,
      operator_name: e.operator_name, tags: e.tags,
    })
    setEntryModalOpen(true)
  }

  const handleSaveEntry = async () => {
    if (!selectedLog) return
    setSavingEntry(true)
    try {
      if (editEntry) {
        const updated = await api.oplogs.entries.update(selectedLog.id, editEntry.id, entryForm)
        setEntries(prev => prev.map(e => e.id === editEntry.id ? updated : e))
        if (selectedEntry?.id === editEntry.id) setSelectedEntry(updated)
      } else {
        const created = await api.oplogs.entries.create(selectedLog.id, entryForm)
        setEntries(prev => [...prev, created])
        setSelectedEntry(created)
      }
      setEntryModalOpen(false)
    } catch { /* ignore */ }
    finally { setSavingEntry(false) }
  }

  const handleDeleteEntry = async (entryId: number) => {
    if (!selectedLog || !confirm('Delete this entry and all its evidence?')) return
    try {
      await api.oplogs.entries.delete(selectedLog.id, entryId)
      setEntries(prev => prev.filter(e => e.id !== entryId))
      if (selectedEntry?.id === entryId) setSelectedEntry(null)
    } catch { /* ignore */ }
  }

  // ── Evidence ────────────────────────────────────────────────────────────────

  const openEvidenceModal = () => { setEvForm(EMPTY_EV_FORM); setEvFile(null); setEvModalOpen(true) }

  const handleUploadEvidence = async () => {
    if (!selectedLog || !selectedEntry || !evFile) return
    setUploadingEv(true)
    try {
      const ev = await api.oplogs.entries.uploadEvidence(selectedLog.id, selectedEntry.id, evFile, evForm)
      const updatedEntry = { ...selectedEntry, evidence: [...selectedEntry.evidence, ev] }
      setSelectedEntry(updatedEntry)
      setEntries(prev => prev.map(e => e.id === selectedEntry.id ? updatedEntry : e))
      setEvModalOpen(false)
    } catch { /* ignore */ }
    finally { setUploadingEv(false) }
  }

  const handleDeleteEvidence = async (evidenceId: number) => {
    if (!selectedEntry || !confirm('Delete this evidence?')) return
    try {
      await api.oplogs.entries.deleteEvidence(evidenceId)
      const updatedEntry = { ...selectedEntry, evidence: selectedEntry.evidence.filter(e => e.id !== evidenceId) }
      setSelectedEntry(updatedEntry)
      setEntries(prev => prev.map(e => e.id === selectedEntry.id ? updatedEntry : e))
    } catch { /* ignore */ }
  }

  const filtered = logs.filter(l => {
    const q = search.toLowerCase()
    return !q || l.name.toLowerCase().includes(q) || (l.project_name || '').toLowerCase().includes(q)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — Oplog List
  // ═══════════════════════════════════════════════════════════════════════════

  if (view === 'list') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        <div className="page-header">
          <div className="page-header-left">
            <span className="page-header-title">Operation Logs</span>
            <span className="page-header-count">{logs.length} log{logs.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="page-header-right">
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-3)', pointerEvents: 'none' }} />
              <input className="field" style={{ paddingLeft: 30, height: 32, width: 220, fontSize: 12 }} placeholder="Search logs…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={openCreateLog}><Plus size={13} /> New Log</button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 10, color: 'var(--c-text-3)' }}>
            <div className="spinner" /> <span style={{ fontSize: 13 }}>Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 24 }}>
            {search ? 'No logs match your search.' : 'No operation logs yet. Create one to start tracking activities.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th>
                  <th>Name</th>
                  <th>Project</th>
                  <th style={{ width: 130 }}>Notifications</th>
                  <th style={{ width: 110 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(lg => (
                  <tr key={lg.id} style={{ cursor: 'pointer' }} onClick={() => openLog(lg)}>
                    <td onClick={e => e.stopPropagation()}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--c-text-3)' }}>#{lg.id}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500, color: 'var(--c-text-1)' }}>{lg.name}</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--c-text-2)' }}>
                      {lg.project_name ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <FileText size={11} style={{ color: 'var(--c-text-3)' }} /> {lg.project_name}
                        </span>
                      ) : <span style={{ color: 'var(--c-text-3)' }}>—</span>}
                    </td>
                    <td>
                      {lg.notifications_enabled
                        ? <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--c-green-text)' }}><Bell size={12} style={{ color: 'var(--c-green)' }} /> Active</span>
                        : <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--c-text-3)' }}><BellOff size={12} /> Muted</span>}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="data-table-actions">
                        <button className="btn-icon" title="Export" onClick={() => handleExportLog(lg)}><Download size={11} /></button>
                        <button className="btn-icon" title="Edit" onClick={() => openEditLog(lg)}><Pencil size={11} /></button>
                        <button className="btn-icon" style={{ color: 'var(--c-red)' }} title="Delete" onClick={() => handleDeleteLog(lg.id)}><Trash2 size={11} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <OplogModal
          open={oplogModalOpen} onClose={() => setOplogModalOpen(false)}
          editTarget={editTarget} form={oplogForm} setForm={setOplogForm}
          projects={projects} onSave={handleSaveLog} saving={savingLog}
        />
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — Entries Split-Panel
  // ═══════════════════════════════════════════════════════════════════════════

  const castEvidence = selectedEntry?.evidence.filter(e => e.evidence_type === 'cast') ?? []
  const imageEvidence = selectedEntry?.evidence.filter(e => e.evidence_type === 'image') ?? []
  const otherEvidence = selectedEntry?.evidence.filter(e => e.evidence_type === 'file') ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div className="page-header-left">
          <button className="btn-icon" onClick={backToList} title="Back to logs" style={{ marginRight: 4 }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 12, color: 'var(--c-text-3)', marginRight: 6 }}>Operation Logs</span>
          <span style={{ fontSize: 12, color: 'var(--c-text-3)', marginRight: 6 }}>/</span>
          <span className="page-header-title" style={{ fontSize: 15 }}>{selectedLog?.name}</span>
          <span className="page-header-count">{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</span>
        </div>
        <div className="page-header-right">
          <button className="btn-icon" title="Edit log" onClick={() => openEditLog(selectedLog!)}><Pencil size={13} /></button>
          <button className="btn btn-primary btn-sm" onClick={openCreateEntry}><Plus size={13} /> Add Entry</button>
        </div>
      </div>

      {/* Split Panel */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Left — entries list */}
        <div style={{
          width: 480, minWidth: 360, flexShrink: 0, borderRight: '1px solid var(--c-border)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {entriesLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8, color: 'var(--c-text-3)' }}>
              <div className="spinner" /><span style={{ fontSize: 13 }}>Loading entries…</span>
            </div>
          ) : entries.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-text-3)', fontSize: 13 }}>
              No entries yet.<br />
              <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={openCreateEntry}><Plus size={13} /> Add first entry</button>
            </div>
          ) : (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {entries.map(e => {
                const isActive = selectedEntry?.id === e.id
                return (
                  <div
                    key={e.id}
                    onClick={() => setSelectedEntry(e)}
                    style={{
                      padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--c-border)',
                      background: isActive ? 'var(--c-green-dim)' : 'transparent',
                      borderLeft: isActive ? '3px solid var(--c-green)' : '3px solid transparent',
                      transition: 'background 0.12s',
                    }}
                  >
                    {/* Row 1: Date range + tool */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={11} style={{ color: 'var(--c-text-3)', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--c-text-2)' }}>
                          {e.start_date ? fmtDate(e.start_date) : <span style={{ color: 'var(--c-text-3)' }}>No date</span>}
                        </span>
                      </div>
                      {e.tool && (
                        <span style={{
                          fontSize: 10, fontFamily: 'var(--mono)', padding: '2px 7px',
                          background: 'var(--c-surface-2)', border: '1px solid var(--c-border)',
                          borderRadius: 3, color: 'var(--c-text-2)',
                        }}>{e.tool}</span>
                      )}
                    </div>
                    {/* Row 2: Dest IP + operator */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: e.tags ? 6 : 0 }}>
                      <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: isActive ? 'var(--c-green-text)' : 'var(--c-text-1)', fontWeight: 500 }}>
                        {e.dest_ip || <span style={{ color: 'var(--c-text-3)', fontWeight: 400 }}>No destination</span>}
                      </span>
                      {e.operator_name && (
                        <span style={{ fontSize: 11, color: 'var(--c-text-3)' }}>{e.operator_name}</span>
                      )}
                    </div>
                    {/* Row 3: Tags */}
                    {e.tags && <TagChips value={e.tags} />}
                    {/* Row 4: Evidence count */}
                    {e.evidence.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
                        <Paperclip size={10} style={{ color: 'var(--c-text-3)' }} />
                        <span style={{ fontSize: 10, color: 'var(--c-text-3)' }}>{e.evidence.length} evidence item{e.evidence.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right — entry detail */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
          {!selectedEntry ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--c-text-3)', gap: 10 }}>
              <Eye size={28} strokeWidth={1.2} />
              <span style={{ fontSize: 13 }}>Select an entry to view details</span>
            </div>
          ) : (
            <div style={{ padding: '24px 28px', maxWidth: 860 }}>
              {/* Entry header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Clock size={13} style={{ color: 'var(--c-text-3)' }} />
                    <span style={{ fontSize: 13, fontFamily: 'var(--mono)', color: 'var(--c-text-1)', fontWeight: 500 }}>
                      {fmtDate(selectedEntry.start_date)}
                      {selectedEntry.end_date && selectedEntry.end_date !== selectedEntry.start_date && (
                        <span style={{ color: 'var(--c-text-3)' }}> → {fmtDate(selectedEntry.end_date)}</span>
                      )}
                    </span>
                  </div>
                  {selectedEntry.operator_name && (
                    <span style={{ fontSize: 12, color: 'var(--c-text-3)' }}>Operator: <strong style={{ color: 'var(--c-text-2)' }}>{selectedEntry.operator_name}</strong></span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => openEditEntry(selectedEntry)}><Pencil size={12} /> Edit</button>
                  <button className="btn btn-sm" style={{ background: 'rgba(220,60,60,0.1)', color: 'var(--c-red)', border: '1px solid rgba(220,60,60,0.25)' }} onClick={() => handleDeleteEntry(selectedEntry.id)}><Trash2 size={12} /></button>
                </div>
              </div>

              {/* Meta grid */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24,
                padding: '14px 16px', background: 'var(--c-surface)', borderRadius: 8,
                border: '1px solid var(--c-border)',
              }}>
                {[
                  { label: 'Source IP', value: selectedEntry.source_ip },
                  { label: 'Dest IP', value: selectedEntry.dest_ip },
                  { label: 'Tool', value: selectedEntry.tool },
                  { label: 'User Context', value: selectedEntry.user_context },
                  { label: 'Operator', value: selectedEntry.operator_name },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-3)', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: value ? 'var(--c-text-1)' : 'var(--c-text-3)' }}>{value || '—'}</div>
                  </div>
                ))}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-3)', marginBottom: 3 }}>Tags</div>
                  <TagChips value={selectedEntry.tags} />
                </div>
              </div>

              {/* Command */}
              {selectedEntry.command && (
                <Section label="Command" icon={<Terminal size={13} />}>
                  <pre style={{
                    margin: 0, padding: '12px 14px', background: '#111214',
                    border: '1px solid var(--c-border)', borderRadius: 6,
                    fontSize: 12, fontFamily: 'var(--mono)', color: '#e0e0e0',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.6,
                  }}><span style={{ color: 'var(--c-green)', userSelect: 'none' }}>$ </span>{selectedEntry.command}</pre>
                </Section>
              )}

              {/* Description */}
              {selectedEntry.description && (
                <Section label="Description">
                  <p style={{ fontSize: 13, color: 'var(--c-text-2)', lineHeight: 1.7, margin: 0 }}>{selectedEntry.description}</p>
                </Section>
              )}

              {/* Output */}
              {selectedEntry.output && (
                <Section label="Output" icon={<Monitor size={13} />}>
                  <pre style={{
                    margin: 0, padding: '12px 14px', background: '#111214',
                    border: '1px solid var(--c-border)', borderRadius: 6,
                    fontSize: 11, fontFamily: 'var(--mono)', color: '#c0c0c0',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.6,
                    maxHeight: 300, overflowY: 'auto',
                  }}>{selectedEntry.output}</pre>
                </Section>
              )}

              {/* Comments */}
              {selectedEntry.comments && (
                <Section label="Comments">
                  <p style={{ fontSize: 13, color: 'var(--c-text-2)', lineHeight: 1.7, margin: 0 }}>{selectedEntry.comments}</p>
                </Section>
              )}

              {/* Evidence */}
              <Section
                label="Evidence"
                icon={<Paperclip size={13} />}
                action={
                  <button className="btn btn-outline btn-sm" style={{ fontSize: 11 }} onClick={openEvidenceModal}>
                    <Upload size={11} /> Upload
                  </button>
                }
              >
                {selectedEntry.evidence.length === 0 ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--c-text-3)', fontSize: 12 }}>
                    No evidence uploaded yet.
                    <button className="btn btn-outline btn-sm" style={{ display: 'block', margin: '10px auto 0' }} onClick={openEvidenceModal}>
                      <Upload size={12} /> Upload evidence
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Images */}
                    {imageEvidence.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                        {imageEvidence.map(ev => (
                          <EvidenceImageCard key={ev.id} ev={ev} onDelete={() => handleDeleteEvidence(ev.id)} />
                        ))}
                      </div>
                    )}
                    {/* Other files */}
                    {otherEvidence.map(ev => (
                      <EvidenceFileCard key={ev.id} ev={ev} onDelete={() => handleDeleteEvidence(ev.id)} />
                    ))}
                  </div>
                )}
              </Section>

              {/* Terminal Recordings */}
              {castEvidence.length > 0 && (
                <Section label="Terminal Recordings" icon={<Terminal size={13} />}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {castEvidence.map(ev => (
                      <div key={ev.id} style={{ border: '1px solid var(--c-border)', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Terminal size={12} style={{ color: 'var(--c-green)' }} />
                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-text-1)' }}>{ev.friendly_name}</span>
                          </div>
                          <button className="btn-icon" style={{ color: 'var(--c-red)' }} onClick={() => handleDeleteEvidence(ev.id)} title="Delete">
                            <Trash2 size={11} />
                          </button>
                        </div>
                        <div style={{ padding: 12, background: '#1a1c1e' }}>
                          <AsciinemaEmbed url={ev.url} />
                        </div>
                        {ev.caption && <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--c-text-3)', fontStyle: 'italic', background: 'var(--c-surface)' }}>{ev.caption}</div>}
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Oplog create/edit modal */}
      <OplogModal
        open={oplogModalOpen} onClose={() => setOplogModalOpen(false)}
        editTarget={editTarget} form={oplogForm} setForm={setOplogForm}
        projects={projects} onSave={handleSaveLog} saving={savingLog}
      />

      {/* Entry create/edit modal */}
      <Modal open={entryModalOpen} onClose={() => setEntryModalOpen(false)} title={editEntry ? 'Edit Entry' : 'New Log Entry'} maxWidth="720px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="field-label">Start Date / Time</label>
              <input type="datetime-local" className="field" value={entryForm.start_date} onChange={e => setEntryForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">End Date / Time</label>
              <input type="datetime-local" className="field" value={entryForm.end_date} onChange={e => setEntryForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Source IP</label>
              <input className="field" style={{ fontFamily: 'var(--mono)' }} placeholder="10.0.0.1" value={entryForm.source_ip} onChange={e => setEntryForm(f => ({ ...f, source_ip: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Destination IP</label>
              <input className="field" style={{ fontFamily: 'var(--mono)' }} placeholder="192.168.1.1" value={entryForm.dest_ip} onChange={e => setEntryForm(f => ({ ...f, dest_ip: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Tool</label>
              <input className="field" placeholder="nmap, crackmapexec, …" value={entryForm.tool} onChange={e => setEntryForm(f => ({ ...f, tool: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Operator Name</label>
              <input className="field" placeholder="jsmith" value={entryForm.operator_name} onChange={e => setEntryForm(f => ({ ...f, operator_name: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">User Context</label>
              <input className="field" style={{ fontFamily: 'var(--mono)' }} placeholder="root, DOMAIN\user, …" value={entryForm.user_context} onChange={e => setEntryForm(f => ({ ...f, user_context: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Tags</label>
              <input className="field" placeholder="recon, exploit, post-ex (comma-separated)" value={entryForm.tags} onChange={e => setEntryForm(f => ({ ...f, tags: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="field-label">Command</label>
            <textarea className="field" rows={3} style={{ fontFamily: 'var(--mono)', fontSize: 12, resize: 'vertical' }} placeholder="nmap -sV -p- 192.168.1.1" value={entryForm.command} onChange={e => setEntryForm(f => ({ ...f, command: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Description</label>
            <textarea className="field" rows={3} style={{ resize: 'vertical' }} placeholder="What was the goal of this action?" value={entryForm.description} onChange={e => setEntryForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Output / Result</label>
            <textarea className="field" rows={4} style={{ fontFamily: 'var(--mono)', fontSize: 12, resize: 'vertical' }} placeholder="Paste command output here…" value={entryForm.output} onChange={e => setEntryForm(f => ({ ...f, output: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Comments</label>
            <textarea className="field" rows={2} style={{ resize: 'vertical' }} placeholder="Additional notes or analyst comments…" value={entryForm.comments} onChange={e => setEntryForm(f => ({ ...f, comments: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-outline" onClick={() => setEntryModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveEntry} disabled={savingEntry}>
              {editEntry ? 'Save Changes' : 'Add Entry'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Evidence upload modal */}
      <Modal open={evModalOpen} onClose={() => setEvModalOpen(false)} title="Upload Evidence">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="field-label">Evidence File *</label>
            <input
              type="file"
              accept="image/*,.cast,.txt,.log,.pcap"
              className="field"
              style={{ padding: '6px 10px', cursor: 'pointer' }}
              onChange={e => {
                const f = e.target.files?.[0] ?? null
                setEvFile(f)
                if (f && !evForm.friendly_name) setEvForm(ef => ({ ...ef, friendly_name: f.name }))
              }}
            />
            <p style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 4 }}>Images (.png, .jpg, .gif), terminal recordings (.cast), or other files</p>
          </div>
          <div>
            <label className="field-label">Friendly Name</label>
            <input className="field" placeholder="e.g. Port scan results" value={evForm.friendly_name} onChange={e => setEvForm(f => ({ ...f, friendly_name: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="field-label">Caption</label>
              <input className="field" placeholder="Short caption for the evidence" value={evForm.caption} onChange={e => setEvForm(f => ({ ...f, caption: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Tags</label>
              <input className="field" placeholder="screenshot, output (comma-separated)" value={evForm.tags} onChange={e => setEvForm(f => ({ ...f, tags: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="field-label">Description</label>
            <textarea className="field" rows={2} style={{ resize: 'vertical' }} placeholder="Describe what this evidence shows…" value={evForm.description} onChange={e => setEvForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-outline" onClick={() => setEvModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleUploadEvidence} disabled={!evFile || uploadingEv}>
              {uploadingEv ? 'Uploading…' : <><Upload size={13} /> Upload</>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({
  label, icon, action, children,
}: {
  label: string
  icon?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {icon && <span style={{ color: 'var(--c-text-3)' }}>{icon}</span>}
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--c-text-3)' }}>{label}</span>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function EvidenceImageCard({ ev, onDelete }: { ev: OpLogEvidence; onDelete: () => void }) {
  return (
    <div style={{ border: '1px solid var(--c-border)', borderRadius: 8, overflow: 'hidden', background: 'var(--c-surface)' }}>
      <div style={{ position: 'relative', background: '#111' }}>
        <img
          src={ev.url}
          alt={ev.friendly_name}
          style={{ width: '100%', display: 'block', maxHeight: 180, objectFit: 'contain' }}
        />
        <button
          className="btn-icon"
          style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: 'var(--c-red)', borderRadius: 4, padding: 4 }}
          onClick={onDelete}
          title="Delete"
        >
          <X size={11} />
        </button>
      </div>
      <div style={{ padding: '8px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
          <ImageIcon size={10} style={{ color: 'var(--c-text-3)', flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--c-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.friendly_name}</span>
        </div>
        {ev.caption && <p style={{ fontSize: 10, color: 'var(--c-text-3)', fontStyle: 'italic', margin: 0 }}>{ev.caption}</p>}
        {ev.tags && <div style={{ marginTop: 4 }}><TagChips value={ev.tags} /></div>}
      </div>
    </div>
  )
}

function EvidenceFileCard({ ev, onDelete }: { ev: OpLogEvidence; onDelete: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface)' }}>
      <Paperclip size={14} style={{ color: 'var(--c-text-3)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.friendly_name}</div>
        {ev.caption && <div style={{ fontSize: 11, color: 'var(--c-text-3)' }}>{ev.caption}</div>}
        {ev.tags && <div style={{ marginTop: 4 }}><TagChips value={ev.tags} /></div>}
      </div>
      <a href={ev.url} download target="_blank" rel="noreferrer" className="btn-icon" title="Download">
        <Download size={12} />
      </a>
      <button className="btn-icon" style={{ color: 'var(--c-red)' }} onClick={onDelete} title="Delete">
        <Trash2 size={12} />
      </button>
    </div>
  )
}

function OplogModal({
  open, onClose, editTarget, form, setForm, projects, onSave, saving,
}: {
  open: boolean
  onClose: () => void
  editTarget: OpLog | null
  form: typeof EMPTY_OPLOG_FORM
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_OPLOG_FORM>>
  projects: Project[]
  onSave: () => void
  saving: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title={editTarget ? 'Edit Log' : 'Create Operation Log'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="field-label">Log Name *</label>
          <input className="field" placeholder="e.g. Engagement Alpha — Week 1 Recon" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
        </div>
        <div>
          <label className="field-label">Project</label>
          <select className="field" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
            <option value="">— Select an Active Project —</option>
            {projects.filter(p => p.status === 'active').map(p => (
              <option key={p.id} value={p.id}>{p.client_name || p.name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" id="notif" checked={form.notifications_enabled} onChange={e => setForm(f => ({ ...f, notifications_enabled: e.target.checked }))} style={{ accentColor: 'var(--c-green)', width: 14, height: 14 }} />
          <label htmlFor="notif" style={{ fontSize: 13, color: 'var(--c-text-2)', cursor: 'pointer' }}>Enable notifications for this log</label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving || !form.name.trim()}>{editTarget ? 'Save Changes' : 'Create Log'}</button>
        </div>
      </div>
    </Modal>
  )
}
