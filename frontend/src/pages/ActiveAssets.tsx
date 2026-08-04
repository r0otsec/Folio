import { useState, useEffect, useCallback } from 'react'
import { Globe, Server } from 'lucide-react'
import { api } from '../api'
import { useNavigate } from 'react-router-dom'

export default function ActiveAssets() {
  const [domains, setDomains] = useState<any[]>([])
  const [servers, setServers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([api.domains.list(), api.servers.list()])
      const inactiveDomains = new Set(['burned', 'expired'])
      const inactiveServers = new Set(['burned', 'retired'])
      setDomains(d.filter((x: any) => !inactiveDomains.has(x.status)))
      setServers(s.filter((x: any) => !inactiveServers.has(x.status)))
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 10, color: 'var(--c-text-3)' }}>
      <div className="spinner" /><span style={{ fontSize: 13 }}>Loading assets…</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-header-title">My Active Assets</span>
          <span className="page-header-count">{domains.length + servers.length} active</span>
        </div>
      </div>

      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Active Domains */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Globe size={16} style={{ color: 'var(--c-purple-text)' }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-purple-text)' }}>Your Active Domains</span>
            <span style={{ fontSize: 11, color: 'var(--c-text-3)', marginLeft: 4 }}>{domains.length}</span>
          </div>
          {domains.length === 0 ? (
            <div className="empty-state">There are no domains currently active for your account.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Domain</th><th>Purpose</th><th>Expiry</th><th>Registrar</th><th>Engagement</th></tr>
              </thead>
              <tbody>
                {domains.map((d: any) => (
                  <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/domains')}>
                    <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--c-purple-text)', fontWeight: 600 }}>{d.domain}</span></td>
                    <td><span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--c-text-2)', padding: '2px 8px', borderRadius: 3, fontSize: 11 }}>{d.purpose}</span></td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--c-text-2)' }}>{d.expiry_date || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--c-text-3)' }}>{d.registrar || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--c-text-2)' }}>{d.engagement || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/domains')}>
              Manage All Domains →
            </button>
          </div>
        </div>

        {/* Active Servers */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Server size={16} style={{ color: 'var(--c-green-text)' }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-green-text)' }}>Your Active Servers</span>
            <span style={{ fontSize: 11, color: 'var(--c-text-3)', marginLeft: 4 }}>{servers.length}</span>
          </div>
          {servers.length === 0 ? (
            <div className="empty-state">There are no servers currently active for your account.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>IP Address</th><th>Hostname</th><th>Purpose</th><th>Provider</th><th>Engagement</th></tr>
              </thead>
              <tbody>
                {servers.map((s: any) => (
                  <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/servers')}>
                    <td className="td-mono">{s.ip_address || '—'}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--c-text-1)', fontWeight: 500 }}>{s.hostname || '—'}</td>
                    <td><span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--c-text-2)', padding: '2px 8px', borderRadius: 3, fontSize: 11 }}>{s.purpose}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--c-text-3)' }}>{s.server_provider || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--c-text-2)' }}>{s.engagement || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/servers')}>
              Manage All Servers →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
