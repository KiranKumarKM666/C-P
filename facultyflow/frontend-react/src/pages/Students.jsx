import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getStudents, addStudent, removeStudent, uploadStudents, getTemplate } from '../api.js'

export default function Students() {
  const { id } = useParams()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ usn: '', name: '', email: '' })
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setStudents(await getStudents(id)) }
    catch (ex) { setErr(ex.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [id])

  const handleAdd = async e => {
    e.preventDefault(); setSubmitting(true); setErr('')
    try {
      await addStudent(id, form)
      setForm({ usn: '', name: '', email: '' })
      setShowAdd(false)
      setMsg('Student added!')
      await load()
    } catch (ex) { setErr(ex.message) }
    finally { setSubmitting(false) }
  }

  const handleRemove = async sid => {
    if (!window.confirm('Remove this student and all their records?')) return
    try { await removeStudent(id, sid); await load() }
    catch (ex) { setErr(ex.message) }
  }

  const handleUpload = async e => {
    const f = e.target.files[0]; if (!f) return
    setUploading(true); setErr(''); setMsg('')
    try {
      const fd = new FormData(); fd.append('file', f)
      const res = await uploadStudents(id, fd)
      setMsg(`Imported: ${res.imported}, Updated: ${res.updated}, Errors: ${res.errors?.length || 0}`)
      await load()
    } catch (ex) { setErr(ex.message) }
    finally { setUploading(false); e.target.value = '' }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Students</h1>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-ghost btn-sm" onClick={() => getTemplate('students')}>↓ Template</button>
          <label className="btn-ghost btn-sm cursor-pointer">
            {uploading ? <span className="spinner" /> : '↑ Upload CSV'}
            <input type="file" accept=".csv,.xlsx" className="hidden" onChange={handleUpload} />
          </label>
          <button className="btn btn-sm" onClick={() => setShowAdd(s => !s)}>
            {showAdd ? 'Cancel' : '+ Add Student'}
          </button>
        </div>
      </div>

      {err && <div className="card" style={{ color: 'var(--red)', background: 'var(--red-light)' }}>{err}</div>}
      {msg && <div className="card" style={{ color: 'var(--green)', background: 'var(--green-light)' }}>{msg}</div>}

      {showAdd && (
        <form onSubmit={handleAdd} className="card flex flex-col gap-3">
          <h3 className="font-semibold">Add Student</h3>
          <div className="grid sm:grid-cols-3 gap-3">
            <input className="inp" placeholder="USN" value={form.usn} onChange={e => setForm(f => ({ ...f, usn: e.target.value }))} required />
            <input className="inp" placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            <input className="inp" placeholder="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <button type="submit" disabled={submitting} className="btn self-start">
            {submitting ? <span className="spinner" /> : 'Add'}
          </button>
        </form>
      )}

      {loading
        ? <div className="flex justify-center py-12"><div className="spinner w-8 h-8" /></div>
        : students.length === 0
        ? <div className="card empty-state">No students enrolled yet. Add one or upload a CSV.</div>
        : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>#</th><th>USN</th><th>Name</th><th>Email</th><th></th></tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.student_id}>
                    <td style={{ color: 'var(--text3)' }}>{i + 1}</td>
                    <td className="font-mono text-xs">{s.usn}</td>
                    <td className="font-medium">{s.name}</td>
                    <td style={{ color: 'var(--text2)' }}>{s.email}</td>
                    <td>
                      <button className="btn btn-sm btn-danger"
                              onClick={() => handleRemove(s.student_id)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  )
}
