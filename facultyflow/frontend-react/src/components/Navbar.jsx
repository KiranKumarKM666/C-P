import { useNavigate, useLocation, Link } from 'react-router-dom'
import { getUser, clearToken } from '../api.js'

const NAV_LINKS = [
  { label: 'Dashboard', href: '/dashboard', roles: ['faculty', 'admin'] },
  { label: 'Admin Panel', href: '/admin', roles: ['admin'] },
]

const ROLE_COLORS = {
  admin:   { bg: '#d8f3dc', text: '#1b4332' },
  faculty: { bg: '#e0f2fe', text: '#0c4a6e' },
  student: { bg: '#fef9c3', text: '#713f12' },
}

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = getUser()
  if (!user) return null

  const rc = ROLE_COLORS[user.role] || ROLE_COLORS.faculty

  const handleSignOut = () => {
    clearToken()
    navigate('/')
  }

  return (
    <nav style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-14 gap-6">
        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-2 font-bold text-base no-underline"
              style={{ color: 'var(--accent)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
            <path d="M6 12v5c3 3 9 3 12 0v-5"/>
          </svg>
          FacultyFlow
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1 ml-2">
          {NAV_LINKS.filter(l => l.roles.includes(user.role)).map(l => (
            <Link key={l.href} to={l.href}
                  className="text-sm font-medium px-3 py-1.5 rounded-md transition-all no-underline"
                  style={{
                    color: location.pathname === l.href ? 'var(--accent)' : 'var(--text2)',
                    background: location.pathname === l.href ? 'var(--accent-light)' : 'transparent',
                  }}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex-1" />

        {/* User pill */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{user.name}</span>
            <span className="text-xs" style={{ color: 'var(--text3)' }}>{user.email}</span>
          </div>
          <span className="badge text-[0.68rem]"
                style={{ background: rc.bg, color: rc.text, border: 'none' }}>
            {user.role}
          </span>
          <button onClick={handleSignOut}
                  className="btn-ghost btn-sm"
                  title="Sign out">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </nav>
  )
}
