import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  LineElement, PointElement
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import {
  getDeficits, getAttendanceTrend, draftAdvisory, approveAdvisory, getCourses
} from '../api.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, LineElement, PointElement)

const TIER_COLOR = {
  Urgent:   { badge: 'badge-urgent',   border: '#ef4444', bg: '#fef2f2' },
  Critical: { badge: 'badge-critical', border: '#c0392b', bg: '#fde8e8' },
  Advisory: { badge: 'badge-advisory', border: '#c05621', bg: '#fef3e2' },
  Positive: { badge: 'badge-safe',     border: '#166534', bg: '#dcfce7' },
}

function AdvisoryModal({ student, courseId, onClose, onApproved }) {
  const [draft, setDraft] = useState('')
  const [advisoryId, setAdvisoryId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [approving, setApproving] = useState(false)
  const [err, setErr] = useState('')
  const [step, setStep] = useState('draft') // draft | edit | done

  const handleDraft = async () => {
    setLoading(true); setErr('')
    try {
      const res = await draftAdvisory({
        student_id: student.student_id,
        course_id: parseInt(courseId),
        issue_type: student.issue_type || 'attendance shortage',
      })
      setDraft(res.ai_draft || res.final_message || '')
      setAdvisoryId(res.advisory_id)
      setStep('edit')
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    setApproving(true); setErr('')
    try {
      await approveAdvisory(advisoryId, { final_message: draft })
      setStep('done')
      onApproved()
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setApproving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <button onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-light">×</button>
        <h2 className="font-bold text-base mb-1" style={{ color: 'var(--text)' }}>AI Advisory</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text2)' }}>
          {student.name} · {student.issue_type}
        </p>

        {step === 'draft' && (
          <div className="flex flex-col gap-3">
            <div className="card-flat text-sm" style={{ color: 'var(--text2)' }}>
              <strong>AI will draft</strong> a polite, motivating message based on {student.name}'s data.
              You'll review and edit before approving.
            </div>
            {err && <div className="text-sm" style={{ color: 'var(--red)' }}>{err}</div>}
            <button onClick={handleDraft} disabled={loading} className="btn">
              {loading ? <><span className="spinner" /> Generating…</> : '✨ Generate AI Draft'}
            </button>
          </div>
        )}

        {step === 'edit' && (
          <div className="flex flex-col gap-3">
            <div className="card-flat text-xs mb-1" style={{ color: 'var(--text3)' }}>
              AI draft — edit freely before approving. The student sees nothing until you approve.
            </div>
            <textarea
              className="inp text-sm"
              rows={7}
              value={draft}
              onChange={e => setDraft(e.target.value)}
            />
            <div className="text-xs" style={{ color: draft.trim().split(/\s+/).length > 120 ? 'var(--red)' : 'var(--text3)' }}>
              {draft.trim().split(/\s+/).filter(Boolean).length} / 120 words
            </div>
            {err && <div className="text-sm" style={{ color: 'var(--red)' }}>{err}</div>}
            <div className="flex gap-2">
              <button onClick={() => setStep('draft')} className="btn-ghost">← Regenerate</button>
              <button onClick={handleApprove} disabled={approving || !draft.trim()} className="btn flex-1">
                {approving ? <span className="spinner" /> : '✓ Approve & Send'}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                 style={{ background: 'var(--accent-light)' }}>✓</div>
            <p className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
              Advisory approved and sent to student portal.
            </p>
            <button onClick={onClose} className="btn-ghost">Close</button>
          </div>
        )}
      </div>
    </div>
  )
}

function TrendChart({ courseId }) {
  const [data, setData] = useState(null)
  useEffect(() => {
    getAttendanceTrend(courseId).then(setData).catch(() => {})
  }, [courseId])

  if (!data || !data.labels?.length) return null

  return (
    <div className="card">
      <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--text2)' }}>Attendance Trend</h3>
      <Line
        data={{
          labels: data.labels,
          datasets: [{
            label: 'Avg Attendance %',
            data: data.values,
            borderColor: '#2d6a4f',
            backgroundColor: 'rgba(45,106,79,0.08)',
            tension: 0.4,
            fill: true,
            pointBackgroundColor: '#2d6a4f',
          }]
        }}
        options={{
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { min: 0, max: 100, ticks: { stepSize: 20 }, grid: { color: 'rgba(0,0,0,0.04)' } },
            x: { grid: { display: false } }
          }
        }}
        height={80}
      />
    </div>
  )
}

export default function Deficits() {
  const { id } = useParams()
  const [deficits, setDeficits] = useState([])
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [modal, setModal] = useState(null)

  const load = async () => {
    setLoading(true); setErr('')
    try {
      const [d, courses] = await Promise.all([getDeficits(id), getCourses()])
      setDeficits(d)
      setCourse(courses.find(c => c.course_id === parseInt(id)))
    } catch (ex) { setErr(ex.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  if (loading) return <div className="flex justify-center py-16"><div className="spinner w-8 h-8" /></div>

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          Deficit Report
        </h1>
        {course && <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>
          {course.course_name} ({course.course_code})
        </p>}
      </div>

      {err && <div className="card" style={{ color: 'var(--red)', background: 'var(--red-light)' }}>{err}</div>}

      <TrendChart courseId={id} />

      {deficits.length === 0
        ? <div className="card empty-state">🎉 No at-risk students — great work!</div>
        : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student</th>
                  <th>USN</th>
                  <th>Attendance</th>
                  <th>CIE</th>
                  <th>Risk</th>
                  <th>Reason</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {deficits.map((s, i) => {
                  const tier = s.risk_tier || (s.attendance_pct < 75 ? 'Critical' : 'Advisory')
                  const tc = TIER_COLOR[tier] || TIER_COLOR.Advisory
                  const att = s.attendance_pct != null ? s.attendance_pct.toFixed(1) + '%' : 'N/A'
                  const cie = s.cie_pct != null ? s.cie_pct.toFixed(1) + '%' : 'N/A'
                  return (
                    <tr key={s.student_id}>
                      <td style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>{i + 1}</td>
                      <td className="font-medium">{s.name}</td>
                      <td style={{ color: 'var(--text3)' }}>{s.usn}</td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold">{att}</span>
                          <div className="prog-wrap" style={{ width: 80 }}>
                            <div className="prog-bar"
                                 style={{ width: `${Math.min(100, s.attendance_pct || 0)}%`,
                                   background: (s.attendance_pct || 0) < 75 ? '#c0392b' : (s.attendance_pct || 0) < 85 ? '#c05621' : '#166534' }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold">{cie}</span>
                          <div className="prog-wrap" style={{ width: 80 }}>
                            <div className="prog-bar"
                                 style={{ width: `${Math.min(100, s.cie_pct || 0)}%`,
                                   background: (s.cie_pct || 0) < 40 ? '#c0392b' : '#166534' }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${tc.badge}`} style={{ borderColor: tc.border }}>
                          {tier}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text2)', fontSize: '0.8rem', maxWidth: 180, whiteSpace: 'pre-wrap' }}>
                        {s.reason || s.deficit_reasons?.join(', ') || '—'}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm"
                          onClick={() => setModal(s)}
                        >
                          ✨ Draft advisory
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      }

      {modal && (
        <AdvisoryModal
          student={modal}
          courseId={id}
          onClose={() => setModal(null)}
          onApproved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}
