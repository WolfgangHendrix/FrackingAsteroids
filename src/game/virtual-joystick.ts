import type { InputState, AimState } from './input'

const JOYSTICK_DEAD_ZONE = 10
const JOYSTICK_MAX_RADIUS = 50
const BASE_RADIUS = 60
const KNOB_RADIUS = 24

/** Deadzone for the aim stick before it starts aiming/firing. */
const AIM_DEAD_ZONE = 12
/**
 * Aim point offset from canvas centre, as a fraction of min(width, height).
 * Mirrors gamepad.ts so touch and controller aiming behave identically.
 */
const AIM_SCREEN_RADIUS_FACTOR = 0.4

export interface VirtualJoystick {
  attach: () => void
  detach: () => void
}

/** Right-side aim stick — drives AimState and reports firing intent. */
export interface AimJoystick {
  attach: () => void
  detach: () => void
  /** Re-applies aim to AimState and reports whether to fire this frame. */
  poll: () => { firing: boolean }
}

function createOverlay(
  container: HTMLElement,
  rgb: readonly [number, number, number],
): {
  base: HTMLElement
  knob: HTMLElement
  show: (x: number, y: number) => void
  move: (dx: number, dy: number) => void
  hide: () => void
  destroy: () => void
} {
  const [r, g, b] = rgb
  const base = document.createElement('div')
  base.style.cssText =
    `position:absolute;width:${BASE_RADIUS * 2}px;height:${BASE_RADIUS * 2}px;` +
    `border-radius:50%;border:2px solid rgba(${r},${g},${b},0.3);` +
    `background:rgba(${r},${g},${b},0.07);pointer-events:none;` +
    `display:none;transform:translate(-50%,-50%);z-index:10;`

  const knob = document.createElement('div')
  knob.style.cssText =
    `position:absolute;width:${KNOB_RADIUS * 2}px;height:${KNOB_RADIUS * 2}px;` +
    `border-radius:50%;background:rgba(${r},${g},${b},0.4);` +
    `left:50%;top:50%;transform:translate(-50%,-50%);`

  base.appendChild(knob)
  container.appendChild(base)

  return {
    base,
    knob,
    show(x: number, y: number) {
      base.style.display = 'block'
      base.style.left = `${x}px`
      base.style.top = `${y}px`
      knob.style.left = '50%'
      knob.style.top = '50%'
    },
    move(dx: number, dy: number) {
      const dist = Math.sqrt(dx * dx + dy * dy)
      const clamped = Math.min(dist, JOYSTICK_MAX_RADIUS)
      const scale = dist > 0 ? clamped / dist : 0
      const offsetX = dx * scale
      const offsetY = dy * scale
      knob.style.left = `calc(50% + ${offsetX}px)`
      knob.style.top = `calc(50% + ${offsetY}px)`
    },
    hide() {
      base.style.display = 'none'
    },
    destroy() {
      if (base.parentElement) base.parentElement.removeChild(base)
    },
  }
}

/**
 * Creates a virtual joystick that writes to an InputState and renders
 * a visible base + knob overlay. Active only on touch devices — the
 * left half of the container acts as the joystick area. A touch-start
 * anchors the joystick center, then dragging sets the direction.
 */
export function createVirtualJoystick(
  inputState: InputState,
  container: HTMLElement,
): VirtualJoystick {
  let activeId: number | null = null
  let originX = 0
  let originY = 0

  const overlay = createOverlay(container, [255, 255, 255])

  function isLeftHalf(touch: Touch): boolean {
    const rect = container.getBoundingClientRect()
    return touch.clientX - rect.left < rect.width / 2
  }

  function updateDirection(touch: Touch): void {
    const dx = touch.clientX - originX
    const dy = touch.clientY - originY

    overlay.move(dx, dy)

    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < JOYSTICK_DEAD_ZONE) {
      inputState.up = false
      inputState.down = false
      inputState.left = false
      inputState.right = false
      inputState.joystickAngle = null
      return
    }

    // Normalize to max radius
    const nx = dx / Math.max(dist, JOYSTICK_MAX_RADIUS)
    const ny = dy / Math.max(dist, JOYSTICK_MAX_RADIUS)

    // Map to cardinal directions with 0.3 threshold for diagonals
    inputState.right = nx > 0.3
    inputState.left = nx < -0.3
    inputState.down = ny > 0.3 // screen Y is inverted vs game Y
    inputState.up = ny < -0.3

    // Store precise angle for smooth 360° ship rotation.
    // Screen coords: dx is right, dy is down. Game coords: +Y is up.
    // Ship rotation formula: atan2(-game_dx, game_dy) = atan2(-dx, -dy)
    inputState.joystickAngle = Math.atan2(-dx, -dy)
  }

  function onTouchStart(e: TouchEvent): void {
    if (activeId !== null) return
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      if (isLeftHalf(touch)) {
        activeId = touch.identifier
        originX = touch.clientX
        originY = touch.clientY

        const rect = container.getBoundingClientRect()
        overlay.show(touch.clientX - rect.left, touch.clientY - rect.top)

        e.preventDefault()
        return
      }
    }
  }

  function onTouchMove(e: TouchEvent): void {
    if (activeId === null) return
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      if (touch.identifier === activeId) {
        updateDirection(touch)
        e.preventDefault()
        return
      }
    }
  }

  function resetAndHide(): void {
    activeId = null
    inputState.up = false
    inputState.down = false
    inputState.left = false
    inputState.right = false
    inputState.joystickAngle = null
    overlay.hide()
  }

  function onTouchEnd(e: TouchEvent): void {
    if (activeId === null) return
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      if (touch.identifier === activeId) {
        resetAndHide()
        return
      }
    }
  }

  return {
    attach() {
      container.addEventListener('touchstart', onTouchStart, { passive: false })
      container.addEventListener('touchmove', onTouchMove, { passive: false })
      container.addEventListener('touchend', onTouchEnd)
      container.addEventListener('touchcancel', onTouchEnd)
    },
    detach() {
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
      container.removeEventListener('touchcancel', onTouchEnd)
      activeId = null
      inputState.up = false
      inputState.down = false
      inputState.left = false
      inputState.right = false
      inputState.joystickAngle = null
      overlay.destroy()
    },
  }
}

/**
 * Creates the right-side aim stick for twin-stick touch play. A touch-start
 * on the right half of the container anchors the stick; dragging sets the aim
 * direction and fires. While engaged it writes a screen-space aim point into
 * AimState (mirroring the gamepad right stick) so the turret tracks it and the
 * shared fire logic engages — letting the player shoot independently of the
 * direction the ship is travelling.
 */
export function createAimJoystick(aimState: AimState, container: HTMLElement): AimJoystick {
  let activeId: number | null = null
  let originX = 0
  let originY = 0
  let curX = 0
  let curY = 0
  /** Whether this stick currently owns AimState (so release only clears its own). */
  let owns = false

  const overlay = createOverlay(container, [255, 170, 0])

  function isRightHalf(touch: Touch): boolean {
    const rect = container.getBoundingClientRect()
    return touch.clientX - rect.left >= rect.width / 2
  }

  function onTouchStart(e: TouchEvent): void {
    if (activeId !== null) return
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      if (isRightHalf(touch)) {
        activeId = touch.identifier
        originX = curX = touch.clientX
        originY = curY = touch.clientY

        const rect = container.getBoundingClientRect()
        overlay.show(touch.clientX - rect.left, touch.clientY - rect.top)

        e.preventDefault()
        return
      }
    }
  }

  function onTouchMove(e: TouchEvent): void {
    if (activeId === null) return
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      if (touch.identifier === activeId) {
        curX = touch.clientX
        curY = touch.clientY
        overlay.move(curX - originX, curY - originY)
        e.preventDefault()
        return
      }
    }
  }

  function onTouchEnd(e: TouchEvent): void {
    if (activeId === null) return
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeId) {
        activeId = null
        overlay.hide()
        return
      }
    }
  }

  /** Drop our claim on AimState if we currently hold it. */
  function releaseAim(): void {
    if (owns) {
      aimState.active = false
      owns = false
    }
  }

  return {
    attach() {
      container.addEventListener('touchstart', onTouchStart, { passive: false })
      container.addEventListener('touchmove', onTouchMove, { passive: false })
      container.addEventListener('touchend', onTouchEnd)
      container.addEventListener('touchcancel', onTouchEnd)
    },
    detach() {
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
      container.removeEventListener('touchcancel', onTouchEnd)
      activeId = null
      releaseAim()
      overlay.destroy()
    },
    poll() {
      if (activeId === null) {
        releaseAim()
        return { firing: false }
      }

      const dx = curX - originX
      const dy = curY - originY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < AIM_DEAD_ZONE) {
        // Touching but not aiming yet — hold fire.
        releaseAim()
        return { firing: false }
      }

      // Project the drag direction onto a screen point offset from canvas
      // centre; screenToWorld() in scene.ts turns this into an aim bearing.
      const w = container.clientWidth
      const h = container.clientHeight
      const radius = Math.min(w, h) * AIM_SCREEN_RADIUS_FACTOR
      aimState.screenX = w / 2 + (dx / dist) * radius
      aimState.screenY = h / 2 + (dy / dist) * radius
      aimState.active = true
      owns = true
      return { firing: true }
    },
  }
}
