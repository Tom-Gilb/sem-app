// UNIT_TYPE=Test
// Feature #135 — Tests for useStepMob composable

import { describe, it, expect, beforeEach } from 'vitest'
import { useStepMob } from '../useStepMob'

describe('useStepMob', () => {
  it('mobMap starts empty', () => {
    const { mobMap } = useStepMob()
    expect(Object.keys(mobMap.value)).toHaveLength(0)
  })

  it('generateMob creates exactly 4 rotations', () => {
    const { mobMap, generateMob } = useStepMob()
    generateMob({ id: 'step-0', name: 'Alpha' })
    expect(mobMap.value['step-0'].rotations).toHaveLength(4)
  })

  it('rotationNumbers are 1, 2, 3, 4', () => {
    const { mobMap, generateMob } = useStepMob()
    generateMob({ id: 'step-0', name: 'Alpha' })
    const nums = mobMap.value['step-0'].rotations.map(r => r.rotationNumber)
    expect(nums).toEqual([1, 2, 3, 4])
  })

  it('each rotation driver is "Driver (10 min)"', () => {
    const { mobMap, generateMob } = useStepMob()
    generateMob({ id: 'step-0', name: 'Alpha' })
    for (const r of mobMap.value['step-0'].rotations) {
      expect(r.driver).toBe('Driver (10 min)')
    }
  })

  it('rotation focus values come from the focus bank', () => {
    const focusBank = [
      'Set up the problem context and skeleton',
      'Implement the core logic',
      'Write or review unit tests',
      'Refactor for clarity and readability',
      'Handle edge cases and error states',
      'Integrate with adjacent components',
      'Review and discuss design decisions',
      'Document the approach inline',
    ]
    const { mobMap, generateMob } = useStepMob()
    generateMob({ id: 'step-0', name: 'Alpha' })
    for (const r of mobMap.value['step-0'].rotations) {
      expect(focusBank).toContain(r.focus)
    }
  })

  it('generateMob is deterministic — same stepId produces same rotations', () => {
    const { mobMap, generateMob } = useStepMob()
    generateMob({ id: 'step-0', name: 'Alpha' })
    const first = mobMap.value['step-0'].rotations.map(r => r.focus)
    generateMob({ id: 'step-0', name: 'Alpha' })
    const second = mobMap.value['step-0'].rotations.map(r => r.focus)
    expect(first).toEqual(second)
  })

  it('sessionGoal contains the step name', () => {
    const { mobMap, generateMob } = useStepMob()
    generateMob({ id: 'step-0', name: 'MyFeature' })
    expect(mobMap.value['step-0'].sessionGoal).toContain('MyFeature')
  })

  it('teamSize defaults to 3', () => {
    const { mobMap, generateMob } = useStepMob()
    generateMob({ id: 'step-0', name: 'Alpha' })
    expect(mobMap.value['step-0'].teamSize).toBe(3)
  })

  it('totalMinutes is 40', () => {
    const { mobMap, generateMob } = useStepMob()
    generateMob({ id: 'step-0', name: 'Alpha' })
    expect(mobMap.value['step-0'].totalMinutes).toBe(40)
  })

  it('rotationMinutes is 10', () => {
    const { mobMap, generateMob } = useStepMob()
    generateMob({ id: 'step-0', name: 'Alpha' })
    expect(mobMap.value['step-0'].rotationMinutes).toBe(10)
  })

  it('toggleOpen flips open state from false to true', () => {
    const { mobMap, generateMob, toggleOpen } = useStepMob()
    generateMob({ id: 'step-0', name: 'Alpha' })
    expect(mobMap.value['step-0'].open).toBe(false)
    toggleOpen('step-0')
    expect(mobMap.value['step-0'].open).toBe(true)
  })

  it('toggleOpen flips open state from true back to false', () => {
    const { mobMap, generateMob, toggleOpen } = useStepMob()
    generateMob({ id: 'step-0', name: 'Alpha' })
    toggleOpen('step-0')
    toggleOpen('step-0')
    expect(mobMap.value['step-0'].open).toBe(false)
  })

  it('copyMob includes all 4 rotation focus texts', () => {
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

    const { mobMap, generateMob, copyMob } = useStepMob()
    generateMob({ id: 'step-0', name: 'Alpha' })
    copyMob('step-0')

    const rotations = mobMap.value['step-0'].rotations
    const text = clipboardTexts[0]
    for (const r of rotations) {
      expect(text).toContain(r.focus)
      expect(text).toContain(`Rotation ${r.rotationNumber}`)
    }
  })

  it('multiple steps tracked independently', () => {
    const { mobMap, generateMob } = useStepMob()
    generateMob({ id: 'step-0', name: 'Alpha' })
    generateMob({ id: 'step-1', name: 'Beta' })
    expect(mobMap.value['step-0'].stepName).toBe('Alpha')
    expect(mobMap.value['step-1'].stepName).toBe('Beta')
    expect(mobMap.value['step-0'].rotations).toHaveLength(4)
    expect(mobMap.value['step-1'].rotations).toHaveLength(4)
  })

  it('generateMob is idempotent — second call does not reset open state', () => {
    const { mobMap, generateMob, toggleOpen } = useStepMob()
    generateMob({ id: 'step-0', name: 'Alpha' })
    toggleOpen('step-0')
    expect(mobMap.value['step-0'].open).toBe(true)
    generateMob({ id: 'step-0', name: 'Alpha' })
    expect(mobMap.value['step-0'].open).toBe(true)
  })
})
