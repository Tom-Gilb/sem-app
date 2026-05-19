/**
 * useGlobalSearch — command-palette search for all SEM App features.
 *
 * Exports:
 *   useGlobalSearch()  — singleton open/close state shared between App.vue and GlobalSearch.vue
 *   fuzzySearch()      — scores entries against a query string; tolerates misspellings
 *   SearchEntry        — type for a searchable action
 *   SearchResult       — type for a scored result
 */

import { ref } from 'vue'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SearchEntry {
  id: string
  /** Display name shown in the result row */
  name: string
  /** One-line description shown below the name */
  description: string
  /** Extra words / synonyms the user might type — not displayed */
  keywords?: string[]
  /** Where the feature lives — shown as a pill on the right */
  context: string
  /** Emoji icon */
  icon: string
  /** Called when the user clicks or presses Enter on this result */
  action: () => void
  /** When true, row is greyed out and action is blocked */
  disabled?: boolean
}

export interface SearchResult {
  entry: SearchEntry
  score: number
}

// ── Singleton open state ───────────────────────────────────────────────────────

const _open = ref(false)

export function useGlobalSearch() {
  return {
    isOpen: _open,
    open:   () => { _open.value = true },
    close:  () => { _open.value = false },
    toggle: () => { _open.value = !_open.value },
  }
}

// ── Fuzzy search ───────────────────────────────────────────────────────────────

/**
 * Returns up to 8 results scored by relevance.
 * Empty query → empty results (caller shows a default hint instead).
 */
export function fuzzySearch(query: string, entries: SearchEntry[]): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const results: SearchResult[] = []
  for (const entry of entries) {
    const score = _scoreEntry(q, entry)
    if (score > 0) results.push({ entry, score })
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 9)
}

function _scoreEntry(q: string, entry: SearchEntry): number {
  const targets = [
    { text: entry.name,        weight: 1.5 },
    { text: entry.description, weight: 1.0 },
    { text: entry.context,     weight: 0.8 },
    ...(entry.keywords ?? []).map(k => ({ text: k, weight: 1.2 })),
  ]

  let best = 0
  for (const { text, weight } of targets) {
    const s = _scoreAgainst(q, text.toLowerCase()) * weight
    if (s > best) best = s
  }
  return best
}

function _scoreAgainst(q: string, t: string): number {
  // 1. Exact substring — highest rank
  if (t.includes(q)) return 10 - (t.indexOf(q) / (t.length || 1)) * 0.3

  // 2. Target word starts with query
  if (t.startsWith(q)) return 9.5

  // 3. Any word in the target starts with query
  if (t.split(/\s+/).some(w => w.startsWith(q))) return 7.5

  // 4. All words in a multi-word query are substrings of the target
  const qWords = q.split(/\s+/)
  if (qWords.length > 1 && qWords.every(w => t.includes(w))) return 7

  // 5. Subsequence matching — all query chars appear in order
  const subScore = _subsequenceScore(q, t)
  if (subScore > 0) return subScore * 5

  // 6. Edit-distance tolerance for short queries (≤ 7 chars) — catches typos
  if (q.length <= 7) {
    // Compare against the beginning of the target (same length window)
    const window = t.slice(0, q.length + 2)
    const ed = _editDistance(q, window)
    if (ed === 1) return 2.5
    if (ed === 2 && q.length >= 4) return 1.5
  }

  return 0
}

/** Returns a 0–1 score for how well q appears as a subsequence in t. */
function _subsequenceScore(q: string, t: string): number {
  let qi = 0, score = 0, consecutive = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 1 + consecutive * 0.4   // reward consecutive matches
      consecutive++
      qi++
    } else {
      consecutive = 0
    }
  }
  if (qi < q.length) return 0          // didn't consume all query chars
  return score / (q.length * 1.4)      // normalise to ~0–1
}

/** Classic Wagner–Fischer edit distance. */
function _editDistance(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}
