import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getStudents, getMarks, saveMarks, uploadMarks, getTemplate } from '../api.js'
import { useCourse } from '../context/CourseContext.jsx'

export default function Marks() {
  const { id } = useParams()
  const { activeCourseId, activeCourse } = useCourse()
  const courseId = id || activeCourseId

  const [students, setStudents] = useState([])
  const [marksTable, setMarksTable] = useState({ assessments: [], rows: [] })
  const [assessment, setAssessment] = useState('Test 1')
  const [maxMarks, setMaxMarks] = useState(25)
  const [entries, setEntries] = useState({}) // { student_id: { score: '', absent: false } }
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const loadData = async () => {
    if (!courseId) return
    setLoading(true)
    setErr('')
    try {
      const [studs, mTable] = await Promise.all([
        getStudents(courseId),
        getMarks(courseId).catch(() => ({ assessments: [], rows: [] }))
      ])
      setStudents(studs)
      setMarksTable(mTable)

      const map = {}
      studs.forEach(s => {
        map[s.student_id] = { score: '', absent: false }
      })
      setEntries(map)
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [courseId])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!assessment.trim()) {
      setErr('Please provide an assessment name.')
      return
    }
    const max = parseFloat(maxMarks)
    if (!max || max <= 0) {
      setErr('Maximum marks must be greater than 0.')
      return
    }

    setSaving(true)
    setErr('')
    setMsg('')
    try {
      const rows = students.map(s => {
        const ent = entries[s.student_id] || { score: '', absent: false }
        return {
          student_id: s.student_id,
          marks_obtained: ent.absent ? null : (ent.score === '' ? null : parseFloat(ent.score)),
          is_absent: !!ent.absent,
          absent: !!ent.absent,
        }
      })

      // Validation check
      const missing = rows.find(r => !r.is_absent && r.marks_obtained === null)
      if (missing) {
        throw new Error('Please enter marks or check AB for every student.')
      }

      await saveMarks({
        course_id: parseInt(courseId),
        assessment_name: assessment.trim(),
        max_marks: max,
        records: rows
      })

      setMsg(`✓ Marks for "${assessment}" successfully saved!`)
      // Refresh marks matrix
      getMarks(courseId).then(setMarksTable).catch(() => {})
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setSaving(false)
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
      const res = await uploadMarks(courseId, fd)
      setMsg(`✓ Bulk Upload: ${res.imported} imported, ${res.updated} updated${res.errors?.length ? ` (${res.errors.length} skipped)` : ''}`)
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

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-text">
            Internal Marks & CIE Management
          </h1>
          <p className="text-xs font-medium text-text-2 mt-0.5">
            {activeCourse ? `${activeCourse.course_code} · ${activeCourse.course_name}` : `Course #${courseId}`}
          </p>
        </div>
      </div>

      {err && <div className="card bg-red-50 border-red-200 text-red-700 text-sm font-medium py-2.5 px-4">{err}</div>}
      {msg && <div className="card bg-emerald-50 border-emerald-200 text-emerald-800 text-sm font-medium py-2.5 px-4">{msg}</div>}

      {/* Top 2-Column Split: Record Assessment Marks VS Bulk Upload */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Cols: Assessment Input & Entry Table */}
        <div className="lg:col-span-2 card flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <h2 className="font-bold text-sm text-text">Record Assessment Marks</h2>
            <span className="text-xs text-text-3 font-medium">{students.length} students enrolled</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-surface-2 border border-border">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-2 mb-1">
                Assessment Name
              </label>
              <input
                className="inp"
                placeholder="e.g. Test 1, Quiz 2"
                value={assessment}
                onChange={e => setAssessment(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-2 mb-1">
                Max Marks
              </label>
              <input
                type="number"
                min="1"
                step="any"
                className="inp"
                placeholder="25"
                value={maxMarks}
                onChange={e => setMaxMarks(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || students.length === 0}
                className="btn w-full justify-center"
              >
                {saving ? <><span className="spinner" /> Saving…</> : '💾 Save Marks'}
              </button>
            </div>
          </div>

          {students.length === 0 ? (
            <div className="empty-state py-10">
              <div className="text-3xl mb-1">📝</div>
              <div className="font-semibold text-text">No students enrolled yet</div>
            </div>
          ) : (
            <div className="tbl-wrap max-h-96 overflow-y-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>USN</th>
                    <th>Student Name</th>
                    <th className="w-28">Score</th>
                    <th className="text-center w-20">Absent (AB)</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => {
                    const ent = entries[s.student_id] || { score: '', absent: false }
                    return (
                      <tr key={s.student_id}>
                        <td className="font-mono text-xs font-semibold text-text">{s.usn}</td>
                        <td className="font-medium text-text">{s.name}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max={maxMarks}
                            step="any"
                            disabled={ent.absent}
                            placeholder={ent.absent ? 'AB' : '0'}
                            className="inp py-1 px-2 text-xs font-semibold w-24 disabled:opacity-40 disabled:bg-surface-2"
                            value={ent.score}
                            onChange={e => {
                              const val = e.target.value
                              setEntries(prev => ({
                                ...prev,
                                [s.student_id]: { ...prev[s.student_id], score: val, absent: false }
                              }))
                            }}
                          />
                        </td>
                        <td className="text-center">
                          <input
                            type="checkbox"
                            checked={!!ent.absent}
                            onChange={e => {
                              const isAb = e.target.checked
                              setEntries(prev => ({
                                ...prev,
                                [s.student_id]: { ...prev[s.student_id], absent: isAb, score: isAb ? '' : prev[s.student_id]?.score }
                              }))
                            }}
                            className="w-4 h-4 cursor-pointer accent-accent"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Col: Dedicated Bulk Upload Card */}
        <div className="card flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <h3 className="font-bold text-sm text-text">Bulk Marks Upload</h3>
            <button
              type="button"
              onClick={() => getTemplate('marks')}
              className="text-xs text-accent font-semibold hover:underline"
            >
              ↓ CSV Template
            </button>
          </div>

          <p className="text-xs text-text-2 leading-relaxed">
            Columns: <code className="bg-surface-2 px-1 py-0.5 rounded text-[0.7rem]">usn, assessment, max_marks, marks</code>
            <br />
            (Use <b className="text-text">AB</b> for absent students).
          </p>

          <label className="border-2 border-dashed border-border-2 rounded-lg p-5 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-accent hover:bg-surface-2 transition-all text-center">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-3">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="text-xs font-semibold text-accent">
              {uploading ? 'Importing Marks…' : 'Upload Marks Sheet'}
            </span>
            <span className="text-[0.68rem] text-text-3">CSV or XLSX format</span>
            <input
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              disabled={uploading}
              onChange={handleUpload}
            />
          </label>
        </div>
      </div>

      {/* Bottom Section: Existing Marks Matrix Across All Assessments with Progress Bars */}
      <div className="card flex flex-col gap-4">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div>
            <h3 className="font-bold text-sm text-text">Course Marks Matrix & CIE Overview</h3>
            <p className="text-xs text-text-2 mt-0.5">Aggregated assessment scores and continuous internal evaluation (CIE)</p>
          </div>
          <span className="badge badge-safe font-mono">{marksTable.assessments?.length || 0} Assessments</span>
        </div>

        {(!marksTable.rows || marksTable.rows.length === 0) ? (
          <div className="empty-state py-8">
            <div className="text-sm font-semibold text-text">No recorded assessments yet.</div>
            <p className="text-xs text-text-3 mt-1">Scores entered above will automatically populate this performance matrix.</p>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>USN</th>
                  <th>Student Name</th>
                  {marksTable.assessments.map(a => (
                    <th key={a} className="text-center">{a}</th>
                  ))}
                  <th className="text-center w-36">CIE %</th>
                </tr>
              </thead>
              <tbody>
                {marksTable.rows.map(r => {
                  const cie = r.cie_pct != null ? r.cie_pct : null
                  const cieColor = cie == null ? 'bg-border-2' : cie < 40 ? 'bg-red-500' : 'bg-emerald-600'
                  return (
                    <tr key={r.student_id}>
                      <td className="font-mono text-xs font-semibold text-text">{r.usn}</td>
                      <td className="font-medium text-text">{r.name}</td>
                      {marksTable.assessments.map(a => (
                        <td key={a} className="text-center font-mono text-xs">
                          {r.cells[a] === 'AB' ? (
                            <span className="badge badge-critical text-[0.65rem]">AB</span>
                          ) : r.cells[a] != null ? (
                            <span className="font-semibold text-text">{r.cells[a]}</span>
                          ) : (
                            <span className="text-text-3">—</span>
                          )}
                        </td>
                      ))}
                      <td>
                        {cie != null ? (
                          <div className="flex flex-col gap-1 items-center">
                            <span className={`text-xs font-bold ${cie < 40 ? 'text-red-600' : 'text-emerald-700'}`}>
                              {cie.toFixed(1)}%
                            </span>
                            <div className="w-24 h-1.5 rounded-full bg-border overflow-hidden">
                              <div className={`h-full ${cieColor}`} style={{ width: `${Math.min(100, cie)}%` }} />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-text-3 text-center block">No Scored Tests</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
