// UNIT_TYPE=Test
// Feature #138 — Tests for useBlockerLog composable

import { describe, it, expect } from 'vitest'
import { useBlockerLog } from '../useBlockerLog'

describe('useBlockerLog', () => {
  it('blockerMap starts empty', () => {
    const { blockerMap } = useBlockerLog()
    expect(Object.keys(blockerMap.value)).toHaveLength(0)
  })

  it('initStep creates an empty log for a new stepId', () => {
    const { blockerMap, initStep } = useBlockerLog()
    initStep('step-0')
    expect(blockerMap.value['step-0']).toBeDefined()
    expect(blockerMap.value['step-0'].blockers).toHaveLength(0)
    expect(blockerMap.value['step-0'].activeCount).toBe(0)
    expect(blockerMap.value['step-0'].resolvedCount).toBe(0)
  })

  it('initStep does not overwrite existing log', () => {
    const { blockerMap, initStep, addBlocker } = useBlockerLog()
    initStep('step-0')
    addBlocker('step-0', 'First blocker', 'P2')
    initStep('step-0')
    expect(blockerMap.value['step-0'].blockers).toHaveLength(1)
  })

  it('addBlocker appends a blocker to the log', () => {
    const { blockerMap, addBlocker } = useBlockerLog()
    addBlocker('step-0', 'Build is broken', 'P1')
    expect(blockerMap.value['step-0'].blockers).toHaveLength(1)
    expect(blockerMap.value['step-0'].blockers[0].description).toBe('Build is broken')
    expect(blockerMap.value['step-0'].blockers[0].severity).toBe('P1')
  })

  it('addBlocker increments activeCount', () => {
    const { blockerMap, addBlocker } = useBlockerLog()
    addBlocker('step-0', 'Blocker A', 'P3')
    expect(blockerMap.value['step-0'].activeCount).toBe(1)
    addBlocker('step-0', 'Blocker B', 'P2')
    expect(blockerMap.value['step-0'].activeCount).toBe(2)
  })

  it('addBlocker sets resolved to false and resolvedDate to null', () => {
    const { blockerMap, addBlocker } = useBlockerLog()
    addBlocker('step-0', 'Waiting on API', 'P2')
    const b = blockerMap.value['step-0'].blockers[0]
    expect(b.resolved).toBe(false)
    expect(b.resolvedDate).toBeNull()
  })

  it('addBlocker sets addedAt to an ISO date string', () => {
    const { blockerMap, addBlocker } = useBlockerLog()
    addBlocker('step-0', 'Test blocker', 'P3')
    const b = blockerMap.value['step-0'].blockers[0]
    expect(b.addedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('resolveBlocker sets resolved=true and resolvedDate', () => {
    const { blockerMap, addBlocker, resolveBlocker } = useBlockerLog()
    addBlocker('step-0', 'Dep missing', 'P1')
    const blockerId = blockerMap.value['step-0'].blockers[0].id
    resolveBlocker('step-0', blockerId)
    const b = blockerMap.value['step-0'].blockers[0]
    expect(b.resolved).toBe(true)
    expect(b.resolvedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('resolveBlocker decrements activeCount and increments resolvedCount', () => {
    const { blockerMap, addBlocker, resolveBlocker } = useBlockerLog()
    addBlocker('step-0', 'Blocker A', 'P2')
    addBlocker('step-0', 'Blocker B', 'P1')
    const blockerId = blockerMap.value['step-0'].blockers[0].id
    expect(blockerMap.value['step-0'].activeCount).toBe(2)
    expect(blockerMap.value['step-0'].resolvedCount).toBe(0)
    resolveBlocker('step-0', blockerId)
    expect(blockerMap.value['step-0'].activeCount).toBe(1)
    expect(blockerMap.value['step-0'].resolvedCount).toBe(1)
  })

  it('removeBlocker removes the blocker from the array', () => {
    const { blockerMap, addBlocker, removeBlocker } = useBlockerLog()
    addBlocker('step-0', 'To remove', 'P3')
    const blockerId = blockerMap.value['step-0'].blockers[0].id
    removeBlocker('step-0', blockerId)
    expect(blockerMap.value['step-0'].blockers).toHaveLength(0)
  })

  it('removeBlocker updates activeCount', () => {
    const { blockerMap, addBlocker, removeBlocker } = useBlockerLog()
    addBlocker('step-0', 'Blocker A', 'P3')
    addBlocker('step-0', 'Blocker B', 'P2')
    const blockerId = blockerMap.value['step-0'].blockers[0].id
    removeBlocker('step-0', blockerId)
    expect(blockerMap.value['step-0'].activeCount).toBe(1)
  })

  it('toggleOpen flips open from false to true', () => {
    const { blockerMap, initStep, toggleOpen } = useBlockerLog()
    initStep('step-0')
    expect(blockerMap.value['step-0'].open).toBe(false)
    toggleOpen('step-0')
    expect(blockerMap.value['step-0'].open).toBe(true)
  })

  it('toggleOpen flips open from true back to false', () => {
    const { blockerMap, initStep, toggleOpen } = useBlockerLog()
    initStep('step-0')
    toggleOpen('step-0')
    toggleOpen('step-0')
    expect(blockerMap.value['step-0'].open).toBe(false)
  })

  it('copyLog output contains severity labels P1/P2/P3', () => {
    const clipboardTexts: string[] = []
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: {
          writeText: (text: string) => {
            clipboardTexts.push(text)
            return Promise.resolve()
          },
        },
      },
      writable: true,
      configurable: true,
    })

    const { addBlocker, copyLog } = useBlockerLog()
    addBlocker('step-0', 'Critical issue', 'P1')
    addBlocker('step-0', 'Medium issue', 'P2')
    addBlocker('step-0', 'Low issue', 'P3')
    copyLog('step-0')

    const text = clipboardTexts[0]
    expect(text).toContain('[P1]')
    expect(text).toContain('[P2]')
    expect(text).toContain('[P3]')
  })

  it('copyLog output shows RESOLVED for resolved blockers', () => {
    const clipboardTexts: string[] = []
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: {
          writeText: (text: string) => {
            clipboardTexts.push(text)
            return Promise.resolve()
          },
        },
      },
      writable: true,
      configurable: true,
    })

    const { blockerMap, addBlocker, resolveBlocker, copyLog } = useBlockerLog()
    addBlocker('step-0', 'Fixed issue', 'P2')
    const blockerId = blockerMap.value['step-0'].blockers[0].id
    resolveBlocker('step-0', blockerId)
    copyLog('step-0')

    const text = clipboardTexts[0]
    expect(text).toContain('RESOLVED')
  })

  it('copyLog output shows OPEN for unresolved blockers', () => {
    const clipboardTexts: string[] = []
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: {
          writeText: (text: string) => {
            clipboardTexts.push(text)
            return Promise.resolve()
          },
        },
      },
      writable: true,
      configurable: true,
    })

    const { addBlocker, copyLog } = useBlockerLog()
    addBlocker('step-0', 'Still open', 'P1')
    copyLog('step-0')

    const text = clipboardTexts[0]
    expect(text).toContain('OPEN')
  })

  it('empty log guard — initStep with no blockers has zero counts', () => {
    const { blockerMap, initStep } = useBlockerLog()
    initStep('step-5')
    expect(blockerMap.value['step-5'].activeCount).toBe(0)
    expect(blockerMap.value['step-5'].resolvedCount).toBe(0)
    expect(blockerMap.value['step-5'].blockers).toHaveLength(0)
  })
})
