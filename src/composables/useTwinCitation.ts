// useTwinCitation.ts — Tom's Twin Consultant programmatic citation backend
// (Tom Gilb r93ttt 2026-06-12).
//
// Single source of truth for hitting Tom Gilb's Twin Consultant /api/chat
// endpoint (public, CORS-open, no auth — probed in r93ooo) to retrieve
// canonical Planguage Glossary entries. Returns the raw answer text plus
// any concept numbers found in the response so the caller can build
// clickable Twin concept URLs (per r93ppp Twin-as-Destination discipline).
//
// Usage:
//   const { citeTerm, lastResult, isLoading, lastError } = useTwinCitation()
//   await citeTerm('Qualifier')   // streams response into lastResult
//
// Single shared composable instance per session (singleton) — caches
// successful queries by lowercased term so the second click on the same
// concept is instant.
//
// Tom verbatim (r93ooo): "you can just go there, on principle. Then when
// you give quotes, you can actually cite the exact URL or is is URI to
// get into the book free no passwords at a click."
//
// Composes with: r93ooo Twin Integration Architecture; r93ppp Twin-as-
// Destination commercial framing; r93jjj/r93kkk/r93mmm Qualifiers SUPREME
// rules (Twin is the canonical source); Conjunction-of-Technologies SUPREME
// (Twin materialises the Gilb-corpus layer).

import { ref, readonly } from 'vue'

const TWIN_API = 'https://www.gilb.com/api/chat'
const TWIN_BASE = 'https://www.gilb.com/tomtwin'
const TWIN_LOGIN_URL = `${TWIN_BASE}/login`
/** Named-export form so a plain `<a :href>` consumer doesn't need to instantiate the composable. */
export const TWIN_LOGIN_URL_EXPORT: string = TWIN_LOGIN_URL

export interface TwinCitationResult {
  /** The verbatim text streamed back from the Twin */
  text: string
  /** Concept numbers parsed from the response, e.g. ['124', '666'] */
  conceptNumbers: string[]
  /** First clickable concept URL (or `null` if no concept number parsed) */
  primaryConceptUrl: string | null
  /** The query that produced this result */
  term: string
  /** ISO timestamp of retrieval */
  retrievedAtIso: string
}

const _isLoading = ref<boolean>(false)
const _lastResult = ref<TwinCitationResult | null>(null)
const _lastError  = ref<string | null>(null)
const _cache = new Map<string, TwinCitationResult>()

/** Parse `*NNN` concept numbers out of arbitrary Twin response text. */
function _parseConceptNumbers(text: string): string[] {
  const re = /\*(\d{2,4})\b/g
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) seen.add(m[1])
  return Array.from(seen)
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
    } catch { /* ignore non-JSON / partial frames */ }
  }
  return acc
}

/**
 * Build the user prompt that maximises the chance of a single-shot answer
 * WITHOUT triggering the Twin's internal tool roundtrip. Asks the Twin to
 * answer from loaded context, return concept numbers, and quote sources.
 */
function _buildPrompt(term: string): string {
  return `Define the Planguage / CE concept "${term}" from your loaded glossary context. ` +
         `Return: a 2-3 sentence definition, the concept number (e.g. *124), and the canonical Tom Gilb source ` +
         `(book + chapter + page if available). If multiple related concepts exist, list each with its concept number. ` +
         `Do not call tools — answer from your own loaded context. Cite Twin concept URLs in the form ` +
         `https://www.gilb.com/tomtwin/concept/<Name>.<N> when you reference a concept.`
}

/**
 * Build a Twin concept URL given a concept name + number. The Twin SPA renders
 * the concept page passwordless / free / at-a-click (Tom verbatim r93ooo).
 */
export function twinConceptUrl(name: string, conceptNumber: string | number): string {
  // Normalise name to dot-segment form (e.g. "Qualifier Condition" → "Qualifier-Condition")
  const safe = name.trim().replace(/\s+/g, '-')
  return `${TWIN_BASE}/concept/${safe}.${conceptNumber}`
}

/**
 * Convenience helper — opens the Twin Consultant landing page in a new tab.
 * For users to start a deeper free-form conversation with the Twin Consultant.
 */
export function openTwinConsultant(): void {
  if (typeof window !== 'undefined') {
    window.open(TWIN_LOGIN_URL, '_blank', 'noopener')
  }
}

/**
 * Singleton — returns a stable instance of the Twin citation composable.
 */
export function useTwinCitation() {
  /**
   * Cite a Planguage / CE term via Tom's Twin. Streams the response into
   * `lastResult`. Returns the result on success, throws on failure.
   */
  async function citeTerm(term: string, opts?: { force?: boolean; signal?: AbortSignal }): Promise<TwinCitationResult> {
    const key = term.trim().toLowerCase()
    if (!key) throw new Error('Empty term')

    // Cache hit
    if (!opts?.force && _cache.has(key)) {
      const cached = _cache.get(key)!
      _lastResult.value = cached
      return cached
    }

    _isLoading.value = true
    _lastError.value = null

    try {
      const res = await fetch(TWIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: _buildPrompt(term) }],
        }),
        signal: opts?.signal,
      })

      if (!res.ok) {
        throw new Error(`Twin /api/chat returned HTTP ${res.status}`)
      }

      const raw = await res.text()
      const text = _parseSseResponse(raw)
      const conceptNumbers = _parseConceptNumbers(text)
      const primary = conceptNumbers.length > 0
        ? twinConceptUrl(term, conceptNumbers[0])
        : null

      const result: TwinCitationResult = {
        text: text.trim() || '(Twin returned an empty response — try again or open the Twin Consultant directly.)',
        conceptNumbers,
        primaryConceptUrl: primary,
        term,
        retrievedAtIso: new Date().toISOString(),
      }

      _cache.set(key, result)
      _lastResult.value = result
      return result
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      _lastError.value = msg
      throw e
    } finally {
      _isLoading.value = false
    }
  }

  /** Clear the in-memory cache (testing + manual refresh). */
  function clearCache(): void {
    _cache.clear()
    _lastResult.value = null
    _lastError.value = null
  }

  return {
    citeTerm,
    clearCache,
    twinConceptUrl,
    openTwinConsultant,
    isLoading: readonly(_isLoading),
    lastResult: readonly(_lastResult),
    lastError:  readonly(_lastError),
    TWIN_LOGIN_URL,
  }
}
