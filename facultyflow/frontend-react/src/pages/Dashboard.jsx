import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import { getCourses, getDashboard, getUser } from '../api.js'

ChartJS.register(ArcElement, Tooltip, Legend)

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: color || 'var(--text)' }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function RiskDoughnut({ data }) {
  const critical = data.reduce((s, c) => s + (c.critical_count || 0), 0)
  const advisory = data.reduce((s, c) => s + (c.advisory_count || 0), 0)
  const lowCie   = data.reduce((s, c) => s + (c.low_cie_count || 0), 0)
  const safe = Math.max(0, (data.reduce((s, c) => s + (c.total_students || 0), 0)) - critical - advisory)

  return (
    <div className="card flex flex-col gap-4">
      <h3 className="font-semibold text-sm" style={{ color: 'var(--text2)' }}>Risk Distribution</h3>
      <div className="flex items-center gap-6">
        <div style={{ width: 140, height: 140 }}>
          <Doughnut
            data={{
              labels: ['Critical', 'Advisory', 'Low CIE', 'Safe'],
              datasets: [{
                data: [critical, advisory, lowCie, safe],
                backgroundColor: ['#c0392b', '#c05621', '#92400e', '#166534'],
                borderWidth: 2,
                borderColor: '#fff',
              }]
            }}
            options={{
              cutout: '68%',
              plugins: { legend: { display: false }, tooltip: { enabled: true } },
            }}
          />
        </div>
        <div className="flex flex-col gap-2 text-sm">
          {[
            { label: 'Critical', val: critical, color: '#c0392b' },
            { label: 'Advisory', val: advisory, color: '#c05621' },
            { label: 'Low CIE',  val: lowCie,   color: '#92400e' },
            { label: 'Safe',     val: safe,      color: '#166534' },
          ].map(r => (
            <div key={r.label} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: r.color }} />
              <span style={{ color: 'var(--text2)' }}>{r.label}</span>
              <span className="font-bold ml-auto pl-4" style={{ color: 'var(--text)' }}>{r.val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const user = getUser()
  const [courses, setCourses] = useState([])
  const [dash, setDash] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const [c, d] = await Promise.all([getCourses(), getDashboard()])
      setCourses(c)
      setDash(d)
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalStudents = dash.reduce((s, c) => s + (c.total_students || 0), 0)
  const totalCritical = dash.reduce((s, c) => s + (c.critical_count || 0), 0)
  const totalAdvisory = dash.reduce((s, c) => s + (c.advisory_count || 0), 0)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner w-8 h-8" />
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          Welcome, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {err && <div className="card" style={{ color: 'var(--red)', background: 'var(--red-light)' }}>{err}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Courses"  value={courses.length}  sub="assigned" />
        <StatCard label="Students" value={totalStudents}   sub="enrolled" />
        <StatCard label="Critical" value={totalCritical}   sub="below 75%" color="var(--red)" />
        <StatCard label="Advisory" value={totalAdvisory}   sub="75–85%" color="var(--orange)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Courses Table */}
        <div className="lg:col-span-2 card flex flex-col gap-4">
          <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Your Courses</h2>
          {courses.length === 0
            ? <div className="empty-state">No courses assigned yet.</div>
            : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Code</th>
                      <th>Sem</th>
                      <th>Critical</th>
                      <th>Advisory</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map(c => {
                      const d = dash.find(r => r.course_id === c.course_id) || {}
                      return (
                        <tr key={c.course_id}>
                          <td className="font-medium">{c.course_name}</td>
                          <td>{c.course_code}</td>
                          <td>{c.semester}</td>
                          <td>
                            {d.critical_count > 0
                              ? <span className="badge badge-critical">{d.critical_count}</span>
                              : <span style={{ color: 'var(--text3)' }}>—</span>
                            }
                          </td>
                          <td>
                            {d.advisory_count > 0
                              ? <span className="badge badge-advisory">{d.advisory_count}</span>
                              : <span style={{ color: 'var(--text3)' }}>—</span>
                            }
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-1.5">
                              <button className="btn btn-sm" onClick={() => navigate(`/courses/${c.course_id}/deficits`)}>Deficits</button>
                              <button className="btn-ghost btn-sm" onClick={() => navigate(`/courses/${c.course_id}/attendance`)}>Attendance</button>
                              <button className="btn-ghost btn-sm" onClick={() => navigate(`/courses/${c.course_id}/marks`)}>Marks</button>
                              <button className="btn-ghost btn-sm" onClick={() => navigate(`/courses/${c.course_id}/reports`)}>Reports</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>

        {/* Doughnut */}
        {dash.length > 0 && <RiskDoughnut data={dash} />}
      </div>
    </div>
  )
}
