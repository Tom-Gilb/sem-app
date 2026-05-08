// Feature #153 — useRetroThemes tests
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useRetroThemes, detectTheme, type RetroThemesStep } from '../useRetroThemes'

const makeStep = (id: string, name: string, effort?: number): RetroThemesStep => ({
  id, name, effort,
})

describe('useRetroThemes', () => {
  // 1 — returns exactly 4 themes
  it('returns exactly 4 themes', () => {
    const steps = ref<RetroThemesStep[]>([])
    const { themes } = useRetroThemes(steps)
    expect(themes.value).toHaveLength(4)
  })

  // 2 — all 4 required theme names are present
  it('all four theme names are present', () => {
    const steps = ref<RetroThemesStep[]>([])
    const { themes } = useRetroThemes(steps)
    const names = themes.value.map(t => t.name)
    expect(names).toContain('velocity')
    expect(names).toContain('quality')
    expect(names).toContain('team')
    expect(names).toContain('process')
  })

  // 3 — each theme has required fields
  it('each theme has name, steps, count, and topPrompt fields', () => {
    const steps = ref<RetroThemesStep[]>([])
    const { themes } = useRetroThemes(steps)
    for (const t of themes.value) {
      expect(t).toHaveProperty('name')
      expect(t).toHaveProperty('steps')
      expect(t).toHaveProperty('count')
      expect(t).toHaveProperty('topPrompt')
      expect(Array.isArray(t.steps)).toBe(true)
      expect(typeof t.count).toBe('number')
      expect(typeof t.topPrompt).toBe('string')
    }
  })

  // 4 — velocity keyword detection
  it('detects velocity theme from keyword "fast"', () => {
    const step = makeStep('s1', 'ship it fast')
    expect(detectTheme(step)).toBe('velocity')
  })

  // 5 — quality keyword detection
  it('detects quality theme from keyword "test"', () => {
    const step = makeStep('s2', 'test the module')
    expect(detectTheme(step)).toBe('quality')
  })

  // 6 — team keyword detection
  it('detects team theme from keyword "standup"', () => {
    const step = makeStep('s3', 'run daily standup')
    expect(detectTheme(step)).toBe('team')
  })

  // 7 — process keyword detection
  it('detects process theme from keyword "sprint"', () => {
    const step = makeStep('s4', 'plan the sprint')
    expect(detectTheme(step)).toBe('process')
  })

  // 8 — no keyword falls back to seed % 4
  it('falls back to seed-based theme when no keyword matches', () => {
    const step = makeStep('abc', 'xyz')
    const result = detectTheme(step)
    expect(['velocity', 'quality', 'team', 'process']).toContain(result)
  })

  // 9 — detection is deterministic
  it('detectTheme is deterministic for same input', () => {
    const step = makeStep('id42', 'NoKeywordHere')
    expect(detectTheme(step)).toBe(detectTheme(step))
  })

  // 10 — themes sorted descending by count
  it('themes are sorted descending by count', () => {
    const steps = ref([
      makeStep('a', 'fix the bug'),
      makeStep('b', 'fix another bug'),
      makeStep('c', 'fix all the bugs'),
    ])
    const { themes } = useRetroThemes(steps)
    const counts = themes.value.map(t => t.count)
    expect(counts[0]).toBeGreaterThanOrEqual(counts[1])
    expect(counts[1]).toBeGreaterThanOrEqual(counts[2])
    expect(counts[2]).toBeGreaterThanOrEqual(counts[3])
  })

  // 11 — total step count across themes equals input length
  it('total step count across all themes equals input step count', () => {
    const steps = ref([
      makeStep('a', 'ship the feature'),
      makeStep('b', 'fix the bug'),
      makeStep('c', 'review the spec'),
    ])
    const { themes } = useRetroThemes(steps)
    const total = themes.value.reduce((sum, t) => sum + t.count, 0)
    expect(total).toBe(3)
  })

  // 12 — stepTheme returns a valid theme name
  it('stepTheme returns a valid theme name for a given stepId', () => {
    const steps = ref([makeStep('step-0', 'fix the bug')])
    const { stepTheme } = useRetroThemes(steps)
    const result = stepTheme('step-0')
    expect(['velocity', 'quality', 'team', 'process']).toContain(result)
  })

  // 13 — stepTheme returns same theme on repeated calls (deterministic)
  it('stepTheme is deterministic', () => {
    const steps = ref([makeStep('s99', 'deliver fast')])
    const { stepTheme } = useRetroThemes(steps)
    expect(stepTheme('s99')).toBe(stepTheme('s99'))
  })

  // 14 — copyMarkdown generates markdown with 4 sections
  it('copyMarkdown produces markdown with 4 theme sections', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
    })
    const steps = ref([makeStep('a', 'ship feature'), makeStep('b', 'fix bug')])
    const { copyMarkdown } = useRetroThemes(steps)
    copyMarkdown()
    const md: string = writeTextMock.mock.calls[0][0]
    expect(md).toContain('## Velocity')
    expect(md).toContain('## Quality')
    expect(md).toContain('## Team')
    expect(md).toContain('## Process')
  })

  // 15 — copyMarkdown includes the topPrompt for each theme
  it('copyMarkdown includes topPrompt text in output', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
    })
    const steps = ref<RetroThemesStep[]>([])
    const { copyMarkdown } = useRetroThemes(steps)
    copyMarkdown()
    const md: string = writeTextMock.mock.calls[0][0]
    expect(md).toContain('What slowed us down this sprint?')
    expect(md).toContain('What quality issues need addressing?')
    expect(md).toContain('How can we improve team collaboration?')
    expect(md).toContain('What process improvements would help most?')
  })

  // 16 — copied flips to true then resets after 2s
  it('copied flips to true on copyMarkdown and resets after 2s', async () => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
    })
    const steps = ref<RetroThemesStep[]>([])
    const { copyMarkdown, copied } = useRetroThemes(steps)
    expect(copied.value).toBe(false)
    copyMarkdown()
    expect(copied.value).toBe(true)
    vi.advanceTimersByTime(2001)
    expect(copied.value).toBe(false)
    vi.useRealTimers()
  })

  // 17 — retroThemesOpen starts as false
  it('retroThemesOpen starts as false', () => {
    const steps = ref<RetroThemesStep[]>([])
    const { retroThemesOpen } = useRetroThemes(steps)
    expect(retroThemesOpen.value).toBe(false)
  })

  // 18 — first keyword match wins (velocity before quality)
  it('assigns to first matching theme keyword set only', () => {
    // "ship" matches velocity; "fix" matches quality; "ship" comes first
    const step = makeStep('s1', 'ship and fix')
    expect(detectTheme(step)).toBe('velocity')
  })
})
