import * as THREE from 'three'

const RIPPLE_COLOR = 0x77ffcc
const RIPPLE_CORE = 0xffffff

export function createRippleBeam(): THREE.Group {
  const group = new THREE.Group()
  group.visible = false

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: RIPPLE_COLOR,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  group.add(glow)

  const core = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: RIPPLE_CORE,
      transparent: true,
      opacity: 0.36,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  core.position.z = 0.02
  group.add(core)

  return group
}

export function updateRippleBeam(
  beam: THREE.Group,
  visible: boolean,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  elapsed: number,
): void {
  beam.visible = visible
  if (!visible) return

  const dx = endX - startX
  const dy = endY - startY
  const length = Math.hypot(dx, dy)
  if (length < 0.1) {
    beam.visible = false
    return
  }

  beam.position.set((startX + endX) / 2, (startY + endY) / 2, 0.45)
  beam.rotation.z = Math.atan2(dy, dx) - Math.PI / 2

  const pulse = 1 + Math.sin(elapsed * 18) * 0.08
  beam.children[0].scale.set(12 * pulse, length, 1)
  beam.children[1].scale.set(4 * pulse, length, 1)
}

export function disposeRippleBeam(beam: THREE.Group): void {
  beam.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose()
      if (obj.material instanceof THREE.Material) obj.material.dispose()
    }
  })
}
