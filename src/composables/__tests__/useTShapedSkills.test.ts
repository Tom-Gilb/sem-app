// Feature #155 — useTShapedSkills tests
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import {
  useTShapedSkills,
  buildTSkillEntry,
  charCodeSeed,
  spiderPolygonPoints,
  spiderSpokes,
  type TSkillsStep,
} from '../useTShapedSkills'

const DOMAINS = ['Frontend', 'Backend', 'Data', 'DevOps', 'QA'] as const

const makeStep = (id: string, name: string): TSkillsStep => ({ id, name })

// ── Helper: compute expected seed ────────────────────────────────────────────

function seed(id: string, name: string): number {
  const str = id + name
  return Array.from(str).reduce((acc, c) => acc + c.charCodeAt(0), 0)
}

describe('useTShapedSkills', () => {
  // 1 — entries count matches steps count
  it('returns one entry per step', () => {
    const steps = ref([makeStep('s1', 'Step A'), makeStep('s2', 'Step B'), makeStep('s3', 'Step C')])
    const { entries } = useTShapedSkills(steps)
    expect(entries.value).toHaveLength(3)
  })

  // 2 — empty steps yields empty entries
  it('returns empty entries for empty steps', () => {
    const steps = ref<TSkillsStep[]>([])
    const { entries } = useTShapedSkills(steps)
    expect(entries.value).toHaveLength(0)
  })

  // 3 — depthDomain is always one of the 5 domains
  it('depthDomain is always a valid domain', () => {
    const steps = ref([makeStep('a', 'alpha'), makeStep('b', 'beta'), makeStep('c', 'gamma')])
    const { entries } = useTShapedSkills(steps)
    for (const e of entries.value) {
      expect(DOMAINS).toContain(e.depthDomain)
    }
  })

  // 4 — depthDomain assigned by seed % 5
  it('depthDomain matches seed % 5 index', () => {
    const step = makeStep('step-0', 'Alpha')
    const s = seed('step-0', 'Alpha')
    const expected = DOMAINS[s % 5]
    const entry = buildTSkillEntry(step)
    expect(entry.depthDomain).toBe(expected)
  })

  // 5 — depthScore in range 70–100
  it('depthScore is in range 70–100', () => {
    const steps = ref([makeStep('x', 'TestStep'), makeStep('y', 'OtherStep')])
    const { entries } = useTShapedSkills(steps)
    for (const e of entries.value) {
      expect(e.depthScore).toBeGreaterThanOrEqual(70)
      expect(e.depthScore).toBeLessThanOrEqual(100)
    }
  })

  // 6 — broadScore in range 20–60
  it('broadScore is in range 20–60', () => {
    const steps = ref([makeStep('p', 'PlanStep'), makeStep('q', 'QualityStep')])
    const { entries } = useTShapedSkills(steps)
    for (const e of entries.value) {
      expect(e.broadScore).toBeGreaterThanOrEqual(20)
      expect(e.broadScore).toBeLessThanOrEqual(60)
    }
  })

  // 7 — breadthDomains has exactly 3 entries
  it('breadthDomains always has exactly 3 entries', () => {
    const steps = ref([makeStep('s1', 'Step A'), makeStep('s2', 'Step B'), makeStep('s3', 'Step C'), makeStep('s4', 'Step D'), makeStep('s5', 'Step E')])
    const { entries } = useTShapedSkills(steps)
    for (const e of entries.value) {
      expect(e.breadthDomains).toHaveLength(3)
    }
  })

  // 8 — breadthDomains never contains depthDomain
  it('breadthDomains never contains the depthDomain', () => {
    const steps = ref([makeStep('s1', 'Step A'), makeStep('s2', 'Step B'), makeStep('s3', 'Step C'), makeStep('s4', 'Step D'), makeStep('s5', 'Step E')])
    const { entries } = useTShapedSkills(steps)
    for (const e of entries.value) {
      expect(e.breadthDomains).not.toContain(e.depthDomain)
    }
  })

  // 9 — all breadthDomains are valid domains
  it('breadthDomains contains only valid domain names', () => {
    const steps = ref([makeStep('a', 'Alpha'), makeStep('b', 'Beta')])
    const { entries } = useTShapedSkills(steps)
    for (const e of entries.value) {
      for (const d of e.breadthDomains) {
        expect(DOMAINS).toContain(d)
      }
    }
  })

  // 10 — detection is deterministic
  it('buildTSkillEntry is deterministic for the same step', () => {
    const step = makeStep('step-3', 'Build Backend')
    const e1 = buildTSkillEntry(step)
    const e2 = buildTSkillEntry(step)
    expect(e1).toEqual(e2)
  })

  // 11 — charCodeSeed computed correctly
  it('charCodeSeed returns correct value for known input', () => {
    const step = makeStep('ab', 'cd')
    // 'a'=97,'b'=98,'c'=99,'d'=100 → 394
    expect(charCodeSeed(step)).toBe(97 + 98 + 99 + 100)
  })

  // 12 — toggleOpen / isOpen works
  it('toggleOpen toggles isOpen state', () => {
    const steps = ref([makeStep('s1', 'Step A')])
    const { toggleOpen, isOpen } = useTShapedSkills(steps)
    expect(isOpen('s1')).toBe(false)
    toggleOpen('s1')
    expect(isOpen('s1')).toBe(true)
    toggleOpen('s1')
    expect(isOpen('s1')).toBe(false)
  })

  // 13 — copyMarkdown produces pipe table with correct columns
  it('copyMarkdown produces a pipe table with correct headers', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
    })
    const steps = ref([makeStep('s1', 'My Step')])
    const { copyMarkdown } = useTShapedSkills(steps)
    copyMarkdown()
    const md: string = writeTextMock.mock.calls[0][0]
    expect(md).toContain('| Step |')
    expect(md).toContain('| Depth Domain |')
    expect(md).toContain('| Depth % |')
    expect(md).toContain('| Breadth Domains |')
    expect(md).toContain('| Broad % |')
  })

  // 14 — copyMarkdown includes step name in table
  it('copyMarkdown includes the step name in the table rows', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
    })
    const steps = ref([makeStep('s1', 'Deploy Pipeline')])
    const { copyMarkdown } = useTShapedSkills(steps)
    copyMarkdown()
    const md: string = writeTextMock.mock.calls[0][0]
    expect(md).toContain('Deploy Pipeline')
  })

  // 15 — copied flips to true and resets after 2s
  it('copied flips to true on copyMarkdown and resets after 2s', async () => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
    })
    const steps = ref<TSkillsStep[]>([])
    const { copyMarkdown, copied } = useTShapedSkills(steps)
    expect(copied.value).toBe(false)
    copyMarkdown()
    expect(copied.value).toBe(true)
    vi.advanceTimersByTime(2001)
    expect(copied.value).toBe(false)
    vi.useRealTimers()
  })

  // 16 — spiderPolygonPoints returns string with correct number of points
  it('spiderPolygonPoints returns 5 coordinate pairs', () => {
    const entry = buildTSkillEntry(makeStep('s1', 'My Step'))
    const pts = spiderPolygonPoints(entry, 40, 40, 40)
    const pairs = pts.trim().split(' ').filter(Boolean)
    expect(pairs).toHaveLength(5)
  })

  // 17 — spiderSpokes returns 5 spokes with labels
  it('spiderSpokes returns 5 spokes with domain labels', () => {
    const spokes = spiderSpokes(40, 40, 40)
    expect(spokes).toHaveLength(5)
    const labels = spokes.map(s => s.label)
    for (const d of DOMAINS) {
      expect(labels).toContain(d)
    }
  })

  // 18 — entries update reactively when steps change
  it('entries update reactively when steps are updated', () => {
    const steps = ref([makeStep('s1', 'Step A')])
    const { entries } = useTShapedSkills(steps)
    expect(entries.value).toHaveLength(1)
    steps.value = [...steps.value, makeStep('s2', 'Step B')]
    expect(entries.value).toHaveLength(2)
  })
})
