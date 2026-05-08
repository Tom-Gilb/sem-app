// UNIT_TYPE=Test
// Feature #148 — Tests for useMeetingAgenda composable

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useMeetingAgenda } from '../useMeetingAgenda'

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
const STEP_C = { id: 'step-2', name: 'Write Tests' } // no effort

describe('useMeetingAgenda', () => {
  it('agendaMap initialised empty', () => {
    const steps = ref([STEP_A])
    const { agendaMap } = useMeetingAgenda(steps)
    expect(Object.keys(agendaMap.value)).toHaveLength(0)
  })

  it('toggleOpen creates an entry for a step', () => {
    const steps = ref([STEP_A])
    const { agendaMap, toggleOpen } = useMeetingAgenda(steps)
    toggleOpen(STEP_A.id)
    expect(agendaMap.value[STEP_A.id]).toBeDefined()
  })

  it('entry has exactly 5 sections', () => {
    const steps = ref([STEP_A])
    const { agendaMap, toggleOpen } = useMeetingAgenda(steps)
    toggleOpen(STEP_A.id)
    expect(agendaMap.value[STEP_A.id].sections).toHaveLength(5)
  })

  it('section titles match fixed list', () => {
    const EXPECTED_TITLES = [
      'Context & Goals',
      'Progress Review',
      'Decisions Needed',
      'Task Assignments',
      'Next Steps & Actions',
    ]
    const steps = ref([STEP_A])
    const { agendaMap, toggleOpen } = useMeetingAgenda(steps)
    toggleOpen(STEP_A.id)
    const titles = agendaMap.value[STEP_A.id].sections.map((s) => s.title)
    expect(titles).toEqual(EXPECTED_TITLES)
  })

  it('section durations are [5, 10, 10, 10, 5]', () => {
    const steps = ref([STEP_A])
    const { agendaMap, toggleOpen } = useMeetingAgenda(steps)
    toggleOpen(STEP_A.id)
    const durations = agendaMap.value[STEP_A.id].sections.map((s) => s.duration)
    expect(durations).toEqual([5, 10, 10, 10, 5])
  })

  it('total duration always sums to 40', () => {
    const steps = ref([STEP_A, STEP_B])
    const { agendaMap, toggleOpen } = useMeetingAgenda(steps)
    toggleOpen(STEP_A.id)
    toggleOpen(STEP_B.id)
    for (const id of [STEP_A.id, STEP_B.id]) {
      const total = agendaMap.value[id].sections.reduce((sum, s) => sum + s.duration, 0)
      expect(total).toBe(40)
    }
  })

  it('Decisions Needed content is from the expected bank', () => {
    const DECISIONS_BANK = [
      'API contract',
      'Tech stack choice',
      'Scope boundary',
      'Release criteria',
      'Resource allocation',
      'Risk acceptance',
    ]
    const steps = ref([STEP_A])
    const { agendaMap, toggleOpen } = useMeetingAgenda(steps)
    toggleOpen(STEP_A.id)
    const decisionsSection = agendaMap.value[STEP_A.id].sections.find(
      (s) => s.title === 'Decisions Needed',
    )
    expect(decisionsSection).toBeDefined()
    expect(DECISIONS_BANK).toContain(decisionsSection!.content)
  })

  it('Task Assignments uses step.effort when provided', () => {
    const steps = ref([STEP_A])
    const { agendaMap, toggleOpen } = useMeetingAgenda(steps)
    toggleOpen(STEP_A.id)
    const assignSection = agendaMap.value[STEP_A.id].sections.find(
      (s) => s.title === 'Task Assignments',
    )
    expect(assignSection?.content).toContain(`${STEP_A.effort}h`)
  })

  it('Task Assignments defaults effort to 4 when not provided', () => {
    const steps = ref([STEP_C])
    const { agendaMap, toggleOpen } = useMeetingAgenda(steps)
    toggleOpen(STEP_C.id)
    const assignSection = agendaMap.value[STEP_C.id].sections.find(
      (s) => s.title === 'Task Assignments',
    )
    expect(assignSection?.content).toContain('4h')
  })

  it('deterministic: same step produces same sections on repeated calls', () => {
    const steps = ref([STEP_A])
    const { agendaMap, toggleOpen } = useMeetingAgenda(steps)
    toggleOpen(STEP_A.id) // open
    const firstSections = agendaMap.value[STEP_A.id].sections.map((s) => s.content)
    toggleOpen(STEP_A.id) // close
    toggleOpen(STEP_A.id) // re-open (re-builds)
    const secondSections = agendaMap.value[STEP_A.id].sections.map((s) => s.content)
    expect(firstSections).toEqual(secondSections)
  })

  it('toggleOpen flips isOpen from false to true', () => {
    const steps = ref([STEP_A])
    const { agendaMap, toggleOpen } = useMeetingAgenda(steps)
    toggleOpen(STEP_A.id)
    expect(agendaMap.value[STEP_A.id].isOpen).toBe(true)
  })

  it('toggleOpen flips isOpen from true back to false', () => {
    const steps = ref([STEP_A])
    const { agendaMap, toggleOpen } = useMeetingAgenda(steps)
    toggleOpen(STEP_A.id)
    toggleOpen(STEP_A.id)
    expect(agendaMap.value[STEP_A.id].isOpen).toBe(false)
  })

  it('copyAgenda writes pipe-table markdown', () => {
    const steps = ref([STEP_A])
    const { toggleOpen, copyAgenda } = useMeetingAgenda(steps)
    toggleOpen(STEP_A.id)
    copyAgenda(STEP_A.id)
    const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(written).toContain(`## Meeting Agenda — ${STEP_A.name}`)
    expect(written).toContain('| # | Topic | Duration |')
    expect(written).toContain('|---|---|---|')
    expect(written).toContain('Context & Goals')
    expect(written).toContain('Next Steps & Actions')
  })

  it('agendaCopied is set to stepId immediately after copyAgenda', () => {
    const steps = ref([STEP_A])
    const { agendaCopied, toggleOpen, copyAgenda } = useMeetingAgenda(steps)
    toggleOpen(STEP_A.id)
    copyAgenda(STEP_A.id)
    expect(agendaCopied.value).toBe(STEP_A.id)
  })

  it('agendaCopied resets to null after 2 seconds', () => {
    const steps = ref([STEP_A])
    const { agendaCopied, toggleOpen, copyAgenda } = useMeetingAgenda(steps)
    toggleOpen(STEP_A.id)
    copyAgenda(STEP_A.id)
    expect(agendaCopied.value).toBe(STEP_A.id)
    vi.advanceTimersByTime(2000)
    expect(agendaCopied.value).toBeNull()
  })

  it('Context & Goals content includes aligning text', () => {
    const steps = ref([STEP_A])
    const { agendaMap, toggleOpen } = useMeetingAgenda(steps)
    toggleOpen(STEP_A.id)
    const contextSection = agendaMap.value[STEP_A.id].sections.find(
      (s) => s.title === 'Context & Goals',
    )
    expect(contextSection?.content).toContain('aligning team on current sprint goals')
  })

  it('empty steps list — toggleOpen on missing step does not throw', () => {
    const steps = ref<typeof STEP_A[]>([])
    const { agendaMap, toggleOpen } = useMeetingAgenda(steps)
    expect(() => toggleOpen('unknown-id')).not.toThrow()
    // Entry should not be created when step doesn't exist in the list
    expect(agendaMap.value['unknown-id']).toBeUndefined()
  })
})
