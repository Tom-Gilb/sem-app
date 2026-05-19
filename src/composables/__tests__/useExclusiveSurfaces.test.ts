/**
 * useExclusiveSurfaces.test.ts — verifies the Universal Single-Surface Rule.
 *
 * The rule (per vault CLAUDE.md): when one registered surface opens, every
 * OTHER currently-open registered surface auto-closes. The previously-open
 * window goes away gracefully — no two full-screen surfaces stacked.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import {
  registerExclusiveSurface,
  _activeExclusiveSurface,
  _resetSurfaces,
} from '../useExclusiveSurfaces'

describe('useExclusiveSurfaces — Universal Single-Surface Rule', () => {
  beforeEach(() => {
    _resetSurfaces()
  })

  it('opening a second exclusive surface auto-closes the first (the EvoSimulator → another action case)', async () => {
    const evoSimulatorOpen = ref(false)
    const planTargetsOpen = ref(false)

    registerExclusiveSurface('evoSimulator', evoSimulatorOpen)
    registerExclusiveSurface('planTargets', planTargetsOpen)

    // User opens Evo Simulator.
    evoSimulatorOpen.value = true
    await nextTick()
    expect(_activeExclusiveSurface()).toBe('evoSimulator')

    // User clicks an action that opens Plan Targets — Evo Simulator must
    // close automatically and Plan Targets becomes the active surface.
    planTargetsOpen.value = true
    await nextTick()
    expect(evoSimulatorOpen.value).toBe(false)
    expect(planTargetsOpen.value).toBe(true)
    expect(_activeExclusiveSurface()).toBe('planTargets')
  })

  it('closing a surface does not affect any other surface', async () => {
    const aOpen = ref(false)
    const bOpen = ref(false)
    registerExclusiveSurface('a', aOpen)
    registerExclusiveSurface('b', bOpen)

    aOpen.value = true
    await nextTick()
    expect(_activeExclusiveSurface()).toBe('a')

    aOpen.value = false
    await nextTick()
    expect(_activeExclusiveSurface()).toBeNull()
    expect(bOpen.value).toBe(false)
  })

  it('opening 3+ surfaces in sequence keeps only the last one open', async () => {
    const a = ref(false), b = ref(false), c = ref(false)
    registerExclusiveSurface('a', a)
    registerExclusiveSurface('b', b)
    registerExclusiveSurface('c', c)

    a.value = true; await nextTick()
    b.value = true; await nextTick()
    c.value = true; await nextTick()

    expect(a.value).toBe(false)
    expect(b.value).toBe(false)
    expect(c.value).toBe(true)
    expect(_activeExclusiveSurface()).toBe('c')
  })

  it('non-exclusive surfaces neither auto-close others nor get auto-closed', async () => {
    const persistent = ref(false)
    const exclusiveA = ref(false)
    const exclusiveB = ref(false)

    registerExclusiveSurface('persistent', persistent, { exclusive: false })
    registerExclusiveSurface('a', exclusiveA)
    registerExclusiveSurface('b', exclusiveB)

    // A persistent surface is open.
    persistent.value = true
    await nextTick()

    // Opening an exclusive surface must NOT close the persistent one.
    exclusiveA.value = true
    await nextTick()
    expect(persistent.value).toBe(true)
    expect(exclusiveA.value).toBe(true)

    // Opening another exclusive surface closes A but leaves persistent open.
    exclusiveB.value = true
    await nextTick()
    expect(exclusiveA.value).toBe(false)
    expect(exclusiveB.value).toBe(true)
    expect(persistent.value).toBe(true)
  })

  it('re-registering the same id replaces the previous entry (HMR safety)', async () => {
    const oldRef = ref(false)
    const newRef = ref(false)
    const otherRef = ref(false)

    registerExclusiveSurface('panel', oldRef)
    registerExclusiveSurface('other', otherRef)

    // Hot-reload: the panel re-registers with a fresh ref.
    registerExclusiveSurface('panel', newRef)

    // Opening the new ref auto-closes the other surface.
    otherRef.value = true; await nextTick()
    newRef.value = true; await nextTick()
    expect(otherRef.value).toBe(false)
    expect(newRef.value).toBe(true)
  })
})
