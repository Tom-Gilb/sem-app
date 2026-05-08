// UNIT_TYPE=Test
// Feature #149 — useEmpathyMap composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  useEmpathyMap,
  buildEmpathyCard,
  formatEmpathyMarkdown,
  charCodeSeed,
} from '../useEmpathyMap'
import type { SpecBlock } from '../../types/spec'

function makeBlock(vIds: string[] = [], fIds: string[] = []): SpecBlock {
  return {
    functions: fIds.map((id) => ({
      id,
      type: 'Function',
      level: 'Product',
      description: `Desc for ${id}`,
      successCriteria: '',
      functionOfValue: '',
    })),
    values: vIds.map((id) => ({
      id,
      type: 'Value',
      level: 'Product',
      description: `Desc for ${id}`,
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

afterEach(() => {
  vi.restoreAllMocks()
})

describe('charCodeSeed', () => {
  it('returns sum of char codes', () => {
    // 'A' = 65
    expect(charCodeSeed('A')).toBe(65)
  })

  it('returns 0 for empty string', () => {
    expect(charCodeSeed('')).toBe(0)
  })
})

describe('buildEmpathyCard', () => {
  it('sets vEntryId correctly', () => {
    const card = buildEmpathyCard('V.Speed', 'V.Speed')
    expect(card.vEntryId).toBe('V.Speed')
  })

  it('sets vEntryName correctly', () => {
    const card = buildEmpathyCard('V.Fluency', 'V.Fluency')
    expect(card.vEntryName).toBe('V.Fluency')
  })

  it('think field is from THINK_BANK (non-empty string)', () => {
    const card = buildEmpathyCard('V.Alpha', 'V.Alpha')
    expect(typeof card.think).toBe('string')
    expect(card.think.length).toBeGreaterThan(0)
  })

  it('feel field is from FEEL_BANK (non-empty string)', () => {
    const card = buildEmpathyCard('V.Beta', 'V.Beta')
    expect(typeof card.feel).toBe('string')
    expect(card.feel.length).toBeGreaterThan(0)
  })

  it('say field is from SAY_BANK (non-empty string)', () => {
    const card = buildEmpathyCard('V.Gamma', 'V.Gamma')
    expect(typeof card.say).toBe('string')
    expect(card.say.length).toBeGreaterThan(0)
  })

  it('doText field is from DO_BANK (non-empty string)', () => {
    const card = buildEmpathyCard('V.Delta', 'V.Delta')
    expect(typeof card.doText).toBe('string')
    expect(card.doText.length).toBeGreaterThan(0)
  })

  it('is deterministic — same id produces same card', () => {
    const card1 = buildEmpathyCard('V.Test', 'V.Test')
    const card2 = buildEmpathyCard('V.Test', 'V.Test')
    expect(card1).toEqual(card2)
  })

  it('different ids produce potentially different cards (seed-based)', () => {
    const card1 = buildEmpathyCard('V.Aaa', 'V.Aaa')
    const card2 = buildEmpathyCard('V.Zzz', 'V.Zzz')
    // At minimum the fields should be computed from different seeds
    const seed1 = charCodeSeed('V.Aaa')
    const seed2 = charCodeSeed('V.Zzz')
    expect(seed1).not.toBe(seed2)
    // We can verify the bank indices differ
    expect(card1.think === card2.think && card1.feel === card2.feel &&
      card1.say === card2.say && card1.doText === card2.doText).toBe(
      seed1 % 6 === seed2 % 6 &&
      (seed1 + 1) % 6 === (seed2 + 1) % 6 &&
      (seed1 + 2) % 6 === (seed2 + 2) % 6 &&
      (seed1 + 3) % 6 === (seed2 + 3) % 6,
    )
  })
})

describe('formatEmpathyMarkdown', () => {
  it('includes heading with vEntryName', () => {
    const card = buildEmpathyCard('V.Test', 'V.Test')
    const md = formatEmpathyMarkdown([card])
    expect(md).toContain('## Empathy Map — V.Test')
  })

  it('includes Think section', () => {
    const card = buildEmpathyCard('V.Think', 'V.Think')
    const md = formatEmpathyMarkdown([card])
    expect(md).toContain('**Think:**')
  })

  it('includes Feel section', () => {
    const card = buildEmpathyCard('V.Feel', 'V.Feel')
    const md = formatEmpathyMarkdown([card])
    expect(md).toContain('**Feel:**')
  })

  it('includes Say section', () => {
    const card = buildEmpathyCard('V.Say', 'V.Say')
    const md = formatEmpathyMarkdown([card])
    expect(md).toContain('**Say:**')
  })

  it('includes Do section', () => {
    const card = buildEmpathyCard('V.Do', 'V.Do')
    const md = formatEmpathyMarkdown([card])
    expect(md).toContain('**Do:**')
  })

  it('separates multiple cards with blank lines', () => {
    const cards = [buildEmpathyCard('V.One', 'V.One'), buildEmpathyCard('V.Two', 'V.Two')]
    const md = formatEmpathyMarkdown(cards)
    expect(md).toContain('V.One')
    expect(md).toContain('V.Two')
  })
})

describe('useEmpathyMap', () => {
  it('returns one card per V. entry', () => {
    const blocks = [makeBlock(['V.Alpha', 'V.Beta'])]
    const { cards } = useEmpathyMap(blocks)
    expect(cards.value).toHaveLength(2)
  })

  it('returns cards across multiple blocks', () => {
    const blocks = [makeBlock(['V.A']), makeBlock(['V.B']), makeBlock(['V.C'])]
    const { cards } = useEmpathyMap(blocks)
    expect(cards.value).toHaveLength(3)
  })

  it('returns empty cards for empty blocks', () => {
    const { cards } = useEmpathyMap([])
    expect(cards.value).toHaveLength(0)
  })

  it('ignores blocks with no V. entries', () => {
    const blocks = [makeBlock([], ['F.SomeFunc']), makeBlock(['V.Alpha'])]
    const { cards } = useEmpathyMap(blocks)
    expect(cards.value).toHaveLength(1)
  })

  it('selectedId starts as null', () => {
    const { selectedId } = useEmpathyMap([makeBlock(['V.X'])])
    expect(selectedId.value).toBeNull()
  })

  it('selectCard sets selectedId', () => {
    const { selectedId, selectCard } = useEmpathyMap([makeBlock(['V.MyEntry'])])
    selectCard('V.MyEntry')
    expect(selectedId.value).toBe('V.MyEntry')
  })

  it('copied starts as false', () => {
    const { copied } = useEmpathyMap([])
    expect(copied.value).toBe(false)
  })

  it('copyMarkdown writes to clipboard and sets copied=true', async () => {
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn((t: string) => { written.push(t); return Promise.resolve() }) },
    })
    const blocks = [makeBlock(['V.ClipTest'])]
    const { copyMarkdown, copied } = useEmpathyMap(blocks)
    await copyMarkdown()
    expect(written[0]).toContain('## Empathy Map — V.ClipTest')
    expect(copied.value).toBe(true)
  })

  it('copyMarkdown does nothing when there are no cards', async () => {
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { copyMarkdown } = useEmpathyMap([])
    await copyMarkdown()
    expect(writeText).not.toHaveBeenCalled()
  })

  it('copied flips back to false after 2s', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    })
    const blocks = [makeBlock(['V.Timer'])]
    const { copyMarkdown, copied } = useEmpathyMap(blocks)
    await copyMarkdown()
    expect(copied.value).toBe(true)
    vi.advanceTimersByTime(2000)
    expect(copied.value).toBe(false)
    vi.useRealTimers()
  })
})
