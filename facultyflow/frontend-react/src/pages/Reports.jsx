import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { downloadReport } from '../api.js'
import { useCourse } from '../context/CourseContext.jsx'

const REPORTS = [
  {
    type: 'attendance',
    title: 'Class-Wise Attendance Report',
    icon: '📋',
    color: 'border-l-4 border-l-emerald-600',
    desc: 'Complete roll call history, present/absent ratios, and aggregate percentage for each enrolled student.'
  },
  {
    type: 'cie',
    title: 'Internal Marks (CIE) Report',
    icon: '📊',
    color: 'border-l-4 border-l-blue-600',
    desc: 'Breakdown of scores across tests, quizzes, and labs with continuous internal evaluation standing.'
  },
  {
    type: 'deficit',
    title: 'Deficit & Follow-Up Report',
    icon: '⚠️',
    color: 'border-l-4 border-l-amber-600',
    desc: 'Prioritized at-risk student registry, flagged thresholds, and mathematical classes required to reach 75%.'
  },
]

export default function Reports() {
  const { id } = useParams()
  const { activeCourseId, activeCourse } = useCourse()
  const courseId = id || activeCourseId

  const today = new Date().toISOString().split('T')[0]
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState(today)
  const [loading, setLoading] = useState({})
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')

  const handleDownload = async (type, format) => {
    const key = `${type}-${format}`
    setLoading(l => ({ ...l, [key]: true }))
    setErr('')
    setSuccess('')
    try {
      const params = { course_id: courseId, format }
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      await downloadReport(type, params)
      setSuccess(`✓ Successfully generated ${type.toUpperCase()} ${format.toUpperCase()} report.`)
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setLoading(l => ({ ...l, [key]: false }))
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-text">
          Academic Report Generation
        </h1>
        <p className="text-xs font-medium text-text-2 mt-0.5">
          {activeCourse ? `${activeCourse.course_code} · ${activeCourse.course_name}` : `Course #${courseId}`}
        </p>
      </div>

      {err && <div className="card bg-red-50 border-red-200 text-red-700 text-sm font-medium py-2.5 px-4">{err}</div>}
      {success && <div className="card bg-emerald-50 border-emerald-200 text-emerald-800 text-sm font-medium py-2.5 px-4">{success}</div>}

      {/* Date Filter Bar */}
      <div className="card flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-2 mb-1">
              Date From (Optional)
            </label>
            <input
              type="date"
              className="inp text-xs w-auto font-medium"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-2 mb-1">
              Date To
            </label>
            <input
              type="date"
              className="inp text-xs w-auto font-medium"
              value={dateTo}
              max={today}
              onChange={e => setDateTo(e.target.value)}
            />
          </div>
        </div>
        <div className="text-xs text-text-3 font-medium">
          PDF and Excel files are generated on demand with verified totals.
        </div>
      </div>

      {/* Differentiated Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {REPORTS.map(r => (
          <div key={r.type} className={`card flex flex-col justify-between gap-4 ${r.color} shadow-sm hover:shadow-md transition-shadow`}>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">{r.icon}</span>
                <div>
                  <h3 className="font-bold text-sm text-text leading-tight">{r.title}</h3>
                  <span className="text-[0.68rem] uppercase tracking-wider text-accent font-semibold">
                    Automated Export
                  </span>
                </div>
              </div>
              <p className="text-xs text-text-2 leading-relaxed mt-2">{r.desc}</p>
            </div>

            <div className="flex gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => handleDownload(r.type, 'pdf')}
                disabled={loading[`${r.type}-pdf`]}
                className="btn btn-sm flex-1 justify-center text-xs"
              >
                {loading[`${r.type}-pdf`] ? <span className="spinner" /> : '📄 PDF Report'}
              </button>
              <button
                type="button"
                onClick={() => handleDownload(r.type, 'xlsx')}
                disabled={loading[`${r.type}-xlsx`]}
                className="btn-ghost btn-sm flex-1 justify-center text-xs"
              >
                {loading[`${r.type}-xlsx`] ? <span className="spinner" /> : '📊 Excel'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
