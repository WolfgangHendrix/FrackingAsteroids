/**
 * Arbiter comms — pure presentation helpers for the endless-mode boss.
 *
 * This module has NO dependencies (no Three.js) so it is safe to import from
 * React components and the server-rendered page bundle.
 */

/** Boss-bar info surfaced to the HUD while an Arbiter encounter is active. */
export interface ArbiterHudInfo {
  mark: number
  hp: number
  maxHp: number
  phase: number
}

/** Render a positive integer as a Roman numeral (X repeats past 39). */
export function romanNumeral(n: number): string {
  let x = Math.floor(n)
  if (x <= 0) return '0'
  const table: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]
  let out = ''
  for (const [value, sym] of table) {
    while (x >= value) {
      out += sym
      x -= value
    }
  }
  return out
}

/**
 * The Arbiter's arrival comms — a bureaucratic enforcement AI that never
 * raises its voice, only escalates its paperwork.
 */
const ARRIVAL_LINES: Record<number, string> = {
  1: 'Unlicensed extraction logged. Asset recovery authorised.',
  2: 'You are operating beyond salvage value. Cease.',
  3: 'Recovery cost now exceeds asset worth. Liquidation advised.',
  4: 'You were a rounding error. You have become a line item.',
}

/** Line shown when an Arbiter Mark enters the sector. */
export function arbiterArrivalLine(mark: number): string {
  return ARRIVAL_LINES[mark] ?? 'Query: why do you persist.'
}

/** Line shown when the player destroys an Arbiter. */
export function arbiterDefeatLine(mark: number): string {
  return `Arbiter unit Mark ${romanNumeral(mark)} disabled. Recalculating.`
}

/** Line shown when an Arbiter gives up and withdraws. */
export function arbiterWithdrawLine(mark: number): string {
  return `Arbiter Mark ${romanNumeral(mark)} withdrawing. The ledger does not forget.`
}
