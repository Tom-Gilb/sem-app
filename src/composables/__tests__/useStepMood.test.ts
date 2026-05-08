// Feature #158 — useStepMood tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useStepMood } from '../useStepMood'
import type { MoodEmoji } from '../useStepMood'

const VALID_MOODS: MoodEmoji[] = ['😰', '😐', '😊', '🤩']

beforeEach(() => {
  vi.stubGlobal('sessionStorage', {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useStepMood', () => {
  // 1 — toggleOpen / isOpen mechanics
  it('toggleOpen adds a step and isOpen returns true', () => {
    const { toggleOpen, isOpen } = useStepMood()
    expect(isOpen('step-0')).toBe(false)
    toggleOpen('step-0')
    expect(isOpen('step-0')).toBe(true)
  })

  // 2 — toggleOpen closes an already open step
  it('toggleOpen removes a step that was already open', () => {
    const { toggleOpen, isOpen } = useStepMood()
    toggleOpen('step-0')
    toggleOpen('step-0')
    expect(isOpen('step-0')).toBe(false)
  })

  // 3 — isOpen returns false for unknown step
  it('isOpen returns false for a step that was never opened', () => {
    const { isOpen } = useStepMood()
    expect(isOpen('nonexistent')).toBe(false)
  })

  // 4 — getMood returns a valid MoodEmoji
  it('getMood returns a valid MoodEmoji', () => {
    const { getMood } = useStepMood()
    const mood = getMood('step-0', 'My Step')
    expect(VALID_MOODS).toContain(mood)
  })

  // 5 — getMood is deterministic (charcode-seeded default)
  it('getMood returns the same default for the same stepId and title', () => {
    const { getMood } = useStepMood()
    const m1 = getMood('step-3', 'Deploy Service')
    const m2 = getMood('step-3', 'Deploy Service')
    expect(m1).toBe(m2)
  })

  // 6 — getMood uses stored value from sessionStorage
  it('getMood returns the stored value if present in sessionStorage', () => {
    const stored = JSON.stringify({ 'step-1': '🤩' })
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn().mockReturnValue(stored),
      setItem: vi.fn(),
    })
    const { getMood } = useStepMood()
    const mood = getMood('step-1', 'Any Title')
    expect(mood).toBe('🤩')
  })

  // 7 — setMood updates moodMap
  it('setMood updates the moodMap for the given stepId', () => {
    const { getMood, setMood, moodMap } = useStepMood()
    getMood('step-0', 'Test Step') // initialise
    setMood('step-0', '😊')
    expect(moodMap.value['step-0']).toBe('😊')
  })

  // 8 — setMood persists to sessionStorage
  it('setMood calls sessionStorage.setItem', () => {
    const setItemMock = vi.fn()
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: setItemMock,
    })
    const { getMood, setMood } = useStepMood()
    getMood('step-0', 'Test Step')
    setMood('step-0', '🤩')
    expect(setItemMock).toHaveBeenCalledWith('sem-step-moods', expect.any(String))
  })

  // 9 — setMood with different moods — all valid moods can be set
  it('all four moods can be set via setMood', () => {
    const { getMood, setMood, moodMap } = useStepMood()
    getMood('step-0', 'Step A')
    for (const mood of VALID_MOODS) {
      setMood('step-0', mood)
      expect(moodMap.value['step-0']).toBe(mood)
    }
  })

  // 10 — dominantMood returns the most frequent mood
  it('dominantMood returns the most frequent mood across all steps', () => {
    const { getMood, setMood, dominantMood } = useStepMood()
    getMood('step-0', 'A')
    getMood('step-1', 'B')
    getMood('step-2', 'C')
    setMood('step-0', '😊')
    setMood('step-1', '😊')
    setMood('step-2', '😰')
    expect(dominantMood.value).toBe('😊')
  })

  // 11 — dominantMood with single mood
  it('dominantMood returns the only mood when all steps share it', () => {
    const { getMood, setMood, dominantMood } = useStepMood()
    getMood('step-0', 'A')
    getMood('step-1', 'B')
    setMood('step-0', '🤩')
    setMood('step-1', '🤩')
    expect(dominantMood.value).toBe('🤩')
  })

  // 12 — dominantMood with empty moodMap returns first mood (default behaviour)
  it('dominantMood with empty moodMap is a valid MoodEmoji', () => {
    const { dominantMood } = useStepMood()
    expect(VALID_MOODS).toContain(dominantMood.value)
  })

  // 13 — moodLabel maps each emoji to correct label
  it('moodLabel returns correct labels for each emoji', () => {
    const { moodLabel } = useStepMood()
    expect(moodLabel('😰')).toBe('Anxious')
    expect(moodLabel('😐')).toBe('Neutral')
    expect(moodLabel('😊')).toBe('Good')
    expect(moodLabel('🤩')).toBe('Excited')
  })

  // 14 — copyMarkdown contains expected headers
  it('copyMarkdown output contains Step Mood Tracker header', () => {
    const { copyMarkdown } = useStepMood()
    const md = copyMarkdown([{ id: 'step-0', title: 'My Step' }])
    expect(md).toContain('# Step Mood Tracker')
  })

  // 15 — copyMarkdown contains Overall mood line
  it('copyMarkdown output contains Overall mood line', () => {
    const { copyMarkdown } = useStepMood()
    const md = copyMarkdown([{ id: 'step-0', title: 'My Step' }])
    expect(md).toContain('Overall mood:')
  })

  // 16 — copyMarkdown contains table headers
  it('copyMarkdown output contains Step, Mood, and Label table columns', () => {
    const { copyMarkdown } = useStepMood()
    const md = copyMarkdown([{ id: 'step-0', title: 'Step Alpha' }])
    expect(md).toContain('| Step | Mood | Label |')
  })

  // 17 — copyMarkdown includes step titles
  it('copyMarkdown output contains the step title', () => {
    const { copyMarkdown } = useStepMood()
    const md = copyMarkdown([{ id: 'step-0', title: 'Deploy Pipeline' }])
    expect(md).toContain('Deploy Pipeline')
  })

  // 18 — copyMarkdown with empty steps returns header and overall mood
  it('copyMarkdown with empty steps still includes header', () => {
    const { copyMarkdown } = useStepMood()
    const md = copyMarkdown([])
    expect(md).toContain('# Step Mood Tracker')
  })

  // 19 — sessionStorage error handling — getItem throws, getMood does not crash
  it('getMood does not crash when sessionStorage.getItem throws', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn().mockImplementation(() => { throw new Error('storage error') }),
      setItem: vi.fn(),
    })
    const { getMood } = useStepMood()
    expect(() => getMood('step-0', 'Safe Step')).not.toThrow()
  })

  // 20 — sessionStorage error handling — setItem throws, setMood does not crash
  it('setMood does not crash when sessionStorage.setItem throws', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn().mockImplementation(() => { throw new Error('quota exceeded') }),
    })
    const { getMood, setMood } = useStepMood()
    getMood('step-0', 'Test')
    expect(() => setMood('step-0', '😊')).not.toThrow()
  })

  // 21 — multiple steps can be open simultaneously
  it('multiple different steps can be open at the same time', () => {
    const { toggleOpen, isOpen } = useStepMood()
    toggleOpen('step-0')
    toggleOpen('step-1')
    expect(isOpen('step-0')).toBe(true)
    expect(isOpen('step-1')).toBe(true)
  })

  // 22 — MOODS export contains all four emoji
  it('MOODS export contains all four emojis in order', () => {
    const { MOODS } = useStepMood()
    expect(MOODS).toEqual(['😰', '😐', '😊', '🤩'])
  })
})
