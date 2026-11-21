import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { login, getToken } from '../api.js'

function ThreeBackground() {
  const mountRef = useRef(null)

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, el.offsetWidth / el.offsetHeight, 0.1, 1000)
    camera.position.z = 5

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(el.offsetWidth, el.offsetHeight)
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)

    // ── Particles ──
    const COUNT = 1800
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(COUNT * 3)
    const col = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      pos[i*3]   = (Math.random() - 0.5) * 20
      pos[i*3+1] = (Math.random() - 0.5) * 20
      pos[i*3+2] = (Math.random() - 0.5) * 20
      const g = 0.17 + Math.random() * 0.3
      col[i*3] = 0.17; col[i*3+1] = g + 0.1; col[i*3+2] = 0.31
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const mat = new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, opacity: 0.8 })
    const points = new THREE.Points(geo, mat)
    scene.add(points)

    // ── Floating torus ──
    const torusGeo = new THREE.TorusGeometry(1.4, 0.04, 16, 100)
    const torusMat = new THREE.MeshBasicMaterial({ color: 0x2d6a4f, transparent: true, opacity: 0.18, wireframe: true })
    const torus = new THREE.Mesh(torusGeo, torusMat)
    scene.add(torus)

    // ── Inner sphere ──
    const sphereGeo = new THREE.SphereGeometry(0.6, 32, 32)
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x40916c, transparent: true, opacity: 0.08, wireframe: true })
    const sphere = new THREE.Mesh(sphereGeo, sphereMat)
    scene.add(sphere)

    let mouse = { x: 0, y: 0 }
    const onMouseMove = (e) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2
      mouse.y = -(e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', onMouseMove)

    let frame
    let t = 0
    const animate = () => {
      frame = requestAnimationFrame(animate)
      t += 0.004
      points.rotation.y += 0.0005
      points.rotation.x += 0.0002
      torus.rotation.x = Math.sin(t * 0.5) * 0.4 + mouse.y * 0.15
      torus.rotation.y = t * 0.3 + mouse.x * 0.15
      sphere.rotation.y = t * 0.5
      sphere.rotation.x = Math.cos(t * 0.3) * 0.3
      camera.position.x += (mouse.x * 0.5 - camera.position.x) * 0.03
      camera.position.y += (mouse.y * 0.5 - camera.position.y) * 0.03
      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      if (!el) return
      camera.aspect = el.offsetWidth / el.offsetHeight
      camera.updateProjectionMatrix()
      renderer.setSize(el.offsetWidth, el.offsetHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mountRef} className="absolute inset-0 w-full h-full" />
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErr(''); setLoading(true)
    try {
      const user = await login(email, password)
      navigate(user.role === 'student' ? '/student' : '/dashboard')
    } catch (ex) {
      setErr(ex.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden"
         style={{ background: 'linear-gradient(135deg,#0d1b2a 0%,#1b4332 60%,#081c15 100%)' }}>
      {/* Three.js Background */}
      <ThreeBackground />

      {/* Glass card */}
      <div className="relative z-10 w-full max-w-sm mx-4" style={{ animation: 'fadeUp 0.4s ease both' }}>
        <div style={{
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: '16px',
          padding: '2.5rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                 style={{ background: 'rgba(45,106,79,0.6)', border: '1px solid rgba(64,145,108,0.5)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d8f3dc" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                <path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">FacultyFlow</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Academic Intelligence Platform
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                     style={{ color: 'rgba(255,255,255,0.6)' }}>Email</label>
              <input
                type="email"
                className="w-full text-sm rounded-lg px-3 py-2.5 outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1.5px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                }}
                placeholder="you@college.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                     style={{ color: 'rgba(255,255,255,0.6)' }}>Password</label>
              <input
                type="password"
                className="w-full text-sm rounded-lg px-3 py-2.5 outline-none"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1.5px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                }}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {err && (
              <div className="text-sm rounded-lg px-3 py-2"
                   style={{ background: 'rgba(192,57,43,0.25)', color: '#fca5a5', border: '1px solid rgba(192,57,43,0.4)' }}>
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all"
              style={{ background: '#2d6a4f', color: '#fff' }}
            >
              {loading ? <span className="spinner" /> : 'Sign in'}
            </button>
          </form>

          {/* Demo creds */}
          <div className="mt-6 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-xs uppercase tracking-wider font-semibold mb-3"
               style={{ color: 'rgba(255,255,255,0.4)' }}>Demo accounts</p>
            {[
              { label: 'Faculty', email: 'meera@college.edu', pass: 'faculty123' },
              { label: 'Admin/HOD', email: 'hod@college.edu', pass: 'admin123' },
              { label: 'Student', email: 'asha@college.edu', pass: 'student123' },
            ].map(d => (
              <button
                key={d.label}
                type="button"
                onClick={() => { setEmail(d.email); setPassword(d.pass) }}
                className="w-full text-left text-xs px-3 py-2 rounded-lg mb-1 transition-all"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.65)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <span className="font-semibold">{d.label}:</span> {d.email}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
