// UNIT_TYPE=Test
// Feature #175 — Tests for usePodcastOutline composable

import { describe, it, expect } from 'vitest'
import { usePodcastOutline, buildPodcastOutline } from '../usePodcastOutline'
import type { SpecBlock } from '../../types/spec'

function makeBlock(): SpecBlock {
  return {
    functions: [
      {
        id: 'F.DeliverSEM',
        type: 'Function',
        level: 'Product',
        description: 'Deliver a SEM entry interface for users with real-time feedback',
        successCriteria: 'Users complete entry in under 30 seconds',
        functionOfValue: 'V.EntryFluency',
      },
    ],
    values: [
      {
        id: 'V.EntryFluency',
        type: 'Value',
        level: 'Product',
        description: 'Speed at which users complete SEM entries in seconds per session',
        scale: 'seconds per entry',
        meter: 'Average session time',
        status: 'Status 45 seconds',
        tolerable: 'Tolerable 30 seconds',
        goal: 'Goal 20 seconds',
        valueOfFunction: 'F.DeliverSEM',
      },
      {
        id: 'V.Accuracy',
        type: 'Value',
        level: 'Product',
        description: 'Accuracy rate of SEM entries submitted',
        scale: '% correct entries',
        meter: 'Manual review sample',
        status: 'Status 70%',
        tolerable: 'Tolerable 85%',
        goal: 'Goal 95%',
        valueOfFunction: 'F.DeliverSEM',
      },
    ],
    solutions: [
      {
        id: 'S.AutoComplete',
        type: 'Solution',
        level: 'Product',
        description: 'Autocomplete suggestions for SEM fields using past entries',
        impact: 'V.EntryFluency ~80%',
        function: 'F.DeliverSEM',
      },
    ],
  }
}

function makeEmptyBlock(): SpecBlock {
  return { functions: [], values: [], solutions: [] }
}

// ── buildPodcastOutline unit tests ──────────────────────────────────────────

describe('buildPodcastOutline', () => {
  it('returns 3 segments', () => {
    const outline = buildPodcastOutline([makeBlock()])
    expect(outline.segments).toHaveLength(3)
  })

  it('Hook act is first segment', () => {
    const outline = buildPodcastOutline([makeBlock()])
    expect(outline.segments[0].act).toBe('Hook')
  })

  it('Body act is second segment', () => {
    const outline = buildPodcastOutline([makeBlock()])
    expect(outline.segments[1].act).toBe('Body')
  })

  it('CTA act is third segment', () => {
    const outline = buildPodcastOutline([makeBlock()])
    expect(outline.segments[2].act).toBe('CTA')
  })

  it('Hook title is "Why This Spec Matters"', () => {
    const outline = buildPodcastOutline([makeBlock()])
    expect(outline.segments[0].title).toBe('Why This Spec Matters')
  })

  it('CTA title is "What To Do Next"', () => {
    const outline = buildPodcastOutline([makeBlock()])
    expect(outline.segments[2].title).toBe('What To Do Next')
  })

  it('Hook has 3 bullets', () => {
    const outline = buildPodcastOutline([makeBlock()])
    expect(outline.segments[0].bullets).toHaveLength(3)
  })

  it('Hook second bullet contains value count', () => {
    const outline = buildPodcastOutline([makeBlock()])
    expect(outline.segments[0].bullets[1]).toMatch(/2 value goals? defined/)
  })

  it('Body bullets include goal entries', () => {
    const outline = buildPodcastOutline([makeBlock()])
    const bodyBullets = outline.segments[1].bullets
    expect(bodyBullets.some(b => b.includes('V.EntryFluency'))).toBe(true)
  })

  it('CTA includes stakeholder bullet', () => {
    const outline = buildPodcastOutline([makeBlock()])
    const ctaBullets = outline.segments[2].bullets
    expect(ctaBullets.some(b => b.includes('stakeholders'))).toBe(true)
  })

  it('CTA review date uses current year + 1', () => {
    const outline = buildPodcastOutline([makeBlock()])
    const nextYear = (new Date().getFullYear() + 1).toString()
    expect(outline.segments[2].bullets.some(b => b.includes(nextYear))).toBe(true)
  })

  it('episode title includes first F. description (truncated 40)', () => {
    const outline = buildPodcastOutline([makeBlock()])
    expect(outline.episodeTitle).toContain('A Planguage Deep Dive')
    expect(outline.episodeTitle).toContain('Deliver a SEM entry interface')
  })

  it('episodeTitle fallback when no functions', () => {
    const outline = buildPodcastOutline([makeEmptyBlock()])
    expect(outline.episodeTitle).toBe('Planguage Spec Walkthrough: A Deep Dive')
  })

  it('Hook durationMins is 2', () => {
    const outline = buildPodcastOutline([makeBlock()])
    expect(outline.segments[0].durationMins).toBe(2)
  })

  it('CTA durationMins is 1', () => {
    const outline = buildPodcastOutline([makeBlock()])
    expect(outline.segments[2].durationMins).toBe(1)
  })

  it('totalMins equals sum of segment durations', () => {
    const outline = buildPodcastOutline([makeBlock()])
    const sum = outline.segments.reduce((a, s) => a + s.durationMins, 0)
    expect(outline.totalMins).toBe(sum)
  })

  it('Body durationMins = 2 + bullet count', () => {
    const outline = buildPodcastOutline([makeBlock()])
    const body = outline.segments[1]
    expect(body.durationMins).toBe(2 + body.bullets.length)
  })
})

// ── usePodcastOutline composable tests ──────────────────────────────────────

describe('usePodcastOutline', () => {
  it('returns fallback outline for empty blocks', () => {
    const { outline } = usePodcastOutline([])
    expect(outline.value.episodeTitle).toBe('Planguage Spec Walkthrough: A Deep Dive')
  })

  it('open ref starts false', () => {
    const { open } = usePodcastOutline([makeBlock()])
    expect(open.value).toBe(false)
  })

  it('copied ref starts false', () => {
    const { copied } = usePodcastOutline([makeBlock()])
    expect(copied.value).toBe(false)
  })

  it('outline has non-zero totalMins', () => {
    const { outline } = usePodcastOutline([makeBlock()])
    expect(outline.value.totalMins).toBeGreaterThan(0)
  })
})
