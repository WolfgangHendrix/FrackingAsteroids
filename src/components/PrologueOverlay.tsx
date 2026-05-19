'use client'

import { useCallback, useEffect, useState } from 'react'
import type { TutorialStep } from '@/hooks/useTutorial'
import { ARBITER_DIALOGUE } from '@/game/prologue-config'

interface PrologueOverlayProps {
  step: TutorialStep
  onSkip: () => void
  onDialogueComplete: () => void
}

/** Auto-fading text that appears then disappears. */
function FadingText({ text, color = 'text-hud-green' }: { text: string; color?: string }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 2500)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <p
      className={`font-mono text-sm sm:text-base ${color} animate-pulse transition-opacity duration-500`}
    >
      {text}
    </p>
  )
}

/** Click-to-advance Arbiter dialogue. Each tap reveals the next line. */
function ArbiterDialogue({ onComplete }: { onComplete: () => void }) {
  const [lineIndex, setLineIndex] = useState(0)
  const allRevealed = lineIndex >= ARBITER_DIALOGUE.length

  const advance = useCallback(() => {
    setLineIndex((i) => {
      const next = i + 1
      if (next >= ARBITER_DIALOGUE.length) {
        // Defer onComplete to avoid setState-during-render
        setTimeout(onComplete, 0)
      }
      return next
    })
  }, [onComplete])

  // Listen for any tap/click/key to advance dialogue
  useEffect(() => {
    if (allRevealed) return

    let handler: ((e: Event) => void) | null = null

    // Small grace period so the tap that triggered this step doesn't advance immediately
    const timerId = setTimeout(() => {
      handler = (e: Event) => {
        e.preventDefault()
        advance()
      }
      window.addEventListener('mousedown', handler, { once: true })
      window.addEventListener('touchstart', handler, { once: true })
      window.addEventListener('keydown', handler, { once: true })
    }, 300)

    return () => {
      clearTimeout(timerId)
      if (handler) {
        window.removeEventListener('mousedown', handler)
        window.removeEventListener('touchstart', handler)
        window.removeEventListener('keydown', handler)
      }
    }
  }, [lineIndex, allRevealed, advance])

  return (
    <div className="flex flex-col items-center gap-3">
      {ARBITER_DIALOGUE.slice(0, lineIndex + 1).map((line, i) => (
        <p
          key={i}
          className={`font-mono text-sm sm:text-lg tracking-wide ${
            i === lineIndex && !allRevealed ? 'text-hud-red animate-pulse' : 'text-hud-red/60'
          }`}
        >
          &quot;{line}&quot;
        </p>
      ))}
      {!allRevealed && (
        <>
          <p className="text-white/40 text-xs mt-2 animate-pulse">Tap to continue</p>
          {/* Invisible focusable target so gamepad A press advances dialogue. */}
          <button
            data-menu-item
            onClick={advance}
            aria-label="Advance dialogue"
            className="pointer-events-auto absolute opacity-0 w-px h-px"
          />
        </>
      )}
    </div>
  )
}

export function PrologueOverlay({ step, onSkip, onDialogueComplete }: PrologueOverlayProps) {
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    setConfirming(false)
  }, [step])

  const handleSkipClick = useCallback(() => {
    if (confirming) {
      onSkip()
    } else {
      setConfirming(true)
    }
  }, [confirming, onSkip])

  const handleCancelSkip = useCallback(() => {
    setConfirming(false)
  }, [])

  // Only show during prologue steps
  if (!step.startsWith('prologue-')) return null

  // Steps that show persistent text in a panel
  const showPanel =
    step === 'prologue-start' ||
    step === 'prologue-arbiter' ||
    step === 'prologue-dialogue' ||
    step === 'prologue-strip'

  return (
    <div className="absolute inset-0 pointer-events-none" data-testid="prologue-overlay">
      {/* Persistent content panel (start, arbiter dialogue, strip) */}
      {showPanel && (
        <div className="absolute top-24 sm:top-28 left-1/2 -translate-x-1/2 w-auto max-w-[80vw] sm:max-w-md px-4 sm:px-6 py-3 sm:py-4 bg-space-800/80 border border-hud-green/30 rounded-lg font-mono text-center">
          {step === 'prologue-start' && (
            <p className="text-hud-green text-sm sm:text-base animate-pulse">
              Systems online. Full power.
            </p>
          )}

          {step === 'prologue-arbiter' && (
            <p className="text-white/60 text-xs uppercase tracking-widest animate-pulse">
              Signal detected
            </p>
          )}

          {step === 'prologue-dialogue' && (
            <div className="space-y-4">
              <ArbiterDialogue onComplete={onDialogueComplete} />
            </div>
          )}

          {step === 'prologue-strip' && (
            <p className="text-hud-red text-sm sm:text-base animate-pulse">Systems failing...</p>
          )}
        </div>
      )}

      {/* Fading text during free-play mining phase */}
      {step === 'prologue-mining' && (
        <div className="absolute top-24 sm:top-28 left-1/2 -translate-x-1/2 font-mono text-center">
          <FadingText text="Clear the field." />
        </div>
      )}

      {/* Tractor beam indicator when the Arbiter takes control */}
      {(step === 'prologue-arbiter' ||
        step === 'prologue-dialogue' ||
        step === 'prologue-strip') && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 font-mono">
          <p className="text-hud-red/50 text-xs uppercase tracking-[0.3em]">
            Stuck in Tractor Beam
          </p>
        </div>
      )}

      {/* Skip button — always visible during prologue */}
      <div className="absolute bottom-8 sm:bottom-12 left-1/2 -translate-x-1/2">
        {!confirming && (
          <button
            data-menu-item
            onClick={handleSkipClick}
            className="pointer-events-auto text-white/30 hover:text-white/60 focus:text-white/90 focus:outline-none focus:ring-2 focus:ring-white/40 rounded text-xs font-mono transition-colors"
            data-testid="prologue-skip"
          >
            SKIP INTRO
          </button>
        )}
        {confirming && (
          <div
            className="flex flex-col items-center gap-2 pointer-events-auto"
            data-testid="prologue-skip-confirm"
          >
            <p className="text-white/50 text-xs font-mono">Skip the intro?</p>
            <div className="flex gap-3">
              <button
                data-menu-item
                onClick={handleSkipClick}
                className="px-3 py-1 text-hud-red text-xs font-mono border border-hud-red/40 rounded hover:bg-hud-red/20 focus:bg-hud-red/30 focus:outline-none focus:ring-2 focus:ring-hud-red transition-colors"
                data-testid="prologue-skip-yes"
              >
                YES
              </button>
              <button
                data-menu-item
                data-menu-back
                onClick={handleCancelSkip}
                className="px-3 py-1 text-white/50 text-xs font-mono border border-white/20 rounded hover:bg-white/10 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40 transition-colors"
                data-testid="prologue-skip-no"
              >
                NO
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
