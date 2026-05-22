import * as THREE from 'three'

const SPARK_COLORS = [0xfff2a0, 0xff8833, 0xff3322, 0x99f7ff] as const
const SPARK_DURATION = 0.38

export interface EnemyDamageSparks {
  group: THREE.Group
  particles: {
    mesh: THREE.Mesh
    vx: number
    vy: number
    vz: number
    spin: number
  }[]
  elapsed: number
  duration: number
}

export function createEnemyDamageSparks(
  x: number,
  y: number,
  radius: number,
  count: number,
): EnemyDamageSparks {
  const group = new THREE.Group()
  group.position.set(x, y, 2)
  const particles: EnemyDamageSparks['particles'] = []

  for (let i = 0; i < count; i++) {
    const color = SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)]
    const size = 0.45 + Math.random() * 0.55
    const geo = new THREE.BoxGeometry(size, size, size)
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(geo, mat)
    const angle = Math.random() * Math.PI * 2
    const spawnRadius = radius * (0.15 + Math.random() * 0.7)
    mesh.position.set(
      Math.cos(angle) * spawnRadius,
      Math.sin(angle) * spawnRadius,
      Math.random() * 3,
    )
    group.add(mesh)

    const speed = 16 + Math.random() * 34
    particles.push({
      mesh,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      vz: 8 + Math.random() * 18,
      spin: (Math.random() - 0.5) * 14,
    })
  }

  return { group, particles, elapsed: 0, duration: SPARK_DURATION }
}

export function updateEnemyDamageSparks(sparks: EnemyDamageSparks, dt: number): boolean {
  sparks.elapsed += dt
  const t = Math.min(1, sparks.elapsed / sparks.duration)
  const fade = 1 - t

  for (const p of sparks.particles) {
    p.mesh.position.x += p.vx * dt
    p.mesh.position.y += p.vy * dt
    p.mesh.position.z += p.vz * dt
    p.vz -= 55 * dt
    p.mesh.rotation.z += p.spin * dt
    p.mesh.scale.setScalar(0.7 + fade * 0.5)
    const mat = p.mesh.material
    if (mat instanceof THREE.MeshBasicMaterial) mat.opacity = fade
  }

  return sparks.elapsed < sparks.duration
}

export function disposeEnemyDamageSparks(sparks: EnemyDamageSparks): void {
  sparks.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose()
      if (obj.material instanceof THREE.Material) obj.material.dispose()
    }
  })
}
