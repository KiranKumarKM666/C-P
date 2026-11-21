import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { getStudentAdvisories, clearToken, getUser } from '../api.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

function calcClassesNeeded(attended, total, target = 75) {
  if (!total || total === 0) return null
  const pctNow = (attended / total) * 100
  if (pctNow >= target) {
    const canMiss = Math.floor((attended - (target / 100) * total) / (1 - target / 100))
    return { status: 'above', canMiss: Math.max(0, canMiss), pct: pctNow }
  }
  const needed = Math.ceil(((target * total) / 100 - attended) / (1 - target / 100))
  return { status: 'below', needed: Math.max(0, needed), pct: pctNow }
}

function Student3DHero() {
  const mountRef = useRef(null)

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(65, el.clientWidth / el.clientHeight, 0.1, 100)
    camera.position.z = 4.5

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)

    // Floating DNA-like double ring or orbital node
    const group = new THREE.Group()
    scene.add(group)

    const ring1Geo = new THREE.TorusGeometry(1.6, 0.03, 16, 100)
    const ring1Mat = new THREE.MeshBasicMaterial({ color: 0x52b788, wireframe: true, transparent: true, opacity: 0.35 })
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat)
    group.add(ring1)

    const ring2Geo = new THREE.TorusGeometry(1.2, 0.02, 16, 80)
    const ring2Mat = new THREE.MeshBasicMaterial({ color: 0x74c69d, wireframe: true, transparent: true, opacity: 0.25 })
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat)
    ring2.rotation.x = Math.PI / 3
    group.add(ring2)

    const coreGeo = new THREE.OctahedronGeometry(0.5, 0)
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x40916c, wireframe: true, transparent: true, opacity: 0.5 })
    const core = new THREE.Mesh(coreGeo, coreMat)
    group.add(core)

    let reqId
    let t = 0
    const animate = () => {
      reqId = requestAnimationFrame(animate)
      t += 0.01
      group.rotation.y = t * 0.4
      group.rotation.x = Math.sin(t * 0.3) * 0.3
      core.rotation.z = t * 0.6
      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      if (!el) return
      camera.aspect = el.clientWidth / el.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(el.clientWidth, el.clientHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(reqId)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mountRef} className="w-28 h-28 shrink-0" />
}

export default function StudentPortal() {
  const navigate = useNavigate()
  const user = getUser()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    getStudentAdvisories()
      .then(setData)
      .catch(ex => setErr(ex.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSignOut = () => {
    clearToken()
    navigate('/')
  }

  const coursesList = data?.courses || (Array.isArray(data) ? data : [])

  return (
    <div
      className="min-h-screen relative p-4 sm:p-8"
      style={{
        background: 'radial-gradient(ellipse at top, #1b4332 0%, #0d2818 50%, #04120a 100%)',
      }}
    >
      <div className="max-w-4xl mx-auto flex flex-col gap-6 relative z-10 page-enter">
        {/* Header Bar */}
        <header
          className="flex items-center justify-between p-5 rounded-2xl border"
          style={{
            background: 'rgba(255, 255, 255, 0.07)',
            backdropFilter: 'blur(20px)',
            borderColor: 'rgba(255, 255, 255, 0.14)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div className="flex items-center gap-4">
            <Student3DHero />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white tracking-tight">Student Academic Portal</h1>
                <span className="badge text-[0.65rem] bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                  3D Telemetry
                </span>
              </div>
              <p className="text-xs text-white/60 mt-1">
                Student Profile: <b className="text-white">{user?.name}</b> · {user?.email}
              </p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="btn-ghost btn-sm text-xs text-white/80 hover:text-white border-white/20 hover:bg-white/10"
          >
            Sign out
          </button>
        </header>

        {loading && (
          <div className="flex justify-center py-24">
            <div className="spinner w-10 h-10 border-white/30 border-t-emerald-400" />
          </div>
        )}

        {err && (
          <div className="card text-red-300 bg-red-950/40 border-red-800 text-sm p-4">
            {err}
          </div>
        )}

        {coursesList.length === 0 && !loading && (
          <div
            className="card text-center py-16 text-white/60"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'rgba(255, 255, 255, 0.1)',
            }}
          >
            <div className="text-4xl mb-2">🎓</div>
            <div className="font-semibold text-white">No Courses Linked Yet</div>
            <p className="text-xs mt-1 text-white/50">Your faculty advisor will associate your student email with course sections.</p>
          </div>
        )}

        {/* Courses Feed */}
        {coursesList.map(c => {
          const attPct = c.attendance_pct != null ? c.attendance_pct : null
          const attended = c.attended || 0
          const totalClasses = c.total_classes || 0
          const prob = calcClassesNeeded(attended, totalClasses, 75)

          const statusColor = attPct == null ? 'text-white/60' :
                              attPct < 75 ? 'text-red-400' :
                              attPct <= 85 ? 'text-amber-300' : 'text-emerald-400'

          const barColor = attPct == null ? 'bg-white/20' :
                           attPct < 75 ? 'bg-red-500' :
                           attPct <= 85 ? 'bg-amber-500' : 'bg-emerald-500'

          return (
            <div
              key={c.course_id || c.code}
              className="p-6 rounded-2xl border flex flex-col gap-5 transition-all hover:border-white/25"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                backdropFilter: 'blur(16px)',
                borderColor: 'rgba(255, 255, 255, 0.12)',
                boxShadow: '0 12px 36px rgba(0, 0, 0, 0.35)',
              }}
            >
              {/* Course Title Row */}
              <div className="flex items-start justify-between flex-wrap gap-2 pb-3 border-b border-white/10">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    {c.course_name || c.course}
                  </h2>
                  <span className="text-xs font-mono text-white/50">
                    {c.course_code || c.code} · Semester {c.semester || 'Current'}
                  </span>
                </div>

                <span
                  className="badge px-3 py-1 text-xs font-bold"
                  style={{
                    background: (attPct || 0) < 75 ? 'rgba(192, 57, 43, 0.35)' :
                                (attPct || 0) <= 85 ? 'rgba(192, 86, 33, 0.35)' : 'rgba(45, 106, 79, 0.45)',
                    color: (attPct || 0) < 75 ? '#fca5a5' :
                           (attPct || 0) <= 85 ? '#fed7aa' : '#bbf7d0',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                  }}
                >
                  {c.attendance_status || (attPct != null ? (attPct < 75 ? 'Critical' : attPct <= 85 ? 'Advisory' : 'Safe') : 'No Data')}
                </span>
              </div>

              {/* Attendance & Probability Split */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Attendance Rate</span>
                    <span className={`text-2xl font-black ${statusColor}`}>
                      {attPct != null ? `${attPct.toFixed(1)}%` : 'No Data'}
                    </span>
                  </div>

                  <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-700 ${barColor}`}
                      style={{ width: `${Math.min(100, attPct || 0)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-white/50">
                    <span>{attended} attended / {totalClasses} classes conducted</span>
                    <span>Required: 75%</span>
                  </div>

                  {/* Mathematical projection statement like before */}
                  {prob && (
                    <div
                      className="mt-1 p-2.5 rounded-lg border text-xs leading-relaxed"
                      style={{
                        background: prob.status === 'above' ? 'rgba(45, 106, 79, 0.25)' : 'rgba(192, 57, 43, 0.25)',
                        borderColor: prob.status === 'above' ? 'rgba(116, 198, 157, 0.3)' : 'rgba(252, 165, 165, 0.3)',
                        color: prob.status === 'above' ? '#d8f3dc' : '#fecaca',
                      }}
                    >
                      {prob.status === 'above' ? (
                        <span>✓ You can miss up to <b>{prob.canMiss}</b> more classes and remain above 75%.</span>
                      ) : (
                        <span>⚠️ You need to attend <b>{prob.needed}</b> consecutive classes to reach 75%.</span>
                      )}
                    </div>
                  )}
                </div>

                {/* CIE Score Bars */}
                {c.cie_scores && c.cie_scores.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/60">
                      CIE Assessment Breakdown
                    </span>
                    <div className="h-28 w-full">
                      <Bar
                        data={{
                          labels: c.cie_scores.map(s => s.assessment_name),
                          datasets: [{
                            label: '% Score',
                            data: c.cie_scores.map(s => s.pct),
                            backgroundColor: c.cie_scores.map(s => s.pct < 40 ? '#ef4444' : '#52b788'),
                            borderRadius: 6,
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false } },
                          scales: {
                            y: { min: 0, max: 100, ticks: { stepSize: 50, color: 'rgba(255,255,255,0.4)', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.08)' } },
                            x: { ticks: { color: 'rgba(255,255,255,0.6)', font: { size: 9 } }, grid: { display: false } }
                          }
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-xs text-white/40">
                    No CIE assessments recorded yet for this course.
                  </div>
                )}
              </div>

              {/* Approved Faculty Advisories */}
              {c.advisories && c.advisories.length > 0 && (
                <div className="mt-2 pt-3 border-t border-white/10 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-light">
                    <span>💬 Faculty Guidance & Approved Messages</span>
                  </div>
                  {c.advisories.map((a, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border text-xs leading-relaxed"
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        borderColor: 'rgba(255, 255, 255, 0.15)',
                        color: 'rgba(255, 255, 255, 0.9)',
                      }}
                    >
                      <p>{a.final_message || a.message}</p>
                      {a.approved_at && (
                        <span className="block mt-1 text-[0.68rem] text-white/40">
                          Approved: {new Date(a.approved_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
