// UNIT_TYPE=Tests
// Feature #116 — useStepReady composable tests
import { describe, it, expect, beforeEach } from 'vitest'
import { useStepReady } from '../useStepReady'

describe('useStepReady', () => {
  // Re-create a fresh composable instance for each test
  let composable: ReturnType<typeof useStepReady>

  beforeEach(() => {
    composable = useStepReady()
  })

  it('initStep creates 5 items, all unchecked', () => {
    const { initStep, readyMap } = composable
    initStep('step-0')
    const state = readyMap.value['step-0']
    expect(state).toBeDefined()
    expect(state.items).toHaveLength(5)
    expect(state.items.every(i => !i.checked)).toBe(true)
  })

  it('initStep creates items with correct IDs', () => {
    const { initStep, readyMap } = composable
    initStep('step-0')
    const ids = readyMap.value['step-0'].items.map(i => i.id)
    expect(ids).toEqual([
      'acceptance-criteria',
      'dependencies',
      'resources',
      'design',
      'tests',
    ])
  })

  it('initStep is idempotent — calling again does not reset checked state', () => {
    const { initStep, toggleItem, readyMap } = composable
    initStep('step-0')
    toggleItem('step-0', 'acceptance-criteria')
    expect(readyMap.value['step-0'].items[0].checked).toBe(true)
    // Call again — should not reset
    initStep('step-0')
    expect(readyMap.value['step-0'].items[0].checked).toBe(true)
  })

  it('toggleItem flips checked state from false to true', () => {
    const { initStep, toggleItem, readyMap } = composable
    initStep('step-1')
    toggleItem('step-1', 'dependencies')
    const item = readyMap.value['step-1'].items.find(i => i.id === 'dependencies')
    expect(item?.checked).toBe(true)
  })

  it('toggleItem flips checked state from true to false', () => {
    const { initStep, toggleItem, readyMap } = composable
    initStep('step-1')
    toggleItem('step-1', 'dependencies')
    toggleItem('step-1', 'dependencies')
    const item = readyMap.value['step-1'].items.find(i => i.id === 'dependencies')
    expect(item?.checked).toBe(false)
  })

  it('ready is true only when all 5 items are checked', () => {
    const { initStep, toggleItem, readyMap } = composable
    initStep('step-2')
    const ids = ['acceptance-criteria', 'dependencies', 'resources', 'design', 'tests']
    ids.forEach(id => toggleItem('step-2', id))
    expect(readyMap.value['step-2'].ready).toBe(true)
  })

  it('ready is false when only 4 of 5 items are checked', () => {
    const { initStep, toggleItem, readyMap } = composable
    initStep('step-2')
    const ids = ['acceptance-criteria', 'dependencies', 'resources', 'design']
    ids.forEach(id => toggleItem('step-2', id))
    expect(readyMap.value['step-2'].ready).toBe(false)
  })

  it('blockedCount decrements as items are checked', () => {
    const { initStep, toggleItem, readyMap } = composable
    initStep('step-3')
    expect(readyMap.value['step-3'].blockedCount).toBe(5)
    toggleItem('step-3', 'acceptance-criteria')
    expect(readyMap.value['step-3'].blockedCount).toBe(4)
    toggleItem('step-3', 'dependencies')
    expect(readyMap.value['step-3'].blockedCount).toBe(3)
  })

  it('blockedCount is 5 when all items are unchecked', () => {
    const { initStep, readyMap } = composable
    initStep('step-4')
    expect(readyMap.value['step-4'].blockedCount).toBe(5)
  })

  it('blockedCount increments when an item is unchecked again', () => {
    const { initStep, toggleItem, readyMap } = composable
    initStep('step-4')
    toggleItem('step-4', 'tests')
    expect(readyMap.value['step-4'].blockedCount).toBe(4)
    toggleItem('step-4', 'tests')
    expect(readyMap.value['step-4'].blockedCount).toBe(5)
  })

  it('toggleOpen flips the open state', () => {
    const { initStep, toggleOpen, readyMap } = composable
    initStep('step-5')
    expect(readyMap.value['step-5'].open).toBe(false)
    toggleOpen('step-5')
    expect(readyMap.value['step-5'].open).toBe(true)
    toggleOpen('step-5')
    expect(readyMap.value['step-5'].open).toBe(false)
  })

  it('isReady returns false with 4 of 5 items checked', () => {
    const { initStep, toggleItem, isReady } = composable
    initStep('step-6')
    const ids = ['acceptance-criteria', 'dependencies', 'resources', 'design']
    ids.forEach(id => toggleItem('step-6', id))
    expect(isReady('step-6')).toBe(false)
  })

  it('isReady returns true when all 5 items are checked', () => {
    const { initStep, toggleItem, isReady } = composable
    initStep('step-6')
    const ids = ['acceptance-criteria', 'dependencies', 'resources', 'design', 'tests']
    ids.forEach(id => toggleItem('step-6', id))
    expect(isReady('step-6')).toBe(true)
  })

  it('copyReadiness includes checked items with [x]', () => {
    const { initStep, toggleItem, copyReadiness } = composable
    const written: string[] = []
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (text: string) => { written.push(text); return Promise.resolve() } },
      configurable: true,
    })
    initStep('step-7')
    toggleItem('step-7', 'acceptance-criteria')
    copyReadiness('step-7')
    expect(written[0]).toContain('- [x] Acceptance criteria defined')
  })

  it('copyReadiness includes unchecked items with [ ]', () => {
    const { initStep, toggleItem, copyReadiness } = composable
    const written: string[] = []
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (text: string) => { written.push(text); return Promise.resolve() } },
      configurable: true,
    })
    initStep('step-7')
    toggleItem('step-7', 'acceptance-criteria') // check one
    copyReadiness('step-7')
    expect(written[0]).toContain('- [ ] Dependencies unblocked')
  })

  it('copyReadiness footer says "Ready ✅" when all items are checked', () => {
    const { initStep, toggleItem, copyReadiness } = composable
    const written: string[] = []
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (text: string) => { written.push(text); return Promise.resolve() } },
      configurable: true,
    })
    initStep('step-8')
    const ids = ['acceptance-criteria', 'dependencies', 'resources', 'design', 'tests']
    ids.forEach(id => toggleItem('step-8', id))
    copyReadiness('step-8')
    expect(written[0]).toContain('Status: Ready ✅')
  })

  it('copyReadiness footer says "Not Ready ⛔" when items are unchecked', () => {
    const { initStep, copyReadiness } = composable
    const written: string[] = []
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (text: string) => { written.push(text); return Promise.resolve() } },
      configurable: true,
    })
    initStep('step-9')
    copyReadiness('step-9')
    expect(written[0]).toContain('Not Ready ⛔')
  })

  it('multiple steps are tracked independently', () => {
    const { initStep, toggleItem, isReady, readyMap } = composable
    initStep('step-A')
    initStep('step-B')
    // Check all items for step-A
    const ids = ['acceptance-criteria', 'dependencies', 'resources', 'design', 'tests']
    ids.forEach(id => toggleItem('step-A', id))
    // step-B remains untouched
    expect(isReady('step-A')).toBe(true)
    expect(isReady('step-B')).toBe(false)
    expect(readyMap.value['step-A'].blockedCount).toBe(0)
    expect(readyMap.value['step-B'].blockedCount).toBe(5)
  })
})
