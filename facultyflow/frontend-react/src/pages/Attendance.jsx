import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getStudents, getAttendance, saveAttendance, uploadAttendance, getTemplate, getSummary } from '../api.js'
import { useCourse } from '../context/CourseContext.jsx'

export default function Attendance() {
  const { id } = useParams()
  const { activeCourseId, activeCourse } = useCourse()
  const courseId = id || activeCourseId

  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [students, setStudents] = useState([])
  const [summary, setSummary] = useState([])
  const [records, setRecords] = useState({}) // { student_id: 'Present' | 'Absent' }
  const [reasons, setReasons] = useState({})
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
      const [studs, att, summ] = await Promise.all([
        getStudents(courseId),
        getAttendance(courseId, date),
        getSummary(courseId).catch(() => [])
      ])
      setStudents(studs)
      setSummary(summ)

      const map = {}
      const reasonMap = {}
      studs.forEach(s => { map[s.student_id] = 'Present' })
      att.forEach(a => { map[a.student_id] = a.status; reasonMap[a.student_id] = a.reason || '' })
      setRecords(map)
      setReasons(reasonMap)
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [courseId, date])

  const handleSave = async () => {
    setSaving(true)
    setErr('')
    setMsg('')
    try {
      const rows = students.map(s => ({
        student_id: s.student_id,
        course_id: parseInt(courseId),
        date,
        status: records[s.student_id] || 'Present',
        reason: records[s.student_id] === 'Absent' ? (reasons[s.student_id] || '') : null,
      }))
      await saveAttendance({
        course_id: parseInt(courseId),
        date,
        records: rows
      })
      setMsg(`✓ Attendance for ${date} successfully recorded.`)
      // Refresh summary
      getSummary(courseId).then(setSummary).catch(() => {})
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
      const res = await uploadAttendance(courseId, fd)
      setMsg(`✓ Bulk Upload: ${res.imported} imported, ${res.updated} updated${res.errors?.length ? ` (${res.errors.length} skipped)` : ''}`)
      await loadData()
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const toggleAll = (status) => {
    setRecords(prev => {
      const updated = { ...prev }
      students.forEach(s => { updated[s.student_id] = status })
      return updated
    })
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

  const presentCount = Object.values(records).filter(v => v === 'Present').length
  const attendanceRate = students.length ? Math.round((presentCount / students.length) * 100) : 0

  return (
    <div className="flex flex-col gap-6">
      {/* Title & Quick Info */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-text">
            Attendance Recording
          </h1>
          <p className="text-xs font-medium text-text-2 mt-0.5">
            {activeCourse ? `${activeCourse.course_code} · ${activeCourse.course_name}` : `Course #${courseId}`}
          </p>
        </div>

        {/* Live Attendance Rate Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-surface shadow-sm">
          <span className="text-xs text-text-2 font-medium">Session Attendance:</span>
          <span className="text-sm font-bold text-accent">{presentCount} / {students.length} ({attendanceRate}%)</span>
        </div>
      </div>

      {err && <div className="card bg-red-50 border-red-200 text-red-700 text-sm font-medium py-2.5 px-4">{err}</div>}
      {msg && <div className="card bg-emerald-50 border-emerald-200 text-emerald-800 text-sm font-medium py-2.5 px-4">{msg}</div>}

      {/* Differentiated 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main Column: Date Picker, Controls & Student Roll Call Table */}
        <div className="lg:col-span-2 card flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3 pb-3 border-b border-border">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-2 mb-1">
                Attendance Date
              </label>
              <input
                type="date"
                className="inp w-auto text-sm font-semibold"
                value={date}
                max={today}
                onChange={e => setDate(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleAll('Present')}
                className="btn-ghost btn-sm"
              >
                Mark All Present
              </button>
              <button
                type="button"
                onClick={() => toggleAll('Absent')}
                className="btn-ghost btn-sm"
              >
                Mark All Absent
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || students.length === 0}
                className="btn btn-sm"
              >
                {saving ? <><span className="spinner" /> Saving…</> : '💾 Save Attendance'}
              </button>
            </div>
          </div>

          {students.length === 0 ? (
            <div className="empty-state py-12">
              <div className="text-3xl mb-2">👥</div>
              <div className="font-semibold text-text">No students enrolled yet</div>
              <p className="text-xs text-text-2 mt-1">Add students in the Students tab or upload via bulk CSV.</p>
            </div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>USN</th>
                    <th>Student Name</th>
                    <th className="text-center w-28">Status</th>
                    <th>Absence reason</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => {
                    const isPresent = records[s.student_id] === 'Present'
                    return (
                      <tr key={s.student_id} className="hover:bg-surface-2 transition-colors">
                        <td className="font-mono text-xs font-semibold text-text">{s.usn}</td>
                        <td className="font-medium text-text">{s.name}</td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => setRecords(prev => ({
                              ...prev,
                              [s.student_id]: isPresent ? 'Absent' : 'Present'
                            }))}
                            className={`badge px-3 py-1 cursor-pointer transition-all uppercase text-[0.7rem] ${
                              isPresent ? 'badge-safe' : 'badge-critical'
                            }`}
                          >
                            {isPresent ? '✓ Present' : '✕ Absent'}
                          </button>
                        </td>
                        <td>
                          {isPresent ? (
                            <span className="text-xs text-text-3">—</span>
                          ) : (
                            <input
                              className="inp py-1.5 text-xs"
                              value={reasons[s.student_id] || ''}
                              onChange={e => setReasons(prev => ({ ...prev, [s.student_id]: e.target.value }))}
                              placeholder="Reason for absence"
                            />
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

        {/* Right Column: Attendance Summary List & Bulk Upload Area */}
        <div className="flex flex-col gap-6">
          {/* Real-time Attendance Summary */}
          <div className="card flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-bold text-sm text-text">Course Attendance Summary</h3>
              <span className="text-xs text-text-3">{summary.length} students</span>
            </div>

            <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto pr-1">
              {summary.length === 0 ? (
                <div className="text-xs text-text-3 py-4 text-center">Summary will compute as classes are held.</div>
              ) : (
                summary.map(r => {
                  const pct = r.attendance_pct != null ? `${r.attendance_pct.toFixed(1)}%` : 'No Data'
                  const colorCls = (r.attendance_pct || 0) < 75 ? 'text-red-600 bg-red-50 border-red-200' :
                                   (r.attendance_pct || 0) <= 85 ? 'text-amber-700 bg-amber-50 border-amber-200' :
                                   'text-emerald-700 bg-emerald-50 border-emerald-200'

                  return (
                    <div
                      key={r.student_id}
                      className="flex items-center justify-between p-2 rounded-lg bg-surface-2 border border-border text-xs"
                    >
                      <div className="flex flex-col truncate pr-2">
                        <span className="font-semibold text-text truncate">{r.name}</span>
                        <span className="text-[0.68rem] text-text-3 font-mono">{r.usn}</span>
                      </div>
                      <span className={`badge px-2 py-0.5 border ${colorCls} font-bold`}>
                        {pct}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Differentiated Bulk Upload Area */}
          <div className="card flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-bold text-sm text-text">Bulk Attendance Upload</h3>
              <button
                type="button"
                onClick={() => getTemplate('attendance')}
                className="text-xs text-accent font-semibold hover:underline"
              >
                ↓ CSV Template
              </button>
            </div>

            <p className="text-xs text-text-2 leading-relaxed">
              Upload class sheets with columns: <code className="bg-surface-2 px-1 py-0.5 rounded text-[0.7rem]">usn, date, status, reason</code> (reason is optional and only used for absent students).
            </p>

            <label className="border-2 border-dashed border-border-2 rounded-lg p-4 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-accent hover:bg-surface-2 transition-all text-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-3">
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
        </div>
      </div>
    </div>
  )
}
