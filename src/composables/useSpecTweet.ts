// UNIT_TYPE=Composable
// Feature #90 — "Spec as a tweet" thread
// Distils each F./V./S. entry in the spec into a ≤280-char tweet and formats a numbered thread.

import { ref } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface TweetEntry {
  id: string
  type: 'F' | 'V' | 'S'
  original: string  // full description/goal text
  tweet: string     // distilled to ≤280 chars
  charCount: number // tweet.length
  overLimit: boolean // charCount > 280
}

const MAX_CHARS = 280

function truncateToFit(prefix: string, raw: string): string {
  const full = prefix + raw
  if (full.length <= MAX_CHARS) return full
  // Reserve 1 char for "…"
  const budget = MAX_CHARS - prefix.length - 1
  if (budget <= 0) return (prefix + '…').slice(0, MAX_CHARS)
  return prefix + raw.slice(0, budget) + '…'
}

function firstSentence(text: string): string {
  if (!text) return ''
  const match = text.match(/^[^.!?]+[.!?]?/)
  return match ? match[0].trim() : text.trim()
}

export function useSpecTweet(spec: Ref<SpecBlock | null>) {
  const tweetOpen = ref(false)
  const tweets = ref<TweetEntry[]>([])

  function generateTweets(): void {
    const s = spec.value
    if (!s) {
      tweets.value = []
      return
    }

    const result: TweetEntry[] = []

    // F. entries — 🔧 prefix
    for (const f of s.functions) {
      const prefix = `🔧 ${f.id}: `
      const raw = firstSentence(f.description)
      const tweet = truncateToFit(prefix, raw)
      result.push({
        id: f.id,
        type: 'F',
        original: f.description,
        tweet,
        charCount: tweet.length,
        overLimit: tweet.length > MAX_CHARS,
      })
    }

    // V. entries — 📊 prefix + scale snippet + goal
    for (const v of s.values) {
      const prefix = `📊 ${v.id}: `
      // Build a meaningful snippet: scale + goal
      const scalePart = v.scale ? v.scale : ''
      const goalPart = v.goal ? `Goal: ${v.goal}` : ''
      const parts = [scalePart, goalPart].filter(Boolean)
      const raw = parts.length > 0 ? parts.join(' | ') : firstSentence(v.description)
      const tweet = truncateToFit(prefix, raw)
      result.push({
        id: v.id,
        type: 'V',
        original: v.description,
        tweet,
        charCount: tweet.length,
        overLimit: tweet.length > MAX_CHARS,
      })
    }

    // S. entries — 🔩 prefix
    for (const sol of s.solutions) {
      const prefix = `🔩 ${sol.id}: `
      const raw = firstSentence(sol.description)
      const tweet = truncateToFit(prefix, raw)
      result.push({
        id: sol.id,
        type: 'S',
        original: sol.description,
        tweet,
        charCount: tweet.length,
        overLimit: tweet.length > MAX_CHARS,
      })
    }

    tweets.value = result
  }

  async function copyThread(): Promise<void> {
    const s = spec.value
    if (!s) return

    const fCount = s.functions.length
    const vCount = s.values.length
    const sCount = s.solutions.length
    const header = `Thread: [${fCount} F., ${vCount} V., ${sCount} S.]`

    const n = tweets.value.length
    const lines = tweets.value.map((t, i) => `${i + 1}/${n} ${t.tweet}`)
    const thread = [header, '', ...lines.map(l => l)].join('\n\n')

    try {
      await navigator.clipboard.writeText(thread)
    } catch {
      // clipboard not available in test / SSR
    }
  }

  return { tweetOpen, tweets, generateTweets, copyThread }
}
