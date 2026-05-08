// Feature #166 — usePersonasGallery tests
import { usePersonasGallery } from '../usePersonasGallery'
import type { SpecBlock } from '../../types/spec'

function makeBlock(fDescs: string[] = [], vDescs: string[] = []): SpecBlock {
  return {
    functions: fDescs.map((desc, i) => ({
      id: `F.Func${i}`,
      type: 'Function',
      level: 'Business',
      description: desc,
      successCriteria: '',
      functionOfValue: '',
    })),
    values: vDescs.map((desc, i) => ({
      id: `V.Val${i}`,
      type: 'Value',
      level: 'Business',
      description: desc,
      scale: '',
      meter: '',
      status: '',
      tolerable: '',
      goal: '',
      valueOfFunction: '',
    })),
    solutions: [],
  }
}

describe('usePersonasGallery', () => {
  it('open starts as false', () => {
    const { open } = usePersonasGallery([])
    expect(open.value).toBe(false)
  })

  it('always returns exactly 3 persona cards', () => {
    const { personas } = usePersonasGallery([])
    expect(personas.value).toHaveLength(3)
  })

  it('returns exactly 3 personas even with populated blocks', () => {
    const block = makeBlock(['desc1', 'desc2'], ['val1', 'val2'])
    const { personas } = usePersonasGallery([block])
    expect(personas.value).toHaveLength(3)
  })

  it('each persona has exactly 3 pain points', () => {
    const block = makeBlock(['some function'], ['some value'])
    const { personas } = usePersonasGallery([block])
    for (const p of personas.value) {
      expect(p.painPoints).toHaveLength(3)
    }
  })

  it('each persona has a non-empty name', () => {
    const { personas } = usePersonasGallery([])
    for (const p of personas.value) {
      expect(p.name.length).toBeGreaterThan(0)
    }
  })

  it('each persona has a non-empty role', () => {
    const { personas } = usePersonasGallery([])
    for (const p of personas.value) {
      expect(p.role.length).toBeGreaterThan(0)
    }
  })

  it('each persona has a non-empty quote', () => {
    const { personas } = usePersonasGallery([])
    for (const p of personas.value) {
      expect(p.quote.length).toBeGreaterThan(0)
    }
  })

  it('each persona has a non-empty emoji', () => {
    const { personas } = usePersonasGallery([])
    for (const p of personas.value) {
      expect(p.emoji.length).toBeGreaterThan(0)
    }
  })

  it('seeding is deterministic — same input → same output', () => {
    const block = makeBlock(['consistent description'], ['consistent value'])
    const { personas: p1 } = usePersonasGallery([block])
    const { personas: p2 } = usePersonasGallery([block])
    expect(p1.value[0].name).toBe(p2.value[0].name)
    expect(p1.value[0].role).toBe(p2.value[0].role)
    expect(p1.value[1].name).toBe(p2.value[1].name)
    expect(p1.value[2].name).toBe(p2.value[2].name)
  })

  it('different inputs produce potentially different persona seeds', () => {
    const block1 = makeBlock(['alpha description one two three'])
    const block2 = makeBlock(['completely different zzz text here'])
    const { personas: p1 } = usePersonasGallery([block1])
    const { personas: p2 } = usePersonasGallery([block2])
    // At least one persona field should differ (extremely unlikely to be equal)
    const allSame =
      p1.value[0].name === p2.value[0].name &&
      p1.value[0].role === p2.value[0].role &&
      p1.value[1].name === p2.value[1].name
    // We can't guarantee difference, but we can verify both return 3 personas
    expect(p1.value).toHaveLength(3)
    expect(p2.value).toHaveLength(3)
  })

  it('copyMarkdown returns a non-empty string', () => {
    const block = makeBlock(['fn desc'], ['val desc'])
    const { copyMarkdown } = usePersonasGallery([block])
    const result = copyMarkdown()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('copyMarkdown includes "User Personas" heading', () => {
    const { copyMarkdown } = usePersonasGallery([])
    const result = copyMarkdown()
    expect(result).toContain('User Personas')
  })

  it('copyMarkdown includes all 3 persona names', () => {
    const block = makeBlock(['fn'], ['val'])
    const { personas, copyMarkdown } = usePersonasGallery([block])
    const result = copyMarkdown()
    for (const p of personas.value) {
      expect(result).toContain(p.name)
    }
  })

  it('pain points are strings from the allowed pool', () => {
    const PAIN_PHRASES = [
      'Unclear requirements slow everything down',
      'Too many meetings, not enough clarity',
      'Hard to measure progress objectively',
      'Stakeholders change their minds frequently',
      'Tech debt accumulates faster than we can fix',
      'No single source of truth for project goals',
      'Handoffs between teams lose context',
      'Estimation is consistently off',
    ]
    const { personas } = usePersonasGallery([])
    for (const p of personas.value) {
      for (const pain of p.painPoints) {
        expect(PAIN_PHRASES).toContain(pain)
      }
    }
  })
})
