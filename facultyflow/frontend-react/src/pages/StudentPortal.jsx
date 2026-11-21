import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { getStudentAdvisories, clearToken, getUser } from '../api.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

function ThreeBg() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(70, el.offsetWidth / el.offsetHeight, 0.1, 100)
    camera.position.z = 4
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(el.offsetWidth, el.offsetHeight)
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)
    // soft particle field
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(600 * 3)
    for (let i = 0; i < 600; i++) {
      pos[i*3]   = (Math.random() - 0.5) * 14
      pos[i*3+1] = (Math.random() - 0.5) * 14
      pos[i*3+2] = (Math.random() - 0.5) * 14
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.05, color: 0x40916c, transparent: true, opacity: 0.5 }))
    scene.add(pts)
    let af; const anim = () => { af = requestAnimationFrame(anim); pts.rotation.y += 0.001; renderer.render(scene, camera) }
    anim()
    return () => { cancelAnimationFrame(af); renderer.dispose(); if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement) }
  }, [])
  return <div ref={ref} className="absolute inset-0" />
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

  const handleSignOut = () => { clearToken(); navigate('/') }

  return (
    <div className="min-h-screen relative overflow-hidden"
         style={{ background: 'linear-gradient(160deg,#081c15 0%,#1b4332 50%,#0d2818 100%)' }}>
      <ThreeBg />
      <div className="relative z-10 max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Student Portal</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Welcome, {user?.name}
            </p>
          </div>
          <button onClick={handleSignOut} className="btn-ghost btn-sm"
                  style={{ color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)' }}>
            Sign out
          </button>
        </div>

        {loading && <div className="flex justify-center py-16"><div className="spinner" /></div>}
        {err && <div className="card mb-4" style={{ color: 'var(--red)', background: 'var(--red-light)' }}>{err}</div>}

        {data && (
          <div className="flex flex-col gap-6">
            {/* Course cards */}
            {data.courses?.map(c => (
              <div key={c.course_id} style={{
                background: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(14px)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 14,
                padding: '1.5rem',
              }}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="font-bold text-white">{c.course_name}</div>
                    <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{c.course_code} · Sem {c.semester}</div>
                  </div>
                  <span className="badge"
                        style={{
                          background: (c.attendance_pct || 0) < 75 ? 'rgba(192,57,43,0.3)' : (c.attendance_pct || 0) < 85 ? 'rgba(192,86,33,0.3)' : 'rgba(22,101,52,0.3)',
                          color: (c.attendance_pct || 0) < 75 ? '#fca5a5' : (c.attendance_pct || 0) < 85 ? '#fdba74' : '#86efac',
                          border: 'none',
                        }}>
                    {c.attendance_pct != null ? c.attendance_pct.toFixed(1) + '% attendance' : 'No data'}
                  </span>
                </div>

                {/* Attendance bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    <span>Attendance</span>
                    <span>{c.attendance_pct != null ? c.attendance_pct.toFixed(1) + '%' : '—'}</span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                         style={{ width: `${Math.min(100, c.attendance_pct || 0)}%`,
                           background: (c.attendance_pct || 0) < 75 ? '#c0392b' : (c.attendance_pct || 0) < 85 ? '#c05621' : '#40916c' }} />
                  </div>
                </div>

                {/* CIE bars */}
                {c.cie_scores?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider mb-2"
                         style={{ color: 'rgba(255,255,255,0.5)' }}>CIE Scores</div>
                    <Bar
                      data={{
                        labels: c.cie_scores.map(s => s.assessment_name),
                        datasets: [{
                          label: 'Score %',
                          data: c.cie_scores.map(s => s.pct),
                          backgroundColor: c.cie_scores.map(s => s.pct < 40 ? 'rgba(192,57,43,0.7)' : 'rgba(64,145,108,0.7)'),
                          borderRadius: 4,
                        }]
                      }}
                      options={{
                        responsive: true,
                        plugins: { legend: { display: false } },
                        scales: {
                          y: { min: 0, max: 100, ticks: { color: 'rgba(255,255,255,0.4)', stepSize: 25 }, grid: { color: 'rgba(255,255,255,0.05)' } },
                          x: { ticks: { color: 'rgba(255,255,255,0.5)' }, grid: { display: false } }
                        }
                      }}
                      height={80}
                    />
                  </div>
                )}

                {/* Approved advisories */}
                {c.advisories?.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2">
                    <div className="text-xs font-semibold uppercase tracking-wider"
                         style={{ color: 'rgba(255,255,255,0.5)' }}>Messages from Faculty</div>
                    {c.advisories.map(a => (
                      <div key={a.advisory_id}
                           style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '0.75rem 1rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{a.final_message}</p>
                        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          {new Date(a.approved_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {!data.courses?.length && (
              <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.4)' }}>
                No courses linked to your account yet.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
