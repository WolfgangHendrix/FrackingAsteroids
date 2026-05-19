'use client'

import { useEffect, useRef } from 'react'

/**
 * Edge-detected single-button polling for the first connected gamepad.
 *
 * Each animation frame, checks `pad.buttons[buttonIndex].pressed`. Fires
 * `onPress` on the rising edge only (not while held). Standard Gamepad
 * mapping: button 0 = A, 1 = B, 9 = Start.
 */
export function useGamepadButton(
  buttonIndex: number,
  onPress: () => void,
  enabled: boolean = true,
): void {
  const onPressRef = useRef(onPress)
  useEffect(() => {
    onPressRef.current = onPress
  }, [onPress])

  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined') return
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return

    let prev = false
    let raf = 0
    const tick = (): void => {
      raf = requestAnimationFrame(tick)
      const pads = Array.from(navigator.getGamepads())
      const pad = pads.find((p) => p && p.connected) ?? null
      if (!pad) {
        prev = false
        return
      }
      const pressed = pad.buttons[buttonIndex]?.pressed ?? false
      if (pressed && !prev) onPressRef.current()
      prev = pressed
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [buttonIndex, enabled])
}
