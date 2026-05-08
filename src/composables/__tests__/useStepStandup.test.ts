// UNIT_TYPE=Test
// Feature #145 — Tests for useStepStandup composable

import { describe, it, expect } from 'vitest'
import { useStepStandup } from '../useStepStandup'

const yesterdayBank = [
  'Completed initial scoping and requirements review',
  'Finished design and wireframe approval',
  'Delivered first working prototype',
  'Resolved blocking dependencies from upstream',
  'Completed code review feedback and revisions',
  'Shipped integration tests for core path',
  'Finalised documentation and handoff notes',
  'Ran end-to-end validation with stakeholders',
]

const todayBank = [
  'Implement the core logic and write unit tests',
  'Integrate with dependent services',
  'Complete the UI component and wire up state',
  'Review pull request and address feedback',
  'Deploy to staging and run smoke tests',
  'Pair with a teammate on the hardest task',
  "Fix identified issues from yesterday's review",
  'Prepare demo and update progress notes',
]

const blockerBank = [
  'None identified',
  'Waiting for API credentials to be provisioned',
  'Dependency not yet available in environment',
  'Unclear acceptance criteria — needs clarification',
  'Code review pending from another team member',
  'Infrastructure access required before proceeding',
]

describe('useStepStandup', () => {
  it('standupMap starts empty', () => {
    const { standupMap } = useStepStandup()
    expect(Object.keys(standupMap.value)).toHaveLength(0)
  })

  it('generateStandup creates a script with all three fields', () => {
    const { standupMap, generateStandup } = useStepStandup()
    generateStandup({ id: 'step-0', name: 'Build Core API' })
    const script = standupMap.value['step-0']
    expect(script.yesterday).toBeTruthy()
    expect(script.today).toBeTruthy()
    expect(script.blockers).toBeTruthy()
  })

  it('yesterday value comes from yesterdayBank', () => {
    const { standupMap, generateStandup } = useStepStandup()
    generateStandup({ id: 'step-0', name: 'Deploy Infrastructure' })
    expect(yesterdayBank).toContain(standupMap.value['step-0'].yesterday)
  })

  it('today value comes from todayBank', () => {
    const { standupMap, generateStandup } = useStepStandup()
    generateStandup({ id: 'step-0', name: 'Deploy Infrastructure' })
    expect(todayBank).toContain(standupMap.value['step-0'].today)
  })

  it('blockers value comes from blockerBank', () => {
    const { standupMap, generateStandup } = useStepStandup()
    generateStandup({ id: 'step-0', name: 'Deploy Infrastructure' })
    expect(blockerBank).toContain(standupMap.value['step-0'].blockers)
  })

  it('charCode determinism — same name always produces same results', () => {
    const a = useStepStandup()
    const b = useStepStandup()
    a.generateStandup({ id: 'step-0', name: 'Integrate Payment System' })
    b.generateStandup({ id: 'step-0', name: 'Integrate Payment System' })
    expect(a.standupMap.value['step-0'].yesterday).toBe(b.standupMap.value['step-0'].yesterday)
    expect(a.standupMap.value['step-0'].today).toBe(b.standupMap.value['step-0'].today)
    expect(a.standupMap.value['step-0'].blockers).toBe(b.standupMap.value['step-0'].blockers)
  })

  it('different names produce different results', () => {
    const { standupMap, generateStandup } = useStepStandup()
    generateStandup({ id: 'step-0', name: 'Alpha Step' })
    generateStandup({ id: 'step-1', name: 'Zeta Step Completely Different Name' })
    const s0 = standupMap.value['step-0']
    const s1 = standupMap.value['step-1']
    // At least one field must differ (extremely unlikely they all match for different seeds)
    const allSame =
      s0.yesterday === s1.yesterday &&
      s0.today === s1.today &&
      s0.blockers === s1.blockers
    expect(allSame).toBe(false)
  })

  it('toggleOpen flips open from false to true', () => {
    const { standupMap, generateStandup, toggleOpen } = useStepStandup()
    generateStandup({ id: 'step-0', name: 'Test Step' })
    expect(standupMap.value['step-0'].open).toBe(false)
    toggleOpen('step-0')
    expect(standupMap.value['step-0'].open).toBe(true)
  })

  it('toggleOpen flips open from true back to false', () => {
    const { standupMap, generateStandup, toggleOpen } = useStepStandup()
    generateStandup({ id: 'step-0', name: 'Test Step' })
    toggleOpen('step-0')
    toggleOpen('step-0')
    expect(standupMap.value['step-0'].open).toBe(false)
  })

  it('copyStandup writes text containing Yesterday, Today, Blockers headings', () => {
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

    const { generateStandup, copyStandup } = useStepStandup()
    generateStandup({ id: 'step-0', name: 'Copy Standup Step' })
    copyStandup('step-0')

    const text = clipboardTexts[0]
    expect(text).toContain('**Yesterday:**')
    expect(text).toContain('**Today:**')
    expect(text).toContain('**Blockers:**')
  })

  it('copyStandup output contains the step name in header', () => {
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

    const { generateStandup, copyStandup } = useStepStandup()
    generateStandup({ id: 'step-2', name: 'Header Check Step' })
    copyStandup('step-2')

    expect(clipboardTexts[0]).toContain('Daily Standup — Header Check Step')
  })

  it('multiple steps are tracked independently', () => {
    const { standupMap, generateStandup } = useStepStandup()
    generateStandup({ id: 'step-0', name: 'Step Alpha' })
    generateStandup({ id: 'step-1', name: 'Step Beta' })
    generateStandup({ id: 'step-2', name: 'Step Gamma' })
    expect(Object.keys(standupMap.value)).toHaveLength(3)
    expect(standupMap.value['step-0'].yesterday).toBeTruthy()
    expect(standupMap.value['step-1'].yesterday).toBeTruthy()
    expect(standupMap.value['step-2'].yesterday).toBeTruthy()
  })

  it('toggleOpen on one step does not affect another step', () => {
    const { standupMap, generateStandup, toggleOpen } = useStepStandup()
    generateStandup({ id: 'step-0', name: 'Step A' })
    generateStandup({ id: 'step-1', name: 'Step B' })
    toggleOpen('step-0')
    expect(standupMap.value['step-0'].open).toBe(true)
    expect(standupMap.value['step-1'].open).toBe(false)
  })

  it('"None identified" is produced for a step whose seed % 6 offset yields index 0 in blockerBank', () => {
    // We need a name where (seed + 2) % 6 === 0, i.e. seed % 6 === 4
    // Find such a name by checking charcode sums
    // "AB" has charCodes 65 + 66 = 131; 131 % 6 = 5, (131+2) % 6 = 3 — not 0
    // Try name with seed where (seed+2)%6 = 0 → seed%6 = 4
    // seed 4: charCode sum = 4 → e.g. chr(4) not printable; try seed = 10: (10+2)%6 = 0 ✓
    // We can brute-force a simple name or just verify the bank entry directly
    const { standupMap, generateStandup } = useStepStandup()
    // Find a name whose seed+2 is divisible by 6
    // Iterate short test names
    const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa',
                   'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho', 'Sigma', 'Tau', 'Upsilon']
    let foundNone = false
    for (const name of names) {
      const seed = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
      if ((seed + 2) % 6 === 0) {
        generateStandup({ id: 'step-none', name })
        expect(standupMap.value['step-none'].blockers).toBe('None identified')
        foundNone = true
        break
      }
    }
    // If none of the test names happen to have the right seed, skip gracefully
    // but at least assert the bank entry exists
    if (!foundNone) {
      expect(blockerBank[0]).toBe('None identified')
    }
  })

  it('generateStandup stores stepId and stepName on the script', () => {
    const { standupMap, generateStandup } = useStepStandup()
    generateStandup({ id: 'step-7', name: 'Named Step' })
    expect(standupMap.value['step-7'].stepId).toBe('step-7')
    expect(standupMap.value['step-7'].stepName).toBe('Named Step')
  })
})
