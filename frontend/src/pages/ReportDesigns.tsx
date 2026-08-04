import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Pencil, Trash2, CheckCircle, Loader2, Shield, AlertTriangle, Save, RotateCcw, FileCode, ChevronRight } from 'lucide-react'
import { api } from '../api'
import Modal from '../components/Modal'
import { useAuth } from '../auth'

interface ReportDesign {
  id: number
  name: string
  description: string
  report_type: string
  is_default: boolean
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface TemplateFile {
  path: string
  size: number
}

const REPORT_TYPES = [
  'Internal Penetration Test',
  'External Penetration Test',
  'Web Application Assessment',
  'Red Team Exercise',
  'Cloud Security Review',
  'Physical Security Assessment',
  'Wireless Assessment',
  'Social Engineering',
  'Custom',
]

const EMPTY_FORM = {
  name: '', description: '', report_type: 'Internal Penetration Test', is_default: false,
}

function basename(p: string): string {
  return p.split('/').pop() || p
}

function groupFiles(files: TemplateFile[]) {
  const main: TemplateFile[] = []
  const partials: TemplateFile[] = []
  for (const f of files) {
    if (f.path === 'report.html.j2' || f.path === 'assets/style.css') {
      main.push(f)
    } else {
      partials.push(f)
    }
  }
  return { main, partials }
}

export default function ReportDesigns() {
  const { isAdmin } = useAuth()
  const [designs, setDesigns] = useState<ReportDesign[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ReportDesign | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Selected design for template editing
  const [selectedDesign, setSelectedDesign] = useState<ReportDesign | null>(null)

  // Template editor state — only populated once a design is selected
  const [files, setFiles] = useState<TemplateFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [loadingFileContent, setLoadingFileContent] = useState(false)
  const [fileSaving, setFileSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isDirty = fileContent !== originalContent

  const load = useCallback(async () => {
    try { setDesigns(await api.designs.list()) }
    catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Load file list when a design is selected
  useEffect(() => {
    if (!selectedDesign || !isAdmin) return
    setFiles([])
    setSelectedFile(null)
    setFileContent('')
    setOriginalContent('')
    setSaveMsg(null)
    setLoadingFiles(true)
    api.admin.designTemplateFiles.list(selectedDesign.id)
      .then(setFiles)
      .catch(() => {})
      .finally(() => setLoadingFiles(false))
  }, [selectedDesign, isAdmin])

  // Load file content when file selection changes
  useEffect(() => {
    if (!selectedFile || !selectedDesign) return
    setLoadingFileContent(true)
    setSaveMsg(null)
    api.admin.designTemplateFiles.get(selectedDesign.id, selectedFile)
      .then(res => {
        setFileContent(res.content)
        setOriginalContent(res.content)
      })
      .catch(() => {})
      .finally(() => setLoadingFileContent(false))
  }, [selectedFile, selectedDesign])

  const handleSelectDesign = (d: ReportDesign) => {
    if (selectedDesign?.id === d.id) {
      // Deselect
      setSelectedDesign(null)
      setFiles([])
      setSelectedFile(null)
      setFileContent('')
      setOriginalContent('')
    } else {
      setSelectedDesign(d)
    }
  }

  const openCreate = () => {
    setEditTarget(null); setForm(EMPTY_FORM); setError(''); setModalOpen(true)
  }

  const openEdit = (d: ReportDesign) => {
    setEditTarget(d)
    setForm({ name: d.name, description: d.description, report_type: d.report_type, is_default: d.is_default })
    setError(''); setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true); setError('')
    try {
      if (editTarget) {
        const updated = await api.designs.update(editTarget.id, form)
        setDesigns(prev => prev.map(d => d.id === editTarget.id ? updated : d))
        if (selectedDesign?.id === editTarget.id) setSelectedDesign(updated)
      } else {
        const created = await api.designs.create(form)
        setDesigns(prev => [...prev, created])
      }
      setModalOpen(false)
    } catch (e: unknown) {
      setError((e as Error).message || 'Save failed')
    } finally { setSaving(false) }
  }

  const handleDelete = async (d: ReportDesign) => {
    if (!confirm(`Delete design "${d.name}"?`)) return
    try {
      await api.designs.delete(d.id)
      setDesigns(prev => prev.filter(x => x.id !== d.id))
      if (selectedDesign?.id === d.id) {
        setSelectedDesign(null)
        setFiles([])
        setSelectedFile(null)
      }
    } catch { /* ignore */ }
  }

  const handleFileSave = async () => {
    if (!selectedFile || !selectedDesign) return
    setFileSaving(true); setSaveMsg(null)
    try {
      await api.admin.designTemplateFiles.update(selectedDesign.id, selectedFile, fileContent)
      setOriginalContent(fileContent)
      setSaveMsg('Saved')
      setTimeout(() => setSaveMsg(null), 2500)
    } catch (e: unknown) {
      setSaveMsg('Error: ' + ((e as Error).message || 'save failed'))
    } finally { setFileSaving(false) }
  }

  const handleFileReset = async () => {
    if (!selectedFile || !selectedDesign) return
    if (!confirm(`Reset "${selectedFile}" to the built-in default? Your changes will be lost.`)) return
    setResetting(true); setSaveMsg(null)
    try {
      const res = await api.admin.designTemplateFiles.reset(selectedDesign.id, selectedFile)
      setFileContent(res.content)
      setOriginalContent(res.content)
      setSaveMsg('Reset to default')
      setTimeout(() => setSaveMsg(null), 2500)
    } catch (e: unknown) {
      setSaveMsg('Error: ' + ((e as Error).message || 'reset failed'))
    } finally { setResetting(false) }
  }

  const handleTabKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const el = e.currentTarget
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = fileContent.substring(0, start) + '  ' + fileContent.substring(end)
    setFileContent(next)
    requestAnimationFrame(() => {
      el.selectionStart = start + 2
      el.selectionEnd = start + 2
    })
  }

  const { main: mainFiles, partials: partialFiles } = groupFiles(files)
  const lineCount = fileContent.split('\n').length
  const charCount = fileContent.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-header-title">Report Designs</span>
          <span className="page-header-count">{designs.length} template{designs.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="page-header-right">
          {isAdmin && (
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              <Plus size={13} /> New Design
            </button>
          )}
        </div>
      </div>

      {!isAdmin && (
        <div style={{ padding: '12px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: '1px solid var(--c-border)', borderRadius: 4, color: 'var(--c-text-3)', fontSize: 12 }}>
            <Shield size={14} style={{ flexShrink: 0 }} />
            View only — contact an admin to create or modify report designs
          </div>
        </div>
      )}

      {/* Designs table */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 10, color: 'var(--c-text-3)' }}>
          <div className="spinner" /> <span style={{ fontSize: 13 }}>Loading designs…</span>
        </div>
      ) : designs.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 24 }}>
          No report designs yet. Create a design template to standardise report output.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Name</th>
                <th>Type</th>
                <th>Description</th>
                <th>Default</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {designs.map(d => {
                const isSelected = selectedDesign?.id === d.id
                return (
                  <tr
                    key={d.id}
                    onClick={() => isAdmin && handleSelectDesign(d)}
                    style={{
                      cursor: isAdmin ? 'pointer' : 'default',
                      background: isSelected ? 'rgba(26,125,217,0.08)' : undefined,
                      borderLeft: isSelected ? '2px solid var(--c-blue)' : '2px solid transparent',
                    }}
                  >
                    <td style={{ textAlign: 'center', color: 'var(--c-text-3)' }}>
                      {isAdmin && (
                        <ChevronRight
                          size={13}
                          style={{
                            transition: 'transform 0.15s',
                            transform: isSelected ? 'rotate(90deg)' : 'rotate(0deg)',
                            color: isSelected ? 'var(--c-blue)' : 'var(--c-text-3)',
                          }}
                        />
                      )}
                    </td>
                    <td className="td-primary" style={{ color: isSelected ? 'var(--c-blue)' : undefined }}>
                      {d.name}
                    </td>
                    <td>
                      <span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--c-text-2)', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600 }}>
                        {d.report_type}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--c-text-3)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.description || '—'}
                    </td>
                    <td>
                      {d.is_default && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          background: 'var(--c-green-dim)', color: 'var(--c-green-text)',
                          border: '1px solid rgba(76,175,130,0.25)',
                          padding: '1px 7px', borderRadius: 3, fontSize: 9, fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.07em',
                        }}>
                          <CheckCircle size={8} /> DEFAULT
                        </span>
                      )}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      {isAdmin && (
                        <div className="data-table-actions">
                          <button className="btn-icon" onClick={() => openEdit(d)} title="Edit">
                            <Pencil size={11} />
                          </button>
                          <button className="btn-icon" style={{ color: 'var(--c-red)' }}
                            onClick={() => handleDelete(d)} title="Delete">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── PDF Template Source Editor — only shown when a design is selected ── */}
      {isAdmin && selectedDesign && (
        <div style={{ borderTop: '1px solid var(--c-border)', marginTop: 8 }}>

          {/* Section heading */}
          <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileCode size={16} style={{ color: 'var(--c-blue)' }} />
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)' }}>
                  PDF Template Source Editor
                </span>
                <span style={{ margin: '0 8px', color: 'var(--c-text-3)', fontSize: 13 }}>—</span>
                <span style={{ fontSize: 13, color: 'var(--c-blue)', fontWeight: 500 }}>
                  {selectedDesign.name}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--c-amber)' }}>
              <AlertTriangle size={11} />
              Changes apply immediately to all generated PDFs using this template
            </div>
          </div>

          {loadingFiles ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--c-text-3)', fontSize: 13, padding: '0 24px 24px' }}>
              <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Loading template files…
            </div>
          ) : (
            <div style={{ margin: '0 24px 40px', display: 'flex', gap: 0, border: '1px solid var(--c-border)', borderRadius: 6, overflow: 'hidden', minHeight: 500 }}>

              {/* LEFT: file list */}
              <div style={{
                width: 240, minWidth: 240, flexShrink: 0,
                background: 'var(--c-sidebar)',
                borderRight: '1px solid var(--c-border)',
                overflowY: 'auto',
              }}>
                {mainFiles.length > 0 && (
                  <>
                    <div style={{ padding: '10px 12px 4px', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-text-3)' }}>
                      Main
                    </div>
                    {mainFiles.map(f => (
                      <FileRow
                        key={f.path}
                        file={f}
                        selected={selectedFile === f.path}
                        onClick={() => setSelectedFile(f.path)}
                      />
                    ))}
                  </>
                )}

                {partialFiles.length > 0 && (
                  <>
                    <div style={{ padding: '14px 12px 4px', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-text-3)' }}>
                      Partials
                    </div>
                    {partialFiles.map(f => (
                      <FileRow
                        key={f.path}
                        file={f}
                        selected={selectedFile === f.path}
                        onClick={() => setSelectedFile(f.path)}
                      />
                    ))}
                  </>
                )}

                {files.length === 0 && (
                  <div style={{ padding: '20px 12px', fontSize: 12, color: 'var(--c-text-3)' }}>
                    No template files found
                  </div>
                )}
              </div>

              {/* RIGHT: editor */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--c-surface)', minWidth: 0 }}>
                {selectedFile ? (
                  <>
                    {/* Toolbar */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 14px',
                      borderBottom: '1px solid var(--c-border)',
                      background: 'var(--c-surface-2)',
                    }}>
                      <span style={{ flex: 1, fontSize: 12, color: 'var(--c-text-2)', fontFamily: 'var(--mono)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedFile}
                        {isDirty && (
                          <span style={{ marginLeft: 6, color: 'var(--c-amber)', fontSize: 10 }}>unsaved</span>
                        )}
                      </span>
                      {saveMsg && (
                        <span style={{ fontSize: 11, color: saveMsg.startsWith('Error') ? 'var(--c-red)' : 'var(--c-green-text)' }}>
                          {saveMsg}
                        </span>
                      )}
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={handleFileReset}
                        disabled={resetting || fileSaving}
                        title="Reset to built-in default"
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}
                      >
                        {resetting
                          ? <Loader2 size={11} style={{ animation: 'spin 0.7s linear infinite' }} />
                          : <RotateCcw size={11} />
                        }
                        Reset
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleFileSave}
                        disabled={fileSaving || !isDirty}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}
                      >
                        {fileSaving
                          ? <Loader2 size={11} style={{ animation: 'spin 0.7s linear infinite' }} />
                          : <Save size={11} />
                        }
                        Save
                      </button>
                    </div>

                    {/* Editor area */}
                    {loadingFileContent ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-3)', fontSize: 13, gap: 8 }}>
                        <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Loading…
                      </div>
                    ) : (
                      <textarea
                        ref={textareaRef}
                        value={fileContent}
                        onChange={e => setFileContent(e.target.value)}
                        onKeyDown={handleTabKey}
                        spellCheck={false}
                        style={{
                          flex: 1,
                          width: '100%',
                          minHeight: 600,
                          resize: 'vertical',
                          fontFamily: 'var(--mono)',
                          fontSize: 12,
                          lineHeight: 1.6,
                          background: '#0d1117',
                          color: '#e6edf3',
                          border: 'none',
                          outline: 'none',
                          padding: 16,
                          tabSize: 2,
                        }}
                      />
                    )}

                    {/* Status bar */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      padding: '4px 14px',
                      borderTop: '1px solid var(--c-border)',
                      background: 'var(--c-surface-2)',
                      fontSize: 10,
                      color: 'var(--c-text-3)',
                    }}>
                      <span>{lineCount} lines</span>
                      <span>{charCount} chars</span>
                    </div>
                  </>
                ) : (
                  <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    color: 'var(--c-text-3)', gap: 8,
                  }}>
                    <FileCode size={32} style={{ opacity: 0.3 }} />
                    <span style={{ fontSize: 13 }}>Select a template file to edit</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hint for admins when nothing is selected */}
      {isAdmin && !selectedDesign && !loading && designs.length > 0 && (
        <div style={{ padding: '16px 24px 32px', fontSize: 12, color: 'var(--c-text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileCode size={13} />
          Click a report template above to edit its PDF source files
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editTarget ? 'Edit Design' : 'New Report Design'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="field-label">Design Name *</label>
            <input className="field" placeholder="Standard Pentest Report" autoFocus
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Report Type</label>
            <select className="field" value={form.report_type}
              onChange={e => setForm(f => ({ ...f, report_type: e.target.value }))}>
              {REPORT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Description</label>
            <textarea className="field" style={{ minHeight: 80, resize: 'vertical' }}
              placeholder="Describe what this design is used for…"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              id="is_default"
              checked={form.is_default}
              onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
              style={{ accentColor: 'var(--c-green)', width: 14, height: 14 }}
            />
            <label htmlFor="is_default" style={{ fontSize: 12, cursor: 'pointer', color: 'var(--c-text-2)' }}>
              Set as default design for new engagements
            </label>
          </div>
          {error && (
            <div className="error-box">
              <AlertTriangle size={12} /> {error}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}
              disabled={saving || !form.name.trim()}>
              {saving ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : null}
              {editTarget ? 'Save Changes' : 'Create Design'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ── File row sub-component ────────────────────────────────────────────────────

function FileRow({ file, selected, onClick }: { file: TemplateFile; selected: boolean; onClick: () => void }) {
  const dir = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : ''
  const name = basename(file.path)

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        width: '100%', padding: '7px 12px',
        background: selected ? 'rgba(26,125,217,0.1)' : 'transparent',
        border: 'none',
        borderLeft: `2px solid ${selected ? 'var(--c-blue)' : 'transparent'}`,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.1s',
      }}
    >
      {dir && (
        <span style={{ fontSize: 9, color: 'var(--c-text-3)', fontFamily: 'var(--mono)' }}>
          {dir}/
        </span>
      )}
      <span style={{ fontSize: 12, color: selected ? 'var(--c-blue)' : 'var(--c-text-2)', fontFamily: 'var(--mono)', fontWeight: selected ? 500 : 400 }}>
        {name}
      </span>
    </button>
  )
}
