/**
 * Arbiter tractor beam visual — a glowing capture cone with a traveling
 * "wave" band that pulses out from the Arbiter toward the player.
 *
 * Pure rendering: the cone geometry/orientation here mirror the capture
 * logic in arbiter.ts (TRACTOR_RANGE / TRACTOR_CONE_HALF_ANGLE).
 */

import * as THREE from 'three'
import { TRACTOR_RANGE, TRACTOR_CONE_HALF_ANGLE } from './arbiter'

const FIELD_COLOR = 0x33ddff
const WAVE_COLOR = 0x99f7ff
/** Seconds for one capture wave to travel apex → tip. */
const WAVE_PERIOD = 0.7
/** Thickness of the traveling wave band (world units). */
const WAVE_THICKNESS = 7

export interface TractorBeam {
  group: THREE.Group
  fieldMat: THREE.MeshBasicMaterial
  wave: THREE.Mesh
  waveMat: THREE.MeshBasicMaterial
}

/**
 * Build the tractor beam: a translucent cone "field" plus a brighter wave
 * band. Geometry points along local +X with the apex at the group origin,
 * so the group can simply be placed at the Arbiter and rotated to aim.
 */
export function createTractorBeam(): TractorBeam {
  const group = new THREE.Group()
  group.visible = false

  const halfW = TRACTOR_RANGE * Math.tan(TRACTOR_CONE_HALF_ANGLE)

  // --- Cone field ---
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.lineTo(TRACTOR_RANGE, halfW)
  shape.lineTo(TRACTOR_RANGE, -halfW)
  shape.closePath()
  const fieldMat = new THREE.MeshBasicMaterial({
    color: FIELD_COLOR,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  })
  const field = new THREE.Mesh(new THREE.ShapeGeometry(shape), fieldMat)
  field.renderOrder = 3
  group.add(field)

  // --- Traveling capture wave ---
  const waveMat = new THREE.MeshBasicMaterial({
    color: WAVE_COLOR,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  })
  const wave = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), waveMat)
  wave.renderOrder = 4
  group.add(wave)

  return { group, fieldMat, wave, waveMat }
}

/**
 * Position, orient, and animate the tractor beam. `elapsed` is the active
 * beam's age (seconds) — drives the field pulse and the traveling wave.
 */
export function updateTractorBeam(
  beam: TractorBeam,
  active: boolean,
  originX: number,
  originY: number,
  angle: number,
  elapsed: number,
): void {
  beam.group.visible = active
  if (!active) return

  beam.group.position.set(originX, originY, 0.25)
  beam.group.rotation.z = angle

  // Field opacity pulses to read as a live energy field.
  beam.fieldMat.opacity = 0.13 + 0.08 * Math.sin(elapsed * 9)

  // Wave band travels apex → tip on a loop, widening to match the cone.
  const travel = ((elapsed % WAVE_PERIOD) / WAVE_PERIOD) * TRACTOR_RANGE
  const widthAt = Math.max(3, 2 * travel * Math.tan(TRACTOR_CONE_HALF_ANGLE))
  beam.wave.position.x = travel
  beam.wave.scale.set(WAVE_THICKNESS, widthAt, 1)
  beam.waveMat.opacity = 0.6 * (1 - (travel / TRACTOR_RANGE) * 0.55)
}

export function disposeTractorBeam(beam: TractorBeam): void {
  beam.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose()
      if (obj.material instanceof THREE.Material) obj.material.dispose()
    }
  })
}
