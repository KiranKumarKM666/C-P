import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function ThreeHoloSphere({ label = 'System Health', value = '98.4%', sub = 'Optimal' }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const width = el.clientWidth || 220
    const height = el.clientHeight || 180

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100)
    camera.position.z = 4.2

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)

    // Inner icosahedron / core
    const coreGeo = new THREE.IcosahedronGeometry(1.0, 1)
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x40916c,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    })
    const core = new THREE.Mesh(coreGeo, coreMat)
    scene.add(core)

    // Central glow sphere
    const glowGeo = new THREE.SphereGeometry(0.65, 24, 24)
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x2d6a4f,
      transparent: true,
      opacity: 0.25,
      wireframe: true,
    })
    const glow = new THREE.Mesh(glowGeo, glowMat)
    scene.add(glow)

    // Orbiting data nodes
    const orbitGroup = new THREE.Group()
    scene.add(orbitGroup)

    const satellites = []
    const satGeo = new THREE.SphereGeometry(0.08, 12, 12)
    const satMat = new THREE.MeshBasicMaterial({ color: 0x74c69d })

    for (let i = 0; i < 4; i++) {
      const sat = new THREE.Mesh(satGeo, satMat)
      const angle = (i / 4) * Math.PI * 2
      sat.position.set(Math.cos(angle) * 1.6, Math.sin(angle) * 0.5, Math.sin(angle) * 1.6)
      orbitGroup.add(sat)
      satellites.push({ mesh: sat, angle, speed: 0.02 + i * 0.005, radius: 1.6 })
    }

    // Outer faint ring
    const ringGeo = new THREE.RingGeometry(1.58, 1.62, 48)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x52b788, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI / 2.3
    scene.add(ring)

    let mouse = { x: 0, y: 0 }
    const onMove = (e) => {
      const rect = el.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / width - 0.5) * 2
      mouse.y = -((e.clientY - rect.top) / height - 0.5) * 2
    }
    el.addEventListener('mousemove', onMove)

    let reqId
    let t = 0
    const animate = () => {
      reqId = requestAnimationFrame(animate)
      t += 0.015

      core.rotation.x = t * 0.4 + mouse.y * 0.3
      core.rotation.y = t * 0.6 + mouse.x * 0.3

      glow.rotation.y = -t * 0.5
      ring.rotation.z = t * 0.2

      satellites.forEach(s => {
        s.angle += s.speed
        s.mesh.position.x = Math.cos(s.angle) * s.radius
        s.mesh.position.z = Math.sin(s.angle) * s.radius
        s.mesh.position.y = Math.sin(s.angle * 2) * 0.4
      })

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      if (!el) return
      const w = el.clientWidth || 220
      const h = el.clientHeight || 180
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(reqId)
      el.removeEventListener('mousemove', onMove)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div className="card flex flex-col items-center justify-between relative overflow-hidden p-4 group">
      <div className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-text-2 mb-1 z-10">
        <span>{label}</span>
        <span className="flex items-center gap-1 text-accent font-bold">
          <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
          Active 3D
        </span>
      </div>
      <div ref={containerRef} className="w-full h-36 flex items-center justify-center cursor-grab active:cursor-grabbing" />
      <div className="w-full flex items-baseline justify-between mt-1 z-10 pt-2 border-t border-border">
        <span className="text-xl font-bold text-text">{value}</span>
        <span className="text-xs font-medium text-accent-2">{sub}</span>
      </div>
    </div>
  )
}
