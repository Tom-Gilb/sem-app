// useTwinSearch.ts — Tom's Twin Consultant ontology-backed search backend.
//
// Tom Gilb 2026-06-13 verbatim: "I hope you can make use of the twins advanced
// search logic, noting less is interesting".
//
// Difference from useTwinCitation:
//   - useTwinCitation asks "define this single term" → returns a definition + concept number
//   - useTwinSearch asks "find concepts related to this query" → returns a curated list of
//     relevant concepts with definitions, ranked by Twin's ontology graph relevance
//
// The Twin's /api/chat endpoint is ontology-backed (RDF/OWL via purl.org +
// semanticscience.org + schema.org vocabularies — see CLAUDE.md r93ooo).
// That means the Twin understands SEMANTIC RELATIONSHIPS between concepts
// (e.g. "stakeholder" surfaces Stakeholder Engineering, Stakeholder.Critical,
// Stakeholder.Inanimate-Data, etc.) rather than just text-matching.
//
// Architecture for the SEM picker integration:
//   1. User types a query in the picker
//   2. Local weighted ranker fires instantly (free, no network) — populates left/right columns
//   3. After 800 ms of typing pause, Twin search fires asynchronously
//   4. Twin response streams into a 🔮 banner above the local columns
//   5. Concept URLs in the response are clickable → open Twin Consultant in new tab
//
// Composes with: r93ooo Twin Integration Architecture (pattern C: TwinSearchBar);
// r93ppp Twin-as-Destination (every concept reference is a clickable Twin URL);
// Conjunction-of-Technologies SUPREME (Twin materialises the Gilb-corpus layer);
// No-Dodging-Ambiguous-Bugs rule (Twin search is the "fun and rewarding" bug Tom
// pointed me at: the local text ranker is OK but the Twin's ontology is the goal).

import { ref, readonly } from 'vue'

const TWIN_API = 'https://www.gilb.com/api/chat'
const TWIN_BASE = 'https://www.gilb.com/tomtwin'

export interface TwinSearchResult {
  /** Verbatim Twin response text (markdown) */
  text:              string
  /** Concept numbers parsed out of the response */
  conceptNumbers:    string[]
  /** All concept URLs found in the response — clickable */
  conceptUrls:       Array<{ name: string; number: string; url: string }>
  /** The query that produced this result */
  query:             string
  /** ISO timestamp of retrieval */
  retrievedAtIso:    string
  /** Wall-clock time (ms) the Twin took to respond — for UX progress reporting */
  elapsedMs:         number
}

const _isLoading      = ref(false)
const _lastResult     = ref<TwinSearchResult | null>(null)
const _lastError      = ref<string | null>(null)
const _elapsedSeconds = ref(0)
const _cache          = new Map<string, TwinSearchResult>()

/** Parse `*NNN` concept numbers out of arbitrary Twin response text. */
function _parseConceptNumbers(text: string): string[] {
  const re = /\*(\d{2,4})\b/g
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) seen.add(m[1])
  return Array.from(seen)
}

/** Parse `https://.../tomtwin/concept/<Name>.<N>` URLs out of the response. */
function _parseConceptUrls(text: string): Array<{ name: string; number: string; url: string }> {
  const re = /https?:\/\/www\.gilb\.com\/tomtwin\/concept\/([A-Za-z0-9_-]+)\.(\d{2,4})/g
  const out: Array<{ name: string; number: string; url: string }> = []
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const key = `${m[1]}.${m[2]}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ name: m[1], number: m[2], url: m[0] })
  }
  return out
}

/** Strip SSE `data: {...}` frame wrapper and concatenate delta text. */
function _parseSseResponse(raw: string): string {
  const lines = raw.split('\n').filter(l => l.startsWith('data: '))
  let acc = ''
  for (const line of lines) {
    try {
      const payload = JSON.parse(line.slice(6)) as { type?: string; text?: string }
      if (payload.type === 'delta' && typeof payload.text === 'string') {
        acc += payload.text
      }
    } catch { /* non-JSON or partial frame */ }
  }
  return acc
}

/**
 * Build the search prompt. Asks the Twin to:
 *   1. Identify the most relevant Planguage / CE / Tom Gilb concepts
 *   2. List each with concept number + brief description
 *   3. Cite Twin URLs so users can drill in
 *   4. Answer from loaded context — no tool calls (keeps response under 8 s)
 */
function _buildSearchPrompt(query: string): string {
  return (
    `I'm searching across Tom Gilb's Planguage / Competitive Engineering corpus for: "${query}".\n\n` +
    `Return the most relevant concepts in ranked order. For each concept:\n` +
    `  - Concept name and number (e.g. *124)\n` +
    `  - 1-2 sentence description from the canonical Glossary\n` +
    `  - Clickable Twin URL: https://www.gilb.com/tomtwin/concept/<Name>.<Number>\n` +
    `  - Source: book + chapter + page when known\n\n` +
    `Then a brief "Related Concepts" section listing 3-5 ontologically related concepts (with URLs).\n\n` +
    `Answer from your loaded glossary context. Do not call tools — single-shot answer.\n` +
    `Use markdown headings, bold, bullet lists. Keep total response under 600 words.`
  )
}

/** Open a streaming Twin /api/chat search query.  Singleton — one in-flight at a time. */
async function searchTwin(query: string, opts?: { force?: boolean; signal?: AbortSignal }): Promise<TwinSearchResult> {
  const key = query.trim().toLowerCase()
  if (!key) throw new Error('Empty query')

  // Cache hit
  if (!opts?.force && _cache.has(key)) {
    const cached = _cache.get(key)!
    _lastResult.value = cached
    _isLoading.value  = false
    _lastError.value  = null
    return cached
  }

  _isLoading.value      = true
  _lastError.value      = null
  _elapsedSeconds.value = 0
  const startMs = performance.now()
  const tickerId = window.setInterval(() => {
    _elapsedSeconds.value = Math.round((performance.now() - startMs) / 1000)
  }, 1000)

  try {
    const res = await fetch(TWIN_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: _buildSearchPrompt(query) }],
      }),
      signal: opts?.signal,
    })
    if (!res.ok) throw new Error(`Twin /api/chat returned HTTP ${res.status}`)
    const raw = await res.text()
    const text = _parseSseResponse(raw)
    const conceptNumbers = _parseConceptNumbers(text)
    const conceptUrls    = _parseConceptUrls(text)

    const result: TwinSearchResult = {
      text:           text.trim() || '(Twin returned an empty response — try a different query or open the Twin Consultant directly.)',
      conceptNumbers,
      conceptUrls,
      query,
      retrievedAtIso: new Date().toISOString(),
      elapsedMs:      Math.round(performance.now() - startMs),
    }
    _cache.set(key, result)
    _lastResult.value = result
    return result
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    _lastError.value = msg
    throw e
  } finally {
    window.clearInterval(tickerId)
    _isLoading.value = false
  }
}

/** Clear the in-memory cache + reset state. */
function clearCache(): void {
  _cache.clear()
  _lastResult.value = null
  _lastError.value  = null
}

/** Singleton accessor. */
export function useTwinSearch() {
  return {
    searchTwin,
    clearCache,
    isLoading:       readonly(_isLoading),
    lastResult:      readonly(_lastResult),
    lastError:       readonly(_lastError),
    elapsedSeconds:  readonly(_elapsedSeconds),
    TWIN_BASE,
  }
}
