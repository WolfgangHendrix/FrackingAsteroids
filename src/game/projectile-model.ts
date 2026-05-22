import * as THREE from 'three'
import type { ProjectileTool } from './types'
import { PROJECTILE_COLOR, PROJECTILE_CORE_COLOR } from './blaster-constants'

/** Voxel size for projectile bolts — small and punchy. */
const BOLT_VOXEL = 0.4

/** Lazer bolt colors — cyan/magenta energy beam. */
const LAZER_COLOR = 0x00ccff
const LAZER_CORE_COLOR = 0x88eeff
const MISSILE_COLOR = 0xfff2a0
const MISSILE_CORE_COLOR = 0xff5533

function addVoxel(group: THREE.Group, x: number, y: number, z: number, color: number): void {
  const geo = new THREE.BoxGeometry(BOLT_VOXEL, BOLT_VOXEL, BOLT_VOXEL)
  const mat = new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    emissive: color,
    emissiveIntensity: 0.6,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x * BOLT_VOXEL, y * BOLT_VOXEL, z * BOLT_VOXEL)
  group.add(mesh)
}

/**
 * Build a voxel-style mining laser bolt (3 voxels long, 1 wide).
 * Oriented along +Y (ship forward). Amber with a bright core.
 */
export function createProjectileModel(tool: ProjectileTool = 'blaster'): THREE.Group {
  const bolt = new THREE.Group()
  const outerColor =
    tool === 'missile' ? MISSILE_COLOR : tool === 'lazer' ? LAZER_COLOR : PROJECTILE_COLOR
  const coreColor =
    tool === 'missile'
      ? MISSILE_CORE_COLOR
      : tool === 'lazer'
        ? LAZER_CORE_COLOR
        : PROJECTILE_CORE_COLOR

  // Tail
  addVoxel(bolt, 0, -1, 0, outerColor)
  // Core (bright center)
  addVoxel(bolt, 0, 0, 0, coreColor)
  // Tip
  addVoxel(bolt, 0, 1, 0, outerColor)

  return bolt
}
