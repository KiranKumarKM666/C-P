import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboard, getUser } from '../api.js'
import { useCourse } from '../context/CourseContext.jsx'
import ThreeHoloSphere from '../components/ThreeHoloSphere.jsx'

export default function Dashboard() {
  const navigate = useNavigate()
  const user = getUser()
  const { setActiveCourseId } = useCourse()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(ex => setErr(ex.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner w-8 h-8" />
      </div>
    )
  }

  const totalStudents = data.reduce((s, c) => s + (c.student_count || c.total_students || 0), 0)
  const totalCritical = data.reduce((s, c) => s + (c.critical || c.critical_count || 0), 0)
  const totalFlagged  = data.reduce((s, c) => s + (c.flagged || 0), 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome Banner */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-text">
            Department Academic Overview
          </h1>
          <p className="text-xs font-medium text-text-2 mt-0.5">
            Welcome back, <b className="text-text">{user?.name}</b> · Continuous Evaluation & Intelligence
          </p>
        </div>
      </div>

      {err && <div className="card bg-red-50 border-red-200 text-red-700 text-sm font-medium py-2.5 px-4">{err}</div>}

      {/* Stats Row + 3D Holographic Sphere */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="stat-card">
          <div className="stat-label">Active Courses</div>
          <div className="stat-value text-accent">{data.length}</div>
          <div className="stat-sub">Assigned curriculum</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Students</div>
          <div className="stat-value text-text">{totalStudents}</div>
          <div className="stat-sub">Enrolled learners</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Critical Attendance</div>
          <div className="stat-value text-red-700">{totalCritical}</div>
          <div className="stat-sub">&lt; 75% threshold</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Flagged</div>
          <div className="stat-value text-amber-700">{totalFlagged}</div>
          <div className="stat-sub">Requiring attention</div>
        </div>

        {/* 3D Interactive Holographic Sphere Component */}
        <div className="sm:col-span-2 lg:col-span-1">
          <ThreeHoloSphere
            label="3D Matrix Health"
            value={`${Math.max(0, 100 - (totalCritical * 4))}%`}
            sub="Neural Monitor"
          />
        </div>
      </div>

      {/* Course Breakdown Table like before */}
      <div className="card flex flex-col gap-4">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div>
            <h2 className="font-bold text-sm text-text">Course Breakdown & Performance</h2>
            <p className="text-xs text-text-2 mt-0.5">Select a course to inspect attendance, scores, and deficits</p>
          </div>
          <span className="badge badge-safe">{data.length} Courses</span>
        </div>

        {data.length === 0 ? (
          <div className="empty-state py-12">
            <div className="text-3xl mb-2">📚</div>
            <div className="font-semibold text-text">No courses assigned yet</div>
            <p className="text-xs text-text-2 mt-1">Courses created in the Admin panel will appear here.</p>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Course Code & Name</th>
                  <th>Faculty</th>
                  <th className="text-center">Students</th>
                  <th className="text-center">Critical</th>
                  <th className="text-center">Advisory</th>
                  <th className="text-center">Low CIE</th>
                  <th className="text-center">Flagged</th>
                  <th className="text-right">Jump to</th>
                </tr>
              </thead>
              <tbody>
                {data.map(c => {
                  const crit = c.critical || c.critical_count || 0
                  const adv  = c.advisory || c.advisory_count || 0
                  const low  = c.low_cie || c.low_cie_count || 0
                  const flag = c.flagged || 0

                  return (
                    <tr key={c.course_id} className="hover:bg-surface-2 transition-colors">
                      <td>
                        <div className="flex flex-col">
                          <span className="font-bold text-xs text-text">{c.course_code}</span>
                          <span className="text-xs text-text-2 font-medium">{c.course_name}</span>
                        </div>
                      </td>
                      <td className="text-xs font-medium text-text-2">{c.faculty_name || 'Assigned'}</td>
                      <td className="text-center font-bold text-xs text-text">{c.student_count || c.total_students || 0}</td>
                      <td className="text-center">
                        {crit > 0 ? (
                          <span className="badge badge-critical text-[0.68rem]">{crit}</span>
                        ) : (
                          <span className="text-text-3 text-xs">—</span>
                        )}
                      </td>
                      <td className="text-center">
                        {adv > 0 ? (
                          <span className="badge badge-advisory text-[0.68rem]">{adv}</span>
                        ) : (
                          <span className="text-text-3 text-xs">—</span>
                        )}
                      </td>
                      <td className="text-center">
                        {low > 0 ? (
                          <span className="badge badge-urgent text-[0.68rem]">{low}</span>
                        ) : (
                          <span className="text-text-3 text-xs">—</span>
                        )}
                      </td>
                      <td className="text-center">
                        {flag > 0 ? (
                          <span className="font-bold text-xs text-red-700">{flag}</span>
                        ) : (
                          <span className="text-emerald-700 text-xs font-bold">0</span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCourseId(c.course_id)
                              navigate('/attendance')
                            }}
                            className="btn-ghost btn-sm text-[0.7rem] py-1 px-2"
                          >
                            Attendance
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCourseId(c.course_id)
                              navigate('/marks')
                            }}
                            className="btn-ghost btn-sm text-[0.7rem] py-1 px-2"
                          >
                            Marks
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCourseId(c.course_id)
                              navigate('/deficits')
                            }}
                            className="btn btn-sm text-[0.7rem] py-1 px-2 font-semibold"
                          >
                            Deficits
                          </button>
                        </div>
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
