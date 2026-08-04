import { useRef, useState, useEffect } from 'react'
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import { Sun, Moon, LogOut, ChevronDown, User } from 'lucide-react'
import { useAuth } from '../auth'

interface TopNavProps {
  projectName?: string
  projectId?: number
}

const RED_TEAM_ROUTES = ['/domains', '/servers', '/observations', '/assets', '/oplogs']
const ADMIN_ROUTES    = ['/admin', '/archived']

export default function TopNav({ projectName, projectId }: TopNavProps) {
  const { user, isAdmin, logout } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  // ── Theme ──────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('folio-theme') as 'light' | 'dark') || 'light'
  })

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('folio-theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  // ── Dropdown state ──────────────────────────────────────────────────────
  const [redTeamOpen, setRedTeamOpen] = useState(false)
  const [adminOpen,   setAdminOpen]   = useState(false)

  const redTeamRef = useRef<HTMLDivElement>(null)
  const adminRef   = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (redTeamRef.current && !redTeamRef.current.contains(e.target as Node)) {
        setRedTeamOpen(false)
      }
      if (adminRef.current && !adminRef.current.contains(e.target as Node)) {
        setAdminOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Active-route detection for dropdown toggles ─────────────────────────
  const isRedTeamActive = RED_TEAM_ROUTES.some(r => location.pathname.startsWith(r))
  const isAdminActive   = ADMIN_ROUTES.some(r => location.pathname.startsWith(r))

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const closeRedTeam = () => setRedTeamOpen(false)
  const closeAdmin   = () => setAdminOpen(false)

  return (
    <nav className="topnav">

      {/* Logo */}
      <Link to="/" className="topnav-logo-link">
        <img src="/logo/folio-lockup.svg" alt="Folio" className="topnav-logo" />
      </Link>

      {/* Engagement breadcrumb pill */}
      {projectName && projectId != null && (
        <Link
          to={`/engagements/${projectId}`}
          className="topnav-breadcrumb"
          title={projectName}
        >
          {projectName}
        </Link>
      )}

      {/* Primary nav links */}
      <div className="topnav-links">
        <NavLink
          to="/engagements"
          className={({ isActive }) => `topnav-link${isActive ? ' active' : ''}`}
        >
          Engagements
        </NavLink>

        <NavLink
          to="/templates"
          className={({ isActive }) => `topnav-link${isActive ? ' active' : ''}`}
        >
          Templates
        </NavLink>

        <NavLink
          to="/clients"
          className={({ isActive }) => `topnav-link${isActive ? ' active' : ''}`}
        >
          Clients
        </NavLink>

        {/* Red Team dropdown */}
        <div className="topnav-dropdown" ref={redTeamRef}>
          <button
            className={`topnav-dropdown-toggle${redTeamOpen || isRedTeamActive ? ' active' : ''}`}
            onClick={() => setRedTeamOpen(v => !v)}
            type="button"
          >
            Red Team
            <ChevronDown
              size={12}
              style={{ transition: 'transform 0.15s', transform: redTeamOpen ? 'rotate(180deg)' : 'none' }}
            />
          </button>
          {redTeamOpen && (
            <div className="topnav-dropdown-menu">
              <NavLink to="/domains"      className="topnav-dropdown-item" onClick={closeRedTeam}>Domains</NavLink>
              <NavLink to="/servers"      className="topnav-dropdown-item" onClick={closeRedTeam}>Servers</NavLink>
              <NavLink to="/observations" className="topnav-dropdown-item" onClick={closeRedTeam}>Observations</NavLink>
              <NavLink to="/assets"       className="topnav-dropdown-item" onClick={closeRedTeam}>Active Assets</NavLink>
              <NavLink to="/oplogs"       className="topnav-dropdown-item" onClick={closeRedTeam}>Operation Logs</NavLink>
            </div>
          )}
        </div>

        <NavLink
          to="/wiki"
          className={({ isActive }) => `topnav-link${isActive ? ' active' : ''}`}
        >
          Wiki
        </NavLink>

        <NavLink
          to="/designs"
          className={({ isActive }) => `topnav-link${isActive ? ' active' : ''}`}
        >
          Report Designs
        </NavLink>

        <NavLink
          to="/import-export"
          className={({ isActive }) => `topnav-link${isActive ? ' active' : ''}`}
        >
          Settings
        </NavLink>
      </div>

      {/* Right side */}
      <div className="topnav-right">

        {/* Admin dropdown (admin role only) */}
        {isAdmin && (
          <>
            <div className="topnav-dropdown" ref={adminRef}>
              <button
                className={`topnav-dropdown-toggle${adminOpen || isAdminActive ? ' active' : ''}`}
                onClick={() => setAdminOpen(v => !v)}
                type="button"
              >
                Admin
                <ChevronDown
                  size={12}
                  style={{ transition: 'transform 0.15s', transform: adminOpen ? 'rotate(180deg)' : 'none' }}
                />
              </button>
              {adminOpen && (
                <div className="topnav-dropdown-menu" style={{ left: 'auto', right: 0 }}>
                  <NavLink to="/admin/users" className="topnav-dropdown-item" onClick={closeAdmin}>Users</NavLink>
                  <NavLink to="/archived"    className="topnav-dropdown-item" onClick={closeAdmin}>Archived Reports</NavLink>
                </div>
              )}
            </div>
            <div className="topnav-sep" />
          </>
        )}

        {/* Theme toggle */}
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          type="button"
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
        </button>

        {/* Username link to profile */}
        <NavLink
          to="/profile"
          className={({ isActive }) => `topnav-user${isActive ? ' active' : ''}`}
        >
          <User size={13} />
          <span>{user?.display_name || user?.username}</span>
        </NavLink>

        {/* Logout */}
        <button
          className="topnav-logout"
          onClick={handleLogout}
          type="button"
          title="Log out"
        >
          <LogOut size={14} />
        </button>
      </div>
    </nav>
  )
}
