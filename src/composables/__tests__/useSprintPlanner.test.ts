// UNIT_TYPE=Test
// Feature #73 — Tests for useSprintPlanner composable

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import {
  nextMonday,
  addDays,
  formatSprintDate,
  useSprintPlanner,
} from '../useSprintPlanner'
import type { EvoStep } from '../../types/evo-plan'

// ── Helper to create a minimal EvoStep ──────────────────────────────────────

function makeStep(name: string, effortPercent: number): EvoStep {
  return {
    name,
    description: '',
    linkedValues: [],
    linkedSolution: '',
    effortPercent,
  }
}

// ── Date helper tests ────────────────────────────────────────────────────────

describe('nextMonday', () => {
  it('from a Monday returns the NEXT Monday (7 days ahead, not the same day)', () => {
    // 2026-05-04 is a Monday
    const monday = new Date(2026, 4, 4)  // month is 0-indexed → May = 4
    const result = nextMonday(monday)
    const expected = new Date(2026, 4, 11) // next Monday is May 11
    expect(result.getFullYear()).toBe(expected.getFullYear())
    expect(result.getMonth()).toBe(expected.getMonth())
    expect(result.getDate()).toBe(expected.getDate())
  })

  it('from a Saturday returns 2 days later (the following Monday)', () => {
    // 2026-05-02 is a Saturday
    const saturday = new Date(2026, 4, 2)
    const result = nextMonday(saturday)
    const expected = new Date(2026, 4, 4) // Monday May 4
    expect(result.getFullYear()).toBe(expected.getFullYear())
    expect(result.getMonth()).toBe(expected.getMonth())
    expect(result.getDate()).toBe(expected.getDate())
  })

  it('from a Sunday returns the following day (Monday)', () => {
    // 2026-05-03 is a Sunday
    const sunday = new Date(2026, 4, 3)
    const result = nextMonday(sunday)
    const expected = new Date(2026, 4, 4) // Monday May 4
    expect(result.getDate()).toBe(expected.getDate())
  })

  it('from a Tuesday returns the Monday of the following week', () => {
    // 2026-05-05 is a Tuesday
    const tuesday = new Date(2026, 4, 5)
    const result = nextMonday(tuesday)
    // Next Monday = May 11
    expect(result.getDate()).toBe(11)
    expect(result.getMonth()).toBe(4)
  })

  it('returns a Monday (getDay() === 1)', () => {
    const saturday = new Date(2026, 4, 2)
    const result = nextMonday(saturday)
    expect(result.getDay()).toBe(1)
  })
})

describe('addDays', () => {
  it('adds 13 days correctly', () => {
    const start = new Date(2026, 4, 4)   // May 4
    const result = addDays(start, 13)
    expect(result.getDate()).toBe(17)    // May 17
    expect(result.getMonth()).toBe(4)
  })

  it('adding 0 days returns the same date', () => {
    const d = new Date(2026, 4, 4)
    const result = addDays(d, 0)
    expect(result.getDate()).toBe(d.getDate())
    expect(result.getMonth()).toBe(d.getMonth())
  })

  it('crosses month boundary correctly', () => {
    const d = new Date(2026, 4, 25)    // May 25
    const result = addDays(d, 14)
    expect(result.getDate()).toBe(8)   // June 8
    expect(result.getMonth()).toBe(5)
  })

  it('does not mutate the original date', () => {
    const d = new Date(2026, 4, 4)
    const orig = d.getDate()
    addDays(d, 7)
    expect(d.getDate()).toBe(orig)
  })
})

describe('formatSprintDate', () => {
  it('returns "Mon 04 May 2026" format for 2026-05-04 (Monday)', () => {
    const d = new Date(2026, 4, 4)  // May 4 2026 — Monday
    expect(formatSprintDate(d)).toBe('Mon 04 May 2026')
  })

  it('pads single-digit day with a leading zero', () => {
    const d = new Date(2026, 4, 4)
    const result = formatSprintDate(d)
    expect(result).toMatch(/\d{2}/)
  })

  it('includes the full 4-digit year', () => {
    const d = new Date(2026, 4, 4)
    expect(formatSprintDate(d)).toContain('2026')
  })
})

// ── useSprintPlanner composable tests ────────────────────────────────────────

describe('useSprintPlanner', () => {
  it('empty steps → empty sprints array', () => {
    const steps = ref<EvoStep[]>([])
    const { sprints } = useSprintPlanner(steps)
    expect(sprints.value).toHaveLength(0)
  })

  it('single step → 1 sprint containing that step', () => {
    const steps = ref([makeStep('Foundation', 10)])  // 10% → 16 hrs → fits in sprint
    const { sprints } = useSprintPlanner(steps)
    expect(sprints.value).toHaveLength(1)
    expect(sprints.value[0].steps[0].title).toBe('Foundation')
  })

  it('steps whose total effort fits within 80 hrs → 1 sprint', () => {
    // 10% = 16 hrs, 20% = 32 hrs → total 48 hrs < 80
    const steps = ref([makeStep('Step A', 10), makeStep('Step B', 20)])
    const { sprints } = useSprintPlanner(steps)
    expect(sprints.value).toHaveLength(1)
    expect(sprints.value[0].steps).toHaveLength(2)
  })

  it('steps exceeding 80 hrs total → splits into 2+ sprints', () => {
    // 30% = 48 hrs, 30% = 48 hrs → 96 hrs > 80, should split into 2 sprints
    const steps = ref([makeStep('Step A', 30), makeStep('Step B', 30)])
    const { sprints } = useSprintPlanner(steps)
    expect(sprints.value.length).toBeGreaterThanOrEqual(2)
  })

  it('sprint names are "Sprint 1", "Sprint 2", etc.', () => {
    const steps = ref([makeStep('Step A', 30), makeStep('Step B', 30), makeStep('Step C', 30)])
    const { sprints } = useSprintPlanner(steps)
    sprints.value.forEach((s, i) => {
      expect(s.name).toBe(`Sprint ${i + 1}`)
    })
  })

  it('sprint endDate is always startDate + 13 days', () => {
    const steps = ref([makeStep('Step A', 10)])
    const { sprints } = useSprintPlanner(steps)
    const sprint = sprints.value[0]
    // Parse the dates back to validate the 13-day gap
    // startDate: "Mon 04 May 2026" → we check the day numbers
    const startParts = sprint.startDate.split(' ')
    const endParts = sprint.endDate.split(' ')
    const startDay = parseInt(startParts[1], 10)
    const endDay = parseInt(endParts[1], 10)
    // Either same month with 13 day difference, or cross-month — check via Date object
    const months: Record<string, number> = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    }
    const year = parseInt(startParts[3], 10)
    const startDate = new Date(year, months[startParts[2]], startDay)
    const endDate = new Date(year, months[endParts[2]], endDay)
    const diffMs = endDate.getTime() - startDate.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    expect(diffDays).toBe(13)
  })

  it('totalEffort in sprint matches sum of step efforts', () => {
    // 10% → 16 hrs, 20% → 32 hrs — both fit in one sprint
    const steps = ref([makeStep('Step A', 10), makeStep('Step B', 20)])
    const { sprints } = useSprintPlanner(steps)
    const sprint = sprints.value[0]
    const sumEfforts = sprint.steps.reduce((sum, s) => sum + s.effort, 0)
    expect(sprint.totalEffort).toBe(sumEfforts)
  })

  it('a single oversized step (>80 hrs) gets its own sprint', () => {
    // 60% → 96 hrs > 80 hrs capacity
    const steps = ref([makeStep('BigStep', 60)])
    const { sprints } = useSprintPlanner(steps)
    expect(sprints.value).toHaveLength(1)
    expect(sprints.value[0].steps[0].title).toBe('BigStep')
    expect(sprints.value[0].totalEffort).toBeGreaterThan(80)
  })

  it('copySprintBoard output contains "Sprint 1" and pipe characters', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    })

    const steps = ref([makeStep('Step A', 10)])
    const { copySprintBoard } = useSprintPlanner(steps)
    copySprintBoard()

    expect(writeTextMock).toHaveBeenCalledOnce()
    const output: string = writeTextMock.mock.calls[0][0]
    expect(output).toContain('Sprint 1')
    expect(output).toContain('|')
  })

  it('sprintOpen starts as false', () => {
    const steps = ref<EvoStep[]>([])
    const { sprintOpen } = useSprintPlanner(steps)
    expect(sprintOpen.value).toBe(false)
  })
})
