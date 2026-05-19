'use client'

import { useState, useEffect, useCallback } from 'react'
import { SAVE_SLOT_IDS, SaveSlotSummarySchema } from '@/lib/schemas'
import type { SaveSlotId, SaveSlotSummary } from '@/lib/schemas'
import { useGamepadMenu } from '@/hooks/useGamepadMenu'

const SLOTS_STORAGE_KEY = 'fracking-asteroids-slot-summaries'

interface StartScreenProps {
  onNewGame: (slotId: SaveSlotId) => void
  onLoadGame: (slotId: SaveSlotId) => void
}

function loadSlotSummaries(): Map<SaveSlotId, SaveSlotSummary> {
  if (typeof window === 'undefined') return new Map()
  try {
    const raw = localStorage.getItem(SLOTS_STORAGE_KEY)
    if (!raw) return new Map()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Map()
    const map = new Map<SaveSlotId, SaveSlotSummary>()
    for (const item of parsed) {
      const result = SaveSlotSummarySchema.safeParse(item)
      if (result.success) {
        map.set(result.data.slotId, result.data)
      }
    }
    return map
  } catch {
    return new Map()
  }
}

export function saveSlotSummary(summary: SaveSlotSummary): void {
  const map = loadSlotSummaries()
  map.set(summary.slotId, summary)
  localStorage.setItem(SLOTS_STORAGE_KEY, JSON.stringify([...map.values()]))
}

export function clearSlotSummary(slotId: SaveSlotId): void {
  const map = loadSlotSummaries()
  map.delete(slotId)
  localStorage.setItem(SLOTS_STORAGE_KEY, JSON.stringify([...map.values()]))
}

type ScreenMode = 'main' | 'new-game' | 'load-game'

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function SlotLabel({ index }: { index: number }) {
  return <span className="text-hud-green font-bold">SLOT {index + 1}</span>
}

export function StartScreen({ onNewGame, onLoadGame }: StartScreenProps) {
  const [mode, setMode] = useState<ScreenMode>('main')
  const [summaries, setSummaries] = useState<Map<SaveSlotId, SaveSlotSummary>>(new Map())
  const [confirmSlot, setConfirmSlot] = useState<SaveSlotId | null>(null)

  useEffect(() => {
    setSummaries(loadSlotSummaries())
  }, [])

  // Gamepad navigation: D-pad/left stick moves focus, A clicks focused button,
  // B clicks the back/cancel button. resetKey re-anchors focus on view changes.
  useGamepadMenu({
    enabled: true,
    resetKey: `${mode}:${confirmSlot ?? ''}`,
  })

  const handleBack = useCallback(() => {
    setMode('main')
    setConfirmSlot(null)
  }, [])

  const handleNewGameSlot = useCallback(
    (slotId: SaveSlotId) => {
      if (summaries.has(slotId)) {
        setConfirmSlot(slotId)
      } else {
        onNewGame(slotId)
      }
    },
    [summaries, onNewGame],
  )

  const handleConfirmOverwrite = useCallback(() => {
    if (confirmSlot) {
      clearSlotSummary(confirmSlot)
      onNewGame(confirmSlot)
    }
  }, [confirmSlot, onNewGame])

  const populatedSlots = SAVE_SLOT_IDS.filter((id) => summaries.has(id))

  return (
    <div className="absolute inset-0 bg-space-900 flex flex-col items-center justify-center z-50">
      {/* Background atmosphere — three drifting star layers, asteroid silhouettes,
          shooting stars, scanline overlay. Stays behind everything else. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Far stars — many, small, dim, slowest drift */}
        <div
          className="menu-starfield-far absolute"
          style={{ inset: '0 -30% 0 0' }}
          aria-hidden="true"
        >
          {Array.from({ length: 60 }, (_, i) => (
            <div
              key={`far-${i}`}
              className="absolute rounded-full bg-white"
              style={{
                width: '1px',
                height: '1px',
                top: `${(i * 37) % 100}%`,
                left: `${(i * 53) % 130}%`,
                opacity: 0.25 + (i % 4) * 0.1,
              }}
            />
          ))}
        </div>

        {/* Mid stars — fewer, slightly larger */}
        <div
          className="menu-starfield-mid absolute"
          style={{ inset: '0 -40% 0 0' }}
          aria-hidden="true"
        >
          {Array.from({ length: 28 }, (_, i) => (
            <div
              key={`mid-${i}`}
              className="absolute rounded-full bg-white"
              style={{
                width: '2px',
                height: '2px',
                top: `${(i * 41) % 100}%`,
                left: `${(i * 59) % 130}%`,
                opacity: 0.45 + (i % 3) * 0.15,
              }}
            />
          ))}
        </div>

        {/* Near stars — fewest, brightest, with twinkle */}
        <div
          className="menu-starfield-near absolute"
          style={{ inset: '0 -60% 0 0' }}
          aria-hidden="true"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={`near-${i}`}
              className="menu-star-twinkle absolute rounded-full bg-white"
              style={{
                width: '3px',
                height: '3px',
                top: `${(i * 43) % 100}%`,
                left: `${(i * 71) % 130}%`,
                animationDelay: `${(i * 0.7) % 4}s`,
                boxShadow: '0 0 4px rgba(255,255,255,0.6)',
              }}
            />
          ))}
        </div>

        {/* Drifting asteroid silhouettes — sparse, behind everything */}
        {Array.from({ length: 6 }, (_, i) => {
          // Deterministic per index so SSR matches the client render.
          const size = 40 + ((i * 17) % 50) // 40–90px
          const top = `${(i * 23 + 5) % 85}%`
          const duration = 55 + ((i * 13) % 35) // 55–90s
          const delay = -((i * 11) % duration) // stagger so they're already on-screen
          return (
            <div
              key={`asteroid-${i}`}
              className="menu-asteroid"
              aria-hidden="true"
              style={{
                width: `${size}px`,
                height: `${size}px`,
                top,
                left: 0,
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`,
              }}
            />
          )
        })}

        {/* Shooting stars — two staggered streaks */}
        <div
          className="menu-shooting-star"
          style={{ animationDelay: '2s', top: '15%' }}
          aria-hidden="true"
        />
        <div
          className="menu-shooting-star"
          style={{ animationDelay: '6.5s', top: '40%' }}
          aria-hidden="true"
        />
      </div>

      {/* Scanline overlay — above background, below menu chrome */}
      <div className="menu-scanlines" aria-hidden="true" />

      {/* Title */}
      <h1 className="menu-title font-mono text-4xl md:text-6xl font-bold text-hud-green mb-2 tracking-widest text-center relative">
        FRACKING
        <br />
        ASTEROIDS
      </h1>
      <p className="font-mono text-sm md:text-base text-hud-amber/70 mb-12 relative">
        Blast. Collect. Scrap. Upgrade.
      </p>

      {/* Main Menu */}
      {mode === 'main' && (
        <div className="flex flex-col gap-4 relative">
          <button
            data-menu-item
            onClick={() => setMode('new-game')}
            className="px-8 py-4 bg-space-800/80 border border-hud-green/50 rounded text-hud-green font-mono text-lg hover:bg-space-700/80 hover:border-hud-green focus:bg-space-700/80 focus:border-hud-green focus:outline-none focus:ring-2 focus:ring-hud-green focus:scale-[1.02] active:scale-95 transition-all min-w-[220px]"
          >
            NEW GAME
          </button>
          <button
            data-menu-item
            onClick={() => setMode('load-game')}
            disabled={populatedSlots.length === 0}
            className="px-8 py-4 bg-space-800/80 border border-hud-blue/50 rounded text-hud-blue font-mono text-lg hover:bg-space-700/80 hover:border-hud-blue focus:bg-space-700/80 focus:border-hud-blue focus:outline-none focus:ring-2 focus:ring-hud-blue focus:scale-[1.02] active:scale-95 transition-all min-w-[220px] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-space-800/80 disabled:hover:border-hud-blue/50"
          >
            LOAD GAME
          </button>
        </div>
      )}

      {/* New Game Slot Picker */}
      {mode === 'new-game' && !confirmSlot && (
        <div className="flex flex-col gap-3 relative w-full max-w-sm px-4">
          <p className="font-mono text-sm text-white/60 text-center mb-2">Select a save slot</p>
          {SAVE_SLOT_IDS.map((slotId, i) => {
            const summary = summaries.get(slotId)
            return (
              <button
                key={slotId}
                data-menu-item
                onClick={() => handleNewGameSlot(slotId)}
                className="px-6 py-3 bg-space-800/80 border border-hud-green/30 rounded font-mono text-sm hover:bg-space-700/80 hover:border-hud-green/60 focus:bg-space-700/80 focus:border-hud-green focus:outline-none focus:ring-2 focus:ring-hud-green active:scale-[0.98] transition-all text-left"
              >
                <SlotLabel index={i} />
                {summary ? (
                  <span className="text-white/50 ml-3">{formatDate(summary.timestamp)}</span>
                ) : (
                  <span className="text-white/30 ml-3">Empty</span>
                )}
              </button>
            )
          })}
          <button
            data-menu-item
            data-menu-back
            onClick={handleBack}
            className="mt-2 px-6 py-2 text-white/40 font-mono text-sm hover:text-white/70 focus:text-white focus:outline-none focus:ring-2 focus:ring-white/40 rounded transition-colors"
          >
            BACK
          </button>
        </div>
      )}

      {/* Confirm Overwrite */}
      {mode === 'new-game' && confirmSlot && (
        <div className="flex flex-col gap-4 items-center relative">
          <p className="font-mono text-sm text-hud-red text-center">
            This slot has saved data.
            <br />
            Start a new game and overwrite it?
          </p>
          <div className="flex gap-4">
            <button
              data-menu-item
              onClick={handleConfirmOverwrite}
              className="px-6 py-3 bg-space-800/80 border border-hud-red/50 rounded text-hud-red font-mono text-sm hover:bg-space-700/80 hover:border-hud-red focus:bg-space-700/80 focus:border-hud-red focus:outline-none focus:ring-2 focus:ring-hud-red active:scale-95 transition-all"
            >
              OVERWRITE
            </button>
            <button
              data-menu-item
              data-menu-back
              onClick={() => setConfirmSlot(null)}
              className="px-6 py-3 bg-space-800/80 border border-white/20 rounded text-white/60 font-mono text-sm hover:bg-space-700/80 hover:text-white/80 focus:bg-space-700/80 focus:text-white focus:outline-none focus:ring-2 focus:ring-white/40 active:scale-95 transition-all"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Load Game Slot Picker */}
      {mode === 'load-game' && (
        <div className="flex flex-col gap-3 relative w-full max-w-sm px-4">
          <p className="font-mono text-sm text-white/60 text-center mb-2">Select a save to load</p>
          {SAVE_SLOT_IDS.map((slotId, i) => {
            const summary = summaries.get(slotId)
            const isEmpty = !summary
            return (
              <button
                key={slotId}
                data-menu-item
                onClick={() => !isEmpty && onLoadGame(slotId)}
                disabled={isEmpty}
                className="px-6 py-3 bg-space-800/80 border border-hud-blue/30 rounded font-mono text-sm hover:bg-space-700/80 hover:border-hud-blue/60 focus:bg-space-700/80 focus:border-hud-blue focus:outline-none focus:ring-2 focus:ring-hud-blue active:scale-[0.98] transition-all text-left disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-space-800/80 disabled:hover:border-hud-blue/30"
              >
                <SlotLabel index={i} />
                {summary ? (
                  <span className="text-white/50 ml-3">{formatDate(summary.timestamp)}</span>
                ) : (
                  <span className="text-white/30 ml-3">Empty</span>
                )}
              </button>
            )
          })}
          <button
            data-menu-item
            data-menu-back
            onClick={handleBack}
            className="mt-2 px-6 py-2 text-white/40 font-mono text-sm hover:text-white/70 focus:text-white focus:outline-none focus:ring-2 focus:ring-white/40 rounded transition-colors"
          >
            BACK
          </button>
        </div>
      )}
    </div>
  )
}
