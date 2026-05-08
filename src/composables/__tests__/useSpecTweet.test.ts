// UNIT_TYPE=Test
// Feature #90 — useSpecTweet composable tests

import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useSpecTweet } from '../useSpecTweet'
import type { SpecBlock, FEntry, VEntry, SEntry } from '../../types/spec'

function makeF(overrides: Partial<FEntry> = {}): FEntry {
  return {
    id: '3P.F.CheckerTool',
    type: 'Function',
    level: 'Product',
    description: 'The system provides a spec entry interface for users to input data.',
    successCriteria: '',
    functionOfValue: '',
    ...overrides,
  }
}

function makeV(overrides: Partial<VEntry> = {}): VEntry {
  return {
    id: '3P.V.EntryFluency',
    type: 'Value',
    level: 'Product',
    description: 'Measures how quickly users can enter a spec entry.',
    scale: 'seconds per entry',
    meter: 'Automated timer',
    status: 'Status [now] 60',
    tolerable: 'Tolerable [2026] 45',
    goal: 'Goal [2026] 30',
    valueOfFunction: '',
    ...overrides,
  }
}

function makeS(overrides: Partial<SEntry> = {}): SEntry {
  return {
    id: '3P.S.MarkdownSerialiser',
    type: 'Solution',
    level: 'Product',
    description: 'A markdown serialiser handles output formatting.',
    impact: '',
    function: '',
    ...overrides,
  }
}

function makeSpec(overrides: Partial<SpecBlock> = {}): SpecBlock {
  return {
    functions: [makeF()],
    values: [makeV()],
    solutions: [makeS()],
    ...overrides,
  }
}

describe('useSpecTweet', () => {
  it('initial: tweetOpen is false', () => {
    const spec = ref<SpecBlock | null>(null)
    const { tweetOpen } = useSpecTweet(spec)
    expect(tweetOpen.value).toBe(false)
  })

  it('initial: tweets array is empty', () => {
    const spec = ref<SpecBlock | null>(null)
    const { tweets } = useSpecTweet(spec)
    expect(tweets.value).toHaveLength(0)
  })

  it('generateTweets with null spec produces empty tweets array', () => {
    const spec = ref<SpecBlock | null>(null)
    const { tweets, generateTweets } = useSpecTweet(spec)
    generateTweets()
    expect(tweets.value).toHaveLength(0)
  })

  it('generateTweets with empty spec (no entries) produces empty tweets array', () => {
    const spec = ref<SpecBlock | null>({ functions: [], values: [], solutions: [] })
    const { tweets, generateTweets } = useSpecTweet(spec)
    generateTweets()
    expect(tweets.value).toHaveLength(0)
  })

  it('generateTweets with one F. entry produces exactly 1 tweet', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [],
      solutions: [],
    }))
    const { tweets, generateTweets } = useSpecTweet(spec)
    generateTweets()
    expect(tweets.value).toHaveLength(1)
    expect(tweets.value[0].type).toBe('F')
  })

  it('all generated tweets have charCount ≤ 280', () => {
    const spec = ref<SpecBlock | null>(makeSpec())
    const { tweets, generateTweets } = useSpecTweet(spec)
    generateTweets()
    for (const t of tweets.value) {
      expect(t.charCount).toBeLessThanOrEqual(280)
    }
  })

  it('overLimit is false for normal entries', () => {
    const spec = ref<SpecBlock | null>(makeSpec())
    const { tweets, generateTweets } = useSpecTweet(spec)
    generateTweets()
    for (const t of tweets.value) {
      expect(t.overLimit).toBe(false)
    }
  })

  it('tweet text includes the entry ID', () => {
    const spec = ref<SpecBlock | null>(makeSpec())
    const { tweets, generateTweets } = useSpecTweet(spec)
    generateTweets()
    for (const t of tweets.value) {
      expect(t.tweet).toContain(t.id)
    }
  })

  it('V. entry tweet includes "Goal" or scale info', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      functions: [],
      solutions: [],
    }))
    const { tweets, generateTweets } = useSpecTweet(spec)
    generateTweets()
    const vTweet = tweets.value[0]
    expect(vTweet.type).toBe('V')
    // Should contain either the scale value or "Goal"
    const hasGoalOrScale = vTweet.tweet.includes('Goal') || vTweet.tweet.includes('seconds per entry')
    expect(hasGoalOrScale).toBe(true)
  })

  it('copyThread output starts with "Thread:"', async () => {
    let captured = ''
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(async (text) => {
      captured = text
    })
    const spec = ref<SpecBlock | null>(makeSpec())
    const { generateTweets, copyThread } = useSpecTweet(spec)
    generateTweets()
    await copyThread()
    expect(captured).toMatch(/^Thread:/)
  })

  it('copyThread includes numbered prefix "1/"', async () => {
    let captured = ''
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(async (text) => {
      captured = text
    })
    const spec = ref<SpecBlock | null>(makeSpec())
    const { generateTweets, copyThread } = useSpecTweet(spec)
    generateTweets()
    await copyThread()
    expect(captured).toContain('1/')
  })
})
