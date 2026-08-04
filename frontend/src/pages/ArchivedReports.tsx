import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, RotateCcw, Trash2, ChevronRight } from 'lucide-react'
import { api } from '../api'
import type { ProjectSummary } from '../types'

function fmtDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ArchivedReports() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const all = await api.projects.list()
      setProjects(all.filter(p => p.status === 'archived'))
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleRestore = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    await api.projects.update(id, { status: 'active' })
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (!confirm('Permanently delete this archived report?')) return
    await api.projects.delete(id)
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div className="page-header">
        <div className="page-header-left">
          <Archive size={15} style={{ color: 'var(--c-text-3)' }} />
          <span className="page-header-title">Archived Reports</span>
          <span className="page-header-count">{projects.length} report{projects.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 10, color: 'var(--c-text-3)' }}>
          <div className="spinner" /> <span style={{ fontSize: 13 }}>Loading…</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 24 }}>
          <Archive size={32} style={{ opacity: 0.2, marginBottom: 10 }} />
          No archived reports. Archive an engagement from the dashboard to store it here.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Client / Report</th>
                <th>Report ID</th>
                <th>Critical</th>
                <th>High</th>
                <th>Medium</th>
                <th>Low</th>
                <th>Last Updated</th>
                <th style={{ width: 110 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/engagements/${p.id}`)}>
                  <td className="td-primary">{p.client_name || p.name}</td>
                  <td className="td-mono">{p.report_id || '—'}</td>
                  <td>{(p.risk_counts.critical || 0) > 0 ? <span className="badge badge-critical">{p.risk_counts.critical}</span> : <span style={{ color: 'var(--c-text-3)' }}>—</span>}</td>
                  <td>{(p.risk_counts.high || 0) > 0 ? <span className="badge badge-high">{p.risk_counts.high}</span> : <span style={{ color: 'var(--c-text-3)' }}>—</span>}</td>
                  <td>{(p.risk_counts.medium || 0) > 0 ? <span className="badge badge-medium">{p.risk_counts.medium}</span> : <span style={{ color: 'var(--c-text-3)' }}>—</span>}</td>
                  <td>{(p.risk_counts.low || 0) > 0 ? <span className="badge badge-low">{p.risk_counts.low}</span> : <span style={{ color: 'var(--c-text-3)' }}>—</span>}</td>
                  <td style={{ fontSize: 11, color: 'var(--c-text-3)' }}>{fmtDate(p.updated_at)}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="data-table-actions">
                      <button
                        className="btn-icon"
                        title="Restore to active"
                        style={{ color: 'var(--c-blue)' }}
                        onClick={e => handleRestore(e, p.id)}
                      >
                        <RotateCcw size={12} />
                      </button>
                      <button
                        className="btn-icon"
                        title="Delete permanently"
                        style={{ color: 'var(--c-red)' }}
                        onClick={e => handleDelete(e, p.id)}
                      >
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
    </div>
  )
}
