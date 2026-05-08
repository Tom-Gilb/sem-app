// UNIT_TYPE=Test
// Feature #139 — useUserJourney composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { useUserJourney } from '../useUserJourney'
import type { SpecBlock } from '../../types/spec'

function makeBlock(overrides?: {
  functions?: Array<{ id: string; description?: string; functionOfValue?: string }>
  values?: Array<{ id: string; goal?: string; description?: string; scale?: string; valueOfFunction?: string }>
  solutions?: Array<{ id: string }>
}): SpecBlock {
  return {
    functions: (overrides?.functions ?? []).map(f => ({
      id: f.id,
      type: 'Function',
      level: 'Product',
      description: f.description ?? '',
      successCriteria: '',
      functionOfValue: f.functionOfValue ?? '',
    })),
    values: (overrides?.values ?? []).map(v => ({
      id: v.id,
      type: 'Value',
      level: 'Product',
      description: v.description ?? '',
      scale: v.scale ?? '',
      meter: '',
      status: '',
      tolerable: '',
      goal: v.goal ?? '',
      valueOfFunction: v.valueOfFunction ?? '',
    })),
    solutions: (overrides?.solutions ?? []).map(s => ({
      id: s.id,
      type: 'Solution',
      level: 'Product',
      description: '',
      impact: '',
      function: '',
    })),
  }
}

afterEach(() => { vi.restoreAllMocks() })

describe('useUserJourney', () => {
  it('step count equals F. entry count', () => {
    const block = makeBlock({
      functions: [
        { id: 'F.Alpha' },
        { id: 'F.Beta' },
        { id: 'F.Gamma' },
      ],
    })
    const { steps } = useUserJourney([block])
    expect(steps.value).toHaveLength(3)
  })

  it('produces zero steps when no F. entries', () => {
    const block = makeBlock()
    const { steps } = useUserJourney([block])
    expect(steps.value).toHaveLength(0)
  })

  it('trigger starts with "When"', () => {
    const block = makeBlock({
      functions: [
        { id: 'F.CreateEntry' },
        { id: 'F.BuildReport' },
      ],
    })
    const { steps } = useUserJourney([block])
    for (const step of steps.value) {
      expect(step.trigger).toMatch(/^When /)
    }
  })

  it('trigger strips leading verb from F. entry id', () => {
    const block = makeBlock({
      functions: [{ id: 'F.CreateNewUser' }],
    })
    const { steps } = useUserJourney([block])
    expect(steps.value[0].trigger).toBe('When NewUser')
  })

  it('each step has an id matching the F. entry id', () => {
    const block = makeBlock({
      functions: [{ id: 'F.SpecEntry' }],
    })
    const { steps } = useUserJourney([block])
    expect(steps.value[0].id).toBe('F.SpecEntry')
  })

  it('action is non-empty for all steps', () => {
    const block = makeBlock({
      functions: [
        { id: 'F.Alpha', description: 'Does alpha things. And more.' },
        { id: 'F.Beta' },
      ],
    })
    const { steps } = useUserJourney([block])
    for (const step of steps.value) {
      expect(step.action.length).toBeGreaterThan(0)
    }
  })

  it('action uses first sentence of description', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Foo', description: 'First sentence here. Second sentence.' }],
    })
    const { steps } = useUserJourney([block])
    expect(steps.value[0].action).toBe('First sentence here')
  })

  it('action falls back to F. entry id when description is empty', () => {
    const block = makeBlock({
      functions: [{ id: 'F.SpecEntry', description: '' }],
    })
    const { steps } = useUserJourney([block])
    expect(steps.value[0].action).toBe('F.SpecEntry')
  })

  it('outcome falls back to "Improved outcome" when no V. entries', () => {
    const block = makeBlock({
      functions: [{ id: 'F.NoMatch' }],
      values: [],
    })
    const { steps } = useUserJourney([block])
    expect(steps.value[0].outcome).toBe('Improved outcome')
  })

  it('outcome is linked V. entry id when word overlap found', () => {
    const block = makeBlock({
      functions: [{ id: 'F.EntryFluency', description: 'Fluency entry creation for specification' }],
      values: [{ id: 'V.EntryFluency', description: 'Fluency for entry specification quality' }],
    })
    const { steps } = useUserJourney([block])
    expect(steps.value[0].outcome).toBe('V.EntryFluency')
  })

  it('fEntryId equals the F. entry id', () => {
    const block = makeBlock({
      functions: [{ id: 'F.SomeFunc' }],
    })
    const { steps } = useUserJourney([block])
    expect(steps.value[0].fEntryId).toBe('F.SomeFunc')
  })

  it('select(id) sets selectedId', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha' }],
    })
    const { select, selectedId } = useUserJourney([block])
    expect(selectedId.value).toBeNull()
    select('F.Alpha')
    expect(selectedId.value).toBe('F.Alpha')
  })

  it('select(id) toggles selectedId on second call', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha' }],
    })
    const { select, selectedId } = useUserJourney([block])
    select('F.Alpha')
    expect(selectedId.value).toBe('F.Alpha')
    select('F.Alpha')
    expect(selectedId.value).toBeNull()
  })

  it('isHighlighted returns true for all steps when nothing selected', () => {
    const block = makeBlock({
      functions: [{ id: 'F.A' }, { id: 'F.B' }],
    })
    const { isHighlighted } = useUserJourney([block])
    expect(isHighlighted('F.A')).toBe(true)
    expect(isHighlighted('F.B')).toBe(true)
  })

  it('isHighlighted returns true only for selected step when one is selected', () => {
    const block = makeBlock({
      functions: [{ id: 'F.A' }, { id: 'F.B' }],
    })
    const { select, isHighlighted } = useUserJourney([block])
    select('F.A')
    expect(isHighlighted('F.A')).toBe(true)
    expect(isHighlighted('F.B')).toBe(false)
  })

  it('highlighted field on each step reflects selection state', () => {
    const block = makeBlock({
      functions: [{ id: 'F.A' }, { id: 'F.B' }],
    })
    const { steps, select } = useUserJourney([block])
    expect(steps.value[0].highlighted).toBe(true)
    expect(steps.value[1].highlighted).toBe(true)
    select('F.A')
    expect(steps.value[0].highlighted).toBe(true)
    expect(steps.value[1].highlighted).toBe(false)
  })

  it('copyMarkdown writes a pipe table with Trigger, Action, Outcome columns', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const block = makeBlock({
      functions: [{ id: 'F.Alpha', description: 'Does alpha.' }],
      values: [],
    })
    const { copyMarkdown } = useUserJourney([block])
    await copyMarkdown()
    const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(written).toContain('| Trigger |')
    expect(written).toContain('| Action |')
    expect(written).toContain('| Outcome |')
  })

  it('copyMarkdown sets copied to true', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const block = makeBlock({
      functions: [{ id: 'F.Beta' }],
    })
    const { copyMarkdown, copied } = useUserJourney([block])
    expect(copied.value).toBe(false)
    await copyMarkdown()
    expect(copied.value).toBe(true)
  })
})
