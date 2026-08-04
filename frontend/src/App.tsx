import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import TopNav from './components/TopNav'
import Dashboard from './pages/Dashboard'
import ProjectDetail from './pages/ProjectDetail'
import FindingsLibrary from './pages/FindingsLibrary'
import Clients from './pages/Clients'
import Domains from './pages/Domains'
import ReportDesigns from './pages/ReportDesigns'
import AdminUsers from './pages/AdminUsers'
import Servers from './pages/Servers'
import Observations from './pages/Observations'
import ActiveAssets from './pages/ActiveAssets'
import OperationLogs from './pages/OperationLogs'
import ImportExport from './pages/ImportExport'
import UserProfile from './pages/UserProfile'
import ArchivedReports from './pages/ArchivedReports'
import Wiki from './pages/Wiki'
import Login from './pages/Login'
import { AuthProvider, useAuth } from './auth'
import { api } from './api'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-bg)' }}>
      <div className="spinner" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppShell({ children, projectName, projectId }: { children: React.ReactNode; projectName?: string; projectId?: number }) {
  return (
    <div className="shell">
      <TopNav projectName={projectName} projectId={projectId} />
      <main className="shell-main">{children}</main>
    </div>
  )
}

function EngagementWrapper() {
  const { id } = useParams<{ id: string }>()
  const [name, setName] = useState('')
  useEffect(() => {
    if (id) api.projects.get(Number(id)).then(p => setName(p.client_name || p.name)).catch(() => {})
  }, [id])
  return (
    <AppShell projectName={name} projectId={id ? Number(id) : undefined}>
      <ProjectDetail />
    </AppShell>
  )
}

function AppRoutes() {
  const { user } = useAuth()

  // One-time migration: move any templates saved in localStorage to the backend DB.
  useEffect(() => {
    if (!user) return
    const raw = localStorage.getItem('sl_templates')
    if (!raw) return
    ;(async () => {
      try {
        const lsItems: Array<{ title?: string; severity?: string; category?: string; description?: string; recommendations?: string; tags?: string[] }> = JSON.parse(raw)
        if (!Array.isArray(lsItems) || lsItems.length === 0) return
        const dbTemplates = await api.templates.list()
        const dbTitles = new Set(dbTemplates.map((t: { title: string }) => t.title.toLowerCase().trim()))
        const toMigrate = lsItems.filter(t => t.title && !dbTitles.has(t.title.toLowerCase().trim()))
        if (toMigrate.length > 0) {
          await api.templates.bulkCreate(toMigrate.map(t => ({
            title: t.title!,
            severity: t.severity || 'medium',
            category: t.category || '',
            description: t.description || '',
            impact: '',
            recommendations: t.recommendations || '',
            tags: t.tags || [],
          })))
        }
      } catch { /* best-effort — never block the app */ }
      finally { localStorage.removeItem('sl_templates') }
    })()
  }, [user])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/"              element={<ProtectedRoute><AppShell><Dashboard /></AppShell></ProtectedRoute>} />
      <Route path="/engagements"   element={<ProtectedRoute><AppShell><Dashboard /></AppShell></ProtectedRoute>} />
      <Route path="/engagements/:id" element={<ProtectedRoute><EngagementWrapper /></ProtectedRoute>} />
      <Route path="/templates"     element={<ProtectedRoute><AppShell><FindingsLibrary /></AppShell></ProtectedRoute>} />
      <Route path="/clients"       element={<ProtectedRoute><AppShell><Clients /></AppShell></ProtectedRoute>} />
      <Route path="/domains"       element={<ProtectedRoute><AppShell><Domains /></AppShell></ProtectedRoute>} />
      <Route path="/designs"       element={<ProtectedRoute><AppShell><ReportDesigns /></AppShell></ProtectedRoute>} />
      <Route path="/admin/users"   element={<ProtectedRoute><AppShell><AdminUsers /></AppShell></ProtectedRoute>} />
      <Route path="/settings"      element={<ProtectedRoute><AppShell><Dashboard /></AppShell></ProtectedRoute>} />
      <Route path="/servers"       element={<ProtectedRoute><AppShell><Servers /></AppShell></ProtectedRoute>} />
      <Route path="/observations"  element={<ProtectedRoute><AppShell><Observations /></AppShell></ProtectedRoute>} />
      <Route path="/assets"        element={<ProtectedRoute><AppShell><ActiveAssets /></AppShell></ProtectedRoute>} />
      <Route path="/oplogs"        element={<ProtectedRoute><AppShell><OperationLogs /></AppShell></ProtectedRoute>} />
      <Route path="/import-export" element={<ProtectedRoute><AppShell><ImportExport /></AppShell></ProtectedRoute>} />
      <Route path="/profile"       element={<ProtectedRoute><AppShell><UserProfile /></AppShell></ProtectedRoute>} />
      <Route path="/gophish"       element={<ProtectedRoute><AppShell><Dashboard /></AppShell></ProtectedRoute>} />
      <Route path="/archived"      element={<ProtectedRoute><AppShell><ArchivedReports /></AppShell></ProtectedRoute>} />
      <Route path="/wiki"          element={<ProtectedRoute><AppShell><Wiki /></AppShell></ProtectedRoute>} />
    </Routes>
  )
}

export default function App() {
  // Initialise theme from localStorage before first paint
  useEffect(() => {
    const saved = localStorage.getItem('folio-theme') as 'light' | 'dark' | null
    document.documentElement.setAttribute('data-theme', saved || 'light')
  }, [])

  return <AuthProvider><AppRoutes /></AuthProvider>
}
