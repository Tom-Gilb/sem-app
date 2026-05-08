// UNIT_TYPE=Test
// Feature #180 — Tests for useSprintReview composable

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSprintReview } from '../useSprintReview'

// Seed helper mirrored from composable
function seed(s: string, mod: number): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mod
}

const DEMO_ITEMS = [
  'Demonstrated working prototype to stakeholders',
  'Showed live system integration',
  'Presented performance benchmark results',
  'Walked through user acceptance criteria',
  'Demoed error handling and edge cases',
  'Showed automated test results dashboard',
  'Presented API contract documentation',
  'Demoed accessibility compliance report',
]

const DECISIONS = [
  'Agreed to proceed with current implementation approach',
  'Deferred scope to next sprint',
  'Prioritised critical path items first',
  'Approved technical architecture decision',
  'Resolved ambiguity in acceptance criteria',
  'Confirmed stakeholder sign-off timeline',
  'Agreed to increase test coverage threshold',
  'Decided to add monitoring instrumentation',
]

const BLOCKERS = [
  'Resolved environment configuration issue',
  'Unblocked pending code review',
  'Cleared dependency on external team',
  'Fixed CI/CD pipeline failure',
  'Resolved merge conflict in shared module',
  'Obtained stakeholder approval for API design',
  'Removed requirement ambiguity',
  'Fixed test flakiness issue',
]

const NEXT_ACTIONS = [
  'Write retrospective summary note',
  'Update definition of done documentation',
  'Share demo recording with wider team',
  'Schedule follow-up with stakeholders',
  'Create tickets for deferred items',
  'Update sprint velocity tracker',
  'Review and close resolved blockers',
  'Plan next sprint kick-off',
]

const ALL_POOLS = [DEMO_ITEMS, DECISIONS, BLOCKERS, NEXT_ACTIONS]

const STEPS = [
  { id: 'step-0', title: 'Discovery' },
  { id: 'step-1', title: 'Implementation' },
  { id: 'step-2', title: 'Delivery' },
]

describe('useSprintReview', () => {
  // 1 — openSteps starts empty
  it('openSteps starts as empty set', () => {
    const { openSteps } = useSprintReview(() => STEPS)
    expect(openSteps.value.size).toBe(0)
  })

  // 2 — toggleOpen adds step to openSteps
  it('toggleOpen adds a stepId to openSteps', () => {
    const { openSteps, toggleOpen } = useSprintReview(() => STEPS)
    toggleOpen('step-0')
    expect(openSteps.value.has('step-0')).toBe(true)
  })

  // 3 — toggleOpen removes step when already open
  it('toggleOpen removes a stepId that is already open', () => {
    const { openSteps, toggleOpen } = useSprintReview(() => STEPS)
    toggleOpen('step-0')
    toggleOpen('step-0')
    expect(openSteps.value.has('step-0')).toBe(false)
  })

  // 4 — isOpen returns false for closed step
  it('isOpen returns false for a step that has not been toggled', () => {
    const { isOpen } = useSprintReview(() => STEPS)
    expect(isOpen('step-0')).toBe(false)
  })

  // 5 — isOpen returns true after toggle
  it('isOpen returns true after toggleOpen is called', () => {
    const { isOpen, toggleOpen } = useSprintReview(() => STEPS)
    toggleOpen('step-1')
    expect(isOpen('step-1')).toBe(true)
  })

  // 6 — getReview returns 4 sections
  it('getReview returns exactly 4 sections', () => {
    const { getReview } = useSprintReview(() => STEPS)
    const review = getReview('step-0', 'Discovery')
    expect(review.sections).toHaveLength(4)
  })

  // 7 — each section has exactly 2 items
  it('each section has exactly 2 items', () => {
    const { getReview } = useSprintReview(() => STEPS)
    const review = getReview('step-0', 'Discovery')
    for (const section of review.sections) {
      expect(section.items).toHaveLength(2)
    }
  })

  // 8 — section titles are correct
  it('section titles match expected titles', () => {
    const { getReview } = useSprintReview(() => STEPS)
    const review = getReview('step-0', 'Discovery')
    expect(review.sections[0].title).toBe('Demo Items')
    expect(review.sections[1].title).toBe('Decisions Made')
    expect(review.sections[2].title).toBe('Blockers Cleared')
    expect(review.sections[3].title).toBe('Next Actions')
  })

  // 9 — items come from correct pools
  it('Demo Items section items come from the demo pool', () => {
    const { getReview } = useSprintReview(() => STEPS)
    const review = getReview('step-0', 'Discovery')
    for (const item of review.sections[0].items) {
      expect(DEMO_ITEMS).toContain(item)
    }
  })

  // 10 — Decisions section items come from decisions pool
  it('Decisions Made section items come from the decisions pool', () => {
    const { getReview } = useSprintReview(() => STEPS)
    const review = getReview('step-1', 'Implementation')
    for (const item of review.sections[1].items) {
      expect(DECISIONS).toContain(item)
    }
  })

  // 11 — Blockers Cleared items come from blockers pool
  it('Blockers Cleared items come from the blockers pool', () => {
    const { getReview } = useSprintReview(() => STEPS)
    const review = getReview('step-2', 'Delivery')
    for (const item of review.sections[2].items) {
      expect(BLOCKERS).toContain(item)
    }
  })

  // 12 — Next Actions items come from next actions pool
  it('Next Actions items come from the next actions pool', () => {
    const { getReview } = useSprintReview(() => STEPS)
    const review = getReview('step-2', 'Delivery')
    for (const item of review.sections[3].items) {
      expect(NEXT_ACTIONS).toContain(item)
    }
  })

  // 13 — items within a section are distinct
  it('two items within a section are not identical', () => {
    const { getReview } = useSprintReview(() => STEPS)
    for (const step of STEPS) {
      const review = getReview(step.id, step.title)
      for (const section of review.sections) {
        expect(section.items[0]).not.toBe(section.items[1])
      }
    }
  })

  // 14 — seeding is deterministic
  it('getReview is deterministic for the same stepId', () => {
    const { getReview: getReview1 } = useSprintReview(() => STEPS)
    const { getReview: getReview2 } = useSprintReview(() => STEPS)
    const r1 = getReview1('step-0', 'Discovery')
    const r2 = getReview2('step-0', 'Discovery')
    expect(r1.sections).toEqual(r2.sections)
  })

  // 15 — copiedSteps starts empty
  it('copiedSteps starts as empty set', () => {
    const { copiedSteps } = useSprintReview(() => STEPS)
    expect(copiedSteps.value.size).toBe(0)
  })

  // 16 — copyReview adds stepId to copiedSteps
  it('copyReview adds the stepId to copiedSteps', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    const { copiedSteps, copyReview } = useSprintReview(() => STEPS)
    await copyReview('step-0')
    expect(copiedSteps.value.has('step-0')).toBe(true)
    vi.unstubAllGlobals()
  })

  // 17 — copyReview output contains section headers
  it('copyReview clipboard text contains "### Demo Items"', async () => {
    let clipboardContent = ''
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: async (text: string) => {
          clipboardContent = text
        },
      },
    })
    const { copyReview } = useSprintReview(() => STEPS)
    await copyReview('step-0')
    expect(clipboardContent).toContain('### Demo Items')
    expect(clipboardContent).toContain('### Decisions Made')
    expect(clipboardContent).toContain('### Blockers Cleared')
    expect(clipboardContent).toContain('### Next Actions')
    vi.unstubAllGlobals()
  })

  // 18 — copyReview output contains stepTitle
  it('copyReview clipboard text contains the step title', async () => {
    let clipboardContent = ''
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: async (text: string) => {
          clipboardContent = text
        },
      },
    })
    const { copyReview } = useSprintReview(() => STEPS)
    await copyReview('step-1')
    expect(clipboardContent).toContain('Implementation')
    vi.unstubAllGlobals()
  })

  // 19 — seeded items match seed formula
  it('seeded item indices match seed formula', () => {
    const { getReview } = useSprintReview(() => STEPS)
    const stepId = 'step-0'
    const review = getReview(stepId, 'Discovery')
    for (let si = 0; si < 4; si++) {
      const i0 = seed(stepId + String(si) + '0', 8)
      let i1 = seed(stepId + String(si) + '1', 8)
      if (i1 === i0) i1 = (i1 + 1) % 8
      expect(review.sections[si].items[0]).toBe(ALL_POOLS[si][i0])
      expect(review.sections[si].items[1]).toBe(ALL_POOLS[si][i1])
    }
  })

  // 20 — multiple steps can be open simultaneously
  it('multiple steps can be open simultaneously', () => {
    const { openSteps, toggleOpen } = useSprintReview(() => STEPS)
    toggleOpen('step-0')
    toggleOpen('step-1')
    expect(openSteps.value.has('step-0')).toBe(true)
    expect(openSteps.value.has('step-1')).toBe(true)
  })

  // 21 — stepId is included in review object
  it('getReview includes the stepId in the returned object', () => {
    const { getReview } = useSprintReview(() => STEPS)
    const review = getReview('step-2', 'Delivery')
    expect(review.stepId).toBe('step-2')
  })
})
