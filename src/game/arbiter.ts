/**
 * The Arbiter — endless-mode recurring boss.
 *
 * Each time the Ledger crosses a threshold the Arbiter returns as a higher
 * Mark: more hull, faster volleys, more reinforcements. The player chooses
 * each encounter — destroy it for a big payout and Ledger relief, or simply
 * survive until it withdraws.
 *
 * This module owns pure Arbiter logic (state, movement, attacks, collision).
 * Rendering lives in scene.ts; arbiter-model.ts builds the mesh.
 */

import type { Ship } from '@/lib/schemas'
import type { Projectile } from './types'
import { createEnemyProjectile } from './enemy-ship'
import type { EnemyProjectile } from './enemy-ship'
import { PROJECTILE_RADIUS, LAZER_DAMAGE_MULTIPLIER } from './blaster-constants'

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------

/** Collision radius — generous, covering the Arbiter's dense core. */
export const ARBITER_COLLISION_RADIUS = 9

/** Movement speed (units/sec) per phase. */
const ARBITER_SPEED_P1 = 22
const ARBITER_SPEED_P2 = 32

/** Preferred distance the Arbiter holds from the player. */
const ARBITER_ORBIT_DISTANCE = 50

/** Speed the Arbiter retreats at once it gives up the hunt. */
const ARBITER_WITHDRAW_SPEED = 78

/** Distance from the player at which a withdrawing Arbiter is gone for good. */
const ARBITER_WITHDRAW_DISTANCE = 470

/** Arbiter projectile speed (slower than grunts — volume, not velocity). */
const ARBITER_PROJECTILE_SPEED = 95

/** Angular gap between bolts in a volley fan (radians). */
const ARBITER_VOLLEY_SPREAD = 0.26

/** Ominous constant spin rate of the construct (radians/sec). */
const ARBITER_SPIN_RATE = 0.35

/** Seconds the player must survive an encounter before the Arbiter withdraws. */
export const ARBITER_EVADE_TIME = 48

/** Grace period before the Arbiter's first volley. */
const ARBITER_FIRST_VOLLEY_DELAY = 2.5

// --- Per-Mark scaling --------------------------------------------------------

/** Total hull for a given Mark. */
export function arbiterMaxHp(mark: number): number {
  return 220 + (mark - 1) * 160
}

/** Damage dealt by an Arbiter projectile. */
function arbiterProjectileDamage(mark: number): number {
  return 10 + mark * 2
}

/** Seconds between volleys. */
function attackInterval(mark: number, phase: number): number {
  const base = Math.max(1.5, 3.0 - mark * 0.12)
  return phase === 2 ? base * 0.62 : base
}

/** Bolts per volley fan. */
function volleyCount(mark: number, phase: number): number {
  return Math.min(7, (phase === 2 ? 3 : 2) + Math.floor(mark / 2))
}

/** Seconds between reinforcement waves. */
function reinforceInterval(mark: number, phase: number): number {
  const base = Math.max(8, 17 - mark)
  return phase === 2 ? base * 0.65 : base
}

/** Reinforcement enemies per wave. */
export function arbiterReinforceCount(mark: number): number {
  return Math.min(4, 1 + Math.floor(mark / 2))
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface ArbiterState {
  mark: number
  x: number
  y: number
  vx: number
  vy: number
  /** Visual spin angle (radians) — purely cosmetic. */
  rotation: number
  hp: number
  maxHp: number
  /** 1 above half hull, 2 below — phase 2 is faster and more aggressive. */
  phase: 1 | 2
  mode: 'hunting' | 'withdrawing'
  /** Counts up while hunting; at ARBITER_EVADE_TIME the Arbiter withdraws. */
  encounterTimer: number
  attackTimer: number
  reinforceTimer: number
}

/** Spawn a fresh Arbiter of the given Mark at a position. */
export function createArbiterState(mark: number, x: number, y: number): ArbiterState {
  const maxHp = arbiterMaxHp(mark)
  return {
    mark,
    x,
    y,
    vx: 0,
    vy: 0,
    rotation: 0,
    hp: maxHp,
    maxHp,
    phase: 1,
    mode: 'hunting',
    encounterTimer: 0,
    attackTimer: ARBITER_FIRST_VOLLEY_DELAY,
    reinforceTimer: reinforceInterval(mark, 1),
  }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export interface ArbiterUpdate {
  /** Projectiles fired this tick. */
  projectiles: EnemyProjectile[]
  /** Reinforcement enemies to spawn this tick (tick() performs the spawn). */
  reinforcements: number
  /** True the tick the Arbiter has fully withdrawn and should be removed. */
  finishedWithdrawing: boolean
}

/**
 * Advance the Arbiter by one tick: movement, volleys, reinforcement timing,
 * phase transitions, and the evade-timeout that ends the encounter.
 */
export function updateArbiter(arbiter: ArbiterState, player: Ship, dt: number): ArbiterUpdate {
  const result: ArbiterUpdate = { projectiles: [], reinforcements: 0, finishedWithdrawing: false }

  // Cosmetic spin.
  arbiter.rotation += ARBITER_SPIN_RATE * dt

  // --- Withdrawing: flee the player, then signal removal ---
  if (arbiter.mode === 'withdrawing') {
    const dx = arbiter.x - player.x
    const dy = arbiter.y - player.y
    const dist = Math.hypot(dx, dy) || 1
    arbiter.vx = (dx / dist) * ARBITER_WITHDRAW_SPEED
    arbiter.vy = (dy / dist) * ARBITER_WITHDRAW_SPEED
    arbiter.x += arbiter.vx * dt
    arbiter.y += arbiter.vy * dt
    result.finishedWithdrawing = dist > ARBITER_WITHDRAW_DISTANCE
    return result
  }

  // --- Phase transition at half hull ---
  if (arbiter.phase === 1 && arbiter.hp <= arbiter.maxHp / 2) {
    arbiter.phase = 2
    // Tighten timers immediately so phase 2 bites without waiting a full cycle.
    arbiter.attackTimer = Math.min(arbiter.attackTimer, 0.6)
    arbiter.reinforceTimer = Math.min(arbiter.reinforceTimer, 1.5)
  }

  // --- Evade timeout: the player outlasted the Arbiter ---
  arbiter.encounterTimer += dt
  if (arbiter.encounterTimer >= ARBITER_EVADE_TIME) {
    arbiter.mode = 'withdrawing'
    return result
  }

  // --- Movement: hold orbit distance with a tangential drift ---
  const dx = player.x - arbiter.x
  const dy = player.y - arbiter.y
  const dist = Math.hypot(dx, dy) || 1
  const ux = dx / dist
  const uy = dy / dist
  let radial = 0
  if (dist > ARBITER_ORBIT_DISTANCE * 1.15) radial = 1
  else if (dist < ARBITER_ORBIT_DISTANCE * 0.8) radial = -1
  // Perpendicular drift so the Arbiter circles rather than sits still.
  let dirX = ux * radial - uy * 0.55
  let dirY = uy * radial + ux * 0.55
  const dl = Math.hypot(dirX, dirY) || 1
  dirX /= dl
  dirY /= dl
  const speed = arbiter.phase === 2 ? ARBITER_SPEED_P2 : ARBITER_SPEED_P1
  const smooth = 1 - Math.pow(0.0015, dt)
  arbiter.vx += (dirX * speed - arbiter.vx) * smooth
  arbiter.vy += (dirY * speed - arbiter.vy) * smooth
  arbiter.x += arbiter.vx * dt
  arbiter.y += arbiter.vy * dt

  // --- Volley fire ---
  arbiter.attackTimer -= dt
  if (arbiter.attackTimer <= 0) {
    arbiter.attackTimer = attackInterval(arbiter.mark, arbiter.phase)
    const aim = Math.atan2(player.y - arbiter.y, player.x - arbiter.x)
    const n = volleyCount(arbiter.mark, arbiter.phase)
    const damage = arbiterProjectileDamage(arbiter.mark)
    for (let i = 0; i < n; i++) {
      const a = aim + (i - (n - 1) / 2) * ARBITER_VOLLEY_SPREAD
      const muzzle = ARBITER_COLLISION_RADIUS + 2
      result.projectiles.push(
        createEnemyProjectile(
          arbiter.x + Math.cos(a) * muzzle,
          arbiter.y + Math.sin(a) * muzzle,
          Math.cos(a) * ARBITER_PROJECTILE_SPEED,
          Math.sin(a) * ARBITER_PROJECTILE_SPEED,
          damage,
        ),
      )
    }
  }

  // --- Reinforcement waves ---
  arbiter.reinforceTimer -= dt
  if (arbiter.reinforceTimer <= 0) {
    arbiter.reinforceTimer = reinforceInterval(arbiter.mark, arbiter.phase)
    result.reinforcements = arbiterReinforceCount(arbiter.mark)
  }

  return result
}

// ---------------------------------------------------------------------------
// Collision
// ---------------------------------------------------------------------------

/** Squared distance from point (cx,cy) to segment (ax,ay)→(bx,by). */
function pointToSegmentDistSq(
  cx: number,
  cy: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax
  const aby = by - ay
  const lenSq = abx * abx + aby * aby
  if (lenSq < 0.0001) {
    return (cx - ax) ** 2 + (cy - ay) ** 2
  }
  let t = ((cx - ax) * abx + (cy - ay) * aby) / lenSq
  t = Math.max(0, Math.min(1, t))
  const px = ax + t * abx
  const py = ay + t * aby
  return (cx - px) ** 2 + (cy - py) ** 2
}

/** True while the Arbiter can still take damage (alive and not fleeing). */
function arbiterVulnerable(arbiter: ArbiterState): boolean {
  return arbiter.hp > 0 && arbiter.mode === 'hunting'
}

/**
 * Player projectiles vs the Arbiter. Mutates Arbiter hp; returns the
 * surviving projectiles and the ids of those that hit.
 */
export function checkProjectileArbiterCollisions(
  projectiles: Projectile[],
  arbiter: ArbiterState,
): { surviving: Projectile[]; hitProjectileIds: string[] } {
  if (!arbiterVulnerable(arbiter)) return { surviving: projectiles, hitProjectileIds: [] }

  const surviving: Projectile[] = []
  const hitProjectileIds: string[] = []
  const minDist = PROJECTILE_RADIUS + ARBITER_COLLISION_RADIUS
  const minDistSq = minDist * minDist

  for (const p of projectiles) {
    const dx = p.x - arbiter.x
    const dy = p.y - arbiter.y
    if (arbiter.hp > 0 && dx * dx + dy * dy < minDistSq) {
      arbiter.hp = Math.max(0, arbiter.hp - p.damage)
      hitProjectileIds.push(p.id)
    } else {
      surviving.push(p)
    }
  }
  return { surviving, hitProjectileIds }
}

/**
 * Lazer beam vs the Arbiter. Mutates Arbiter hp. Returns whether the beam
 * struck and the parameter `t` along the beam at the Arbiter's centre, so the
 * caller can truncate the rendered beam at the impact.
 */
export function checkBeamArbiterCollisions(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  damage: number,
  arbiter: ArbiterState,
): { hit: boolean; t: number } {
  if (!arbiterVulnerable(arbiter)) return { hit: false, t: 1 }

  const distSq = pointToSegmentDistSq(arbiter.x, arbiter.y, startX, startY, endX, endY)
  if (distSq >= ARBITER_COLLISION_RADIUS * ARBITER_COLLISION_RADIUS) {
    return { hit: false, t: 1 }
  }

  arbiter.hp = Math.max(0, arbiter.hp - damage * LAZER_DAMAGE_MULTIPLIER)

  const dx = endX - startX
  const dy = endY - startY
  const lenSq = dx * dx + dy * dy
  let t = 1
  if (lenSq > 0.0001) {
    t = Math.max(0, Math.min(1, ((arbiter.x - startX) * dx + (arbiter.y - startY) * dy) / lenSq))
  }
  return { hit: true, t }
}
