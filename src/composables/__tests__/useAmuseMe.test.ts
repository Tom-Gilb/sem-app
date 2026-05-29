// Tests for useAmuseMe.ts — pure content helpers and reactive composable state.
// Pure functions are the highest-value coverage: silent regressions, easy to test.

import { describe, test, expect } from 'vitest'
import {
  randomJoke,
  randomNiceThing,
  planProgressText,
  nextStepText,
  stagesUntilSharing,
  pictureUrl,
  useAmuseMe,
  GLOSSARY_JOKES,
  NICE_THINGS,
  AMUSE_ITEMS,
  PICTURE_THEMES,
} from '../useAmuseMe'
import type { SpecBlock } from '../../types/spec'

// ─────────────────────────────────────────────────────────────────────────────
// Static data integrity
// ─────────────────────────────────────────────────────────────────────────────

describe('GLOSSARY_JOKES', () => {

  test('has at least one entry', () => {
    expect(GLOSSARY_JOKES.length).toBeGreaterThan(0)
  })

  test('every joke is a non-empty string', () => {
    for (const joke of GLOSSARY_JOKES) {
      expect(typeof joke).toBe('string')
      expect(joke.trim().length).toBeGreaterThan(0)
    }
  })

})

describe('NICE_THINGS', () => {

  test('has at least one entry', () => {
    expect(NICE_THINGS.length).toBeGreaterThan(0)
  })

  test('every suggestion is a non-empty string', () => {
    for (const thing of NICE_THINGS) {
      expect(typeof thing).toBe('string')
      expect(thing.trim().length).toBeGreaterThan(0)
    }
  })

})

describe('AMUSE_ITEMS', () => {

  test('has 9 items (all defined amuse-me menu entries)', () => {
    expect(AMUSE_ITEMS).toHaveLength(9)
  })

  test('every item has required fields: id, emoji, label, blurb, action', () => {
    const validActions = new Set(['static', 'dynamic', 'external'])
    for (const item of AMUSE_ITEMS) {
      expect(typeof item.id).toBe('string')
      expect(item.id.trim().length).toBeGreaterThan(0)
      expect(typeof item.emoji).toBe('string')
      expect(typeof item.label).toBe('string')
      expect(typeof item.blurb).toBe('string')
      expect(validActions.has(item.action)).toBe(true)
    }
  })

  test('all item ids are unique', () => {
    const ids = AMUSE_ITEMS.map(i => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('showPictures item is present (added 2026-05-29)', () => {
    expect(AMUSE_ITEMS.some(i => i.id === 'showPictures')).toBe(true)
  })

})

describe('PICTURE_THEMES', () => {

  test('has 8 themes', () => {
    expect(PICTURE_THEMES).toHaveLength(8)
  })

  test('every theme has id, label, emoji, keyword', () => {
    for (const theme of PICTURE_THEMES) {
      expect(typeof theme.id).toBe('string')
      expect(typeof theme.label).toBe('string')
      expect(typeof theme.emoji).toBe('string')
      expect(typeof theme.keyword).toBe('string')
      expect(theme.keyword.length).toBeGreaterThan(0)
    }
  })

  test('all theme ids are unique', () => {
    const ids = PICTURE_THEMES.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// randomJoke
// ─────────────────────────────────────────────────────────────────────────────

describe('randomJoke', () => {

  test('returns a string that is a member of GLOSSARY_JOKES', () => {
    const joke = randomJoke()
    expect(GLOSSARY_JOKES).toContain(joke)
  })

  test('called 20 times, always returns a non-empty string', () => {
    for (let i = 0; i < 20; i++) {
      const joke = randomJoke()
      expect(typeof joke).toBe('string')
      expect(joke.length).toBeGreaterThan(0)
    }
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// randomNiceThing
// ─────────────────────────────────────────────────────────────────────────────

describe('randomNiceThing', () => {

  test('returns a string that is a member of NICE_THINGS', () => {
    const thing = randomNiceThing()
    expect(NICE_THINGS).toContain(thing)
  })

  test('called 20 times, always returns a non-empty string', () => {
    for (let i = 0; i < 20; i++) {
      const thing = randomNiceThing()
      expect(typeof thing).toBe('string')
      expect(thing.length).toBeGreaterThan(0)
    }
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// pictureUrl
// ─────────────────────────────────────────────────────────────────────────────

describe('pictureUrl', () => {

  test('returns a string URL containing the keyword', () => {
    const url = pictureUrl('norway+fjord')
    expect(url).toContain('norway+fjord')
  })

  test('returns a URL starting with https://source.unsplash.com', () => {
    const url = pictureUrl('modern+art')
    expect(url.startsWith('https://source.unsplash.com')).toBe(true)
  })

  test('when seed is provided, URL contains the exact seed value', () => {
    const url = pictureUrl('nature+landscape', 42)
    expect(url).toContain('sig=42')
  })

  test('when no seed is provided, URL still contains a sig parameter', () => {
    const url = pictureUrl('space')
    expect(url).toContain('sig=')
  })

  test('two calls with the same seed return the same URL', () => {
    const a = pictureUrl('galaxy+space', 1234)
    const b = pictureUrl('galaxy+space', 1234)
    expect(a).toBe(b)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// planProgressText
// ─────────────────────────────────────────────────────────────────────────────

// Minimal SpecBlock stub — only the fields planProgressText reads
function makeSpec(overrides: Partial<{
  functions: { id: string }[]
  values: { id: string }[]
  solutions: { id: string }[]
  constraints: { id: string }[]
}>): SpecBlock {
  return {
    functions:   overrides.functions   ?? [],
    values:      overrides.values      ?? [],
    solutions:   overrides.solutions   ?? [],
    constraints: overrides.constraints ?? [],
  } as unknown as SpecBlock
}

describe('planProgressText', () => {

  test('returns no-spec message when spec is null', () => {
    const text = planProgressText(null)
    expect(text.toLowerCase()).toContain('no spec loaded')
  })

  test('returns no-spec message when spec is undefined', () => {
    const text = planProgressText(undefined)
    expect(text.toLowerCase()).toContain('no spec loaded')
  })

  test('returns empty-spec message when all entry arrays are empty', () => {
    const text = planProgressText(makeSpec({}))
    expect(text.toLowerCase()).toContain('empty')
  })

  test('mentions Value count when values are present', () => {
    const text = planProgressText(makeSpec({ values: [{ id: 'v1' }, { id: 'v2' }] }))
    expect(text).toContain('2 Values')
  })

  test('mentions Function count when functions are present', () => {
    const text = planProgressText(makeSpec({ functions: [{ id: 'f1' }] }))
    expect(text).toContain('1 Function')
  })

  test('prompts to add Values when values array is empty but other entries exist', () => {
    const text = planProgressText(makeSpec({ functions: [{ id: 'f1' }] }))
    expect(text.toLowerCase()).toContain('value')
  })

  test('prompts to add Solutions when values exist but solutions are empty', () => {
    const text = planProgressText(makeSpec({ values: [{ id: 'v1' }] }))
    expect(text.toLowerCase()).toContain('solution')
  })

  test('mentions Evo steps when both values and solutions are present', () => {
    const text = planProgressText(makeSpec({
      values:    [{ id: 'v1' }],
      solutions: [{ id: 's1' }],
    }))
    expect(text.toLowerCase()).toContain('evo')
  })

  test('mentions Constraint count when constraints are present', () => {
    const text = planProgressText(makeSpec({
      values:      [{ id: 'v1' }],
      constraints: [{ id: 'c1' }, { id: 'c2' }],
    }))
    expect(text).toContain('2 Constraints')
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// nextStepText
// ─────────────────────────────────────────────────────────────────────────────

describe('nextStepText', () => {

  test('stage 1 references Stage 1 and Stage 2 in the output', () => {
    const text = nextStepText(1)
    expect(text).toContain('Stage 1')
    expect(text).toContain('Stage 2')
  })

  test('stage 9 (Learn) references Stage 9 and Stage 10', () => {
    const text = nextStepText(9)
    expect(text).toContain('Stage 9')
    expect(text).toContain('Stage 10')
  })

  test('stage 11 (final) mentions it is the final stage', () => {
    const text = nextStepText(11)
    expect(text.toLowerCase()).toContain('final')
  })

  test('stage 11 does not reference a Stage 12', () => {
    const text = nextStepText(11)
    expect(text).not.toContain('Stage 12')
  })

  test('mentions Evo stages can be revisited (circular navigation principle)', () => {
    const text = nextStepText(5)
    expect(text.toLowerCase()).toMatch(/circle back|jump forward|living plan/)
  })

  test('returns a non-empty string for every stage 1–11', () => {
    for (let stage = 1; stage <= 11; stage++) {
      const text = nextStepText(stage)
      expect(typeof text).toBe('string')
      expect(text.trim().length).toBeGreaterThan(0)
    }
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// stagesUntilSharing
// ─────────────────────────────────────────────────────────────────────────────

describe('stagesUntilSharing', () => {

  test('returns empty array when current stage is 11 (Export)', () => {
    expect(stagesUntilSharing(11)).toHaveLength(0)
  })

  test('returns 2 stages (10, 11) when current stage is 9', () => {
    const result = stagesUntilSharing(9)
    expect(result).toHaveLength(2)
    expect(result[0].stage).toBe(10)
    expect(result[1].stage).toBe(11)
  })

  test('returns 10 stages when current stage is 1', () => {
    expect(stagesUntilSharing(1)).toHaveLength(10)
  })

  test('stages are returned in ascending order', () => {
    const result = stagesUntilSharing(5)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].stage).toBeGreaterThan(result[i - 1].stage)
    }
  })

  test('every item has a non-empty name', () => {
    const result = stagesUntilSharing(1)
    for (const item of result) {
      expect(typeof item.name).toBe('string')
      expect(item.name.trim().length).toBeGreaterThan(0)
    }
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// useAmuseMe composable state
// ─────────────────────────────────────────────────────────────────────────────

describe('useAmuseMe', () => {

  test('initial state: isOpen=false, activeItemId=null', () => {
    const { isOpen, activeItemId } = useAmuseMe()
    expect(isOpen.value).toBe(false)
    expect(activeItemId.value).toBe(null)
  })

  test('toggle() opens the panel', () => {
    const { isOpen, toggle } = useAmuseMe()
    toggle()
    expect(isOpen.value).toBe(true)
  })

  test('toggle() twice closes the panel', () => {
    const { isOpen, toggle } = useAmuseMe()
    toggle()
    toggle()
    expect(isOpen.value).toBe(false)
  })

  test('toggle() closing also clears activeItemId', () => {
    const { isOpen, activeItemId, toggle, selectItem } = useAmuseMe()
    selectItem('glossaryJoke')
    expect(activeItemId.value).toBe('glossaryJoke')
    // close by toggling when open
    toggle()  // close (was opened by selectItem)
    expect(activeItemId.value).toBe(null)
  })

  test('selectItem() sets activeItemId and opens panel', () => {
    const { isOpen, activeItemId, selectItem } = useAmuseMe()
    selectItem('planProgress')
    expect(activeItemId.value).toBe('planProgress')
    expect(isOpen.value).toBe(true)
  })

  test('selectItem() can change the active item', () => {
    const { activeItemId, selectItem } = useAmuseMe()
    selectItem('glossaryJoke')
    selectItem('niceThings')
    expect(activeItemId.value).toBe('niceThings')
  })

  test('close() sets isOpen=false and activeItemId=null', () => {
    const { isOpen, activeItemId, selectItem, close } = useAmuseMe()
    selectItem('nextStep')
    close()
    expect(isOpen.value).toBe(false)
    expect(activeItemId.value).toBe(null)
  })

  test('each call to useAmuseMe() returns independent state (no singleton bleed)', () => {
    const a = useAmuseMe()
    const b = useAmuseMe()
    a.toggle()
    expect(a.isOpen.value).toBe(true)
    expect(b.isOpen.value).toBe(false)
  })

})
