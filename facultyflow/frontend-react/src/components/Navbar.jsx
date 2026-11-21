import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getUser, clearToken, updateProfile } from '../api.js'
import { useCourse } from '../context/CourseContext.jsx'

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = getUser()
  const { courses, activeCourseId, setActiveCourseId } = useCourse()
  const [theme, setTheme] = useState(() => localStorage.getItem('ff_theme') || 'light')
  const [profileOpen, setProfileOpen] = useState(false)
  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '', password: '' })
  const [profileMsg, setProfileMsg] = useState('')
  const [profileErr, setProfileErr] = useState('')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('ff_theme', theme)
  }, [theme])

  if (!user) return null

  const tabs = [
    { key: 'dashboard', label: 'Dashboard', path: '/dashboard' },
    { key: 'students', label: 'Students', path: '/students' },
    { key: 'attendance', label: 'Attendance', path: '/attendance' },
    { key: 'marks', label: 'Marks', path: '/marks' },
    { key: 'deficits', label: 'Needs Attention', path: '/deficits' },
    { key: 'reports', label: 'Reports', path: '/reports' },
  ]

  if (user.role === 'admin') {
    tabs.push({ key: 'admin', label: 'Admin', path: '/admin' })
  }

  const handleSignOut = () => {
    clearToken()
    navigate('/')
  }

  const roleColors = {
    admin:   { bg: '#d8f3dc', text: '#1b4332', border: '#b7e4c7' },
    faculty: { bg: '#e0f2fe', text: '#0c4a6e', border: '#bae6fd' },
    student: { bg: '#fef9c3', text: '#713f12', border: '#fef08a' },
  }
  const rc = roleColors[user.role] || roleColors.faculty

  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-border shadow-sm">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 cursor-pointer font-extrabold text-base tracking-tight text-accent transition-transform hover:scale-102"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent text-white shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
            <span>FacultyFlow</span>
          </div>

          {/* Persistent Course Selector Dropdown like before */}
          {courses.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-border-2">|</span>
              <select
                id="header-course-select"
                className="inp py-1 px-2.5 text-xs font-semibold rounded-md border-border bg-surface-2 text-text transition-all focus:border-accent"
                value={activeCourseId || ''}
                onChange={e => setActiveCourseId(e.target.value)}
              >
                {courses.map(c => (
                  <option key={c.course_id} value={c.course_id}>
                    {c.course_code} · {c.course_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Right side user badge & signout */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn-ghost btn-sm w-9 h-9 !px-0 justify-center"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            onClick={() => setTheme(v => v === 'light' ? 'dark' : 'light')}
          >
            {theme === 'light' ? '☾' : '☀'}
          </button>
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full border bg-surface-2"
            style={{ borderColor: rc.border }}
            title="Edit profile"
          >
            <span className="text-xs font-semibold text-text">{user.name}</span>
            <span className="badge text-[0.65rem] uppercase" style={{ background: rc.bg, color: rc.text, border: 'none' }}>
              {user.role}
            </span>
          </button>

          <button
            onClick={handleSignOut}
            className="btn-ghost btn-sm text-xs py-1 px-2.5 rounded-md"
            title="Sign out"
          >
            Log out
          </button>
        </div>
      </div>

      {/* Tabs Row like before */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 flex overflow-x-auto border-t border-border no-scrollbar">
        {tabs.map(t => {
          const isActive = location.pathname.startsWith(t.path)
          return (
            <button
              key={t.key}
              onClick={() => navigate(t.path)}
              className={`tab ${isActive ? 'on' : ''}`}
            >
              {t.label}
            </button>
          )
        })}
      </nav>
      {profileOpen && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setProfileOpen(false)}>
          <form
            className="modal-box flex flex-col gap-3"
            onSubmit={async e => {
              e.preventDefault()
              setProfileErr('')
              setProfileMsg('')
              try {
                const body = { name: profile.name, email: profile.email }
                if (profile.password) body.password = profile.password
                const updated = await updateProfile(body)
                sessionStorage.setItem('ff_user', JSON.stringify(updated))
                setProfileMsg('Profile updated.')
                setProfile(v => ({ ...v, password: '' }))
              } catch (ex) {
                setProfileErr(ex.message)
              }
            }}
          >
            <h2 className="font-bold text-lg text-text">Edit profile</h2>
            {profileErr && <div className="text-sm text-red-700">{profileErr}</div>}
            {profileMsg && <div className="text-sm text-accent">{profileMsg}</div>}
            <input className="inp" value={profile.name} onChange={e => setProfile(v => ({ ...v, name: e.target.value }))} placeholder="Full name" />
            <input className="inp" type="email" value={profile.email} onChange={e => setProfile(v => ({ ...v, email: e.target.value }))} placeholder="Email" />
            <input className="inp" type="password" value={profile.password} onChange={e => setProfile(v => ({ ...v, password: e.target.value }))} placeholder="New password (optional)" />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setProfileOpen(false)}>Close</button>
              <button type="submit" className="btn">Save changes</button>
            </div>
          </form>
        </div>
      )}
    </header>
  )
}
