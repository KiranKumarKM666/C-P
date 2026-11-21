import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getStudents, getAttendance, saveAttendance, uploadAttendance, getTemplate } from '../api.js'

export default function Attendance() {
  const { id } = useParams()
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [students, setStudents] = useState([])
  const [records, setRecords] = useState({}) // { student_id: 'Present'|'Absent' }
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([getStudents(id), getAttendance(id, date)])
      .then(([studs, att]) => {
        setStudents(studs)
        const map = {}
        for (const s of studs) map[s.student_id] = 'Present'
        for (const a of att) map[a.student_id] = a.status
        setRecords(map)
      })
      .catch(ex => setErr(ex.message))
      .finally(() => setLoading(false))
  }, [id, date])

  const handleSave = async () => {
    setSaving(true); setErr(''); setMsg('')
    try {
      const rows = students.map(s => ({
        student_id: s.student_id,
        course_id: parseInt(id),
        date,
        status: records[s.student_id] || 'Present',
      }))
      await saveAttendance({ records: rows })
      setMsg('Attendance saved!')
    } catch (ex) { setErr(ex.message) }
    finally { setSaving(false) }
  }

  const handleUpload = async e => {
    const f = e.target.files[0]; if (!f) return
    setUploading(true); setErr(''); setMsg('')
    try {
      const fd = new FormData(); fd.append('file', f)
      const res = await uploadAttendance(id, fd)
      setMsg(`Imported: ${res.imported}, Updated: ${res.updated}, Errors: ${res.errors?.length || 0}`)
    } catch (ex) { setErr(ex.message) }
    finally { setUploading(false); e.target.value = '' }
  }

  const toggleAll = (status) => setRecords(r => {
    const updated = { ...r }
    students.forEach(s => { updated[s.student_id] = status })
    return updated
  })

  if (loading) return <div className="flex justify-center py-16"><div className="spinner w-8 h-8" /></div>

  const presentCount = Object.values(records).filter(v => v === 'Present').length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Attendance</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>
            {presentCount}/{students.length} present
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <input type="date" className="inp w-auto" value={date} max={today}
                 onChange={e => setDate(e.target.value)} />
          <button className="btn-ghost btn-sm" onClick={() => getTemplate('attendance')}>↓ Template</button>
          <label className="btn-ghost btn-sm cursor-pointer">
            {uploading ? <span className="spinner" /> : '↑ Bulk Upload'}
            <input type="file" accept=".csv,.xlsx" className="hidden" onChange={handleUpload} />
          </label>
        </div>
      </div>

      {err && <div className="card" style={{ color: 'var(--red)', background: 'var(--red-light)' }}>{err}</div>}
      {msg && <div className="card" style={{ color: 'var(--green)', background: 'var(--green-light)' }}>{msg}</div>}

      {students.length === 0
        ? <div className="card empty-state">No students enrolled in this course.</div>
        : (
          <>
            <div className="flex gap-2">
              <button className="btn-ghost btn-sm" onClick={() => toggleAll('Present')}>All Present</button>
              <button className="btn-ghost btn-sm" onClick={() => toggleAll('Absent')}>All Absent</button>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>#</th><th>USN</th><th>Name</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {students.map((s, i) => (
                    <tr key={s.student_id}>
                      <td style={{ color: 'var(--text3)' }}>{i + 1}</td>
                      <td className="font-mono text-xs">{s.usn}</td>
                      <td className="font-medium">{s.name}</td>
                      <td>
                        <div className="flex gap-2">
                          {['Present', 'Absent'].map(st => (
                            <label key={st} className="flex items-center gap-1.5 cursor-pointer text-sm">
                              <input
                                type="radio"
                                name={`status-${s.student_id}`}
                                value={st}
                                checked={records[s.student_id] === st}
                                onChange={() => setRecords(r => ({ ...r, [s.student_id]: st }))}
                              />
                              <span style={{ color: st === 'Absent' ? 'var(--red)' : 'var(--green)' }}>{st}</span>
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={handleSave} disabled={saving} className="btn self-start">
              {saving ? <><span className="spinner" /> Saving…</> : '💾 Save Attendance'}
            </button>
          </>
        )
      }
    </div>
  )
}
