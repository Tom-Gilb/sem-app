// UNIT_TYPE=Test
// Feature #121 — Tests for useStepPair composable

import { describe, it, expect, beforeEach } from 'vitest'
import { useStepPair } from '../useStepPair'

describe('useStepPair', () => {
  it('pairMap starts empty', () => {
    const { pairMap } = useStepPair()
    expect(Object.keys(pairMap.value)).toHaveLength(0)
  })

  it('generatePlan creates exactly 4 blocks', () => {
    const { pairMap, generatePlan } = useStepPair()
    generatePlan({ id: 'step-0', name: 'Alpha' })
    expect(pairMap.value['step-0'].blocks).toHaveLength(4)
  })

  it('blocks alternate driver/navigator (1=driver, 2=navigator, 3=driver, 4=navigator)', () => {
    const { pairMap, generatePlan } = useStepPair()
    generatePlan({ id: 'step-0', name: 'Alpha' })
    const blocks = pairMap.value['step-0'].blocks
    expect(blocks[0].role).toBe('driver')
    expect(blocks[1].role).toBe('navigator')
    expect(blocks[2].role).toBe('driver')
    expect(blocks[3].role).toBe('navigator')
  })

  it('blockNumber values are 1, 2, 3, 4', () => {
    const { pairMap, generatePlan } = useStepPair()
    generatePlan({ id: 'step-0', name: 'Alpha' })
    const blocks = pairMap.value['step-0'].blocks
    expect(blocks[0].blockNumber).toBe(1)
    expect(blocks[1].blockNumber).toBe(2)
    expect(blocks[2].blockNumber).toBe(3)
    expect(blocks[3].blockNumber).toBe(4)
  })

  it('same stepId produces same blocks on repeated calls (deterministic)', () => {
    const { pairMap, generatePlan } = useStepPair()
    generatePlan({ id: 'step-0', name: 'Alpha' })
    const first = pairMap.value['step-0'].blocks.map(b => b.focus)
    generatePlan({ id: 'step-0', name: 'Alpha' })
    const second = pairMap.value['step-0'].blocks.map(b => b.focus)
    expect(first).toEqual(second)
  })

  it('different stepIds (different names) produce different focus text', () => {
    const { pairMap, generatePlan } = useStepPair()
    generatePlan({ id: 'step-0', name: 'Alpha' })
    generatePlan({ id: 'step-1', name: 'Beta' })
    // Seeds differ so block 1 focuses should differ
    expect(pairMap.value['step-0'].blocks[0].focus).not.toBe(
      pairMap.value['step-1'].blocks[0].focus,
    )
  })

  it('contextBrief contains step name', () => {
    const { pairMap, generatePlan } = useStepPair()
    generatePlan({ id: 'step-0', name: 'MyFeature' })
    expect(pairMap.value['step-0'].contextBrief).toContain('MyFeature')
  })

  it('swapNote mentions "Block 2"', () => {
    const { pairMap, generatePlan } = useStepPair()
    generatePlan({ id: 'step-0', name: 'Alpha' })
    expect(pairMap.value['step-0'].swapNote).toContain('Block 2')
  })

  it('toggleOpen flips open state from false to true', () => {
    const { pairMap, generatePlan, toggleOpen } = useStepPair()
    generatePlan({ id: 'step-0', name: 'Alpha' })
    expect(pairMap.value['step-0'].open).toBe(false)
    toggleOpen('step-0')
    expect(pairMap.value['step-0'].open).toBe(true)
  })

  it('toggleOpen flips open state from true back to false', () => {
    const { pairMap, generatePlan, toggleOpen } = useStepPair()
    generatePlan({ id: 'step-0', name: 'Alpha' })
    toggleOpen('step-0')
    expect(pairMap.value['step-0'].open).toBe(true)
    toggleOpen('step-0')
    expect(pairMap.value['step-0'].open).toBe(false)
  })

  it('multiple steps tracked independently', () => {
    const { pairMap, generatePlan } = useStepPair()
    generatePlan({ id: 'step-0', name: 'Alpha' })
    generatePlan({ id: 'step-1', name: 'Beta' })
    expect(pairMap.value['step-0'].stepName).toBe('Alpha')
    expect(pairMap.value['step-1'].stepName).toBe('Beta')
    expect(pairMap.value['step-0'].blocks).toHaveLength(4)
    expect(pairMap.value['step-1'].blocks).toHaveLength(4)
  })

  it('copyPlan includes all 4 block focus texts', () => {
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

    const { pairMap, generatePlan, copyPlan } = useStepPair()
    generatePlan({ id: 'step-0', name: 'Alpha' })
    copyPlan('step-0')

    const blocks = pairMap.value['step-0'].blocks
    const text = clipboardTexts[0]
    for (const block of blocks) {
      expect(text).toContain(block.focus)
    }
  })

  it('copyPlan includes swapNote', () => {
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

    const { pairMap, generatePlan, copyPlan } = useStepPair()
    generatePlan({ id: 'step-0', name: 'Alpha' })
    copyPlan('step-0')

    const swapNote = pairMap.value['step-0'].swapNote
    expect(clipboardTexts[0]).toContain(swapNote)
  })

  it('copyPlan includes stepName in heading', () => {
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

    const { generatePlan, copyPlan } = useStepPair()
    generatePlan({ id: 'step-0', name: 'MyStep' })
    copyPlan('step-0')

    expect(clipboardTexts[0]).toContain('MyStep')
  })

  it('generatePlan is idempotent — second call does not reset open state', () => {
    const { pairMap, generatePlan, toggleOpen } = useStepPair()
    generatePlan({ id: 'step-0', name: 'Alpha' })
    toggleOpen('step-0')
    expect(pairMap.value['step-0'].open).toBe(true)
    generatePlan({ id: 'step-0', name: 'Alpha' })
    expect(pairMap.value['step-0'].open).toBe(true)
  })
})
