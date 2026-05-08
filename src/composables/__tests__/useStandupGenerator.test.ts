// UNIT_TYPE=Test
// Feature #145 — Tests for useStandupGenerator composable

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useStandupGenerator } from '../useStandupGenerator'

beforeEach(() => {
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    },
    writable: true,
    configurable: true,
  })
  vi.useFakeTimers()
})

const STEP_A = { id: 'step-0', name: 'Setup Infrastructure', effort: 10 }
const STEP_B = { id: 'step-1', name: 'Build Core API', effort: 20 }
const STEP_C = { id: 'step-2', name: 'Write Tests', effort: 8 }

describe('useStandupGenerator', () => {
  it('standupMap initialised empty', () => {
    const steps = ref([STEP_A])
    const { standupMap } = useStandupGenerator(steps)
    expect(Object.keys(standupMap.value)).toHaveLength(0)
  })

  it('generate creates an entry for the given stepId', () => {
    const steps = ref([STEP_A])
    const { standupMap, generate } = useStandupGenerator(steps)
    generate(STEP_A.id)
    expect(standupMap.value[STEP_A.id]).toBeDefined()
  })

  it('entry has all required fields', () => {
    const steps = ref([STEP_A])
    const { standupMap, generate } = useStandupGenerator(steps)
    generate(STEP_A.id)
    const entry = standupMap.value[STEP_A.id]
    expect(entry.stepId).toBe(STEP_A.id)
    expect(entry.stepName).toBe(STEP_A.name)
    expect(typeof entry.yesterday).toBe('string')
    expect(typeof entry.today).toBe('string')
    expect(typeof entry.blockers).toBe('string')
    expect(typeof entry.isOpen).toBe('boolean')
  })

  it('yesterday value is from the expected bank', () => {
    const YESTERDAY_BANK = [
      'Completed initial implementation',
      'Reviewed PR and addressed feedback',
      'Wrote unit tests for core logic',
      'Debugged integration issues',
      'Paired with teammate on design',
      'Refined acceptance criteria',
      'Updated documentation',
      'Ran spike on technical approach',
    ]
    const steps = ref([STEP_A])
    const { standupMap, generate } = useStandupGenerator(steps)
    generate(STEP_A.id)
    expect(YESTERDAY_BANK).toContain(standupMap.value[STEP_A.id].yesterday)
  })

  it('today value is from the expected bank', () => {
    const TODAY_BANK = [
      'Continue implementation of main feature',
      'Address code review comments',
      'Write integration tests',
      'Refactor for clarity',
      'Sync with stakeholders',
      'Complete remaining tasks',
      'Begin next sub-task',
      'Investigate blocking issue',
    ]
    const steps = ref([STEP_A])
    const { standupMap, generate } = useStandupGenerator(steps)
    generate(STEP_A.id)
    expect(TODAY_BANK).toContain(standupMap.value[STEP_A.id].today)
  })

  it('blockers value is from the expected bank', () => {
    const BLOCKERS_BANK = [
      'None currently',
      'Waiting on API access',
      'Need design clarification',
      'Blocked by dependency',
      'Awaiting stakeholder sign-off',
      'Environment setup issue',
    ]
    const steps = ref([STEP_A])
    const { standupMap, generate } = useStandupGenerator(steps)
    generate(STEP_A.id)
    expect(BLOCKERS_BANK).toContain(standupMap.value[STEP_A.id].blockers)
  })

  it('deterministic: same step produces same output on repeated calls', () => {
    const steps = ref([STEP_A])
    const { standupMap, generate } = useStandupGenerator(steps)
    generate(STEP_A.id)
    const first = { ...standupMap.value[STEP_A.id] }
    generate(STEP_A.id)
    const second = { ...standupMap.value[STEP_A.id] }
    expect(first.yesterday).toBe(second.yesterday)
    expect(first.today).toBe(second.today)
    expect(first.blockers).toBe(second.blockers)
  })

  it('different steps can produce different entries', () => {
    const steps = ref([STEP_A, STEP_B])
    const { standupMap, generate } = useStandupGenerator(steps)
    generate(STEP_A.id)
    generate(STEP_B.id)
    expect(standupMap.value[STEP_A.id]).toBeDefined()
    expect(standupMap.value[STEP_B.id]).toBeDefined()
    // Both entries must be valid
    expect(typeof standupMap.value[STEP_A.id].yesterday).toBe('string')
    expect(typeof standupMap.value[STEP_B.id].yesterday).toBe('string')
  })

  it('generateAll creates entries for all steps', () => {
    const steps = ref([STEP_A, STEP_B, STEP_C])
    const { standupMap, generateAll } = useStandupGenerator(steps)
    generateAll()
    expect(Object.keys(standupMap.value)).toHaveLength(3)
  })

  it('generateAll with empty steps list produces no entries', () => {
    const steps = ref<typeof STEP_A[]>([])
    const { standupMap, generateAll } = useStandupGenerator(steps)
    generateAll()
    expect(Object.keys(standupMap.value)).toHaveLength(0)
  })

  it('toggleOpen flips isOpen from false to true', () => {
    const steps = ref([STEP_A])
    const { standupMap, generate, toggleOpen } = useStandupGenerator(steps)
    generate(STEP_A.id)
    expect(standupMap.value[STEP_A.id].isOpen).toBe(false)
    toggleOpen(STEP_A.id)
    expect(standupMap.value[STEP_A.id].isOpen).toBe(true)
  })

  it('toggleOpen flips isOpen from true back to false', () => {
    const steps = ref([STEP_A])
    const { standupMap, generate, toggleOpen } = useStandupGenerator(steps)
    generate(STEP_A.id)
    toggleOpen(STEP_A.id)
    expect(standupMap.value[STEP_A.id].isOpen).toBe(true)
    toggleOpen(STEP_A.id)
    expect(standupMap.value[STEP_A.id].isOpen).toBe(false)
  })

  it('toggleOpen on unknown stepId auto-generates then opens', () => {
    const steps = ref([STEP_A])
    const { standupMap, toggleOpen } = useStandupGenerator(steps)
    toggleOpen(STEP_A.id)
    expect(standupMap.value[STEP_A.id]).toBeDefined()
    expect(standupMap.value[STEP_A.id].isOpen).toBe(true)
  })

  it('copyStandup writes correct markdown format', () => {
    const steps = ref([STEP_A])
    const { generate, copyStandup } = useStandupGenerator(steps)
    generate(STEP_A.id)
    copyStandup(STEP_A.id)
    const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(written).toContain(`## Standup — ${STEP_A.name}`)
    expect(written).toContain('**Yesterday:**')
    expect(written).toContain('**Today:**')
    expect(written).toContain('**Blockers:**')
  })

  it('standupCopied is set to stepId immediately after copyStandup', () => {
    const steps = ref([STEP_A])
    const { standupCopied, generate, copyStandup } = useStandupGenerator(steps)
    generate(STEP_A.id)
    copyStandup(STEP_A.id)
    expect(standupCopied.value).toBe(STEP_A.id)
  })

  it('standupCopied resets to null after 2 seconds', () => {
    const steps = ref([STEP_A])
    const { standupCopied, generate, copyStandup } = useStandupGenerator(steps)
    generate(STEP_A.id)
    copyStandup(STEP_A.id)
    expect(standupCopied.value).toBe(STEP_A.id)
    vi.advanceTimersByTime(2000)
    expect(standupCopied.value).toBeNull()
  })

  it('generate on non-existent stepId does nothing', () => {
    const steps = ref([STEP_A])
    const { standupMap, generate } = useStandupGenerator(steps)
    generate('unknown-id')
    expect(standupMap.value['unknown-id']).toBeUndefined()
  })
})
