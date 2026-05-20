'use client'

import type { Cargo, Upgrades } from '@/lib/schemas'
import type { MiningTool } from '@/game/types'

interface HUDProps {
  scrap: number
  cargo: Cargo
  upgrades: Upgrades
  playerHp: number
  playerMaxHp: number
  paused: boolean
  activeTool: MiningTool
  hasLazer: boolean
  onPause: () => void
}

function SilverIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="inline-block"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="5" height="5" rx="1" fill="#c0c0c0" />
      <rect x="7" y="4" width="5" height="5" rx="1" fill="#e8e8e8" />
      <rect x="4" y="7" width="5" height="5" rx="1" fill="#c0c0c0" />
      <rect x="5" y="2" width="4" height="4" rx="1" fill="#e8e8e8" opacity="0.7" />
    </svg>
  )
}

function GoldIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="inline-block"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="5" height="5" rx="1" fill="#ffd700" />
      <rect x="7" y="4" width="5" height="5" rx="1" fill="#daa520" />
      <rect x="4" y="7" width="5" height="5" rx="1" fill="#ffd700" />
      <rect x="5" y="2" width="4" height="4" rx="1" fill="#ffd700" opacity="0.7" />
    </svg>
  )
}

function MiningToolLabel({ activeTool, hasLazer }: { activeTool: MiningTool; hasLazer: boolean }) {
  const toolLabel = activeTool === 'lazer' ? 'LAZER' : 'BLASTER'
  const toolColor = activeTool === 'lazer' ? '#00ccff' : '#ffaa00'
  const isMobile = typeof window !== 'undefined' && 'ontouchstart' in window

  return (
    <div
      className="font-mono font-bold text-[clamp(0.75rem,2vw,0.875rem)]"
      style={{ color: toolColor }}
      data-testid="mining-tool-label"
    >
      {toolLabel}
      {!isMobile && hasLazer && (
        <span className="ml-1 text-white/40 font-normal text-[clamp(0.625rem,1.6vw,0.75rem)]">
          [Q]
        </span>
      )}
    </div>
  )
}

export function HUD({
  scrap,
  cargo,
  upgrades,
  playerHp,
  playerMaxHp,
  paused,
  activeTool,
  hasLazer,
  onPause,
}: HUDProps) {
  const cargoPercent = cargo.capacity > 0 ? Math.round((cargo.fragments / cargo.capacity) * 100) : 0
  const hpPercent = playerMaxHp > 0 ? Math.round((playerHp / playerMaxHp) * 100) : 100
  const hpColor = hpPercent > 50 ? '#00ff88' : hpPercent > 25 ? '#ffaa00' : '#ff4444'
  const showHealth = playerHp < playerMaxHp

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top bar: flex row with resources left, upgrades+pause right */}
      <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-2 sm:p-3 md:p-4 gap-2 sm:gap-4">
        {/* Left: Resources */}
        <div className="flex flex-col gap-1 sm:gap-2 text-[clamp(0.8125rem,2.4vw,1rem)] min-w-0">
          <div className="text-hud-amber font-mono font-bold truncate">SCRAP: {scrap}</div>
          <div className="text-hud-blue font-mono truncate">
            CARGO: {cargo.fragments}/{cargo.capacity} ({cargoPercent}%)
          </div>
          <div className="flex items-center gap-2 sm:gap-3 font-mono text-[clamp(0.75rem,2vw,0.9375rem)]">
            <span className="flex items-center gap-1" style={{ color: '#c0c0c0' }}>
              <SilverIcon size={14} />
              {cargo.silver}
            </span>
            <span className="flex items-center gap-1" style={{ color: '#ffd700' }}>
              <GoldIcon size={14} />
              {cargo.gold}
            </span>
          </div>
          {showHealth && (
            <div className="flex flex-col gap-1">
              <div
                className="font-mono text-[clamp(0.75rem,2vw,0.875rem)]"
                style={{ color: hpColor }}
              >
                HULL: {hpPercent}%
              </div>
              <div
                className="w-20 sm:w-32 h-1.5 sm:h-2 rounded-sm overflow-hidden"
                style={{ backgroundColor: '#333344' }}
              >
                <div
                  className="h-full transition-all duration-200"
                  style={{ width: `${hpPercent}%`, backgroundColor: hpColor }}
                />
              </div>
            </div>
          )}
          <MiningToolLabel activeTool={activeTool} hasLazer={hasLazer} />
        </div>

        {/* Right: Upgrades + Pause */}
        <div className="flex items-start gap-2 sm:gap-4 shrink-0">
          <div className="flex flex-col gap-0.5 sm:gap-1 text-[clamp(0.75rem,2.2vw,0.9375rem)] font-mono text-right">
            <div className="text-hud-red">BLASTER Mk{upgrades.blaster}</div>
            <div className="text-hud-green">COLLECTOR Mk{upgrades.collector}</div>
            <div className="text-hud-blue">STORAGE Mk{upgrades.storage}</div>
          </div>
          <button
            onClick={onPause}
            className="pointer-events-auto relative z-[60] px-2 py-1.5 sm:px-3 sm:py-2 bg-space-800/80 border border-hud-green/30 rounded text-hud-green text-xs sm:text-sm hover:bg-space-700/80 active:scale-95 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={paused ? 'Resume game' : 'Pause game'}
          >
            {paused ? '\u25B6' : 'II'}
          </button>
        </div>
      </div>
    </div>
  )
}
