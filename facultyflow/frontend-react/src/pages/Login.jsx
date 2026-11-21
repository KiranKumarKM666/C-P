import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { forgotPassword, login } from '../api.js'

function ThreeLoginVisual() {
  const mountRef = useRef(null)

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.z = 6

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)

    // Cosmic academic node constellation
    const COUNT = 2200
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(COUNT * 3)
    const col = new Float32Array(COUNT * 3)

    for (let i = 0; i < COUNT; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 26
      pos[i * 3 + 1] = (Math.random() - 0.5) * 26
      pos[i * 3 + 2] = (Math.random() - 0.5) * 24

      // Deep emerald and golden amber spectrum
      const isGold = Math.random() < 0.15
      if (isGold) {
        col[i * 3] = 0.85; col[i * 3 + 1] = 0.65; col[i * 3 + 2] = 0.2
      } else {
        col[i * 3] = 0.16; col[i * 3 + 1] = 0.45 + Math.random() * 0.3; col[i * 3 + 2] = 0.32
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))

    const mat = new THREE.PointsMaterial({
      size: 0.07,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    })
    const points = new THREE.Points(geo, mat)
    scene.add(points)

    // Interactive 3D Wireframe Rings
    const torusGeo = new THREE.TorusGeometry(1.8, 0.05, 16, 120)
    const torusMat = new THREE.MeshBasicMaterial({ color: 0x40916c, transparent: true, opacity: 0.28, wireframe: true })
    const torus = new THREE.Mesh(torusGeo, torusMat)
    scene.add(torus)

    const torus2Geo = new THREE.TorusGeometry(2.6, 0.03, 16, 140)
    const torus2Mat = new THREE.MeshBasicMaterial({ color: 0x52b788, transparent: true, opacity: 0.18, wireframe: true })
    const torus2 = new THREE.Mesh(torus2Geo, torus2Mat)
    scene.add(torus2)

    // Central core icosahedron
    const icoGeo = new THREE.IcosahedronGeometry(0.85, 1)
    const icoMat = new THREE.MeshBasicMaterial({ color: 0x74c69d, transparent: true, opacity: 0.2, wireframe: true })
    const ico = new THREE.Mesh(icoGeo, icoMat)
    scene.add(ico)

    let mouse = { x: 0, y: 0 }
    const onMove = (e) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2
      mouse.y = -(e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', onMove)

    let reqId
    let t = 0
    const animate = () => {
      reqId = requestAnimationFrame(animate)
      t += 0.005

      points.rotation.y += 0.0006
      points.rotation.x += 0.0003

      torus.rotation.x = Math.sin(t * 0.6) * 0.4 + mouse.y * 0.2
      torus.rotation.y = t * 0.4 + mouse.x * 0.2

      torus2.rotation.x = Math.cos(t * 0.4) * 0.5 - mouse.y * 0.15
      torus2.rotation.y = -t * 0.3 + mouse.x * 0.15

      ico.rotation.y = t * 0.7
      ico.rotation.z = Math.sin(t * 0.5) * 0.3

      camera.position.x += (mouse.x * 0.6 - camera.position.x) * 0.04
      camera.position.y += (mouse.y * 0.6 - camera.position.y) * 0.04
      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(reqId)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mountRef} className="absolute inset-0 pointer-events-none" />
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotReason, setForgotReason] = useState('')
  const [forgotMsg, setForgotMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    setLoading(true)
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
    <div
      className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at top, #1b4332 0%, #0d2818 45%, #05140c 100%)',
      }}
    >
      <ThreeLoginVisual />

      {/* Floating 3D-styled glass card */}
      <div
        className="relative z-10 w-full max-w-md page-enter"
        style={{
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          borderRadius: '20px',
          padding: '2.75rem 2.25rem',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
        }}
      >
        {/* Brand header */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3 shadow-lg transition-transform hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, rgba(64,145,108,0.7) 0%, rgba(45,106,79,0.9) 100%)',
              border: '1px solid rgba(116,198,157,0.6)',
              boxShadow: '0 8px 24px rgba(45,106,79,0.4)',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d8f3dc" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">FacultyFlow</h1>
          <p className="text-xs uppercase tracking-widest mt-1.5 font-semibold text-accent-light opacity-80">
            Academic Intelligence Platform
          </p>
        </div>

        {/* Login form (Demo credentials block removed as requested) */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-white opacity-80">
              Email Address
            </label>
            <input
              type="email"
              className="w-full text-sm rounded-lg px-3.5 py-2.5 outline-none text-white transition-all focus:border-accent-2"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1.5px solid rgba(255, 255, 255, 0.16)',
              }}
              placeholder="e.g. name@college.edu"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-white opacity-80">
              Password
            </label>
            <input
              type="password"
              className="w-full text-sm rounded-lg px-3.5 py-2.5 outline-none text-white transition-all focus:border-accent-2"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1.5px solid rgba(255, 255, 255, 0.16)',
              }}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {err && (
            <div
              className="text-xs rounded-lg px-3.5 py-2.5 mt-1 border"
              style={{
                background: 'rgba(192, 57, 43, 0.25)',
                color: '#fca5a5',
                borderColor: 'rgba(192, 57, 43, 0.45)',
              }}
            >
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-lg font-semibold text-sm text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg active:scale-[0.99]"
            style={{
              background: 'linear-gradient(135deg, #2d6a4f 0%, #40916c 100%)',
              border: '1px solid rgba(116, 198, 157, 0.3)',
            }}
          >
            {loading ? <span className="spinner" /> : 'Sign In to FacultyFlow →'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-white opacity-40">
          AI drafts; the teacher always decides.
        </div>
        <button type="button" onClick={() => setForgotOpen(true)}
          className="mt-3 w-full text-xs text-accent-light hover:text-white">
          Forgot password? Request help from the HOD
        </button>
      </div>
      {forgotOpen && (
        <div className="modal-backdrop z-50" onClick={e => e.target === e.currentTarget && setForgotOpen(false)}>
          <form className="modal-box flex flex-col gap-3"
            onSubmit={async e => {
              e.preventDefault()
              setForgotMsg('')
              try {
                await forgotPassword({ email: forgotEmail, reason: forgotReason })
                setForgotMsg('Request submitted. The HOD/Admin can resolve it.')
              } catch (ex) {
                setForgotMsg(ex.message)
              }
            }}>
            <h2 className="font-bold text-lg text-text">Password help request</h2>
            <input className="inp" type="email" required value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)} placeholder="Registered email" />
            <textarea className="inp" rows={3} value={forgotReason}
              onChange={e => setForgotReason(e.target.value)} placeholder="Optional reason" />
            {forgotMsg && <div className="text-sm text-accent">{forgotMsg}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setForgotOpen(false)}>Close</button>
              <button type="submit" className="btn">Send request</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
