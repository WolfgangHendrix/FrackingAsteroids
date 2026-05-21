/**
 * The Ledger — endless-mode escalation engine.
 *
 * The Arbiter's enforcement AI keeps a running tally of everything the player
 * strips out of the contested belt. Mining rocks and hauling ore raise the
 * Ledger; the Ledger decides how hard the sector hunts back — how often
 * patrols arrive, how big they are, and how hard they hit. The player drives
 * their own difficulty: play greedy, get hunted harder.
 *
 * All endless-mode tuning lives here so the whole escalation curve can be
 * balanced from one file.
 */

// ---------------------------------------------------------------------------
// Ledger gain
// ---------------------------------------------------------------------------

/** Ledger points added per asteroid destroyed. */
export const LEDGER_PER_ASTEROID = 4

/** Ledger points added per metal chunk hauled in. */
export const LEDGER_PER_METAL = 2

// ---------------------------------------------------------------------------
// Threat tiers — flavour labels shown on the HUD as the Ledger climbs
// ---------------------------------------------------------------------------

export interface LedgerTier {
  /** Ledger value at which this tier begins. */
  at: number
  /** HUD label. */
  label: string
  /** HUD accent colour (hex string). */
  color: string
}

/** Ascending threat tiers. The first entry must start at 0. */
export const LEDGER_TIERS: readonly LedgerTier[] = [
  { at: 0, label: 'UNLISTED', color: '#9ca3af' },
  { at: 70, label: 'FLAGGED', color: '#fbbf24' },
  { at: 180, label: 'WATCHED', color: '#fb923c' },
  { at: 340, label: 'HUNTED', color: '#f87171' },
  { at: 560, label: 'MARKED', color: '#ef4444' },
  { at: 850, label: 'CONDEMNED', color: '#dc2626' },
] as const

export interface LedgerStatus {
  /** Index into LEDGER_TIERS. */
  tier: number
  /** Current tier label. */
  label: string
  /** Current tier accent colour. */
  color: string
  /** 0–1 progress toward the next tier (1 once at the final tier). */
  progress: number
}

/** Resolve a Ledger value to its current threat tier and progress. */
export function ledgerStatus(ledger: number): LedgerStatus {
  let tier = 0
  for (let i = 0; i < LEDGER_TIERS.length; i++) {
    if (ledger >= LEDGER_TIERS[i].at) tier = i
  }
  const cur = LEDGER_TIERS[tier]
  const next = LEDGER_TIERS[tier + 1]
  const progress = next ? (ledger - cur.at) / (next.at - cur.at) : 1
  return {
    tier,
    label: cur.label,
    color: cur.color,
    progress: Math.max(0, Math.min(1, progress)),
  }
}

// ---------------------------------------------------------------------------
// Enemy director — escalating patrols
// ---------------------------------------------------------------------------

/** Seconds between enemy patrol spawns. Shrinks as the Ledger climbs. */
export function patrolInterval(ledger: number): number {
  return Math.max(7, 24 - ledger / 28)
}

/** Enemies per patrol. Grows with the Ledger. */
export function patrolSize(ledger: number): number {
  return Math.min(4, 1 + Math.floor(ledger / 160))
}

/** Per-projectile damage for patrol enemies. Scales gently with the Ledger. */
export function patrolEnemyDamage(ledger: number): number {
  return Math.min(15, 6 + Math.floor(ledger / 140))
}

/** Hard cap on concurrent patrol enemies so the screen never becomes unplayable. */
export const MAX_PATROL_ENEMIES = 8

/** Seconds before the first patrol arrives in a fresh endless run. */
export const FIRST_PATROL_DELAY = 14

// ---------------------------------------------------------------------------
// The Arbiter — recurring boss encounters
// ---------------------------------------------------------------------------

/** Ledger value that triggers the next Arbiter encounter (Mark `mark`). */
export function arbiterThreshold(mark: number): number {
  return 250 + (mark - 1) * 320
}

/** The Ledger is multiplied by this when an Arbiter is destroyed — real relief. */
export const ARBITER_DEFEAT_LEDGER_FACTOR = 0.35

/** The Ledger drops by this flat amount when an Arbiter is merely evaded. */
export const ARBITER_EVADE_LEDGER_RELIEF = 90

// ---------------------------------------------------------------------------
// Run scoring
// ---------------------------------------------------------------------------

/** End-of-run statistics surfaced to the summary screen. */
export interface RunStats {
  /** Arbiters destroyed this run. */
  marksDefeated: number
  /** Highest Ledger value reached this run. */
  peakLedger: number
  /** Seconds survived this run. */
  runTime: number
  /** Composite score (see computeScore). */
  score: number
}

/** Composite run score: peak Ledger plus a heavy bonus per Arbiter destroyed. */
export function computeScore(peakLedger: number, marksDefeated: number): number {
  return Math.round(peakLedger) + marksDefeated * 500
}

// ---------------------------------------------------------------------------
// Field replenishment
// ---------------------------------------------------------------------------

/** Live asteroid count near the player below which the field replenishes. */
export const ASTEROID_FLOOR = 28

/** Asteroids added per replenishment pulse. */
export const ASTEROID_REPLENISH_BATCH = 4

/** Seconds between replenishment pulses while below the floor. */
export const ASTEROID_REPLENISH_INTERVAL = 3
