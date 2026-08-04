import { useState } from 'react'
import { Download, Upload, CheckCircle, AlertCircle, Loader2, Globe, Server, Clipboard, Crosshair } from 'lucide-react'
import { api, downloadBlob } from '../api'

type Status = { type: 'success' | 'error'; message: string } | null

function Section({
  icon, title, description, onExport, onImport, status, loading,
}: {
  icon: React.ReactNode
  title: string
  description: string
  onExport: () => void
  onImport: (file: File) => void
  status: Status
  loading: boolean
}) {
  return (
    <div style={{
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border)',
      borderRadius: 8,
      padding: '20px 24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 8,
          background: 'var(--c-green-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--c-green)', flexShrink: 0,
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--c-text-1)', marginBottom: 2 }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--c-text-2)', lineHeight: 1.5 }}>{description}</div>
        </div>
      </div>

      {status && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
          borderRadius: 5, marginBottom: 12, fontSize: 12,
          background: status.type === 'success' ? 'var(--c-green-dim)' : 'rgba(224,82,82,0.1)',
          border: `1px solid ${status.type === 'success' ? 'rgba(26,158,106,0.3)' : 'rgba(224,82,82,0.3)'}`,
          color: status.type === 'success' ? 'var(--c-green-text)' : 'var(--c-red)',
        }}>
          {status.type === 'success' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
          {status.message}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className="btn btn-outline btn-sm"
          onClick={onExport}
          disabled={loading}
          style={{ flex: 1 }}
        >
          {loading ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Download size={13} />}
          Export JSON
        </button>
        <label style={{ flex: 1 }}>
          <input
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = '' }}
            disabled={loading}
          />
          <span
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}
          >
            <Upload size={13} /> Import JSON
          </span>
        </label>
      </div>
    </div>
  )
}

export default function ImportExport() {
  const [statuses, setStatuses] = useState<Record<string, Status>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  const setStatus = (key: string, s: Status) => setStatuses(p => ({ ...p, [key]: s }))
  const setLoad = (key: string, v: boolean) => setLoading(p => ({ ...p, [key]: v }))

  const handleExport = async (key: string, fetcher: () => Promise<any[]>, filename: string) => {
    setLoad(key, true); setStatus(key, null)
    try {
      const data = await fetcher()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      downloadBlob(blob, filename)
      setStatus(key, { type: 'success', message: `Exported ${data.length} record${data.length !== 1 ? 's' : ''} successfully.` })
    } catch (e: any) {
      setStatus(key, { type: 'error', message: e.message || 'Export failed.' })
    } finally { setLoad(key, false) }
  }

  const handleImport = async (key: string, importer: (data: any[]) => Promise<{ imported: number }>, file: File) => {
    setLoad(key, true); setStatus(key, null)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!Array.isArray(data)) throw new Error('JSON file must contain an array of records.')
      const result = await importer(data)
      setStatus(key, { type: 'success', message: `Imported ${result.imported} record${result.imported !== 1 ? 's' : ''} successfully.` })
    } catch (e: any) {
      setStatus(key, { type: 'error', message: e.message || 'Import failed — check your JSON format.' })
    } finally { setLoad(key, false) }
  }

  const handleExportTemplates = async () => {
    setLoad('templates', true); setStatus('templates', null)
    try {
      const data = await api.templates.list()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      downloadBlob(blob, 'finding-templates.json')
      setStatus('templates', { type: 'success', message: `Exported ${data.length} template${data.length !== 1 ? 's' : ''}.` })
    } catch (e: any) {
      setStatus('templates', { type: 'error', message: e.message || 'Export failed.' })
    } finally { setLoad('templates', false) }
  }

  const handleImportTemplates = async (file: File) => {
    setLoad('templates', true); setStatus('templates', null)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!Array.isArray(data)) throw new Error('JSON file must contain an array.')
      const result = await api.templates.bulkCreate(data)
      setStatus('templates', { type: 'success', message: `Imported ${result.imported} template${result.imported !== 1 ? 's' : ''} — merged with existing.` })
    } catch (e: any) {
      setStatus('templates', { type: 'error', message: e.message || 'Import failed.' })
    } finally { setLoad('templates', false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-header-title">Import &amp; Export</span>
          <span className="page-header-count">Data management</span>
        </div>
      </div>

      <div style={{ padding: '24px 24px 40px', maxWidth: 860 }}>
        <p style={{ fontSize: 13, color: 'var(--c-text-2)', marginBottom: 28, lineHeight: 1.6 }}>
          Export your data as JSON for backup or migration, or import JSON files to populate records. Imports are additive — existing records are not overwritten.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Section
            icon={<Crosshair size={18} />}
            title="Finding Templates"
            description="Reusable finding templates stored in your browser. Export to share across machines or back up locally."
            onExport={handleExportTemplates}
            onImport={handleImportTemplates}
            status={statuses['templates'] ?? null}
            loading={loading['templates'] ?? false}
          />

          <Section
            icon={<Clipboard size={18} />}
            title="Observations"
            description="Security observations from your observation library stored in the database."
            onExport={() => handleExport('observations', api.exportData.observations, 'observations.json')}
            onImport={f => handleImport('observations', api.importData.observations, f)}
            status={statuses['observations'] ?? null}
            loading={loading['observations'] ?? false}
          />

          <Section
            icon={<Globe size={18} />}
            title="Domains"
            description="Domain tracking records including registrar, expiry, DNS provider, and purpose."
            onExport={() => handleExport('domains', api.exportData.domains, 'domains.json')}
            onImport={f => handleImport('domains', api.importData.domains, f)}
            status={statuses['domains'] ?? null}
            loading={loading['domains'] ?? false}
          />

          <Section
            icon={<Server size={18} />}
            title="Servers"
            description="Infrastructure server records including IP, hostname, provider, purpose, and status."
            onExport={() => handleExport('servers', api.exportData.servers, 'servers.json')}
            onImport={f => handleImport('servers', api.importData.servers, f)}
            status={statuses['servers'] ?? null}
            loading={loading['servers'] ?? false}
          />
        </div>

        <div style={{
          marginTop: 24, padding: '14px 16px',
          background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', borderRadius: 6,
        }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-2)', marginBottom: 4 }}>Import format</p>
          <p style={{ fontSize: 11, color: 'var(--c-text-3)', lineHeight: 1.6 }}>
            All imports expect a <code style={{ fontFamily: 'var(--mono)', color: 'var(--c-text-2)' }}>[...]</code> JSON array. The <code style={{ fontFamily: 'var(--mono)', color: 'var(--c-text-2)' }}>id</code> and <code style={{ fontFamily: 'var(--mono)', color: 'var(--c-text-2)' }}>created_at</code> fields are ignored — new IDs are assigned automatically. Export first to see the expected schema for each type.
          </p>
        </div>
      </div>
    </div>
  )
}
