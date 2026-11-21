import { useState, useEffect } from 'react'
import {
  getUsers, createUser, updateUser, deleteUser, getSettings, updateSettings,
  getCourses, createCourse, getPasswordRequests, resolvePasswordRequest
} from '../api.js'

function Section({ title, children }) {
  return (
    <div className="card flex flex-col gap-4">
      <h2 className="font-bold text-base" style={{ color: 'var(--text)' }}>{title}</h2>
      {children}
    </div>
  )
}

export default function Admin() {
  // Settings
  const [settings, setSettings] = useState(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState('')

  // Users
  const [users, setUsers] = useState([])
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'faculty' })
  const [addingUser, setAddingUser] = useState(false)
  const [userMsg, setUserMsg] = useState('')

  // Courses
  const [courses, setCourses] = useState([])
  const [courseForm, setCourseForm] = useState({ course_name: '', course_code: '', semester: '', faculty_id: '' })
  const [addingCourse, setAddingCourse] = useState(false)
  const [courseMsg, setCourseMsg] = useState('')

  const [err, setErr] = useState('')
  const [resetRequests, setResetRequests] = useState([])
  const [editingUser, setEditingUser] = useState(null)

  useEffect(() => {
    Promise.all([getSettings(), getUsers(), getCourses()])
      .then(async ([s, u, c]) => {
        setSettings(s); setUsers(u); setCourses(c)
        try { setResetRequests(await getPasswordRequests()) } catch { setResetRequests([]) }
      })
      .catch(ex => setErr(ex.message))
  }, [])

  const saveSettings = async e => {
    e.preventDefault(); setSavingSettings(true); setSettingsMsg(''); setErr('')
    try {
      await updateSettings(settings)
      setSettingsMsg('Thresholds updated!')
    } catch (ex) { setErr(ex.message) }
    finally { setSavingSettings(false) }
  }

  const addUser = async e => {
    e.preventDefault(); setAddingUser(true); setUserMsg(''); setErr('')
    try {
      await createUser(userForm)
      const updated = await getUsers(); setUsers(updated)
      setUserForm({ name: '', email: '', password: '', role: 'faculty' })
      setUserMsg('User created!')
    } catch (ex) { setErr(ex.message) }
    finally { setAddingUser(false) }
  }

  const addCourse = async e => {
    e.preventDefault(); setAddingCourse(true); setCourseMsg(''); setErr('')
    try {
      await createCourse({ ...courseForm, faculty_id: parseInt(courseForm.faculty_id) })
      const updated = await getCourses(); setCourses(updated)
      setCourseForm({ course_name: '', course_code: '', semester: '', faculty_id: '' })
      setCourseMsg('Course created!')
    } catch (ex) { setErr(ex.message) }
    finally { setAddingCourse(false) }
  }

  const facultyUsers = users.filter(u => u.role === 'faculty' || u.role === 'admin')

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Admin Panel</h1>
      {err && <div className="card" style={{ color: 'var(--red)', background: 'var(--red-light)' }}>{err}</div>}

      {/* Thresholds */}
      {settings && (
        <Section title="⚙️ Thresholds">
          <form onSubmit={saveSettings} className="grid sm:grid-cols-2 gap-4">
            {[
              { key: 'attendance_critical', label: 'Critical Attendance %', help: 'Default 75' },
              { key: 'attendance_advisory', label: 'Advisory Attendance %', help: 'Default 85' },
              { key: 'cie_low',             label: 'Low CIE %',             help: 'Default 40' },
              { key: 'cie_drop',            label: 'Sudden Drop (pts)',      help: 'Default 20' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1"
                       style={{ color: 'var(--text3)' }}>{f.label}</label>
                <input
                  type="number"
                  className="inp"
                  value={settings[f.key] ?? ''}
                  onChange={e => setSettings(s => ({ ...s, [f.key]: parseFloat(e.target.value) }))}
                />
                <span className="text-xs" style={{ color: 'var(--text3)' }}>{f.help}</span>
              </div>
            ))}
            <div className="sm:col-span-2 flex items-center gap-3">
              <button type="submit" disabled={savingSettings} className="btn">
                {savingSettings ? <span className="spinner" /> : 'Save Thresholds'}
              </button>
              {settingsMsg && <span className="text-sm" style={{ color: 'var(--accent)' }}>{settingsMsg}</span>}
            </div>
          </form>
        </Section>
      )}

      {/* Create User */}
      <Section title="👤 Create User">
        <form onSubmit={addUser} className="grid sm:grid-cols-2 gap-3">
          <input className="inp" placeholder="Full name" value={userForm.name}
                 onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} required />
          <input className="inp" type="email" placeholder="Email" value={userForm.email}
                 onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} required />
          <input className="inp" type="password" placeholder="Password" value={userForm.password}
                 onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} required />
          <select className="inp" value={userForm.role}
                  onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}>
            <option value="faculty">Faculty</option>
            <option value="admin">Admin / HOD</option>
            <option value="student">Student</option>
          </select>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button type="submit" disabled={addingUser} className="btn">
              {addingUser ? <span className="spinner" /> : '+ Create User'}
            </button>
            {userMsg && <span className="text-sm" style={{ color: 'var(--accent)' }}>{userMsg}</span>}
          </div>
        </form>

        <div className="tbl-wrap mt-2">
          <table className="tbl">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id}>
                  <td className="font-medium">{u.name}</td>
                  <td style={{ color: 'var(--text2)' }}>{u.email}</td>
                  <td><span className="badge" style={{
                    background: u.role === 'admin' ? '#d8f3dc' : u.role === 'student' ? '#fef9c3' : '#e0f2fe',
                    color: u.role === 'admin' ? '#1b4332' : u.role === 'student' ? '#713f12' : '#0c4a6e',
                  }}>{u.role}</span></td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button type="button" className="btn-ghost btn-sm" onClick={() => setEditingUser({ ...u, password: '' })}>Edit</button>
                      <button type="button" className="btn-ghost btn-sm text-red-700" onClick={async () => {
                        if (!window.confirm(`Delete ${u.name}?`)) return
                        try {
                          await deleteUser(u.user_id)
                          setUsers(await getUsers())
                        } catch (ex) { setErr(ex.message) }
                      }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Create Course */}
      <Section title="📚 Create Course">
        <form onSubmit={addCourse} className="grid sm:grid-cols-2 gap-3">
          <input className="inp" placeholder="Course name" value={courseForm.course_name}
                 onChange={e => setCourseForm(f => ({ ...f, course_name: e.target.value }))} required />
          <input className="inp" placeholder="Course code (unique)" value={courseForm.course_code}
                 onChange={e => setCourseForm(f => ({ ...f, course_code: e.target.value }))} required />
          <input className="inp" placeholder="Semester" value={courseForm.semester}
                 onChange={e => setCourseForm(f => ({ ...f, semester: e.target.value }))} required />
          <select className="inp" value={courseForm.faculty_id}
                  onChange={e => setCourseForm(f => ({ ...f, faculty_id: e.target.value }))} required>
            <option value="">Assign Faculty</option>
            {facultyUsers.map(u => <option key={u.user_id} value={u.user_id}>{u.name} ({u.role})</option>)}
          </select>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button type="submit" disabled={addingCourse} className="btn">
              {addingCourse ? <span className="spinner" /> : '+ Create Course'}
            </button>
            {courseMsg && <span className="text-sm" style={{ color: 'var(--accent)' }}>{courseMsg}</span>}
          </div>
        </form>

        <div className="tbl-wrap mt-2">
          <table className="tbl">
            <thead><tr><th>Course</th><th>Code</th><th>Semester</th></tr></thead>
            <tbody>
              {courses.map(c => (
                <tr key={c.course_id}>
                  <td className="font-medium">{c.course_name}</td>
                  <td>{c.course_code}</td>
                  <td>{c.semester}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="🔐 Password Help Requests">
        {resetRequests.length === 0 ? (
          <div className="text-sm" style={{ color: 'var(--text3)' }}>No password help requests.</div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Email</th><th>Reason</th><th>Status</th><th className="text-right">Action</th></tr></thead>
              <tbody>
                {resetRequests.map(r => (
                  <tr key={r.request_id}>
                    <td>{r.email}</td>
                    <td>{r.reason || 'Not specified'}</td>
                    <td><span className="badge badge-advisory">{r.status}</span></td>
                    <td className="text-right">
                      {r.status === 'Pending' && (
                        <button type="button" className="btn btn-sm" onClick={async () => {
                          const password = window.prompt(`Set a temporary password for ${r.email}`)
                          if (!password) return
                          try {
                            await resolvePasswordRequest(r.request_id, { new_password: password })
                            setResetRequests(await getPasswordRequests())
                          } catch (ex) { setErr(ex.message) }
                        }}>Resolve</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {editingUser && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setEditingUser(null)}>
          <form className="modal-box flex flex-col gap-3"
            onSubmit={async e => {
              e.preventDefault()
              try {
                const body = { name: editingUser.name, email: editingUser.email, role: editingUser.role }
                if (editingUser.password) body.password = editingUser.password
                await updateUser(editingUser.user_id, body)
                setUsers(await getUsers())
                setEditingUser(null)
              } catch (ex) { setErr(ex.message); setEditingUser(null) }
            }}>
            <h2 className="font-bold text-lg text-text">Edit account</h2>
            <input className="inp" value={editingUser.name} onChange={e => setEditingUser(v => ({ ...v, name: e.target.value }))} />
            <input className="inp" type="email" value={editingUser.email} onChange={e => setEditingUser(v => ({ ...v, email: e.target.value }))} />
            <select className="inp" value={editingUser.role} onChange={e => setEditingUser(v => ({ ...v, role: e.target.value }))}>
              <option value="faculty">Faculty</option><option value="admin">Admin / HOD</option><option value="student">Student</option>
            </select>
            <input className="inp" type="password" value={editingUser.password} onChange={e => setEditingUser(v => ({ ...v, password: e.target.value }))} placeholder="New password (optional)" />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setEditingUser(null)}>Cancel</button>
              <button type="submit" className="btn">Save account</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
