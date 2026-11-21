import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getStudents, getMarks, saveMarks, uploadMarks } from '../api.js'

export default function Marks() {
  const { id } = useParams()
  const [students, setStudents] = useState([])
  const [marks, setMarks] = useState([]) // flat list from API
  const [assessment, setAssessment] = useState('CIE-1')
  const [maxMarks, setMaxMarks] = useState(25)
  const [entries, setEntries] = useState({}) // { student_id: { marks: '', absent: false } }
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([getStudents(id), getMarks(id)])
      .then(([studs, m]) => {
        setStudents(studs)
        setMarks(m)
        // Prefill entries from existing marks for selected assessment
        const map = {}
        for (const s of studs) {
          const existing = m.find(r => r.student_id === s.student_id && r.assessment_name === assessment)
          map[s.student_id] = existing
            ? { marks: existing.is_absent ? '' : String(existing.marks_obtained), absent: existing.is_absent }
            : { marks: '', absent: false }
        }
        setEntries(map)
      })
      .catch(ex => setErr(ex.message))
      .finally(() => setLoading(false))
  }, [id])

  // Re-prefill when assessment changes
  useEffect(() => {
    const map = {}
    for (const s of students) {
      const existing = marks.find(r => r.student_id === s.student_id && r.assessment_name === assessment)
      map[s.student_id] = existing
        ? { marks: existing.is_absent ? '' : String(existing.marks_obtained), absent: existing.is_absent }
        : { marks: '', absent: false }
    }
    setEntries(map)
  }, [assessment, marks])

  const handleSave = async () => {
    setSaving(true); setErr(''); setMsg('')
    try {
      const rows = students.map(s => {
        const e = entries[s.student_id] || {}
        return {
          student_id: s.student_id,
          course_id: parseInt(id),
          assessment_name: assessment,
          max_marks: maxMarks,
          marks_obtained: e.absent ? null : parseFloat(e.marks),
          is_absent: !!e.absent,
        }
      })
      await saveMarks({ records: rows })
      setMsg('Marks saved!')
    } catch (ex) { setErr(ex.message) }
    finally { setSaving(false) }
  }

  const handleUpload = async e => {
    const f = e.target.files[0]; if (!f) return
    setUploading(true); setErr(''); setMsg('')
    try {
      const fd = new FormData(); fd.append('file', f)
      const res = await uploadMarks(id, fd)
      setMsg(`Imported: ${res.imported}, Updated: ${res.updated}, Errors: ${res.errors?.length || 0}`)
    } catch (ex) { setErr(ex.message) }
    finally { setUploading(false); e.target.value = '' }
  }

  const ASSESSMENTS = ['CIE-1', 'CIE-2', 'CIE-3', 'Quiz-1', 'Quiz-2', 'Lab-1', 'Lab-2']

  if (loading) return <div className="flex justify-center py-16"><div className="spinner w-8 h-8" /></div>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Marks</h1>
        <label className="btn-ghost btn-sm cursor-pointer">
          {uploading ? <span className="spinner" /> : '↑ Bulk Upload'}
          <input type="file" accept=".csv,.xlsx" className="hidden" onChange={handleUpload} />
        </label>
      </div>

      {err && <div className="card" style={{ color: 'var(--red)', background: 'var(--red-light)' }}>{err}</div>}
      {msg && <div className="card" style={{ color: 'var(--green)', background: 'var(--green-light)' }}>{msg}</div>}

      {/* Assessment selector */}
      <div className="card flex flex-wrap gap-4 items-center">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>Assessment</label>
          <select className="inp w-auto" value={assessment} onChange={e => setAssessment(e.target.value)}>
            {ASSESSMENTS.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>Max Marks</label>
          <input type="number" className="inp w-24" min={1} value={maxMarks}
                 onChange={e => setMaxMarks(parseInt(e.target.value))} />
        </div>
      </div>

      {students.length === 0
        ? <div className="card empty-state">No students enrolled.</div>
        : (
          <>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>#</th><th>USN</th><th>Name</th><th>Marks / {maxMarks}</th><th>Absent</th></tr>
                </thead>
                <tbody>
                  {students.map((s, i) => {
                    const e = entries[s.student_id] || { marks: '', absent: false }
                    return (
                      <tr key={s.student_id}>
                        <td style={{ color: 'var(--text3)' }}>{i + 1}</td>
                        <td className="font-mono text-xs">{s.usn}</td>
                        <td className="font-medium">{s.name}</td>
                        <td>
                          <input
                            type="number"
                            className="inp w-24"
                            min={0} max={maxMarks}
                            disabled={e.absent}
                            value={e.marks}
                            placeholder={e.absent ? 'AB' : ''}
                            onChange={ev => setEntries(ent => ({
                              ...ent,
                              [s.student_id]: { ...ent[s.student_id], marks: ev.target.value }
                            }))}
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!e.absent}
                            onChange={ev => setEntries(ent => ({
                              ...ent,
                              [s.student_id]: { ...ent[s.student_id], absent: ev.target.checked, marks: '' }
                            }))}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <button onClick={handleSave} disabled={saving} className="btn self-start">
              {saving ? <><span className="spinner" /> Saving…</> : '💾 Save Marks'}
            </button>
          </>
        )
      }
    </div>
  )
}
