import { useRef, useState } from 'react'
import { Camera, Code2, Eye, EyeOff, FileText, GripVertical, Loader2, Plus, X } from 'lucide-react'
import type { ContentBlock } from '../types'
import { api } from '../api'

interface ContentBlockEditorProps {
  blocks: ContentBlock[]
  projectId?: number
  onChange: (blocks: ContentBlock[]) => void
  placeholder?: string
}

const LANGUAGES = ['bash', 'powershell', 'python', 'javascript', 'sql', 'xml', 'json', 'yaml', 'text', 'http']

// ── Insert point between / around blocks ─────────────────────────────────────

interface InsertPointProps {
  position: number
  uploading: boolean
  canUpload: boolean
  onInsertText: (position: number) => void
  onInsertCode: (position: number) => void
  onInsertScreenshot: (position: number, file: File) => void
}

function InsertPoint({ position, uploading, canUpload, onInsertText, onInsertCode, onInsertScreenshot }: InsertPointProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onInsertScreenshot(position, file)
    e.target.value = ''
  }

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '4px 10px', fontSize: 11, fontWeight: 500,
    border: '1px solid var(--c-border-2)',
    borderRadius: 4, cursor: 'pointer',
    color: 'var(--c-text-2)', background: 'var(--c-surface)',
    fontFamily: 'var(--font)', whiteSpace: 'nowrap',
    transition: 'border-color 0.1s, background 0.1s, color 0.1s',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', position: 'relative' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />

      {uploading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: 11, color: 'var(--c-text-3)' }}>
          <Loader2 size={11} className="animate-spin" style={{ color: 'var(--c-purple)' }} />
          Uploading…
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            style={btnStyle}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--c-border-2)'; e.currentTarget.style.background = 'var(--c-surface-2)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-border-2)'; e.currentTarget.style.background = 'var(--c-surface)' }}
            onClick={() => onInsertText(position)}
          >
            <FileText size={11} style={{ color: 'var(--c-text-3)' }} />
            Text
          </button>
          <button
            style={btnStyle}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(37,99,235,0.4)'; e.currentTarget.style.background = 'var(--c-purple-dim)'; e.currentTarget.style.color = 'var(--c-purple-text)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-border-2)'; e.currentTarget.style.background = 'var(--c-surface)'; e.currentTarget.style.color = 'var(--c-text-2)' }}
            onClick={() => onInsertCode(position)}
          >
            <Code2 size={11} style={{ color: 'var(--c-purple)' }} />
            Code
          </button>
          <label
            style={{ ...btnStyle, cursor: canUpload ? 'pointer' : 'not-allowed', opacity: canUpload ? 1 : 0.5 }}
            onMouseEnter={e => { if (canUpload) { e.currentTarget.style.borderColor = 'rgba(37,99,235,0.4)'; e.currentTarget.style.background = 'var(--c-purple-dim)'; e.currentTarget.style.color = 'var(--c-purple-text)' } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-border-2)'; e.currentTarget.style.background = 'var(--c-surface)'; e.currentTarget.style.color = 'var(--c-text-2)' }}
            title={!canUpload ? 'Save the engagement first to enable uploads' : 'Upload screenshot'}
          >
            <Camera size={11} style={{ color: 'var(--c-purple)' }} />
            Screenshot
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={!canUpload}
              onChange={handleFileChange}
            />
          </label>
        </div>
      )}

      <div style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ placeholder }: { placeholder?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-8 text-center"
      style={{ background: 'var(--c-surface-2)', border: '2px dashed var(--c-border-2)', borderRadius: '6px' }}
    >
      <FileText size={20} className="mb-2" style={{ color: 'var(--c-text-3)', opacity: 0.35 }} />
      <p className="text-xs" style={{ color: 'var(--c-text-3)', marginBottom: 2 }}>
        {placeholder || 'No content yet.'}
      </p>
      <p className="text-xs italic" style={{ color: 'var(--c-text-3)', opacity: 0.7 }}>
        Use the buttons above to add a text block, code block, or screenshot.
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ContentBlockEditor({ blocks, projectId, onChange, placeholder }: ContentBlockEditorProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [uploadingAt, setUploadingAt] = useState<number | null>(null)

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (idx !== dragIdx) setDragOverIdx(idx)
  }

  const handleDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === dropIdx) {
      setDragIdx(null); setDragOverIdx(null); return
    }
    const next = [...blocks]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(dropIdx, 0, moved)
    onChange(next)
    setDragIdx(null); setDragOverIdx(null)
  }

  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null) }

  const updateBlock = (idx: number, updated: ContentBlock) => {
    const next = [...blocks]
    next[idx] = updated
    onChange(next)
  }

  const deleteBlock = (idx: number) => {
    onChange(blocks.filter((_, i) => i !== idx))
  }

  const insertBlock = (position: number, block: ContentBlock) => {
    const next = [...blocks]
    next.splice(position, 0, block)
    onChange(next)
  }

  const handleInsertText = (position: number) => {
    insertBlock(position, { type: 'text', content: '' })
    setTimeout(() => {
      const textareas = document.querySelectorAll<HTMLTextAreaElement>('[data-block-textarea]')
      if (textareas[position]) textareas[position].focus()
    }, 50)
  }

  const handleInsertCode = (position: number) => {
    insertBlock(position, { type: 'code', language: 'bash', content: '', highlight_lines: [], label: '', caption: '' })
  }

  const handleInsertScreenshot = async (position: number, file: File) => {
    if (!projectId) return
    setUploadingAt(position)
    try {
      const res = await api.projects.uploadFile(projectId, file)
      insertBlock(position, { type: 'screenshot', path: res.path, caption: '' })
    } catch { /* silently ignore */ }
    finally { setUploadingAt(null) }
  }

  return (
    <div className="space-y-0">
      <InsertPoint
        position={0}
        uploading={uploadingAt === 0}
        canUpload={!!projectId}
        onInsertText={handleInsertText}
        onInsertCode={handleInsertCode}
        onInsertScreenshot={handleInsertScreenshot}
      />

      {blocks.length === 0 && <EmptyState placeholder={placeholder} />}

      {blocks.map((block, idx) => (
        <div key={idx}>
          <div
            draggable
            onDragStart={e => handleDragStart(e, idx)}
            onDragOver={e => handleDragOver(e, idx)}
            onDrop={e => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            className="group/block relative overflow-hidden"
            style={{
              opacity: dragIdx === idx ? 0.4 : 1,
              borderTop: dragOverIdx === idx && dragIdx !== idx ? '2px solid var(--c-purple)' : undefined,
              transition: 'opacity 0.1s',
              marginBottom: '2px',
              borderRadius: '4px',
            }}
          >
            {block.type === 'text' && (
              <TextBlock
                block={block}
                idx={idx}
                placeholder={placeholder}
                onUpdate={b => updateBlock(idx, b)}
                onDelete={() => deleteBlock(idx)}
              />
            )}
            {block.type === 'code' && (
              <CodeBlock
                block={block}
                idx={idx}
                onUpdate={b => updateBlock(idx, b)}
                onDelete={() => deleteBlock(idx)}
              />
            )}
            {block.type === 'screenshot' && (
              <ScreenshotBlock
                block={block}
                idx={idx}
                projectId={projectId}
                onUpdate={b => updateBlock(idx, b)}
                onDelete={() => deleteBlock(idx)}
              />
            )}
          </div>

          <InsertPoint
            position={idx + 1}
            uploading={uploadingAt === idx + 1}
            canUpload={!!projectId}
            onInsertText={handleInsertText}
            onInsertCode={handleInsertCode}
            onInsertScreenshot={handleInsertScreenshot}
          />
        </div>
      ))}
    </div>
  )
}

// ── Text block ────────────────────────────────────────────────────────────────

interface TextBlockProps {
  block: Extract<ContentBlock, { type: 'text' }>
  idx: number
  placeholder?: string
  onUpdate: (block: ContentBlock) => void
  onDelete: () => void
}

function TextBlock({ block, placeholder, onUpdate, onDelete }: TextBlockProps) {
  return (
    <div className="flex gap-2 items-start py-1">
      <div
        className="flex items-start pt-3 shrink-0 opacity-20 group-hover/block:opacity-50 transition-opacity"
        style={{ cursor: 'grab', color: 'var(--c-text-3)' }}
      >
        <GripVertical size={14} />
      </div>
      <textarea
        data-block-textarea
        className="fo-textarea w-full resize-none flex-1"
        style={{
          minHeight: '88px',
          background: 'var(--c-surface-2)',
          border: '1px solid var(--c-border-2)',
          borderRadius: '6px',
          padding: '10px 12px',
        }}
        placeholder={placeholder || 'Write your narrative here. Markdown: **bold**, *italic*, `code`, - list'}
        value={block.content}
        onChange={e => onUpdate({ ...block, content: e.target.value })}
        onInput={e => {
          const t = e.currentTarget
          t.style.height = 'auto'
          t.style.height = t.scrollHeight + 'px'
        }}
      />
      <button
        className="opacity-0 group-hover/block:opacity-100 transition-opacity mt-2 shrink-0 flex items-center justify-center w-6 h-6"
        style={{ color: 'var(--c-red)', borderRadius: '4px' }}
        onClick={onDelete}
        title="Delete block"
      >
        <X size={12} />
      </button>
    </div>
  )
}

// ── Code block ────────────────────────────────────────────────────────────────

interface CodeBlockProps {
  block: Extract<ContentBlock, { type: 'code' }>
  idx: number
  onUpdate: (block: ContentBlock) => void
  onDelete: () => void
}

function CodeBlock({ block, onUpdate, onDelete }: CodeBlockProps) {
  const hlString = (block.highlight_lines ?? []).join(', ')

  const setHlLines = (val: string) => {
    const nums = val.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0)
    onUpdate({ ...block, highlight_lines: nums })
  }

  return (
    <div
      className="overflow-hidden"
      style={{ border: '1px solid rgba(37,99,235,0.2)', borderRadius: '4px' }}
    >
      {/* Code block header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: 'var(--c-purple-dim)', borderBottom: '1px solid rgba(37,99,235,0.15)' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="opacity-40 group-hover/block:opacity-70 transition-opacity"
            style={{ cursor: 'grab', color: 'var(--c-text-3)' }}
          >
            <GripVertical size={13} />
          </span>
          <Code2 size={13} style={{ color: 'var(--c-purple)' }} />
          <span className="text-[11px] font-semibold" style={{ color: 'var(--c-purple-text)' }}>
            Code Block
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5" style={{ background: 'var(--c-purple-dim)', color: 'var(--c-purple-text)', borderRadius: '2px', border: '1px solid rgba(37,99,235,0.2)' }}>
            {block.language || 'bash'}
          </span>
        </div>
        <button
          className="opacity-0 group-hover/block:opacity-100 transition-opacity flex items-center justify-center w-6 h-6"
          style={{ color: 'var(--c-red)', borderRadius: '4px' }}
          onClick={onDelete}
          title="Delete block"
        >
          <X size={11} />
        </button>
      </div>

      {/* Code block body */}
      <div className="px-3 py-3 space-y-2" style={{ background: 'var(--c-surface-2)' }}>
        <div>
          <label className="fo-label" style={{ fontSize: '10px' }}>Label</label>
          <input
            className="fo-input text-xs py-1"
            placeholder="e.g. Hashcat — Offline Crack of Backup Hash"
            value={block.label || ''}
            onChange={e => onUpdate({ ...block, label: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="fo-label" style={{ fontSize: '10px' }}>Language</label>
            <select
              className="fo-select text-xs"
              value={block.language}
              onChange={e => onUpdate({ ...block, language: e.target.value })}
            >
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="fo-label" style={{ fontSize: '10px' }}>Highlight Lines</label>
            <input
              className="fo-input-mono text-xs py-1"
              placeholder="e.g. 1,3,5"
              defaultValue={hlString}
              onBlur={e => setHlLines(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="fo-label" style={{ fontSize: '10px' }}>Code *</label>
          <textarea
            className="fo-textarea font-mono text-xs"
            style={{ minHeight: '96px', fontSize: '11px' }}
            placeholder="Paste your code or command output here…"
            value={block.content}
            onChange={e => onUpdate({ ...block, content: e.target.value })}
            onInput={e => {
              const t = e.currentTarget
              t.style.height = 'auto'
              t.style.height = t.scrollHeight + 'px'
            }}
          />
        </div>

        <div>
          <label className="fo-label" style={{ fontSize: '10px' }}>Caption</label>
          <input
            className="fo-input text-xs py-1"
            placeholder="Optional figure caption"
            value={block.caption || ''}
            onChange={e => onUpdate({ ...block, caption: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}

// ── Screenshot block ──────────────────────────────────────────────────────────

interface ScreenshotBlockProps {
  block: Extract<ContentBlock, { type: 'screenshot' }>
  idx: number
  projectId?: number
  onUpdate: (block: ContentBlock) => void
  onDelete: () => void
}

function ScreenshotBlock({ block, projectId, onUpdate, onDelete }: ScreenshotBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const blockRef = useRef(block)
  blockRef.current = block
  const isResizing = useRef(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const imgWidth = block.width ?? 100

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isResizing.current = true

    const onMouseMove = (mv: MouseEvent) => {
      if (!isResizing.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = Math.round(((mv.clientX - rect.left) / rect.width) * 100)
      onUpdate({ ...blockRef.current, width: Math.max(10, Math.min(100, pct)) })
    }

    const onMouseUp = () => {
      isResizing.current = false
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const imgSrc = projectId && block.path ? `/api/media/${projectId}/${block.path}` : null

  return (
    <div
      className="overflow-hidden"
      style={{ border: '1px solid rgba(37,99,235,0.2)', borderRadius: '4px' }}
    >
      {/* Screenshot block header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: 'var(--c-purple-dim)', borderBottom: '1px solid rgba(37,99,235,0.15)' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="opacity-40 group-hover/block:opacity-70 transition-opacity"
            style={{ cursor: 'grab', color: 'var(--c-text-3)' }}
          >
            <GripVertical size={13} />
          </span>
          <Camera size={13} style={{ color: 'var(--c-purple)' }} />
          <span className="text-[11px] font-semibold" style={{ color: 'var(--c-purple-text)' }}>Screenshot</span>
          <span
            className="text-[10px] font-mono px-1.5 py-0.5"
            style={{ background: 'var(--c-purple-dim)', color: 'var(--c-purple-text)', borderRadius: '2px', border: '1px solid rgba(37,99,235,0.2)' }}
          >
            {imgWidth}%
          </span>
        </div>
        <div className="flex items-center gap-1">
          {imgSrc && (
            <button
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium transition-colors"
              style={{
                background: previewOpen ? 'var(--c-purple-dim)' : 'transparent',
                color: previewOpen ? 'var(--c-purple-text)' : 'var(--c-text-3)',
                border: '1px solid',
                borderColor: previewOpen ? 'rgba(37,99,235,0.3)' : 'transparent',
                borderRadius: '4px',
              }}
              onClick={() => setPreviewOpen(v => !v)}
              title="Toggle PDF preview"
            >
              {previewOpen ? <EyeOff size={11} /> : <Eye size={11} />}
              PDF Preview
            </button>
          )}
          <button
            className="opacity-0 group-hover/block:opacity-100 transition-opacity flex items-center justify-center w-6 h-6"
            style={{ color: 'var(--c-red)', borderRadius: '4px' }}
            onClick={onDelete}
            title="Delete block"
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Screenshot block body */}
      <div className="px-3 py-3 space-y-2" style={{ background: 'var(--c-surface-2)' }}>
        {imgSrc ? (
          <>
            <div ref={containerRef} style={{ position: 'relative' }}>
              <div style={{ width: `${imgWidth}%`, position: 'relative' }}>
                <img
                  src={imgSrc}
                  alt={block.caption || 'Screenshot'}
                  style={{
                    width: '100%',
                    display: 'block',
                    borderRadius: '4px',
                    border: '1px solid var(--c-border)',
                    maxHeight: '320px',
                    objectFit: 'contain',
                    background: 'var(--c-surface-3)',
                  }}
                />
                <div
                  title="Drag to resize"
                  onMouseDown={handleResizeMouseDown}
                  style={{
                    position: 'absolute',
                    right: '-5px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '10px',
                    height: '32px',
                    cursor: 'ew-resize',
                    background: 'var(--c-purple)',
                    borderRadius: '2px',
                    zIndex: 10,
                    userSelect: 'none',
                  }}
                />
              </div>
            </div>
            <p className="text-[10px]" style={{ color: 'var(--c-text-3)' }}>
              Drag the handle to resize — centred in PDF at {imgWidth}% width
            </p>

            {previewOpen && (
              <div className="overflow-hidden" style={{ border: '1px solid var(--c-border)', borderRadius: '4px' }}>
                <div
                  className="px-3 py-1.5 flex items-center gap-2"
                  style={{ background: 'var(--c-surface-3)', borderBottom: '1px solid var(--c-border)' }}
                >
                  <Eye size={10} style={{ color: 'var(--c-text-3)' }} />
                  <span className="text-[10px] font-medium" style={{ color: 'var(--c-text-3)' }}>
                    PDF Page Preview — updates live as you resize
                  </span>
                </div>
                <div style={{ background: '#c9c9c9', padding: '16px 20px' }}>
                  <div
                    style={{
                      background: 'white',
                      borderRadius: '2px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
                      padding: '28px 36px',
                      fontFamily: "DM Sans, system-ui, sans-serif",
                    }}
                  >
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '2px', marginBottom: '6px', width: '90%' }} />
                      <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '2px', marginBottom: '6px', width: '75%' }} />
                      <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '2px', width: '55%' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>
                      <img
                        src={imgSrc}
                        alt={block.caption || 'Screenshot'}
                        style={{ width: `${imgWidth}%`, display: 'block', borderRadius: '2px' }}
                      />
                    </div>
                    <p style={{ textAlign: 'center', fontSize: '10px', color: '#6b7280', fontStyle: 'italic', margin: '0 0 14px' }}>
                      <strong style={{ fontStyle: 'normal' }}>Figure X</strong>
                      {block.caption ? ` — ${block.caption}` : ''}
                    </p>
                    <div>
                      <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '2px', marginBottom: '6px', width: '85%' }} />
                      <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '2px', width: '40%' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div
            className="flex items-center justify-center"
            style={{ height: '80px', background: 'var(--c-surface-3)', border: '1px dashed var(--c-border)', borderRadius: '4px' }}
          >
            <p className="text-xs italic" style={{ color: 'var(--c-text-3)' }}>
              {block.path ? 'Save engagement to preview image' : 'No image path set'}
            </p>
          </div>
        )}

        <input
          className="fo-input text-xs py-1"
          placeholder="Figure caption…"
          value={block.caption || ''}
          onChange={e => onUpdate({ ...block, caption: e.target.value })}
        />
      </div>
    </div>
  )
}
