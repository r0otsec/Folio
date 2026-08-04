import { useState, useEffect } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import {
  Home, ClipboardList, Zap, FileText, HardDrive, ShieldCheck,
  Users, LogOut, Plus, ChevronDown, BookOpen, Building2,
  Globe, Crosshair, Palette, Archive, Database, Clipboard,
  Activity, Server, Settings2, PanelLeftClose, PanelLeftOpen, Search,
  ArrowDownUp,
  HelpCircle,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useAuth } from '../auth'
import { api } from '../api'
import type { ProjectSummary } from '../types'

interface SidebarProps {
  projectName?: string
  projectId?: number
}

function NavAccordion({
  icon, label, defaultOpen = false, children,
}: {
  icon: ReactNode
  label: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <>
      <button
        className={`nav-expand${open ? ' open' : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        {icon}
        <span className="nav-expand-label">{label}</span>
        <ChevronDown size={11} className="nav-expand-arrow" />
      </button>
      <div className={`nav-sub${open ? ' open' : ''}`}>
        <div className="nav-sub-inner">
          {children}
        </div>
      </div>
    </>
  )
}

export default function Sidebar({ projectName, projectId }: SidebarProps) {
  const { isAdmin, logout, user } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [projSearch, setProjSearch] = useState('')
  const [reportSearch, setReportSearch] = useState('')

  useEffect(() => {
    api.projects.list().then(setProjects).catch(() => {})
  }, [])

  const activeProjects = projects.filter(p => p.status === 'active')
  const filteredActiveProjects = activeProjects.filter(p =>
    !reportSearch || (p.client_name || p.name).toLowerCase().includes(reportSearch.toLowerCase())
  )
  const filteredAllProjects = projects.filter(p =>
    !projSearch || (p.client_name || p.name).toLowerCase().includes(projSearch.toLowerCase())
  )

  const handleLogout = () => { logout(); navigate('/login') }
  const handleNew = () => navigate('/?new=1')

  return (
    <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>

      {/* ── Header ── */}
      <div className="sidebar-header">
        {!collapsed && (
          <Link to="/" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <img src="/logo/folio-lockup.svg" alt="Folio" className="sidebar-logo" style={{ cursor: 'pointer' }} />
          </Link>
        )}
        <button
          className="sidebar-collapse"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed(v => !v)}
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>

      {/* ── Collapsed: icon-only rail ── */}
      {collapsed && (
        <div className="sidebar-collapsed-nav">
          <button className="sidebar-icon-btn sidebar-icon-btn-cta" onClick={handleNew} title="New Engagement">
            <Plus size={15} />
          </button>
          <div className="sidebar-icon-divider" />
          <NavLink to="/" end className={({ isActive }) => `sidebar-icon-btn${isActive ? ' active' : ''}`} title="Dashboard">
            <Home size={15} />
          </NavLink>
          <NavLink to="/engagements" className={({ isActive }) => `sidebar-icon-btn${isActive ? ' active' : ''}`} title="Projects">
            <BookOpen size={15} />
          </NavLink>
          <NavLink to="/clients" className={({ isActive }) => `sidebar-icon-btn${isActive ? ' active' : ''}`} title="Clients">
            <Building2 size={15} />
          </NavLink>
          <NavLink to="/observations" className={({ isActive }) => `sidebar-icon-btn${isActive ? ' active' : ''}`} title="Observations">
            <Clipboard size={15} />
          </NavLink>
          <NavLink to="/assets" className={({ isActive }) => `sidebar-icon-btn${isActive ? ' active' : ''}`} title="Active Assets">
            <Database size={15} />
          </NavLink>
          <NavLink to="/servers" className={({ isActive }) => `sidebar-icon-btn${isActive ? ' active' : ''}`} title="Servers">
            <Server size={15} />
          </NavLink>
          <NavLink to="/domains" className={({ isActive }) => `sidebar-icon-btn${isActive ? ' active' : ''}`} title="Domains">
            <Globe size={15} />
          </NavLink>
          <NavLink to="/templates" className={({ isActive }) => `sidebar-icon-btn${isActive ? ' active' : ''}`} title="Finding Templates">
            <Crosshair size={15} />
          </NavLink>
          <NavLink to="/designs" className={({ isActive }) => `sidebar-icon-btn${isActive ? ' active' : ''}`} title="Report Designs">
            <Palette size={15} />
          </NavLink>
          <NavLink to="/import-export" className={({ isActive }) => `sidebar-icon-btn${isActive ? ' active' : ''}`} title="Import & Export">
            <ArrowDownUp size={15} />
          </NavLink>
          <NavLink to="/wiki" className={({ isActive }) => `sidebar-icon-btn${isActive ? ' active' : ''}`} title="Wiki">
            <HelpCircle size={15} />
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin/users" className={({ isActive }) => `sidebar-icon-btn${isActive ? ' active' : ''}`} title="Users">
              <Users size={15} />
            </NavLink>
          )}
          <div style={{ flex: 1 }} />
          <button className="sidebar-icon-btn" onClick={handleLogout} title="Log out">
            <LogOut size={15} />
          </button>
        </div>
      )}

      {/* ── Expanded nav ── */}
      {!collapsed && (
        <>
          {projectId ? (
            <button className="sidebar-cta" onClick={() => navigate(`/engagements/${projectId}`)}>
              <FileText size={13} />
              Jump to Report
            </button>
          ) : (
            <button className="sidebar-cta" onClick={handleNew}>
              <Plus size={13} />
              New Engagement
            </button>
          )}

          <nav className="sidebar-nav">

            {/* ── PROJECT SHORTCUTS ── */}
            <div className="nav-section">
              <Home size={10} style={{ opacity: 0.5, flexShrink: 0 }} />
              Project Shortcuts
            </div>

            {/* My Active Reports */}
            <NavAccordion icon={<FileText size={14} />} label="My Active Reports">
              <div style={{ padding: '6px 10px 4px', position: 'relative' }}>
                <Search size={10} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-3)', pointerEvents: 'none', marginTop: 3 }} />
                <input
                  className="nav-search-input"
                  placeholder="Search Reports…"
                  value={reportSearch}
                  onChange={e => setReportSearch(e.target.value)}
                  onClick={e => e.stopPropagation()}
                />
              </div>
              {filteredActiveProjects.length === 0
                ? <span className="nav-sub-empty">{reportSearch ? 'No match' : 'No active reports'}</span>
                : filteredActiveProjects.map(p => (
                  <NavLink
                    key={p.id}
                    to={`/engagements/${p.id}`}
                    className={({ isActive }) => `nav-sub-link${isActive ? ' active' : ''}`}
                  >
                    {p.client_name || p.name}
                  </NavLink>
                ))
              }
            </NavAccordion>

            {/* My Active Projects */}
            <NavAccordion icon={<BookOpen size={14} />} label="My Active Projects">
              <div style={{ padding: '6px 10px 4px', position: 'relative' }}>
                <Search size={10} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-3)', pointerEvents: 'none', marginTop: 3 }} />
                <input
                  className="nav-search-input"
                  placeholder="Search Projects…"
                  value={projSearch}
                  onChange={e => setProjSearch(e.target.value)}
                  onClick={e => e.stopPropagation()}
                />
              </div>
              <NavLink to="/engagements" className={({ isActive }) => `nav-sub-link${isActive ? ' active' : ''}`}>
                <BookOpen size={10} /> Project Library
              </NavLink>
              <button className="nav-sub-btn" onClick={handleNew}><Plus size={11} /> New Project</button>
              {filteredAllProjects.slice(0, 6).map(p => (
                <NavLink
                  key={p.id}
                  to={`/engagements/${p.id}`}
                  className={({ isActive }) => `nav-sub-link${isActive ? ' active' : ''}`}
                >
                  {p.client_name || p.name}
                </NavLink>
              ))}
            </NavAccordion>

            {/* ── PRE-ENGAGEMENT ── */}
            <div className="nav-section">
              <ClipboardList size={10} style={{ opacity: 0.5, flexShrink: 0 }} />
              Pre-engagement
            </div>

            <NavAccordion icon={<Building2 size={14} />} label="Clients">
              <div style={{ padding: '6px 10px 4px', position: 'relative' }}>
                <Search size={10} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-3)', pointerEvents: 'none', marginTop: 3 }} />
                <input
                  className="nav-search-input"
                  placeholder="Search Clients…"
                  onClick={e => e.stopPropagation()}
                  onChange={() => {}}
                />
              </div>
              <NavLink to="/clients" className={({ isActive }) => `nav-sub-link${isActive ? ' active' : ''}`}>
                <BookOpen size={10} /> Client Library
              </NavLink>
              <button className="nav-sub-btn" onClick={() => navigate('/clients?new=1')}><Plus size={11} /> New Client</button>
            </NavAccordion>

            <NavAccordion icon={<Crosshair size={14} />} label="Findings">
              <div style={{ padding: '6px 10px 4px', position: 'relative' }}>
                <Search size={10} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-3)', pointerEvents: 'none', marginTop: 3 }} />
                <input
                  className="nav-search-input"
                  placeholder="Search Findings…"
                  onClick={e => e.stopPropagation()}
                  onChange={() => {}}
                />
              </div>
              <NavLink to="/templates" className={({ isActive }) => `nav-sub-link${isActive ? ' active' : ''}`}>
                <BookOpen size={10} /> Finding Library
              </NavLink>
              <button className="nav-sub-btn" onClick={() => navigate('/templates?new=1')}><Plus size={11} /> Add New Finding</button>
            </NavAccordion>

            <NavAccordion icon={<Clipboard size={14} />} label="Observations">
              <div style={{ padding: '6px 10px 4px', position: 'relative' }}>
                <Search size={10} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-3)', pointerEvents: 'none', marginTop: 3 }} />
                <input
                  className="nav-search-input"
                  placeholder="Search Observations…"
                  onClick={e => e.stopPropagation()}
                  onChange={() => {}}
                />
              </div>
              <NavLink to="/observations" className={({ isActive }) => `nav-sub-link${isActive ? ' active' : ''}`}>
                <BookOpen size={10} /> Observation Library
              </NavLink>
              <button className="nav-sub-btn" onClick={() => navigate('/observations?new=1')}><Plus size={11} /> New Observation</button>
            </NavAccordion>

            {/* ── EXECUTION ── */}
            <div className="nav-section">
              <Zap size={10} style={{ opacity: 0.5, flexShrink: 0 }} />
              Execution
            </div>

            <NavAccordion icon={<Activity size={14} />} label="Projects">
              <div style={{ padding: '6px 10px 4px', position: 'relative' }}>
                <Search size={10} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-3)', pointerEvents: 'none', marginTop: 3 }} />
                <input
                  className="nav-search-input"
                  placeholder="Search Projects…"
                  onClick={e => e.stopPropagation()}
                  onChange={() => {}}
                />
              </div>
              <NavLink to="/engagements" className={({ isActive }) => `nav-sub-link${isActive ? ' active' : ''}`}>
                <BookOpen size={10} /> All Engagements
              </NavLink>
              <button className="nav-sub-btn" onClick={handleNew}><Plus size={11} /> New Engagement</button>
            </NavAccordion>

            <NavAccordion icon={<FileText size={14} />} label="Operation Logs">
              <NavLink to="/oplogs" className={({ isActive }) => `nav-sub-link${isActive ? ' active' : ''}`}>
                <BookOpen size={10} /> All Operation Logs
              </NavLink>
              <button className="nav-sub-btn" onClick={() => navigate('/oplogs?new=1')}><Plus size={11} /> Create New Log</button>
            </NavAccordion>

            {/* ── REPORTING ── */}
            <div className="nav-section">
              <FileText size={10} style={{ opacity: 0.5, flexShrink: 0 }} />
              Reporting
            </div>

            <NavAccordion icon={<BookOpen size={14} />} label="Reports">
              <div style={{ padding: '6px 10px 4px', position: 'relative' }}>
                <Search size={10} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-3)', pointerEvents: 'none', marginTop: 3 }} />
                <input
                  className="nav-search-input"
                  placeholder="Search Reports…"
                  onClick={e => e.stopPropagation()}
                  onChange={() => {}}
                />
              </div>
              <NavLink to="/engagements" className={({ isActive }) => `nav-sub-link${isActive ? ' active' : ''}`}>
                <BookOpen size={10} /> All Reports
              </NavLink>
              <button className="nav-sub-btn" onClick={handleNew}><Plus size={11} /> New Report</button>
            </NavAccordion>

            <NavAccordion icon={<Palette size={14} />} label="Templates">
              <NavLink to="/designs" className={({ isActive }) => `nav-sub-link${isActive ? ' active' : ''}`}>
                <Palette size={10} /> Report Template Library
              </NavLink>
              <button className="nav-sub-btn" onClick={() => navigate('/designs?new=1')}><Plus size={11} /> Add New Report Template</button>
            </NavAccordion>

            <NavLink to="/archived" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Archive size={14} />
              Archived Reports
            </NavLink>

            {/* ── RED TEAM ── */}
            <div className="nav-section">
              <HardDrive size={10} style={{ opacity: 0.5, flexShrink: 0 }} />
              Red Team
            </div>

            <NavLink to="/assets" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Database size={14} />
              Active Assets
            </NavLink>

            <NavAccordion icon={<Server size={14} />} label="Servers">
              <div style={{ padding: '6px 10px 4px', position: 'relative' }}>
                <Search size={10} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-3)', pointerEvents: 'none', marginTop: 3 }} />
                <input className="nav-search-input" placeholder="Search Servers…" onClick={e => e.stopPropagation()} onChange={() => {}} />
              </div>
              <NavLink to="/servers" className={({ isActive }) => `nav-sub-link${isActive ? ' active' : ''}`}>
                <BookOpen size={10} /> Server Library
              </NavLink>
              <button className="nav-sub-btn" onClick={() => navigate('/servers?new=1')}><Plus size={11} /> Add New Server</button>
            </NavAccordion>

            <NavAccordion icon={<Globe size={14} />} label="Domains">
              <div style={{ padding: '6px 10px 4px', position: 'relative' }}>
                <Search size={10} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-3)', pointerEvents: 'none', marginTop: 3 }} />
                <input className="nav-search-input" placeholder="Search Domains…" onClick={e => e.stopPropagation()} onChange={() => {}} />
              </div>
              <NavLink to="/domains" className={({ isActive }) => `nav-sub-link${isActive ? ' active' : ''}`}>
                <BookOpen size={10} /> Domain Library
              </NavLink>
              <button className="nav-sub-btn" onClick={() => navigate('/domains?new=1')}><Plus size={11} /> Add New Domain</button>
            </NavAccordion>

            <NavAccordion icon={<Crosshair size={14} />} label="GoPhish">
              <span className="nav-sub-empty" style={{ fontStyle: 'normal', color: 'var(--c-text-3)', fontSize: 11 }}>
                Connect a GoPhish instance to view campaign data here.
              </span>
              <NavLink to="/gophish" className={({ isActive }) => `nav-sub-link${isActive ? ' active' : ''}`}>
                <Settings2 size={10} /> Configure Integration
              </NavLink>
            </NavAccordion>

            {/* ── ADMINISTRATION ── */}
            <div className="nav-section">
              <ShieldCheck size={10} style={{ opacity: 0.5, flexShrink: 0 }} />
              Administration
            </div>

            <NavLink to="/import-export" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <ArrowDownUp size={14} />
              Import &amp; Export
            </NavLink>

            <NavLink to="/wiki" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <HelpCircle size={14} />
              Wiki
            </NavLink>

            {isAdmin && (
              <>
                <NavAccordion icon={<Users size={14} />} label="User Management">
                  <NavLink to="/admin/users" className={({ isActive }) => `nav-sub-link${isActive ? ' active' : ''}`}>
                    <Users size={10} /> Manage Users
                  </NavLink>
                  <button className="nav-sub-btn" onClick={() => navigate('/admin/users?new=1')}><Plus size={11} /> Add New User</button>
                </NavAccordion>
              </>
            )}

            {projectId && projectName && (
              <>
                <div className="nav-section" style={{ marginTop: 8 }}>
                  <span className="nav-section-dot" style={{ background: 'var(--c-green)' }} />
                  Active Engagement
                </div>
                <div className="nav-engagement-card" onClick={() => navigate(`/engagements/${projectId}`)}>
                  <div className="nav-engagement-name">{projectName}</div>
                  <div className="nav-engagement-sub">Open engagement →</div>
                </div>
              </>
            )}
          </nav>

          <div className="sidebar-footer">
            <NavLink to="/profile" className={({ isActive }) => `sidebar-profile-btn${isActive ? ' active' : ''}`}>
              <div className="sidebar-profile-avatar">
                {(user?.display_name || user?.username || 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div className="sidebar-profile-info">
                <div className="sidebar-profile-name">{user?.display_name || user?.username}</div>
                <div className="sidebar-profile-role">{user?.role}</div>
              </div>
              <Settings2 size={12} style={{ color: 'var(--c-text-3)', marginLeft: 'auto' }} />
            </NavLink>
            <button className="sidebar-logout" onClick={handleLogout}>
              <LogOut size={13} />
              Log out
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
