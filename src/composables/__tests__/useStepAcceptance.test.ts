// UNIT_TYPE=Test
// Feature #140 — Tests for useStepAcceptance composable

import { describe, it, expect } from 'vitest'
import { useStepAcceptance } from '../useStepAcceptance'

describe('useStepAcceptance', () => {
  it('acceptanceMap starts empty', async () => {
    const { acceptanceMap } = useStepAcceptance('')
    expect(Object.keys(acceptanceMap.value)).toHaveLength(0)
  })

  it('generate creates exactly 3 scenarios per step', async () => {
    const { acceptanceMap, generate } = useStepAcceptance('')
    await generate({ id: 'step-0', name: 'Build Core API' })
    expect(acceptanceMap.value['step-0'].scenarios).toHaveLength(3)
  })

  it('all scenario fields are non-empty strings', async () => {
    const { acceptanceMap, generate } = useStepAcceptance('')
    await generate({ id: 'step-0', name: 'Deploy Infrastructure' })
    for (const s of acceptanceMap.value['step-0'].scenarios) {
      expect(s.title).toBeTruthy()
      expect(s.given).toBeTruthy()
      expect(s.when).toBeTruthy()
      expect(s.then).toBeTruthy()
    }
  })

  it('scenario titles come from titleBank (Happy path, Edge case, Regression)', async () => {
    const { acceptanceMap, generate } = useStepAcceptance('')
    await generate({ id: 'step-0', name: 'Test Step' })
    const titles = acceptanceMap.value['step-0'].scenarios.map(s => s.title)
    expect(titles[0]).toBe('Happy path')
    expect(titles[1]).toBe('Edge case: boundary conditions')
    expect(titles[2]).toBe('Regression: prior state preserved')
  })

  it('charCode determinism — same name always produces same scenarios', async () => {
    const a = useStepAcceptance('')
    const b = useStepAcceptance('')
    await a.generate({ id: 'step-0', name: 'Integrate Payment System' })
    await b.generate({ id: 'step-0', name: 'Integrate Payment System' })
    expect(a.acceptanceMap.value['step-0'].scenarios).toEqual(
      b.acceptanceMap.value['step-0'].scenarios
    )
  })

  it('different step names can produce different given/when/then', async () => {
    const { acceptanceMap, generate } = useStepAcceptance('')
    await generate({ id: 'step-0', name: 'Alpha' })
    await generate({ id: 'step-1', name: 'ZetaLongDifferentName' })
    // titles are same (from bank index), but given/when/then can differ
    const s0 = acceptanceMap.value['step-0'].scenarios[0]
    const s1 = acceptanceMap.value['step-1'].scenarios[0]
    // At minimum, scenarios exist and are well-formed for both
    expect(s0.given).toBeTruthy()
    expect(s1.given).toBeTruthy()
  })

  it('given values come from the defined givenBank', async () => {
    const givenBank = [
      'a user with appropriate permissions',
      'the system is in a valid initial state',
      'all prerequisite steps are complete',
    ]
    const { acceptanceMap, generate } = useStepAcceptance('')
    await generate({ id: 'step-0', name: 'Bank Check Step' })
    for (const s of acceptanceMap.value['step-0'].scenarios) {
      expect(givenBank).toContain(s.given)
    }
  })

  it('when values come from the defined whenBank', async () => {
    const whenBank = [
      'the step is executed as planned',
      'the implementation is deployed',
      'the feature is activated',
    ]
    const { acceptanceMap, generate } = useStepAcceptance('')
    await generate({ id: 'step-0', name: 'Bank Check Step' })
    for (const s of acceptanceMap.value['step-0'].scenarios) {
      expect(whenBank).toContain(s.when)
    }
  })

  it('then values come from the defined thenBank', async () => {
    const thenBank = [
      'the expected outcome is achieved',
      'all acceptance criteria are met',
      'the value goal advances by the specified measure',
    ]
    const { acceptanceMap, generate } = useStepAcceptance('')
    await generate({ id: 'step-0', name: 'Bank Check Step' })
    for (const s of acceptanceMap.value['step-0'].scenarios) {
      expect(thenBank).toContain(s.then)
    }
  })

  it('toggleOpen flips open from false to true', async () => {
    const { acceptanceMap, generate, toggleOpen } = useStepAcceptance('')
    await generate({ id: 'step-0', name: 'Toggle Step' })
    expect(acceptanceMap.value['step-0'].open).toBe(false)
    toggleOpen('step-0')
    expect(acceptanceMap.value['step-0'].open).toBe(true)
  })

  it('toggleOpen flips open from true back to false', async () => {
    const { acceptanceMap, generate, toggleOpen } = useStepAcceptance('')
    await generate({ id: 'step-0', name: 'Toggle Step' })
    toggleOpen('step-0')
    toggleOpen('step-0')
    expect(acceptanceMap.value['step-0'].open).toBe(false)
  })

  it('loading is false after generate completes', async () => {
    const { acceptanceMap, generate } = useStepAcceptance('')
    await generate({ id: 'step-0', name: 'Loading Test Step' })
    expect(acceptanceMap.value['step-0'].loading).toBe(false)
  })

  it('copyAcceptance writes Gherkin format to clipboard', async () => {
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

    const { generate, copyAcceptance } = useStepAcceptance('')
    await generate({ id: 'step-0', name: 'Gherkin Step' })
    copyAcceptance('step-0')

    const text = clipboardTexts[0]
    expect(text).toContain('Scenario:')
    expect(text).toContain('Given ')
    expect(text).toContain('When ')
    expect(text).toContain('Then ')
  })

  it('acceptanceCopied flips to true on copyAcceptance', async () => {
    const { acceptanceCopied, generate, copyAcceptance } = useStepAcceptance('')
    await generate({ id: 'step-0', name: 'Copied Test' })
    copyAcceptance('step-0')
    expect(acceptanceCopied.value['step-0']).toBe(true)
  })

  it('multiple steps are tracked independently', async () => {
    const { acceptanceMap, generate } = useStepAcceptance('')
    await generate({ id: 'step-0', name: 'Step Alpha' })
    await generate({ id: 'step-1', name: 'Step Beta' })
    await generate({ id: 'step-2', name: 'Step Gamma' })
    expect(Object.keys(acceptanceMap.value)).toHaveLength(3)
    expect(acceptanceMap.value['step-0'].scenarios).toHaveLength(3)
    expect(acceptanceMap.value['step-1'].scenarios).toHaveLength(3)
    expect(acceptanceMap.value['step-2'].scenarios).toHaveLength(3)
  })
})
