// UNIT_TYPE=Test
// Feature #47 — Emoji progress tracker unit tests

import { describe, it, expect } from 'vitest'
import { getProgressEmojis, getProgressLabel } from '../emojiProgress'

describe('getProgressEmojis', () => {
  it('returns all 🌱 when totalTasks is 0', () => {
    expect(getProgressEmojis(0, 0)).toEqual(['🌱', '🌱', '🌱', '🌱', '🌱'])
  })

  it('returns all 🌱 when 0 of 5 tasks are complete', () => {
    expect(getProgressEmojis(0, 5)).toEqual(['🌱', '🌱', '🌱', '🌱', '🌱'])
  })

  it('returns all 🌳 when all 5 of 5 tasks are complete', () => {
    expect(getProgressEmojis(5, 5)).toEqual(['🌳', '🌳', '🌳', '🌳', '🌳'])
  })

  it('returns [🌲,🌱,🌱,🌱,🌱] for 1/5 tasks (20%, filledSlots=1)', () => {
    // ratio=0.2, filledSlots=round(0.2*5)=1 → i===0 → 🌲, rest → 🌱
    expect(getProgressEmojis(1, 5)).toEqual(['🌲', '🌱', '🌱', '🌱', '🌱'])
  })

  it('returns [🌳,🌳,🌲,🌱,🌱] for 2/4 tasks (50%, filledSlots=3)', () => {
    // ratio=0.5, filledSlots=round(0.5*5)=3 → i<2→🌳, i===2→🌲, i>2→🌱
    expect(getProgressEmojis(2, 4)).toEqual(['🌳', '🌳', '🌲', '🌱', '🌱'])
  })

  it('returns [🌳,🌳,🌳,🌲,🌱] for 4/5 tasks (80%, filledSlots=4)', () => {
    // ratio=0.8, filledSlots=round(0.8*5)=4 → i<3→🌳, i===3→🌲, i>3→🌱
    expect(getProgressEmojis(4, 5)).toEqual(['🌳', '🌳', '🌳', '🌲', '🌱'])
  })

  it('supports custom slots=3 with 1/2 tasks (50%, filledSlots=2)', () => {
    // ratio=0.5, filledSlots=round(0.5*3)=2 → i<1→🌳, i===1→🌲, i>1→🌱
    expect(getProgressEmojis(1, 2, 3)).toEqual(['🌳', '🌲', '🌱'])
  })

  it('returns all 🌳 for exactly 100% completion', () => {
    expect(getProgressEmojis(10, 10)).toEqual(['🌳', '🌳', '🌳', '🌳', '🌳'])
  })
})

describe('getProgressLabel', () => {
  it('returns "No tasks" when totalTasks is 0', () => {
    expect(getProgressLabel(0, 0)).toBe('No tasks')
  })

  it('returns correct label for partial completion', () => {
    expect(getProgressLabel(2, 5)).toBe('2 of 5 tasks complete (40%)')
  })

  it('returns correct label for full completion', () => {
    expect(getProgressLabel(5, 5)).toBe('5 of 5 tasks complete (100%)')
  })
})
