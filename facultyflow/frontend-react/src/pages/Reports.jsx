import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { downloadReport } from '../api.js'

const REPORTS = [
  { type: 'attendance', label: 'Attendance Report', icon: '📋', desc: 'Class-wise attendance for all students' },
  { type: 'cie',        label: 'CIE Report',        icon: '📊', desc: 'Internal marks across all assessments' },
  { type: 'deficit',    label: 'Deficit Report',    icon: '⚠️', desc: 'At-risk students ranked by priority' },
]

export default function Reports() {
  const { id } = useParams()
  const today = new Date().toISOString().split('T')[0]
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState(today)
  const [loading, setLoading] = useState({})
  const [err, setErr] = useState('')

  const download = async (type, format) => {
    setLoading(l => ({ ...l, [`${type}-${format}`]: true }))
    setErr('')
    try {
      const params = { course_id: id, format }
      if (dateFrom) params.date_from = dateFrom
      if (dateTo)   params.date_to   = dateTo
      await downloadReport(type, params)
    } catch (ex) { setErr(ex.message) }
    finally { setLoading(l => ({ ...l, [`${type}-${format}`]: false })) }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Reports</h1>

      {err && <div className="card" style={{ color: 'var(--red)', background: 'var(--red-light)' }}>{err}</div>}

      {/* Filters */}
      <div className="card flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text3)' }}>From</label>
          <input type="date" className="inp w-auto" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text3)' }}>To</label>
          <input type="date" className="inp w-auto" value={dateTo} max={today} onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>

      {/* Report cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        {REPORTS.map(r => (
          <div key={r.type} className="card flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{r.icon}</span>
              <div>
                <div className="font-semibold">{r.label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>{r.desc}</div>
              </div>
            </div>
            <div className="flex gap-2">
              {['pdf', 'xlsx'].map(fmt => (
                <button
                  key={fmt}
                  onClick={() => download(r.type, fmt)}
                  disabled={!!loading[`${r.type}-${fmt}`]}
                  className="btn-ghost btn-sm flex-1 uppercase"
                >
                  {loading[`${r.type}-${fmt}`] ? <span className="spinner" /> : fmt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
