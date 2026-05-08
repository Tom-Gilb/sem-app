// UNIT_TYPE=Test
// Feature #156 — useJtbd composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  useJtbd,
  charCodeSeed,
  hasKeywordOverlap,
  buildJtbdCard,
  formatJtbdMarkdown,
} from '../useJtbd'
import type { SpecBlock, VEntry } from '../../types/spec'

function makeFEntry(id: string, description: string) {
  return { id, type: 'Function', level: 'Product', description, successCriteria: '', functionOfValue: '' }
}

function makeVEntry(id: string, description: string, goal = ''): VEntry {
  return { id, type: 'Value', level: 'Product', description, scale: '', meter: '', status: '', tolerable: '', goal, valueOfFunction: '' }
}

function makeBlock(
  fEntries: Array<{ id: string; description: string }> = [],
  vEntries: Array<{ id: string; description: string; goal?: string }> = [],
): SpecBlock {
  return {
    functions: fEntries.map((f) => makeFEntry(f.id, f.description)),
    values: vEntries.map((v) => makeVEntry(v.id, v.description, v.goal)),
    solutions: [],
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('charCodeSeed', () => {
  it('returns sum of char codes for a known string', () => {
    expect(charCodeSeed('AB')).toBe('A'.charCodeAt(0) + 'B'.charCodeAt(0))
  })

  it('returns 0 for empty string', () => {
    expect(charCodeSeed('')).toBe(0)
  })
})

describe('hasKeywordOverlap', () => {
  it('returns true when ids share a keyword part (longer than 2 chars)', () => {
    // Both IDs contain 'useronboarding' as a token after splitting on non-alphanumeric
    expect(hasKeywordOverlap('F.UserOnboarding', 'V.UserOnboarding')).toBe(true)
  })

  it('returns false when ids share no keyword parts', () => {
    expect(hasKeywordOverlap('F.Alpha', 'V.Beta')).toBe(false)
  })

  it('returns false when only short tokens match', () => {
    // both have 'f.' stripped — no word longer than 2 chars overlaps
    expect(hasKeywordOverlap('F.AB', 'V.AB')).toBe(false)
  })
})

describe('buildJtbdCard', () => {
  it('sets fEntryId correctly', () => {
    const card = buildJtbdCard('F.MyFunc', 'description text here', [])
    expect(card.fEntryId).toBe('F.MyFunc')
  })

  it('sets fEntryName to fEntryId', () => {
    const card = buildJtbdCard('F.MyFunc', 'description text here', [])
    expect(card.fEntryName).toBe('F.MyFunc')
  })

  it('picks when from WHEN_BANK using seed % 6', () => {
    const WHEN_BANK = [
      "I'm onboarding a new user",
      "I'm planning the next sprint",
      "I'm reviewing progress",
      "I'm evaluating options",
      "I'm troubleshooting an issue",
      "I'm preparing a report",
    ]
    const id = 'F.SomeFunc'
    const seed = charCodeSeed(id)
    const card = buildJtbdCard(id, 'some description', [])
    expect(card.when).toBe(WHEN_BANK[seed % 6])
  })

  it('iWantTo is first 60 chars of description trimmed', () => {
    const desc = 'A'.repeat(80)
    const card = buildJtbdCard('F.X', desc, [])
    expect(card.iWantTo).toBe(desc.slice(0, 60).trim())
  })

  it('soICan defaults to "achieve measurable value" when no V. match', () => {
    const card = buildJtbdCard('F.NoMatch', 'description', [])
    expect(card.soICan).toBe('achieve measurable value')
  })

  it('soICan uses matched V. goal when keyword overlap exists', () => {
    const vEntries = [makeVEntry('V.UserOnboarding', 'desc', 'Achieve user activation')]
    const card = buildJtbdCard('F.UserOnboarding', 'description', vEntries)
    expect(card.soICan).toBe('Achieve user activation')
  })

  it('soICan falls back to "achieve measurable value" when goal is empty', () => {
    const vEntries = [makeVEntry('V.UserOnboarding', 'desc', '')]
    const card = buildJtbdCard('F.UserOnboarding', 'description', vEntries)
    expect(card.soICan).toBe('achieve measurable value')
  })
})

describe('formatJtbdMarkdown', () => {
  it('includes JTBD heading with entry name', () => {
    const card = buildJtbdCard('F.MyFunc', 'do something', [])
    const md = formatJtbdMarkdown([card])
    expect(md).toContain('## JTBD: F.MyFunc')
  })

  it('includes When row', () => {
    const card = buildJtbdCard('F.MyFunc', 'do something', [])
    const md = formatJtbdMarkdown([card])
    expect(md).toContain('**When**')
  })

  it('includes I want to row', () => {
    const card = buildJtbdCard('F.MyFunc', 'do something important', [])
    const md = formatJtbdMarkdown([card])
    expect(md).toContain('**I want to**')
  })

  it('includes So I can row', () => {
    const card = buildJtbdCard('F.MyFunc', 'do something', [])
    const md = formatJtbdMarkdown([card])
    expect(md).toContain('**So I can**')
  })

  it('joins multiple cards with double newline', () => {
    const c1 = buildJtbdCard('F.A', 'desc a', [])
    const c2 = buildJtbdCard('F.B', 'desc b', [])
    const md = formatJtbdMarkdown([c1, c2])
    expect(md).toContain('F.A')
    expect(md).toContain('F.B')
  })
})

describe('useJtbd', () => {
  it('returns one card per F. entry', () => {
    const block = makeBlock([{ id: 'F.A', description: 'desc a' }, { id: 'F.B', description: 'desc b' }])
    const { cards } = useJtbd([block])
    expect(cards.value).toHaveLength(2)
  })

  it('returns cards across multiple blocks', () => {
    const b1 = makeBlock([{ id: 'F.A', description: 'desc' }])
    const b2 = makeBlock([{ id: 'F.B', description: 'desc' }])
    const { cards } = useJtbd([b1, b2])
    expect(cards.value).toHaveLength(2)
  })

  it('returns empty cards for empty blocks', () => {
    const { cards } = useJtbd([])
    expect(cards.value).toHaveLength(0)
  })

  it('selectedCard starts as null', () => {
    const { selectedCard } = useJtbd([])
    expect(selectedCard.value).toBeNull()
  })

  it('selectCard sets selectedCard', () => {
    const block = makeBlock([{ id: 'F.A', description: 'desc' }])
    const { selectCard, selectedCard } = useJtbd([block])
    selectCard('F.A')
    expect(selectedCard.value).toBe('F.A')
  })

  it('allCopied starts as false', () => {
    const { allCopied } = useJtbd([])
    expect(allCopied.value).toBe(false)
  })

  it('copyAll writes markdown to clipboard and sets allCopied=true', async () => {
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn((t: string) => { written.push(t); return Promise.resolve() }) },
    })
    const block = makeBlock([{ id: 'F.Clip', description: 'some description' }])
    const { copyAll, allCopied } = useJtbd([block])
    await copyAll()
    expect(written[0]).toContain('## JTBD:')
    expect(allCopied.value).toBe(true)
  })

  it('copyAll does nothing when no cards', async () => {
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { copyAll } = useJtbd([])
    await copyAll()
    expect(writeText).not.toHaveBeenCalled()
  })

  it('allCopied flips back to false after 2s', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    })
    const block = makeBlock([{ id: 'F.Timer', description: 'description here' }])
    const { copyAll, allCopied } = useJtbd([block])
    await copyAll()
    expect(allCopied.value).toBe(true)
    vi.advanceTimersByTime(2000)
    expect(allCopied.value).toBe(false)
    vi.useRealTimers()
  })

  it('when field is deterministic for same id', () => {
    const block = makeBlock([{ id: 'F.DeterminismTest', description: 'desc' }])
    const { cards: c1 } = useJtbd([block])
    const { cards: c2 } = useJtbd([block])
    expect(c1.value[0].when).toBe(c2.value[0].when)
  })

  it('uses V. entries from all blocks for soICan lookup', () => {
    const b1 = makeBlock(
      [{ id: 'F.UserOnboarding', description: 'onboard users' }],
      [],
    )
    const b2 = makeBlock(
      [],
      [{ id: 'V.UserOnboarding', description: 'desc', goal: 'Reduce time to first value' }],
    )
    const { cards } = useJtbd([b1, b2])
    expect(cards.value[0].soICan).toBe('Reduce time to first value')
  })
})
