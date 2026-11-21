import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  Chart as ChartJS, ArcElement, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend
} from 'chart.js'
import { Doughnut, Line } from 'react-chartjs-2'
import {
  getDeficits, getSummary, getAttendanceTrend, draftAdvisory, approveAdvisory
} from '../api.js'
import { useCourse } from '../context/CourseContext.jsx'

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

// Mathematical probability calculation of classes required to reach 75%
function calcClassesNeeded(attended, total, target = 75) {
  if (!total || total === 0) return null
  const pctNow = (attended / total) * 100
  if (pctNow >= target) {
    // how many can be missed
    const canMiss = Math.floor((attended - (target / 100) * total) / (1 - target / 100))
    return { status: 'above', canMiss: Math.max(0, canMiss), pct: pctNow }
  }
  // (attended + x)/(total + x) >= target/100
  const needed = Math.ceil(((target * total) / 100 - attended) / (1 - target / 100))
  return { status: 'below', needed: Math.max(0, needed), pct: pctNow }
}

function AdvisoryModal({ student, courseId, onClose, onApproved }) {
  const [draft, setDraft] = useState('')
  const [advisoryId, setAdvisoryId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [approving, setApproving] = useState(false)
  const [err, setErr] = useState('')
  const [step, setStep] = useState('draft') // draft | edit | done

  const handleDraft = async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await draftAdvisory({
        student_id: student.student_id,
        course_id: parseInt(courseId),
        issue_type: student.reason || student.deficit_reasons?.[0] || 'attendance shortage',
      })
      setDraft(res.ai_draft || res.draft || '')
      setAdvisoryId(res.advisory_id)
      setStep('edit')
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    setApproving(true)
    setErr('')
    try {
      await approveAdvisory(advisoryId, { final_message: draft.trim() })
      setStep('done')
      onApproved()
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setApproving(false)
    }
  }

  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box page-enter max-w-lg">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-3 hover:text-text text-xl font-light"
        >
          ✕
        </button>

        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">✨</span>
          <h2 className="font-bold text-base text-text">AI Academic Advisory</h2>
        </div>
        <p className="text-xs text-text-2 mb-4">
          Drafting guidance for <b className="text-text">{student.name}</b> ({student.usn})
        </p>

        {step === 'draft' && (
          <div className="flex flex-col gap-3">
            <div className="card-flat text-xs text-text-2 leading-relaxed">
              <strong>Human-in-the-loop guarantee:</strong> The AI will generate a constructive, motivating draft based on attendance and CIE deficits. You will inspect, modify, and explicitly approve it before the student can view it.
            </div>
            {err && <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-200">{err}</div>}
            <button
              onClick={handleDraft}
              disabled={loading}
              className="btn justify-center mt-2"
            >
              {loading ? <><span className="spinner" /> Synthesizing AI Draft…</> : '✨ Generate AI Draft'}
            </button>
          </div>
        )}

        {step === 'edit' && (
          <div className="flex flex-col gap-3">
            <div className="text-xs text-text-3 flex justify-between items-center">
              <span>Review & personalize before sending:</span>
              <span className={`font-mono font-semibold ${wordCount > 120 ? 'text-red-600' : 'text-text-3'}`}>
                {wordCount} / 120 words
              </span>
            </div>
            <textarea
              className="inp text-xs leading-relaxed"
              rows={7}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Advisory message body…"
            />
            {wordCount > 120 && (
              <p className="text-[0.7rem] text-red-600">
                Warning: Advisories should stay concise (under 120 words) for student engagement.
              </p>
            )}
            {err && <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">{err}</div>}
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setStep('draft')}
                className="btn-ghost flex-1 justify-center text-xs"
              >
                ← Regenerate
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving || !draft.trim()}
                className="btn flex-1 justify-center text-xs"
              >
                {approving ? <><span className="spinner" /> Approving…</> : '✓ Approve & Send to Student'}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-2xl">
              ✓
            </div>
            <p className="text-sm font-bold text-accent">
              Advisory Approved & Dispatched
            </p>
            <p className="text-xs text-text-2">
              The student will now be able to read this approved message inside their Student Portal.
            </p>
            <button onClick={onClose} className="btn-ghost btn-sm mt-2">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Deficits() {
  const { id } = useParams()
  const { activeCourseId, activeCourse } = useCourse()
  const courseId = id || activeCourseId

  const [deficits, setDeficits] = useState([])
  const [summary, setSummary] = useState([])
  const [trend, setTrend] = useState({ labels: [], values: [] })
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [modalStudent, setModalStudent] = useState(null)

  const loadData = async () => {
    if (!courseId) return
    setLoading(true)
    setErr('')
    try {
      const [d, s, t] = await Promise.all([
        getDeficits(courseId),
        getSummary(courseId).catch(() => []),
        getAttendanceTrend(courseId).catch(() => ({ labels: [], values: [] }))
      ])
      setDeficits(d)
      setSummary(s)
      setTrend(t.labels ? t : { labels: (t.rows || []).map(r => r.date), values: (t.rows || []).map(r => r.percentage) })
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [courseId])

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

  const criticalCount = summary.filter(r => r.attendance_status === 'Critical').length
  const advisoryCount = summary.filter(r => r.attendance_status === 'Advisory').length
  const safeCount     = summary.filter(r => r.attendance_status === 'Safe').length

  const donutData = {
    labels: ['Critical', 'Advisory', 'Safe'],
    datasets: [{
      data: [criticalCount, advisoryCount, safeCount],
      backgroundColor: ['#c0392b', '#c05621', '#2d6a4f'],
      borderWidth: 2,
      borderColor: '#ffffff',
    }]
  }

  const lineData = {
    labels: trend.labels?.length ? trend.labels : ['Day 1', 'Day 2', 'Day 3'],
    datasets: [{
      label: 'Attendance %',
      data: trend.values?.length ? trend.values : [85, 80, 78],
      borderColor: '#2d6a4f',
      backgroundColor: 'rgba(45, 106, 79, 0.08)',
      fill: true,
      tension: 0.35,
      pointRadius: 3,
      pointBackgroundColor: '#2d6a4f',
    }]
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-text">
          Needs Attention & Deficit Analysis
        </h1>
        <p className="text-xs font-medium text-text-2 mt-0.5">
          {activeCourse ? `${activeCourse.course_code} · ${activeCourse.course_name}` : `Course #${courseId}`}
        </p>
      </div>

      {err && <div className="card bg-red-50 border-red-200 text-red-700 text-sm font-medium py-2.5 px-4">{err}</div>}

      {/* Top Split: Attendance Donut + Trend Line + Quick Stats Grid like before */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Donut Card */}
        <div className="card flex flex-col items-center justify-center p-4">
          <h3 className="font-bold text-xs uppercase tracking-wider text-text-2 mb-2">Attendance Split</h3>
          <div className="w-32 h-32 relative">
            <Doughnut
              data={donutData}
              options={{
                cutout: '70%',
                plugins: { legend: { display: false } },
                maintainAspectRatio: false
              }}
            />
          </div>
          <div className="flex gap-3 text-[0.7rem] font-semibold mt-2">
            <span className="text-red-700">Crit: {criticalCount}</span>
            <span className="text-amber-700">Adv: {advisoryCount}</span>
            <span className="text-emerald-700">Safe: {safeCount}</span>
          </div>
        </div>

        {/* Daily Class Trend Line */}
        <div className="card flex flex-col justify-between p-4">
          <h3 className="font-bold text-xs uppercase tracking-wider text-text-2 mb-1">Daily Class Trend (%)</h3>
          <div className="h-32 w-full relative">
            <Line
              data={lineData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: { min: 0, max: 100, ticks: { stepSize: 25, font: { size: 9 } } },
                  x: { ticks: { font: { size: 9 } } }
                }
              }}
            />
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="card flex flex-col justify-between p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-text-2">Deficit Overview</h3>
            <span className="text-[0.68rem] text-accent font-bold">● Active 3D Engine</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg bg-surface-2 border border-border">
              <div className="text-xl font-bold text-red-700">{criticalCount}</div>
              <div className="text-[0.68rem] font-semibold text-text-2">Critical (&lt;75%)</div>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-2 border border-border">
              <div className="text-xl font-bold text-amber-700">{advisoryCount}</div>
              <div className="text-[0.68rem] font-semibold text-text-2">Advisory (75–85%)</div>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-2 border border-border">
              <div className="text-xl font-bold text-emerald-700">{safeCount}</div>
              <div className="text-[0.68rem] font-semibold text-text-2">Safe (&gt;85%)</div>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-2 border border-border">
              <div className="text-xl font-bold text-text">{deficits.length}</div>
              <div className="text-[0.68rem] font-semibold text-text-2">Flagged Students</div>
            </div>
          </div>
        </div>
      </div>

      {/* Flagged Students Table with Classes to 75% Probability & AI Advisory Action */}
      <div className="card flex flex-col gap-4">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h2 className="font-bold text-sm text-text">
            Flagged Students — Needs Attention ({deficits.length})
          </h2>
          <span className="text-xs text-text-3">Ranked by compound risk priority</span>
        </div>

        {deficits.length === 0 ? (
          <div className="empty-state py-12">
            <div className="text-3xl mb-2">🎉</div>
            <div className="font-semibold text-text">No at-risk students in this course</div>
            <p className="text-xs text-text-2 mt-1">All enrolled students are currently meeting attendance and marks thresholds.</p>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>USN</th>
                  <th>Student Name</th>
                  <th>Attendance</th>
                  <th>Classes to 75%</th>
                  <th>CIE %</th>
                  <th>Flags / Reasons</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {deficits.map(r => {
                  const prob = calcClassesNeeded(r.attended, r.total_classes, 75)
                  const tier = r.priority || r.risk_tier || (r.attendance_pct < 75 ? 'Critical' : 'Advisory')

                  const priorityBadges = {
                    Urgent:   'badge-urgent',
                    Critical: 'badge-critical',
                    Advisory: 'badge-advisory',
                    Safe:     'badge-safe',
                  }
                  const badgeCls = priorityBadges[tier] || 'badge-critical'

                  return (
                    <tr key={r.student_id}>
                      <td>
                        <span className={`badge ${badgeCls}`}>{tier}</span>
                      </td>
                      <td className="font-mono text-xs font-semibold text-text">{r.usn}</td>
                      <td className="font-medium text-text">{r.name}</td>
                      <td>
                        <span className={`font-bold text-xs ${
                          (r.attendance_pct || 0) < 75 ? 'text-red-700' :
                          (r.attendance_pct || 0) <= 85 ? 'text-amber-700' : 'text-emerald-700'
                        }`}>
                          {r.attendance_pct != null ? `${r.attendance_pct.toFixed(1)}%` : 'No Data'}
                        </span>
                      </td>
                      <td>
                        {prob ? (
                          prob.status === 'above' ? (
                            <span className="text-emerald-700 text-xs font-bold">
                              Can miss {prob.canMiss}
                            </span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <span className="text-red-700 text-xs font-bold">
                                Need {prob.needed} more
                              </span>
                              <div className="w-20 h-1.5 rounded-full bg-border overflow-hidden">
                                <div
                                  className="h-full bg-red-600"
                                  style={{ width: `${Math.min(100, (prob.pct / 75) * 100)}%` }}
                                />
                              </div>
                            </div>
                          )
                        ) : (
                          <span className="text-text-3 text-xs">—</span>
                        )}
                      </td>
                      <td>
                        <span className={`text-xs font-bold ${
                          (r.cie_pct || 0) < 40 ? 'text-red-700' : 'text-emerald-700'
                        }`}>
                          {r.cie_pct != null ? `${r.cie_pct.toFixed(1)}%` : '—'}
                        </span>
                      </td>
                      <td className="text-xs text-text-2 max-w-xs leading-normal">
                        {r.reason || r.deficit_reasons?.join(', ') || 'Attendance deficit'}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => setModalStudent(r)}
                          className="btn btn-sm text-xs py-1 px-2.5 font-semibold"
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
        )}
      </div>

      {/* Advisory Modal */}
      {modalStudent && (
        <AdvisoryModal
          student={modalStudent}
          courseId={courseId}
          onClose={() => setModalStudent(null)}
          onApproved={() => {
            setModalStudent(null)
            loadData()
          }}
        />
      )}
    </div>
  )
}
