import type { Ship, Upgrades, Cargo } from '@/lib/schemas'

export interface Asteroid {
  id: string
  x: number
  y: number
  velocityX: number
  velocityY: number
  type: AsteroidType
  hp: number
  maxHp: number
  size: number
}

export type AsteroidType = 'common' | 'dense' | 'precious' | 'comet' | 'crystalline'

export type MiningTool = 'blaster' | 'lazer' | 'ripple'
export type ProjectileTool = MiningTool | 'missile'

export interface Fragment {
  id: string
  x: number
  y: number
  velocityX: number
  velocityY: number
  scrapValue: number
  lifetime: number
}

export interface Projectile {
  id: string
  x: number
  y: number
  velocityX: number
  velocityY: number
  damage: number
  tool: ProjectileTool
}

export interface GameEngine {
  ship: Ship
  upgrades: Upgrades
  cargo: Cargo
  asteroids: Asteroid[]
  fragments: Fragment[]
  projectiles: Projectile[]
  paused: boolean
  update(dt: number): void
  fire(targetX: number, targetY: number): void
  upgrade(system: 'blaster' | 'collector' | 'storage'): boolean
}

export interface UpgradeCost {
  tier: number
  cost: number
}

export const BLASTER_COSTS: UpgradeCost[] = [
  { tier: 2, cost: 50 },
  { tier: 3, cost: 150 },
  { tier: 4, cost: 400 },
  { tier: 5, cost: 1000 },
]

export const COLLECTOR_COSTS: UpgradeCost[] = [
  { tier: 2, cost: 40 },
  { tier: 3, cost: 120 },
  { tier: 4, cost: 350 },
  { tier: 5, cost: 900 },
]

export const STORAGE_COSTS: UpgradeCost[] = [
  { tier: 2, cost: 30 },
  { tier: 3, cost: 100 },
  { tier: 4, cost: 300 },
  { tier: 5, cost: 800 },
]
