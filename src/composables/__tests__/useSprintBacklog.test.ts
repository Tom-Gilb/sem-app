// Feature #167 — useSprintBacklog tests
import { useSprintBacklog } from '../useSprintBacklog'
import type { SpecBlock } from '../../types/spec'

const FIBONACCI = [1, 2, 3, 5, 8]

function makeBlock(fIds: string[], vIds: string[] = []): SpecBlock {
  return {
    functions: fIds.map(id => ({
      id,
      type: 'Function',
      level: 'Business',
      description: `Description for ${id} that is detailed enough`,
      successCriteria: '',
      functionOfValue: '',
    })),
    values: vIds.map(id => ({
      id,
      type: 'Value',
      level: 'Business',
      description: `Value description for ${id}`,
      scale: '',
      meter: '',
      status: '',
      tolerable: '',
      goal: 'Goal 50',
      valueOfFunction: '',
    })),
    solutions: [],
  }
}

describe('useSprintBacklog', () => {
  it('open starts as false', () => {
    const { open } = useSprintBacklog([])
    expect(open.value).toBe(false)
  })

  it('stories is empty for empty blocks', () => {
    const { stories } = useSprintBacklog([])
    expect(stories.value).toHaveLength(0)
  })

  it('stories count is 2 or 3 per F. entry', () => {
    const block = makeBlock(['F.Single'])
    const { stories } = useSprintBacklog([block])
    const count = stories.value.length
    expect(count).toBeGreaterThanOrEqual(2)
    expect(count).toBeLessThanOrEqual(3)
  })

  it('produces 2–3 stories per each F. entry across multiple entries', () => {
    const block = makeBlock(['F.A', 'F.B', 'F.C'])
    const { stories } = useSprintBacklog([block])
    const byParent: Record<string, number> = {}
    for (const s of stories.value) {
      byParent[s.parentFId] = (byParent[s.parentFId] ?? 0) + 1
    }
    for (const [, count] of Object.entries(byParent)) {
      expect(count).toBeGreaterThanOrEqual(2)
      expect(count).toBeLessThanOrEqual(3)
    }
  })

  it('all story points are Fibonacci numbers', () => {
    const block = makeBlock(['F.Alpha', 'F.Beta', 'F.Gamma', 'F.Delta'])
    const { stories } = useSprintBacklog([block])
    for (const s of stories.value) {
      expect(FIBONACCI).toContain(s.storyPoints)
    }
  })

  it('story IDs follow "F-N.M" format', () => {
    const block = makeBlock(['F.One', 'F.Two'])
    const { stories } = useSprintBacklog([block])
    for (const s of stories.value) {
      expect(s.storyId).toMatch(/^F-\d+\.\d+$/)
    }
  })

  it('each story has exactly 2 acceptance criteria', () => {
    const block = makeBlock(['F.WithAC'])
    const { stories } = useSprintBacklog([block])
    for (const s of stories.value) {
      expect(s.acceptanceCriteria).toHaveLength(2)
    }
  })

  it('each story title starts with "As a"', () => {
    const block = makeBlock(['F.UserStory'])
    const { stories } = useSprintBacklog([block])
    for (const s of stories.value) {
      expect(s.title).toMatch(/^As a/)
    }
  })

  it('seeding is deterministic — same input → same output', () => {
    const block = makeBlock(['F.Deterministic'])
    const { stories: s1 } = useSprintBacklog([block])
    const { stories: s2 } = useSprintBacklog([block])
    expect(s1.value[0].storyPoints).toBe(s2.value[0].storyPoints)
    expect(s1.value[0].title).toBe(s2.value[0].title)
    expect(s1.value.length).toBe(s2.value.length)
  })

  it('copyMode starts as "markdown"', () => {
    const { copyMode } = useSprintBacklog([])
    expect(copyMode.value).toBe('markdown')
  })

  it('copyMode can be toggled to "json"', () => {
    const { copyMode } = useSprintBacklog([])
    copyMode.value = 'json'
    expect(copyMode.value).toBe('json')
  })

  it('copyMode can be toggled back to "markdown"', () => {
    const { copyMode } = useSprintBacklog([])
    copyMode.value = 'json'
    copyMode.value = 'markdown'
    expect(copyMode.value).toBe('markdown')
  })

  it('toMarkdown returns a non-empty string', () => {
    const block = makeBlock(['F.Md'])
    const { toMarkdown } = useSprintBacklog([block])
    const result = toMarkdown()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('toMarkdown includes "Sprint Backlog" heading', () => {
    const block = makeBlock(['F.Heading'])
    const { toMarkdown } = useSprintBacklog([block])
    expect(toMarkdown()).toContain('Sprint Backlog')
  })

  it('toJson returns valid JSON', () => {
    const block = makeBlock(['F.Json'])
    const { toJson } = useSprintBacklog([block])
    const result = toJson()
    expect(() => JSON.parse(result)).not.toThrow()
  })

  it('toJson returns a non-empty array', () => {
    const block = makeBlock(['F.JsonArr'])
    const { toJson } = useSprintBacklog([block])
    const parsed = JSON.parse(toJson())
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBeGreaterThan(0)
  })

  it('toJson includes required fields per story', () => {
    const block = makeBlock(['F.Fields'])
    const { toJson } = useSprintBacklog([block])
    const parsed = JSON.parse(toJson())
    for (const story of parsed) {
      expect(story).toHaveProperty('id')
      expect(story).toHaveProperty('parent')
      expect(story).toHaveProperty('title')
      expect(story).toHaveProperty('points')
      expect(story).toHaveProperty('type')
      expect(story).toHaveProperty('ac')
    }
  })

  it('copied starts as false', () => {
    const { copied } = useSprintBacklog([])
    expect(copied.value).toBe(false)
  })

  it('story type is always "story"', () => {
    const block = makeBlock(['F.TypeCheck'])
    const { stories } = useSprintBacklog([block])
    for (const s of stories.value) {
      expect(s.type).toBe('story')
    }
  })
})
