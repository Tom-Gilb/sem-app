// UNIT_TYPE=Test
// Feature #140 — Tests for useStepAcceptanceTests composable

import { describe, it, expect } from 'vitest'
import { useStepAcceptanceTests } from '../useStepAcceptanceTests'

describe('useStepAcceptanceTests', () => {
  it('testMap starts empty', () => {
    const { testMap } = useStepAcceptanceTests()
    expect(Object.keys(testMap.value)).toHaveLength(0)
  })

  it('generateTests creates exactly 3 scenarios per step', () => {
    const { testMap, generateTests } = useStepAcceptanceTests()
    generateTests({ id: 'step-0', name: 'Build Core API' })
    expect(testMap.value['step-0'].scenarios).toHaveLength(3)
  })

  it('all scenario fields are non-empty strings', () => {
    const { testMap, generateTests } = useStepAcceptanceTests()
    generateTests({ id: 'step-0', name: 'Deploy Infrastructure' })
    for (const s of testMap.value['step-0'].scenarios) {
      expect(s.title).toBeTruthy()
      expect(s.given).toBeTruthy()
      expect(s.when).toBeTruthy()
      expect(s.then).toBeTruthy()
    }
  })

  it('charCode determinism — same name always produces same scenarios', () => {
    const a = useStepAcceptanceTests()
    const b = useStepAcceptanceTests()
    a.generateTests({ id: 'step-0', name: 'Integrate Payment System' })
    b.generateTests({ id: 'step-0', name: 'Integrate Payment System' })
    expect(a.testMap.value['step-0'].scenarios).toEqual(
      b.testMap.value['step-0'].scenarios
    )
  })

  it('different step names produce different scenarios', () => {
    const { testMap, generateTests } = useStepAcceptanceTests()
    generateTests({ id: 'step-0', name: 'Alpha Step' })
    generateTests({ id: 'step-1', name: 'Zeta Step Completely Different' })
    const s0 = testMap.value['step-0'].scenarios[0]
    const s1 = testMap.value['step-1'].scenarios[0]
    expect(s0.title).not.toBe(s1.title)
  })

  it('scenario titles contain the step name', () => {
    const { testMap, generateTests } = useStepAcceptanceTests()
    generateTests({ id: 'step-0', name: 'My Feature Step' })
    for (const s of testMap.value['step-0'].scenarios) {
      expect(s.title).toContain('My Feature Step')
    }
  })

  it('scenario titles follow the Scenario N: name — when pattern', () => {
    const { testMap, generateTests } = useStepAcceptanceTests()
    generateTests({ id: 'step-0', name: 'API Setup' })
    expect(testMap.value['step-0'].scenarios[0].title).toMatch(/^Scenario 1:/)
    expect(testMap.value['step-0'].scenarios[1].title).toMatch(/^Scenario 2:/)
    expect(testMap.value['step-0'].scenarios[2].title).toMatch(/^Scenario 3:/)
  })

  it('toggleOpen flips open from false to true', () => {
    const { testMap, generateTests, toggleOpen } = useStepAcceptanceTests()
    generateTests({ id: 'step-0', name: 'Test Step' })
    expect(testMap.value['step-0'].open).toBe(false)
    toggleOpen('step-0')
    expect(testMap.value['step-0'].open).toBe(true)
  })

  it('toggleOpen flips open from true back to false', () => {
    const { testMap, generateTests, toggleOpen } = useStepAcceptanceTests()
    generateTests({ id: 'step-0', name: 'Test Step' })
    toggleOpen('step-0')
    toggleOpen('step-0')
    expect(testMap.value['step-0'].open).toBe(false)
  })

  it('copyTests writes text containing Given, When, Then', () => {
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

    const { generateTests, copyTests } = useStepAcceptanceTests()
    generateTests({ id: 'step-0', name: 'Copy Test Step' })
    copyTests('step-0')

    const text = clipboardTexts[0]
    expect(text).toContain('Given:')
    expect(text).toContain('When:')
    expect(text).toContain('Then:')
  })

  it('copyTests output contains the stepId header', () => {
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

    const { generateTests, copyTests } = useStepAcceptanceTests()
    generateTests({ id: 'step-3', name: 'Header Test' })
    copyTests('step-3')

    expect(clipboardTexts[0]).toContain('Acceptance Tests — step-3')
  })

  it('multiple steps are tracked independently', () => {
    const { testMap, generateTests } = useStepAcceptanceTests()
    generateTests({ id: 'step-0', name: 'Step Alpha' })
    generateTests({ id: 'step-1', name: 'Step Beta' })
    generateTests({ id: 'step-2', name: 'Step Gamma' })
    expect(Object.keys(testMap.value)).toHaveLength(3)
    expect(testMap.value['step-0'].scenarios).toHaveLength(3)
    expect(testMap.value['step-1'].scenarios).toHaveLength(3)
    expect(testMap.value['step-2'].scenarios).toHaveLength(3)
  })

  it('toggleOpen on one step does not affect another step', () => {
    const { testMap, generateTests, toggleOpen } = useStepAcceptanceTests()
    generateTests({ id: 'step-0', name: 'Step A' })
    generateTests({ id: 'step-1', name: 'Step B' })
    toggleOpen('step-0')
    expect(testMap.value['step-0'].open).toBe(true)
    expect(testMap.value['step-1'].open).toBe(false)
  })

  it('generateTests preserves open state on re-generation', () => {
    const { testMap, generateTests, toggleOpen } = useStepAcceptanceTests()
    generateTests({ id: 'step-0', name: 'Preserve State' })
    toggleOpen('step-0')
    expect(testMap.value['step-0'].open).toBe(true)
    generateTests({ id: 'step-0', name: 'Preserve State' })
    expect(testMap.value['step-0'].open).toBe(true)
  })

  it('scenario given/when/then values come from the defined banks', () => {
    const givenBank = [
      'the system is in a clean initial state',
      'a user has valid credentials and access',
      'the required data is available and correctly formatted',
      'all dependencies are resolved and unblocked',
      'the environment matches the target configuration',
      'the previous Evo step has been completed successfully',
      'the acceptance criteria have been reviewed and agreed',
      'the team has allocated sufficient time and resources',
    ]
    const whenBank = [
      'the implementation is deployed',
      'the feature is executed end-to-end',
      'the test suite runs against the deliverable',
      'a stakeholder reviews the output',
      'the integration point is exercised',
      'the edge case is triggered',
      'the performance test is run',
      'the user acceptance test session is conducted',
    ]
    const thenBank = [
      'the output meets the defined acceptance criteria',
      'all unit and integration tests pass',
      'no regressions are introduced',
      'the measurable goal shows progress toward target',
      'the deliverable is approved by the responsible stakeholder',
      'the documentation reflects the current implementation',
      'the exit gate is cleared and the step is marked complete',
      'the value indicator moves closer to Goal',
    ]

    const { testMap, generateTests } = useStepAcceptanceTests()
    generateTests({ id: 'step-0', name: 'Bank Validation Step' })
    for (const s of testMap.value['step-0'].scenarios) {
      expect(givenBank).toContain(s.given)
      expect(whenBank).toContain(s.when)
      expect(thenBank).toContain(s.then)
    }
  })
})
