import type { Severity } from '../types'

const MAP: Record<string, string> = {
  critical: 'badge-critical',
  high: 'badge-high',
  medium: 'badge-medium',
  low: 'badge-low',
  informational: 'badge-info',
  info: 'badge-info',
}
const LABEL: Record<string, string> = {
  critical: 'Critical', high: 'High', medium: 'Medium',
  low: 'Low', informational: 'Info', info: 'Info',
}

export default function SeverityBadge({ severity, size = 'sm' }: { severity: Severity | string; size?: 'xs' | 'sm' | 'md' }) {
  const key = (severity || 'info').toLowerCase()
  const cls = MAP[key] ?? MAP.info
  const label = LABEL[key] ?? severity
  const pad = size === 'xs' ? { padding: '1px 6px', fontSize: 9 } : size === 'md' ? { padding: '3px 10px', fontSize: 11 } : {}
  return <span className={`badge ${cls}`} style={pad}>{label}</span>
}
