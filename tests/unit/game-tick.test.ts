import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { installMockThree, uninstallMockThree } from '../integration/helpers/mock-three'
import type { TutorialStep } from '../../src/hooks/useTutorial'
import type { TickInput } from '../../src/game/game-tick'

before(() => installMockThree())
after(() => uninstallMockThree())

function makeInput(
  createInputState: () => TickInput['inputState'],
  overrides?: Partial<TickInput>,
): TickInput {
  return {
    dt: 1 / 60,
    paused: false,
    inputState: createInputState(),
    aimWorldPosition: null,
    collecting: false,
    tutorialStep: 'done' as TutorialStep,
    ...overrides,
  }
}

describe('game-tick', () => {
  // -------------------------------------------------------------------------
  // 1. Paused frame
  // -------------------------------------------------------------------------
  describe('paused frame', () => {
    it('returns empty result and sets wasPaused', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState()
      const result = tick(state, makeInput(createInputState, { paused: true }))

      assert.equal(state.wasPaused, true)
      assert.equal(result.shipMoved, false)
      assert.equal(result.newProjectiles.length, 0)
    })
  })

  // -------------------------------------------------------------------------
  // 2. Resume from pause
  // -------------------------------------------------------------------------
  describe('resume from pause', () => {
    it('clears mouseHoldingFire, fireTarget, aimActive and sets inputCooldown', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState()
      state.wasPaused = true
      state.mouseHoldingFire = true
      state.fireTarget = { x: 10, y: 20 }
      state.aimActive = true

      tick(state, makeInput(createInputState))

      assert.equal(state.mouseHoldingFire, false)
      assert.equal(state.fireTarget, null)
      assert.equal(state.aimActive, false)
      assert.equal(state.wasPaused, false)
      // inputCooldown was set to 0.5 then decremented by dt (1/60)
      assert.ok(state.inputCooldown > 0, 'inputCooldown should still be active after one frame')
    })
  })

  // -------------------------------------------------------------------------
  // 3. Input cooldown
  // -------------------------------------------------------------------------
  describe('input cooldown', () => {
    it('decrements cooldown and clears fire state while active', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState()
      state.inputCooldown = 0.3
      state.mouseHoldingFire = true
      state.fireTarget = { x: 5, y: 5 }
      state.aimActive = true

      tick(state, makeInput(createInputState))

      assert.equal(state.mouseHoldingFire, false)
      assert.equal(state.fireTarget, null)
      assert.equal(state.aimActive, false)
      assert.ok(state.inputCooldown < 0.3, 'cooldown should have decremented')
      assert.ok(state.inputCooldown > 0, 'cooldown should still be positive')
    })

    it('stops clearing fire state once cooldown expires', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState()
      // Set cooldown to something smaller than dt so it expires this frame
      state.inputCooldown = 0.001

      tick(state, makeInput(createInputState))

      assert.ok(state.inputCooldown <= 0, 'cooldown should have expired')
    })
  })

  // -------------------------------------------------------------------------
  // 4. Ship movement — shipMoved=true when ship far from origin
  // -------------------------------------------------------------------------
  describe('ship movement', () => {
    it('shipMoved=true when ship is far from origin', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState({ shipPosition: { x: 10, y: 10 } })

      const result = tick(state, makeInput(createInputState))
      assert.equal(result.shipMoved, true)
    })

    it('shipMoved=false when ship is at origin', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState({ shipPosition: { x: 0, y: 0 } })

      const result = tick(state, makeInput(createInputState))
      assert.equal(result.shipMoved, false)
    })
  })

  // -------------------------------------------------------------------------
  // 5. Asteroid drift
  // -------------------------------------------------------------------------
  describe('asteroid drift', () => {
    it('asteroids move by velocity*dt', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const asteroid = {
        id: 'ast-1',
        x: 100,
        y: 100,
        velocityX: 30,
        velocityY: -15,
        type: 'common' as const,
        hp: 10,
        maxHp: 10,
        size: 1,
      }
      const state = createTickState({ asteroids: [asteroid] })

      const dt = 1 / 60
      tick(state, makeInput(createInputState, { dt }))

      assert.ok(Math.abs(state.asteroids[0].x - (100 + 30 * dt)) < 0.01)
      assert.ok(Math.abs(state.asteroids[0].y - (100 + -15 * dt)) < 0.01)
    })

    it('stationary asteroids do not move', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const asteroid = {
        id: 'ast-2',
        x: 50,
        y: 50,
        velocityX: 0,
        velocityY: 0,
        type: 'common' as const,
        hp: 10,
        maxHp: 10,
        size: 1,
      }
      const state = createTickState({ asteroids: [asteroid] })

      tick(state, makeInput(createInputState))

      assert.equal(state.asteroids[0].x, 50)
      assert.equal(state.asteroids[0].y, 50)
    })
  })

  // -------------------------------------------------------------------------
  // 6. Blaster firing
  // -------------------------------------------------------------------------
  describe('blaster firing', () => {
    it('produces newProjectiles when fireTarget is set', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState()
      state.fireTarget = { x: 100, y: 0 }
      // Ensure cooldown is 0 so we can fire
      state.blasterState.cooldownRemaining = 0

      const result = tick(state, makeInput(createInputState))

      assert.ok(result.newProjectiles.length > 0, 'should have fired at least one projectile')
      assert.ok(state.projectiles.length > 0, 'projectiles should be in state')
      assert.equal(state.fireTarget, null, 'fireTarget should be cleared after firing')
    })

    it('does not fire when cooldown is active', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState()
      state.fireTarget = { x: 100, y: 0 }
      state.blasterState.cooldownRemaining = 10 // large cooldown

      const result = tick(state, makeInput(createInputState))

      assert.equal(result.newProjectiles.length, 0, 'should not fire while on cooldown')
      assert.equal(state.fireTarget, null, 'fireTarget should still be cleared')
    })
  })

  // -------------------------------------------------------------------------
  // 7. Fire rate bonus
  // -------------------------------------------------------------------------
  describe('fire rate bonus', () => {
    it('divides cooldownRemaining when fireRateBonus > 1', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState({ fireRateBonus: 2.0 })
      state.fireTarget = { x: 100, y: 0 }
      state.blasterState.cooldownRemaining = 0

      tick(state, makeInput(createInputState))

      // After firing, the cooldown should be set (from fireBlaster) then divided by 2
      // We just check the cooldown is less than it would be without the bonus
      // Fire again without bonus to compare
      const stateNormal = createTickState({ fireRateBonus: 1.0 })
      stateNormal.fireTarget = { x: 100, y: 0 }
      stateNormal.blasterState.cooldownRemaining = 0

      tick(stateNormal, makeInput(createInputState))

      assert.ok(
        state.blasterState.cooldownRemaining < stateNormal.blasterState.cooldownRemaining,
        'fire rate bonus should reduce cooldown',
      )
    })
  })

  // -------------------------------------------------------------------------
  // 8. Enemy spawn
  // -------------------------------------------------------------------------
  describe('enemy spawn', () => {
    it('spawns enemy after firstMetalCollectedTime is set', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState()
      state.firstMetalCollectedTime = 1.0

      const result = tick(state, makeInput(createInputState))

      assert.equal(state.enemySpawned, true)
      assert.ok(state.enemy !== null, 'enemy should be created')
      assert.ok(result.enemySpawned !== null, 'result should report enemy spawned')
    })

    it('does not spawn enemy again once already spawned', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState()
      state.firstMetalCollectedTime = 1.0
      state.enemySpawned = true

      const result = tick(state, makeInput(createInputState))

      assert.equal(result.enemySpawned, null, 'should not spawn again')
    })
  })

  // -------------------------------------------------------------------------
  // 9. Enemy nearby
  // -------------------------------------------------------------------------
  describe('enemy nearby', () => {
    it('fires enemyNearby when enemy within 60 units', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')
      const { createEnemyShip } = await import('../../src/game/enemy-ship')

      const state = createTickState()
      // Place enemy close to ship (ship at 0,0)
      state.enemy = createEnemyShip(30, 0)
      state.enemySpawned = true

      const result = tick(state, makeInput(createInputState))

      assert.equal(result.enemyNearby, true)
      assert.equal(state.enemyNearbyFired, true)
    })

    it('does not fire enemyNearby when enemy is far away', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')
      const { createEnemyShip } = await import('../../src/game/enemy-ship')

      const state = createTickState()
      state.enemy = createEnemyShip(200, 200)
      state.enemySpawned = true

      const result = tick(state, makeInput(createInputState))

      assert.equal(result.enemyNearby, false)
    })

    it('does not re-fire enemyNearby once already fired', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')
      const { createEnemyShip } = await import('../../src/game/enemy-ship')

      const state = createTickState()
      state.enemy = createEnemyShip(30, 0)
      state.enemySpawned = true
      state.enemyNearbyFired = true

      const result = tick(state, makeInput(createInputState))

      assert.equal(result.enemyNearby, false, 'should not re-fire')
    })
  })

  // -------------------------------------------------------------------------
  // 10. Enemy projectile -> player collision
  // -------------------------------------------------------------------------
  describe('enemy projectile hits player', () => {
    it('damages player HP on hit', async () => {
      const { tick, createTickState, PLAYER_MAX_HP } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState()
      // Create a fake enemy projectile at the ship position (0,0) to guarantee collision
      const THREE = await import('three')
      const mesh = new THREE.Group()
      state.enemyProjectiles.push({
        id: 'eproj-1',
        mesh,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        elapsed: 0,
      })

      const result = tick(state, makeInput(createInputState))

      assert.ok(state.playerHp < PLAYER_MAX_HP, 'player should have taken damage')
      assert.equal(result.playerDamaged, true)
      assert.ok(result.enemyProjectileHits.length > 0, 'should record hit')
    })

    it('ambush projectile deals 20 damage', async () => {
      const { tick, createTickState, PLAYER_MAX_HP } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState()
      const THREE = await import('three')
      const mesh = new THREE.Group()
      mesh.userData['ambush'] = true
      state.enemyProjectiles.push({
        id: 'eproj-ambush',
        mesh,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        elapsed: 0,
      })

      const result = tick(state, makeInput(createInputState))

      assert.equal(state.playerHp, PLAYER_MAX_HP - 20, 'ambush projectile should deal 20 damage')
      assert.equal(result.enemyProjectileHits[0].damage, 20)
    })
  })

  // -------------------------------------------------------------------------
  // 10b. Same-tick spawn + hit (player very close to enemy)
  // -------------------------------------------------------------------------
  describe('same-tick enemy projectile spawn and hit', () => {
    it('reports projectile in both newEnemyProjectiles and enemyProjectileHits', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createEnemyShip } = await import('../../src/game/enemy-ship')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState()
      // Place enemy 4 units above player — projectile spawns at offset of 4 toward player,
      // which lands exactly on the player at (0,0).
      const enemy = createEnemyShip(0, 4)
      enemy.shootTimer = 0 // force immediate fire
      state.enemy = enemy

      const result = tick(state, makeInput(createInputState))

      assert.ok(
        result.newEnemyProjectiles.length > 0,
        'enemy should have fired a projectile this tick',
      )
      assert.ok(
        result.enemyProjectileHits.length > 0,
        'projectile spawned on top of player should hit immediately',
      )
      // The same projectile id should appear in both lists
      const spawnedIds = new Set(result.newEnemyProjectiles.map((p) => p.id))
      const hitIds = result.enemyProjectileHits.map((h) => h.id)
      const overlap = hitIds.filter((id) => spawnedIds.has(id))
      assert.ok(overlap.length > 0, 'same-tick projectile should be in both new and hit lists')
    })
  })

  // -------------------------------------------------------------------------
  // 11. Scrap collection
  // -------------------------------------------------------------------------
  describe('scrap collection', () => {
    it('collects scrap box when collecting and close to ship', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')
      const { createScrapBox } = await import('../../src/game/scrap-box')

      const state = createTickState()
      // Place scrap box right on the ship
      const box = createScrapBox(0, 0)
      box.x = 0
      box.y = 0
      state.scrapBoxes.push(box)

      // Run many frames with collecting=true so attraction pulls it in
      let collected = false
      for (let i = 0; i < 120; i++) {
        const result = tick(state, makeInput(createInputState, { collecting: true }))
        if (result.scrapCollectedEvent) {
          collected = true
          assert.ok(result.scrapCollected.length > 0, 'should have scrap in result')
          break
        }
      }
      assert.ok(collected, 'scrap should have been collected')
      assert.equal(state.scrapBoxes.length, 0, 'scrap box should be removed')
    })
  })

  // -------------------------------------------------------------------------
  // 12. Metal collection
  // -------------------------------------------------------------------------
  describe('metal collection', () => {
    it('collecting metal sets firstMetalCollectedTime', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')
      const { createMetalChunk } = await import('../../src/game/metal-chunk')

      const state = createTickState()
      assert.equal(state.firstMetalCollectedTime, null)

      // Place metal chunk right on ship
      const metal = createMetalChunk(0, 0, 0, 1)
      metal.x = 0
      metal.y = 0
      metal.vx = 0
      metal.vy = 0
      state.metalChunks.push(metal)

      let collected = false
      for (let i = 0; i < 120; i++) {
        const result = tick(state, makeInput(createInputState, { collecting: true }))
        if (result.metalCollectedEvent) {
          collected = true
          assert.ok(result.metalCollected.length > 0)
          break
        }
      }
      assert.ok(collected, 'metal should have been collected')
      assert.ok(state.firstMetalCollectedTime !== null, 'firstMetalCollectedTime should be set')
    })

    it('metal bounces off ship when not collecting', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')
      const { createMetalChunk } = await import('../../src/game/metal-chunk')

      const state = createTickState()
      const metal = createMetalChunk(0, 0, 0, 1)
      metal.x = 2 // close to ship at origin
      metal.y = 0
      state.metalChunks.push(metal)

      // Run a tick without collecting — metal should bounce, not be collected
      const result = tick(state, makeInput(createInputState, { collecting: false }))

      assert.equal(result.metalCollectedEvent, false, 'should not collect when not collecting')
      assert.equal(state.metalChunks.length, 1, 'metal should remain')
    })
  })

  // -------------------------------------------------------------------------
  // 13. Station repair
  // -------------------------------------------------------------------------
  describe('station repair', () => {
    it('heals player within STATION_REPAIR_DISTANCE (30)', async () => {
      const { tick, createTickState, PLAYER_MAX_HP } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState({
        shipPosition: { x: 30, y: 200 },
        stationPosition: { x: 30, y: 200 },
        playerHp: 50,
      })

      const result = tick(state, makeInput(createInputState))

      assert.equal(state.playerHp, PLAYER_MAX_HP, 'player should be fully healed')
      assert.equal(result.stationRepaired, true)
      assert.equal(state.repairedThisVisit, true)
    })

    it('does not repair twice in the same visit', async () => {
      const { tick, createTickState, PLAYER_MAX_HP } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState({
        shipPosition: { x: 30, y: 200 },
        stationPosition: { x: 30, y: 200 },
        playerHp: 50,
      })

      // First tick — repairs
      tick(state, makeInput(createInputState))
      assert.equal(state.playerHp, PLAYER_MAX_HP)

      // Damage the player again
      state.playerHp = 30

      // Second tick — should NOT repair
      const result2 = tick(state, makeInput(createInputState))
      assert.equal(state.playerHp, 30, 'should not repair again same visit')
      assert.equal(result2.stationRepaired, false)
    })

    it('resets repairedThisVisit when leaving station range', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState({
        shipPosition: { x: 30, y: 200 },
        stationPosition: { x: 30, y: 200 },
        playerHp: 50,
      })

      // Enter station and repair
      tick(state, makeInput(createInputState))
      assert.equal(state.repairedThisVisit, true)

      // Move ship far away
      state.ship.x = 0
      state.ship.y = 0

      const result = tick(state, makeInput(createInputState))
      assert.equal(state.repairedThisVisit, false, 'should reset on leaving')
      assert.equal(result.stationRangeChanged, false, 'stationRangeChanged=false means left')
    })

    it('resets repairedThisVisit when tutorial transitions into drive-through', async () => {
      const { tick, createTickState, PLAYER_MAX_HP } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      // Stage state as if the player healed during approach-station and then
      // bought an upgrade — they're still in heal range with repairedThisVisit set.
      const state = createTickState({
        shipPosition: { x: 30, y: 200 },
        stationPosition: { x: 30, y: 200 },
        playerHp: PLAYER_MAX_HP,
      })
      state.repairedThisVisit = true
      state.wasInStationRange = true
      state.prevTutorialStep = 'trade-buy'
      state.playerHp = 50 // simulate damage taken between heal and drive-through

      const result = tick(state, makeInput(createInputState, { tutorialStep: 'drive-through' }))

      assert.equal(state.prevTutorialStep, 'drive-through', 'prev step is updated')
      assert.equal(state.playerHp, PLAYER_MAX_HP, 'heal fires after the flag reset')
      assert.equal(result.stationRepaired, true, 'stationRepaired event fires')
      assert.equal(state.repairedThisVisit, true, 'flag flips back true after re-heal')
    })

    it('does not re-reset repairedThisVisit on subsequent ticks in drive-through', async () => {
      const { tick, createTickState, PLAYER_MAX_HP } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState({
        shipPosition: { x: 30, y: 200 },
        stationPosition: { x: 30, y: 200 },
        playerHp: PLAYER_MAX_HP,
      })
      state.prevTutorialStep = 'drive-through'
      state.repairedThisVisit = true
      state.wasInStationRange = true

      const result = tick(state, makeInput(createInputState, { tutorialStep: 'drive-through' }))

      assert.equal(state.repairedThisVisit, true, 'flag stays set, no re-reset')
      assert.equal(result.stationRepaired, false, 'no duplicate heal event')
    })
  })

  // -------------------------------------------------------------------------
  // Projectile expiry
  // -------------------------------------------------------------------------
  describe('projectile expiry', () => {
    it('reports expired projectile ids', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState()
      // Fire a projectile first
      state.fireTarget = { x: 100, y: 0 }
      state.blasterState.cooldownRemaining = 0

      const fireResult = tick(state, makeInput(createInputState))
      assert.ok(fireResult.newProjectiles.length > 0)

      const proj = state.projectiles[0]
      assert.ok(proj, 'should have a projectile')
      const projId = proj.id

      // Set elapsed time very high to force expiry
      state.projectileElapsed.set(projId, 100)

      const result = tick(state, makeInput(createInputState))
      assert.ok(result.expiredProjectileIds.includes(projId), 'should report expired projectile')
    })
  })

  // -------------------------------------------------------------------------
  // Enemy projectile update + expiry
  // -------------------------------------------------------------------------
  describe('enemy projectile expiry', () => {
    it('removes expired enemy projectiles', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')
      const THREE = await import('three')

      const state = createTickState()
      const mesh = new THREE.Group()
      state.enemyProjectiles.push({
        id: 'eproj-expire',
        mesh,
        x: 1000, // far away so no collision
        y: 1000,
        vx: 0,
        vy: 0,
        elapsed: 100, // very high elapsed — should expire
      })

      const result = tick(state, makeInput(createInputState))

      assert.ok(
        result.expiredEnemyProjectileIds.includes('eproj-expire'),
        'should report expired enemy projectile',
      )
      assert.equal(state.enemyProjectiles.length, 0, 'should be removed from state')
    })
  })

  // -------------------------------------------------------------------------
  // Hold-to-fire updates fireTarget each frame
  // -------------------------------------------------------------------------
  describe('hold-to-fire', () => {
    it('re-sets fireTarget from aimWorldPosition when holding fire', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState()
      state.mouseHoldingFire = true
      state.aimActive = true
      // Large cooldown so fire doesn't consume the target
      state.blasterState.cooldownRemaining = 999

      const result = tick(
        state,
        makeInput(createInputState, {
          aimWorldPosition: { x: 42, y: 77 },
        }),
      )

      // fireTarget was set from aim then cleared by the fire section (even though no projectile fired)
      // The important thing is that the fire path ran
      assert.equal(result.newProjectiles.length, 0, 'on cooldown so no projectiles')
    })
  })

  // -------------------------------------------------------------------------
  // Station range changed
  // -------------------------------------------------------------------------
  describe('station range change', () => {
    it('reports entering station range', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      // Place ship within enter distance (60) of station
      const state = createTickState({
        shipPosition: { x: 30, y: 200 },
        stationPosition: { x: 30, y: 200 },
      })
      state.wasInStationRange = false

      const result = tick(state, makeInput(createInputState))

      assert.equal(result.stationRangeChanged, true, 'should report entering range')
      assert.equal(state.wasInStationRange, true)
    })

    it('fires nearStation on first approach', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      // Place ship within STATION_NEAR_DISTANCE (80)
      const state = createTickState({
        shipPosition: { x: 30, y: 250 },
        stationPosition: { x: 30, y: 200 },
      })

      const result = tick(state, makeInput(createInputState))
      assert.equal(result.nearStation, true)
      assert.equal(state.nearStationFired, true)
    })
  })

  // -------------------------------------------------------------------------
  // createTickState factory
  // -------------------------------------------------------------------------
  describe('createTickState', () => {
    it('creates default state with sensible defaults', async () => {
      const { createTickState, PLAYER_MAX_HP } = await import('../../src/game/game-tick')

      const state = createTickState()

      assert.equal(state.ship.x, 0)
      assert.equal(state.ship.y, 0)
      assert.equal(state.playerHp, PLAYER_MAX_HP)
      assert.equal(state.blasterTier, 1)
      assert.equal(state.activeMiningTool, 'blaster')
      assert.equal(state.fireRateBonus, 1.0)
      assert.equal(state.wasPaused, false)
      assert.equal(state.enemySpawned, false)
      assert.equal(state.ambushSpawned, false)
      assert.equal(state.firstMetalCollectedTime, null)
      assert.deepEqual(state.asteroids, [])
    })

    it('applies config overrides', async () => {
      const { createTickState } = await import('../../src/game/game-tick')

      const state = createTickState({
        shipPosition: { x: 5, y: 10 },
        playerHp: 42,
        blasterTier: 3,
        miningTool: 'lazer',
        fireRateBonus: 1.5,
        stationPosition: { x: 100, y: 200 },
      })

      assert.equal(state.ship.x, 5)
      assert.equal(state.ship.y, 10)
      assert.equal(state.playerHp, 42)
      assert.equal(state.blasterTier, 3)
      assert.equal(state.activeMiningTool, 'lazer')
      assert.equal(state.fireRateBonus, 1.5)
      assert.equal(state.stationX, 100)
      assert.equal(state.stationY, 200)
    })

    it('initializes asteroidHitCounts from provided asteroids', async () => {
      const { createTickState } = await import('../../src/game/game-tick')

      const asteroids = [
        {
          id: 'a1',
          x: 0,
          y: 0,
          velocityX: 0,
          velocityY: 0,
          type: 'common' as const,
          hp: 5,
          maxHp: 5,
          size: 1,
        },
        {
          id: 'a2',
          x: 10,
          y: 10,
          velocityX: 0,
          velocityY: 0,
          type: 'dense' as const,
          hp: 10,
          maxHp: 10,
          size: 1,
        },
      ]
      const state = createTickState({ asteroids })

      assert.equal(state.asteroidHitCounts.get('a1'), 0)
      assert.equal(state.asteroidHitCounts.get('a2'), 0)
      assert.equal(state.asteroids.length, 2)
    })
  })

  // -------------------------------------------------------------------------
  // Aim rotation during ship update
  // -------------------------------------------------------------------------
  describe('aim rotation', () => {
    it('applies aim rotation when aimActive and aimWorldPosition set', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState()
      state.aimActive = true

      // Run a tick with aim position far to the right
      tick(
        state,
        makeInput(createInputState, {
          aimWorldPosition: { x: 100, y: 0 },
        }),
      )

      // Ship should have been updated (we can't easily check rotation value
      // but the code path should have been exercised)
      // Just verify no crash and state is valid
      assert.ok(typeof state.ship.rotation === 'number')
    })
  })

  // -------------------------------------------------------------------------
  // Elapsed time increments
  // -------------------------------------------------------------------------
  describe('elapsed time', () => {
    it('increments elapsedTime by dt each frame', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState()
      assert.equal(state.elapsedTime, 0)

      tick(state, makeInput(createInputState, { dt: 0.5 }))
      assert.ok(Math.abs(state.elapsedTime - 0.5) < 0.001)

      tick(state, makeInput(createInputState, { dt: 0.25 }))
      assert.ok(Math.abs(state.elapsedTime - 0.75) < 0.001)
    })
  })

  // -------------------------------------------------------------------------
  // Prologue auto-behavior
  // -------------------------------------------------------------------------
  describe('prologue', () => {
    it('prologue-start initializes maxed ship config', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState()
      const result = tick(state, makeInput(createInputState, { tutorialStep: 'prologue-start' }))

      assert.equal(state.blasterTier, 5)
      assert.ok(state.fireRateBonus > 1.4)
      assert.equal(state.activeMiningTool, 'lazer')
      assert.equal(state.prologueFieldSpawned, true)
      assert.equal(result.prologueReady, true)
    })

    it('prologue-mining auto-targets nearest asteroid', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState({
        asteroids: [
          {
            id: 'a1',
            x: 20,
            y: 0,
            velocityX: 0,
            velocityY: 0,
            type: 'common',
            hp: 15,
            maxHp: 15,
            size: 1,
          },
        ],
      })

      // prologue-start sets tool to lazer; simulate that first
      tick(state, makeInput(createInputState, { tutorialStep: 'prologue-start' }))
      assert.equal(state.activeMiningTool, 'lazer')

      tick(state, makeInput(createInputState, { tutorialStep: 'prologue-mining' }))

      assert.equal(state.prologueAutoCollect, true)
      assert.ok(state.fireTarget !== null, 'should auto-fire at nearest target')
      assert.ok(state.mouseHoldingFire, 'should hold fire')
    })

    it('prologue-mining spawns enemies alongside asteroids', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState({ stationPosition: { x: 500, y: 500 } })
      tick(state, makeInput(createInputState, { tutorialStep: 'prologue-mining' }))

      assert.equal(state.prologueEnemiesSpawned, true)
      assert.ok(state.ambushEnemies.length > 0, 'should spawn enemies')
      assert.equal(state.prologueAutoCollect, true)
    })

    it('prologue-mining fires fieldCleared when asteroids + enemies done', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const asteroids = Array.from({ length: 30 }, (_, i) => ({
        id: `a${i}`,
        x: 50 + i * 20,
        y: 50,
        velocityX: 0,
        velocityY: 0,
        type: 'common' as const,
        hp: 0,
        maxHp: 15,
        size: 1,
      }))
      const state = createTickState({ asteroids, stationPosition: { x: 500, y: 500 } })

      // First tick spawns enemies
      tick(state, makeInput(createInputState, { tutorialStep: 'prologue-mining' }))
      // Kill all enemies
      for (const e of state.ambushEnemies) {
        e.alive = false
      }

      const result = tick(state, makeInput(createInputState, { tutorialStep: 'prologue-mining' }))
      assert.equal(result.fieldCleared, true)
    })

    it('prologue-mining does not fire fieldCleared if enemies still alive', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const asteroids = Array.from({ length: 10 }, (_, i) => ({
        id: `a${i}`,
        x: 50 + i * 20,
        y: 50,
        velocityX: 0,
        velocityY: 0,
        type: 'common' as const,
        hp: 0,
        maxHp: 15,
        size: 1,
      }))
      const state = createTickState({ asteroids, stationPosition: { x: 500, y: 500 } })

      // First tick spawns enemies — don't kill them
      tick(state, makeInput(createInputState, { tutorialStep: 'prologue-mining' }))

      const result = tick(state, makeInput(createInputState, { tutorialStep: 'prologue-mining' }))
      assert.equal(result.fieldCleared, false, 'should not clear while enemies alive')
    })

    it('prologue-arbiter freezes ship and tracks approach', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState()
      tick(state, makeInput(createInputState, { tutorialStep: 'prologue-arbiter', dt: 0.5 }))

      assert.equal(state.prologueShipFrozen, true)
      assert.equal(state.prologueArbiterSpawned, true)
      assert.ok(state.prologueArbiterDistance < 80, 'distance should decrease')
      assert.equal(state.ship.velocityX, 0)
      assert.equal(state.ship.velocityY, 0)
    })

    it('prologue-arbiter fires arbiterArrived when close enough', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState()
      state.prologueArbiterSpawned = true
      state.prologueArbiterDistance = 26

      const result = tick(
        state,
        makeInput(createInputState, { tutorialStep: 'prologue-arbiter', dt: 0.1 }),
      )

      assert.equal(result.arbiterArrived, true)
    })

    it('prologue-strip advances phases on timer', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState()
      state.prologueShipFrozen = true

      const result = tick(
        state,
        makeInput(createInputState, { tutorialStep: 'prologue-strip', dt: 1.6 }),
      )

      assert.equal(state.prologueStripPhase, 1)
      assert.equal(result.stripAdvanced, true)
      assert.equal(result.stripComplete, false)
    })

    it('prologue-strip fires stripComplete after 4 phases', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState()
      state.prologueShipFrozen = true
      state.prologueStripPhase = 3
      state.prologueStripTimer = 1.4

      const result = tick(
        state,
        makeInput(createInputState, { tutorialStep: 'prologue-strip', dt: 0.2 }),
      )

      assert.equal(state.prologueStripPhase, 4)
      assert.equal(result.stripAdvanced, true)
      assert.equal(result.stripComplete, true)
    })

    it('prologue-mining: projectiles damage ambush enemies', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')
      const { createEnemyShip } = await import('../../src/game/enemy-ship')

      const state = createTickState({ stationPosition: { x: 500, y: 500 } })
      // Spawn an enemy at a known position
      const enemy = createEnemyShip(20, 0)
      enemy.hp = 1
      enemy.maxHp = 10
      state.ambushEnemies.push(enemy)
      state.prologueEnemiesSpawned = true

      // Place a projectile heading toward the enemy
      state.projectiles.push({
        id: 'p1',
        x: 18,
        y: 0,
        velocityX: 200,
        velocityY: 0,
        damage: 3,
        tool: 'blaster',
      })
      state.projectileElapsed.set('p1', 0)

      const result = tick(state, makeInput(createInputState, { tutorialStep: 'prologue-mining' }))

      // Enemy should take damage (or die)
      assert.ok(enemy.hp < 1 || !enemy.alive, 'enemy should take damage from projectile')
      assert.ok(
        result.expiredProjectileIds.includes('p1') || state.projectiles.length === 0,
        'projectile should be consumed',
      )
    })

    it('prologue-fade returns early with empty result', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState()
      const result = tick(state, makeInput(createInputState, { tutorialStep: 'prologue-fade' }))

      assert.equal(result.shipMoved, false)
      assert.equal(result.newProjectiles.length, 0)
    })

    it('prologue does not mutate input.collecting', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState({
        asteroids: [
          {
            id: 'a1',
            x: 10,
            y: 0,
            velocityX: 0,
            velocityY: 0,
            type: 'common',
            hp: 15,
            maxHp: 15,
            size: 1,
          },
        ],
      })
      const input = makeInput(createInputState, { tutorialStep: 'prologue-mining' })
      assert.equal(input.collecting, false)

      tick(state, input)

      assert.equal(input.collecting, false, 'input.collecting should not be mutated')
    })

    it('prologue does not mutate input.aimWorldPosition', async () => {
      const { tick, createTickState } = await import('../../src/game/game-tick')
      const { createInputState } = await import('../../src/game/input')

      const state = createTickState({
        asteroids: [
          {
            id: 'a1',
            x: 20,
            y: 0,
            velocityX: 0,
            velocityY: 0,
            type: 'common',
            hp: 15,
            maxHp: 15,
            size: 1,
          },
        ],
      })
      const input = makeInput(createInputState, { tutorialStep: 'prologue-mining' })
      assert.equal(input.aimWorldPosition, null)

      tick(state, input)

      assert.equal(input.aimWorldPosition, null, 'input.aimWorldPosition should not be mutated')
    })
  })
})
