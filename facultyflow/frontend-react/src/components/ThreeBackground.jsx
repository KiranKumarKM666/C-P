import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function ThreeBackground({ density = 600, speed = 0.0006 }) {
  const mountRef = useRef(null)

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.z = 8

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)

    // Glowing particle field
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(density * 3)
    const colors = new Float32Array(density * 3)

    for (let i = 0; i < density; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 30
      positions[i * 3 + 1] = (Math.random() - 0.5) * 30
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20

      // Emerald / sage green palette
      const hue = Math.random() > 0.4 ? 0.38 : 0.45
      const col = new THREE.Color().setHSL(hue, 0.6, 0.45 + Math.random() * 0.25)
      colors[i * 3]     = col.r
      colors[i * 3 + 1] = col.g
      colors[i * 3 + 2] = col.b
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const mat = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 0.45,
    })
    const points = new THREE.Points(geo, mat)
    scene.add(points)

    // Ambient floating 3D wireframe rings
    const ringGeo1 = new THREE.TorusGeometry(3.2, 0.02, 16, 120)
    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x40916c, transparent: true, opacity: 0.12, wireframe: true })
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1)
    scene.add(ring1)

    const ringGeo2 = new THREE.TorusGeometry(4.8, 0.015, 16, 140)
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x2d6a4f, transparent: true, opacity: 0.08, wireframe: true })
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2)
    scene.add(ring2)

    let mouse = { x: 0, y: 0 }
    let target = { x: 0, y: 0 }
    const onMouseMove = (e) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2
      mouse.y = -(e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', onMouseMove)

    let reqId
    let clock = 0
    const animate = () => {
      reqId = requestAnimationFrame(animate)
      clock += speed

      target.x += (mouse.x - target.x) * 0.03
      target.y += (mouse.y - target.y) * 0.03

      points.rotation.y = clock * 0.5 + target.x * 0.1
      points.rotation.x = clock * 0.2 + target.y * 0.1

      ring1.rotation.x = Math.sin(clock * 0.7) * 0.6 + target.y * 0.2
      ring1.rotation.y = clock * 0.4 + target.x * 0.2

      ring2.rotation.x = Math.cos(clock * 0.5) * 0.5 - target.y * 0.15
      ring2.rotation.y = -clock * 0.3 - target.x * 0.15

      camera.position.x = target.x * 0.4
      camera.position.y = target.y * 0.4

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
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [density, speed])

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.85 }}
    />
  )
}
