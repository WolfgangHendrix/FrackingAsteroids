'use client'

import { useEffect, useRef } from 'react'

/**
 * Gamepad-driven menu navigation.
 *
 * Polls the first connected gamepad each frame while mounted. Up/down (D-pad
 * or left stick) moves DOM focus between elements with `data-menu-item`,
 * skipping disabled ones. A (button 0) clicks the focused element. B
 * (button 1) clicks the element tagged `data-menu-back`, if any.
 *
 * Focus is reset to the first item whenever `resetKey` changes — pass a key
 * that encodes the visible screen (e.g. mode + confirmation state) so focus
 * lands sensibly after each transition.
 */

const BUTTON_A = 0
const BUTTON_B = 1
const DPAD_UP = 12
const DPAD_DOWN = 13
const AXIS_LEFT_Y = 1
const STICK_THRESHOLD = 0.6

interface UseGamepadMenuOptions {
  enabled: boolean
  resetKey: string
}

function focusableItems(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[data-menu-item]:not([disabled])'),
  )
}

function moveFocus(delta: number): void {
  const items = focusableItems()
  if (items.length === 0) return
  const current = document.activeElement
  const idx = current instanceof HTMLElement ? items.indexOf(current) : -1
  const base = idx === -1 ? (delta > 0 ? -1 : 0) : idx
  const next = (base + delta + items.length) % items.length
  items[next].focus()
}

function focusFirst(): void {
  const items = focusableItems()
  if (items.length > 0) items[0].focus()
}

export function useGamepadMenu({ enabled, resetKey }: UseGamepadMenuOptions): void {
  // Reset DOM focus when the visible menu changes.
  useEffect(() => {
    if (!enabled) return
    // Defer one tick so the new DOM has mounted before we query for items.
    const id = window.setTimeout(focusFirst, 0)
    return () => window.clearTimeout(id)
  }, [enabled, resetKey])

  const prev = useRef({ a: false, b: false, up: false, down: false })

  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined') return
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return

    let raf = 0
    const tick = (): void => {
      raf = requestAnimationFrame(tick)
      const pads = Array.from(navigator.getGamepads())
      const pad = pads.find((p) => p && p.connected) ?? null
      if (!pad) {
        prev.current = { a: false, b: false, up: false, down: false }
        return
      }

      const aDown = pad.buttons[BUTTON_A]?.pressed ?? false
      const bDown = pad.buttons[BUTTON_B]?.pressed ?? false
      const stickY = pad.axes[AXIS_LEFT_Y] ?? 0
      const upDown = (pad.buttons[DPAD_UP]?.pressed ?? false) || stickY < -STICK_THRESHOLD
      const downDown = (pad.buttons[DPAD_DOWN]?.pressed ?? false) || stickY > STICK_THRESHOLD

      if (upDown && !prev.current.up) moveFocus(-1)
      if (downDown && !prev.current.down) moveFocus(+1)

      if (aDown && !prev.current.a) {
        const el = document.activeElement
        if (
          el instanceof HTMLElement &&
          el.matches('[data-menu-item]') &&
          !(el as HTMLButtonElement).disabled
        ) {
          ;(el as HTMLButtonElement).click()
        }
      }

      if (bDown && !prev.current.b) {
        const back = document.querySelector<HTMLButtonElement>('[data-menu-back]:not([disabled])')
        if (back) back.click()
      }

      prev.current = { a: aDown, b: bDown, up: upDown, down: downDown }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [enabled])
}
