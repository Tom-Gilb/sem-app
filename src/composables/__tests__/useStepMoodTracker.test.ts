// Feature #158 — useStepMoodTracker tests
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import {
  useStepMoodTracker,
  defaultMood,
  charCodeSeed,
  type MoodTrackerStep,
  type MoodEmoji,
} from '../useStepMoodTracker'

const MOODS: MoodEmoji[] = ['😰', '😐', '😊', '🤩']

const makeStep = (id: string, name: string): MoodTrackerStep => ({ id, name })

// ── sessionStorage mock ──────────────────────────────────────────────────────

const sessionStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

beforeEach(() => {
  sessionStorageMock.clear()
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: sessionStorageMock,
    writable: true,
  })
})

describe('useStepMoodTracker', () => {
  // 1 — one MoodEntry per step on init
  it('initialises one MoodEntry per step', () => {
    const steps = ref([makeStep('s1', 'Alpha'), makeStep('s2', 'Beta')])
    const { moodMap } = useStepMoodTracker(steps)
    expect(Object.keys(moodMap.value)).toHaveLength(2)
    expect(moodMap.value['s1']).toBeDefined()
    expect(moodMap.value['s2']).toBeDefined()
  })

  // 2 — empty steps yields empty moodMap
  it('yields empty moodMap for empty steps', () => {
    const steps = ref<MoodTrackerStep[]>([])
    const { moodMap } = useStepMoodTracker(steps)
    expect(Object.keys(moodMap.value)).toHaveLength(0)
  })

  // 3 — seed-based default mood is one of the 4 emojis
  it('default mood is always a valid emoji', () => {
    const steps = ref([makeStep('a', 'Step One'), makeStep('b', 'Step Two')])
    const { moodMap } = useStepMoodTracker(steps)
    for (const entry of Object.values(moodMap.value)) {
      expect(MOODS).toContain(entry.mood)
    }
  })

  // 4 — defaultMood seed assignment is deterministic
  it('defaultMood is deterministic for the same step', () => {
    const step = makeStep('step-0', 'Build API')
    expect(defaultMood(step)).toBe(defaultMood(step))
  })

  // 5 — defaultMood uses charCode-sum seed % 4
  it('defaultMood matches seed % 4', () => {
    const step = makeStep('id1', 'Test')
    const s = charCodeSeed(step)
    expect(defaultMood(step)).toBe(MOODS[s % 4])
  })

  // 6 — charCodeSeed is correct for known input
  it('charCodeSeed returns correct sum for known input', () => {
    const step = makeStep('ab', 'cd')
    // 'a'=97,'b'=98,'c'=99,'d'=100 → 394
    expect(charCodeSeed(step)).toBe(97 + 98 + 99 + 100)
  })

  // 7 — setMood updates the mood in moodMap
  it('setMood updates the mood entry', () => {
    const steps = ref([makeStep('s1', 'Deploy')])
    const { moodMap, setMood } = useStepMoodTracker(steps)
    setMood('s1', '🤩')
    expect(moodMap.value['s1'].mood).toBe('🤩')
  })

  // 8 — setMood persists to sessionStorage
  it('setMood persists to sessionStorage', () => {
    const steps = ref([makeStep('s1', 'Deploy')])
    const { setMood } = useStepMoodTracker(steps)
    setMood('s1', '😊')
    expect(sessionStorageMock.getItem('sem-step-mood-s1')).toBe('😊')
  })

  // 9 — loadMoods overrides default with sessionStorage value
  it('loadMoods uses sessionStorage value when present', () => {
    sessionStorageMock.setItem('sem-step-mood-s1', '🤩')
    const steps = ref([makeStep('s1', 'Any Step')])
    const { moodMap } = useStepMoodTracker(steps)
    expect(moodMap.value['s1'].mood).toBe('🤩')
  })

  // 10 — loadMoods ignores invalid sessionStorage value
  it('loadMoods ignores invalid emoji in sessionStorage', () => {
    sessionStorageMock.setItem('sem-step-mood-s1', 'invalid-emoji')
    const steps = ref([makeStep('s1', 'Any Step')])
    const { moodMap } = useStepMoodTracker(steps)
    const expected = defaultMood(makeStep('s1', 'Any Step'))
    expect(moodMap.value['s1'].mood).toBe(expected)
  })

  // 11 — toggleOpen flips isOpen
  it('toggleOpen flips the isOpen state', () => {
    const steps = ref([makeStep('s1', 'Step A')])
    const { moodMap, toggleOpen } = useStepMoodTracker(steps)
    expect(moodMap.value['s1'].isOpen).toBe(false)
    toggleOpen('s1')
    expect(moodMap.value['s1'].isOpen).toBe(true)
    toggleOpen('s1')
    expect(moodMap.value['s1'].isOpen).toBe(false)
  })

  // 12 — aggregateMood returns dominant mood
  it('aggregateMood returns the most frequent mood', () => {
    sessionStorageMock.setItem('sem-step-mood-s1', '😊')
    sessionStorageMock.setItem('sem-step-mood-s2', '😊')
    sessionStorageMock.setItem('sem-step-mood-s3', '😰')
    const steps = ref([makeStep('s1', 'A'), makeStep('s2', 'B'), makeStep('s3', 'C')])
    const { setMood, aggregateMood } = useStepMoodTracker(steps)
    setMood('s1', '😊')
    setMood('s2', '😊')
    setMood('s3', '😰')
    expect(aggregateMood.value).toBe('😊')
  })

  // 13 — aggregateMood tie-break favours 🤩 > 😊 > 😐 > 😰
  it('aggregateMood tie-breaks in favour of higher-index emoji', () => {
    const steps = ref([makeStep('s1', 'A'), makeStep('s2', 'B')])
    const { setMood, aggregateMood } = useStepMoodTracker(steps)
    setMood('s1', '😊')
    setMood('s2', '😐')
    // Tie between 😊 (index 2) and 😐 (index 1) — 😊 wins
    expect(aggregateMood.value).toBe('😊')
  })

  // 14 — aggregateMood returns '😐' for empty steps
  it('aggregateMood returns 😐 for empty steps', () => {
    const steps = ref<MoodTrackerStep[]>([])
    const { aggregateMood } = useStepMoodTracker(steps)
    expect(aggregateMood.value).toBe('😐')
  })

  // 15 — copyMarkdown produces pipe table with Step and Mood columns
  it('copyMarkdown produces a pipe table with Step and Mood columns', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
    })
    const steps = ref([makeStep('s1', 'Deploy API')])
    const { copyMarkdown } = useStepMoodTracker(steps)
    copyMarkdown()
    const md: string = writeTextMock.mock.calls[0][0]
    expect(md).toContain('| Step |')
    expect(md).toContain('| Mood |')
    expect(md).toContain('Deploy API')
  })

  // 16 — moodCopied flips to true and resets after 2s
  it('moodCopied flips to true on copyMarkdown and resets after 2s', () => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
    })
    const steps = ref<MoodTrackerStep[]>([])
    const { copyMarkdown, moodCopied } = useStepMoodTracker(steps)
    expect(moodCopied.value).toBe(false)
    copyMarkdown()
    expect(moodCopied.value).toBe(true)
    vi.advanceTimersByTime(2001)
    expect(moodCopied.value).toBe(false)
    vi.useRealTimers()
  })

  // 17 — setMood on unknown stepId does not throw
  it('setMood on unknown stepId is a no-op', () => {
    const steps = ref([makeStep('s1', 'Step')])
    const { setMood } = useStepMoodTracker(steps)
    expect(() => setMood('nonexistent', '😊')).not.toThrow()
  })

  // 18 — MoodEntry has all required fields
  it('each MoodEntry has required fields', () => {
    const steps = ref([makeStep('s1', 'Step Alpha')])
    const { moodMap } = useStepMoodTracker(steps)
    const entry = moodMap.value['s1']
    expect(entry).toHaveProperty('stepId', 's1')
    expect(entry).toHaveProperty('stepName', 'Step Alpha')
    expect(entry).toHaveProperty('mood')
    expect(entry).toHaveProperty('isOpen', false)
  })
})
