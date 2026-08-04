import type { ProjectDetail, ProjectSummary, ReportData } from './types'

export interface Template {
  id: number
  title: string
  severity: string
  category: string
  description: string
  impact: string
  recommendations: string
  tags: string[]
  cvss_score?: number | null
  cvss_vector?: string
}

const BASE = '/api'
const TOKEN_KEY = 'fo_token'

function getToken() { return localStorage.getItem(TOKEN_KEY) }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// ── Projects ──────────────────────────────────────────────────────────────────
export const api = {
  projects: {
    list: (): Promise<ProjectSummary[]> => request('/projects'),
    create: (data: { name: string; report_id: string; client_name: string; client_id?: number }): Promise<ProjectDetail> =>
      request('/projects', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: number): Promise<ProjectDetail> => request(`/projects/${id}`),
    update: (id: number, data: Partial<{ name: string; report_id: string; client_name: string; status: string; report_data: ReportData }>): Promise<ProjectDetail> =>
      request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number): Promise<void> => request(`/projects/${id}`, { method: 'DELETE' }),
    generatePdf: async (id: number): Promise<Blob> => {
      const token = getToken()
      const res = await fetch(`${BASE}/projects/${id}/generate`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(await res.text())
      return res.blob()
    },
    uploadFile: async (id: number, file: File): Promise<{ path: string; url: string }> => {
      const token = getToken()
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${BASE}/projects/${id}/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    importNessus: async (id: number, file: File): Promise<ProjectDetail> => {
      const token = getToken()
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${BASE}/projects/${id}/import-nessus`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
  },

  clients: {
    list: () => request<any[]>('/clients'),
    create: (data: any) => request<any>('/clients', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/clients/${id}`, { method: 'DELETE' }),
  },

  domains: {
    list: () => request<any[]>('/domains'),
    create: (data: any) => request<any>('/domains', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/domains/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/domains/${id}`, { method: 'DELETE' }),
  },

  servers: {
    list: () => request<any[]>('/servers'),
    create: (data: any) => request<any>('/servers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/servers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/servers/${id}`, { method: 'DELETE' }),
  },

  observations: {
    list: () => request<any[]>('/observations'),
    create: (data: any) => request<any>('/observations', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/observations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/observations/${id}`, { method: 'DELETE' }),
  },

  designs: {
    list: () => request<any[]>('/designs'),
    create: (data: any) => request<any>('/designs', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/designs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/designs/${id}`, { method: 'DELETE' }),
  },

  oplogs: {
    list: () => request<any[]>('/oplogs'),
    create: (data: any) => request<any>('/oplogs', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/oplogs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/oplogs/${id}`, { method: 'DELETE' }),
    entries: {
      list: (oplogId: number) => request<any[]>(`/oplogs/${oplogId}/entries`),
      create: (oplogId: number, data: any) => request<any>(`/oplogs/${oplogId}/entries`, { method: 'POST', body: JSON.stringify(data) }),
      update: (oplogId: number, entryId: number, data: any) => request<any>(`/oplogs/${oplogId}/entries/${entryId}`, { method: 'PUT', body: JSON.stringify(data) }),
      delete: (oplogId: number, entryId: number) => request<void>(`/oplogs/${oplogId}/entries/${entryId}`, { method: 'DELETE' }),
      uploadEvidence: async (oplogId: number, entryId: number, file: File, meta: { friendly_name?: string; caption?: string; description?: string; tags?: string }): Promise<any> => {
        const token = getToken()
        const fd = new FormData()
        fd.append('file', file)
        if (meta.friendly_name) fd.append('friendly_name', meta.friendly_name)
        if (meta.caption) fd.append('caption', meta.caption)
        if (meta.description) fd.append('description', meta.description)
        if (meta.tags) fd.append('tags', meta.tags)
        const res = await fetch(`${BASE}/oplogs/${oplogId}/entries/${entryId}/evidence`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        })
        if (!res.ok) throw new Error(await res.text())
        return res.json()
      },
      deleteEvidence: (evidenceId: number) => request<void>(`/oplog-evidence/${evidenceId}`, { method: 'DELETE' }),
    },
  },

  exportData: {
    domains: () => request<any[]>('/export/domains'),
    servers: () => request<any[]>('/export/servers'),
    observations: () => request<any[]>('/export/observations'),
  },

  importData: {
    domains: (data: any[]) => request<{ imported: number }>('/import/domains', { method: 'POST', body: JSON.stringify(data) }),
    servers: (data: any[]) => request<{ imported: number }>('/import/servers', { method: 'POST', body: JSON.stringify(data) }),
    observations: (data: any[]) => request<{ imported: number }>('/import/observations', { method: 'POST', body: JSON.stringify(data) }),
  },

  templates: {
    list: () => request<Template[]>('/templates'),
    create: (body: Omit<Template, 'id'>) => request<Template>('/templates', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Partial<Omit<Template, 'id'>>) => request<Template>(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => request<void>(`/templates/${id}`, { method: 'DELETE' }),
    bulkCreate: (items: Omit<Template, 'id'>[]) => request<{ imported: number }>('/templates/bulk', { method: 'POST', body: JSON.stringify(items) }),
  },

  admin: {
    users: {
      list: () => request<any[]>('/admin/users'),
      create: (data: any) => request<any>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: number, data: any) => request<any>(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      resetPassword: (id: number, newPassword: string) =>
        request<any>(`/admin/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ new_password: newPassword }) }),
      delete: (id: number) => request<void>(`/admin/users/${id}`, { method: 'DELETE' }),
    },
    templateFiles: {
      list: () => request<{ path: string; size: number }[]>('/admin/template-files'),
      get: (filePath: string) => request<{ path: string; content: string }>(`/admin/template-files/${filePath}`),
      update: (filePath: string, content: string) => request<{ saved: boolean }>(`/admin/template-files/${filePath}`, { method: 'PUT', body: JSON.stringify({ content }) }),
      reset: (filePath: string) => request<{ path: string; content: string }>(`/admin/template-files/reset/${filePath}`, { method: 'POST' }),
    },
    designTemplateFiles: {
      list: (designId: number) => request<{ path: string; size: number }[]>(`/admin/designs/${designId}/template-files`),
      get: (designId: number, filePath: string) => request<{ path: string; content: string }>(`/admin/designs/${designId}/template-files/${filePath}`),
      update: (designId: number, filePath: string, content: string) => request<{ saved: boolean }>(`/admin/designs/${designId}/template-files/${filePath}`, { method: 'PUT', body: JSON.stringify({ content }) }),
      reset: (designId: number, filePath: string) => request<{ path: string; content: string }>(`/admin/designs/${designId}/template-files/reset/${filePath}`, { method: 'POST' }),
    },
  },
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}
