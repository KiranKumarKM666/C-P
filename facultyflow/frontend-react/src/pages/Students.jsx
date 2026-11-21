import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getStudents, addStudent, updateStudent, removeStudent, uploadStudents, getTemplate } from '../api.js'
import { useCourse } from '../context/CourseContext.jsx'

export default function Students() {
  const { id } = useParams()
  const { activeCourseId, activeCourse } = useCourse()
  const courseId = id || activeCourseId

  const [students, setStudents] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ usn: '', name: '', email: '' })
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState(null)

  const loadData = async () => {
    if (!courseId) return
    setLoading(true)
    setErr('')
    try {
      const data = await getStudents(courseId)
      setStudents(data)
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [courseId])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.usn.trim() || !form.name.trim()) {
      setErr('USN and Name are required.')
      return
    }
    setSubmitting(true)
    setErr('')
    setMsg('')
    try {
      await addStudent(courseId, {
        usn: form.usn.trim(),
        name: form.name.trim(),
        email: form.email.trim() || undefined,
      })
      setForm({ usn: '', name: '', email: '' })
      setMsg(`✓ Student ${form.name} successfully enrolled!`)
      await loadData()
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async (sid, name) => {
    if (!window.confirm(`Are you sure you want to remove student "${name}" and all their academic records?`)) return
    try {
      await removeStudent(courseId, sid)
      setMsg(`Student "${name}" removed.`)
      await loadData()
    } catch (ex) {
      setErr(ex.message)
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setErr('')
    setMsg('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadStudents(courseId, fd)
      setMsg(`✓ Roster Upload: ${res.imported} imported, ${res.updated} updated${res.errors?.length ? ` (${res.errors.length} skipped)` : ''}`)
      await loadData()
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  if (!courseId) {
    return (
      <div className="card empty-state">
        <div className="text-3xl mb-2">📚</div>
        <div className="font-semibold text-text">No Course Selected</div>
        <p className="text-sm text-text-2 mt-1">Please select an assigned course from the top dropdown.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner w-8 h-8" />
      </div>
    )
  }

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.usn.toLowerCase().includes(search.toLowerCase()) ||
    (s.email && s.email.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-text">
            Enrolled Student Roster
          </h1>
          <p className="text-xs font-medium text-text-2 mt-0.5">
            {activeCourse ? `${activeCourse.course_code} · ${activeCourse.course_name}` : `Course #${courseId}`}
          </p>
        </div>

        <span className="badge badge-safe font-mono text-xs px-3 py-1">
          {students.length} Total Enrolled
        </span>
      </div>

      {err && <div className="card bg-red-50 border-red-200 text-red-700 text-sm font-medium py-2.5 px-4">{err}</div>}
      {msg && <div className="card bg-emerald-50 border-emerald-200 text-emerald-800 text-sm font-medium py-2.5 px-4">{msg}</div>}

      {/* 2-Column Split: Enrolled Roster VS Add Student / Bulk Upload */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main List */}
        <div className="lg:col-span-2 card flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap pb-2 border-b border-border">
            <h2 className="font-bold text-sm text-text">Class Roster ({filtered.length})</h2>
            <input
              type="text"
              placeholder="Search by name, USN, or email…"
              className="inp text-xs w-64"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state py-12">
              <div className="text-3xl mb-2">👥</div>
              <div className="font-semibold text-text">No students found</div>
              <p className="text-xs text-text-3 mt-1">Enroll students manually or upload a roster sheet.</p>
            </div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>USN</th>
                    <th>Full Name</th>
                    <th>Email Address</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.student_id}>
                      <td className="font-mono text-xs font-semibold text-text">{s.usn}</td>
                      <td className="font-medium text-text">{s.name}</td>
                      <td className="text-xs text-text-2">{s.email || '—'}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setEditing({ ...s })}
                            className="btn-ghost btn-sm text-xs py-0.5 px-2">Edit</button>
                          <button
                            type="button"
                            onClick={() => handleRemove(s.student_id, s.name)}
                            className="btn-ghost btn-sm text-red-600 hover:bg-red-50 hover:border-red-300 text-xs py-0.5 px-2"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Side Cards */}
        <div className="flex flex-col gap-6">
          {/* Add Student Card */}
          <form onSubmit={handleAdd} className="card flex flex-col gap-3">
            <h3 className="font-bold text-sm text-text pb-2 border-b border-border">
              Add Individual Student
            </h3>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-2 mb-1">
                USN (Roll Number)
              </label>
              <input
                className="inp text-xs"
                placeholder="e.g. 1XX23CS001"
                value={form.usn}
                onChange={e => setForm(f => ({ ...f, usn: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-2 mb-1">
                Full Name
              </label>
              <input
                className="inp text-xs"
                placeholder="Student full name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-2 mb-1">
                Email (for Student Portal)
              </label>
              <input
                type="email"
                className="inp text-xs"
                placeholder="student@college.edu"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn justify-center mt-1 text-xs"
            >
              {submitting ? <><span className="spinner" /> Enrolling…</> : '+ Enroll Student'}
            </button>
          </form>

          {/* Bulk Upload Card */}
          <div className="card flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-bold text-sm text-text">Bulk Roster Upload</h3>
              <button
                type="button"
                onClick={() => getTemplate('students')}
                className="text-xs text-accent font-semibold hover:underline"
              >
                ↓ CSV Template
              </button>
            </div>

            <p className="text-xs text-text-2 leading-relaxed">
              Upload class list with columns: <code className="bg-surface-2 px-1 py-0.5 rounded text-[0.7rem]">usn, name, email</code>.
            </p>

            <label className="border-2 border-dashed border-border-2 rounded-lg p-5 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-accent hover:bg-surface-2 transition-all text-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-3">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="text-xs font-semibold text-accent">
                {uploading ? 'Processing file…' : 'Choose CSV or Excel file'}
              </span>
              <span className="text-[0.68rem] text-text-3">.csv or .xlsx</span>
              <input
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                disabled={uploading}
                onChange={handleUpload}
              />
            </label>
          </div>
          {editing && (
            <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setEditing(null)}>
              <form className="modal-box flex flex-col gap-3"
                onSubmit={async e => {
                  e.preventDefault()
                  setErr('')
                  setMsg('')
                  try {
                    await updateStudent(courseId, editing.student_id, {
                      usn: editing.usn,
                      name: editing.name,
                      email: editing.email || '',
                    })
                    setEditing(null)
                    setMsg('Student details updated.')
                    await loadData()
                  } catch (ex) {
                    setErr(ex.message)
                    setEditing(null)
                  }
                }}>
                <h2 className="font-bold text-lg text-text">Edit student</h2>
                <input className="inp" value={editing.usn} onChange={e => setEditing(v => ({ ...v, usn: e.target.value }))} placeholder="USN" />
                <input className="inp" value={editing.name} onChange={e => setEditing(v => ({ ...v, name: e.target.value }))} placeholder="Full name" />
                <input className="inp" type="email" value={editing.email || ''} onChange={e => setEditing(v => ({ ...v, email: e.target.value }))} placeholder="Email" />
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                  <button type="submit" className="btn">Save changes</button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
