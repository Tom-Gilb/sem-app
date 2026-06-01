// UNIT_TYPE=Hook
// useGlossaryEntry — Fetch and cache Planguage glossary entries from the vault.
//
// Requests the raw markdown for a given term from the local Vite dev-server middleware
// at /api/glossary?term=<TermName>, parses it into a GlossaryEntry, and caches the
// result in module-level state so repeated lookups for the same term are instant.
//
// Probing strategy:
//   fetchEntry() can be called for ANY defined term (not just AI-classified planguage-terms).
//   404 responses are silent — they just mean the term has no vault glossary entry.
//   The pin in SelectionDefiner shows only when entry !== null (glossary match confirmed).
//   _notFound tracks terms already probed as absent to avoid repeat 404 requests.
//   _nearMatchCache stores near-match suggestions from the server (X-Near-Match-Options
//   header) so they survive _notFound early-returns on repeated selections.
//
// Only available in dev mode (the /api/glossary endpoint is served by glossaryPlugin()
// in vite.config.ts and is not present in production builds).

import { ref } from 'vue'
import type { GlossaryEntry } from '../utils/parseGlossaryEntry'
import { parseGlossaryEntry } from '../utils/parseGlossaryEntry'

// Module-level cache: term → entry  (survives component unmount)
const _cache          = new Map<string, GlossaryEntry>()
// Terms already probed and confirmed absent — avoids repeat 404 fetches
const _notFound       = new Set<string>()
// Near-match suggestions from server X-Near-Match-Options header, keyed by term
const _nearMatchCache = new Map<string, string[]>()

export function useGlossaryEntry() {
  const loading         = ref(false)
  const entry           = ref<GlossaryEntry | null>(null)
  const error           = ref('')
  /** Set when the term was resolved via synonym, article-stripping, or singularization.
   *  Contains the canonical english_name (e.g. "System") so the UI can show an attribution. */
  const synonymOf       = ref<string | null>(null)
  /** Near-match concept names from the server when no glossary entry exists.
   *  Shown as "Did you mean?" buttons in the Define panel. */
  const nearMatchOptions = ref<string[]>([])
  /**
   * True when the probe failed due to a connectivity problem (503 or network error)
   * rather than a genuine 404 (term absent from vault glossary).
   * Allows SelectionDefiner to show a "dev server needed" hint instead of silence.
   */
  const probeError = ref(false)

  /**
   * Fetch the glossary entry for `term`.  Sets `entry` on success.
   * On 404: entry stays null, no error — the term simply isn't in the glossary.
   * On 503 / network failure: only shows an error message when `userInitiated` is true
   * (i.e. the user actively clicked "More Concept Detail"), not during background probing.
   *
   * @param term           The term to look up (case-insensitive file match).
   * @param userInitiated  true = user explicitly opened the detail panel (show error messages).
   *                       false (default) = auto-probe on result arrival (errors are silent).
   */
  async function fetchEntry(term: string, userInitiated = false): Promise<void> {
    const normalised = term.trim()
    if (!normalised) return

    // Already probed — absent from glossary; restore any cached near-match suggestions
    if (_notFound.has(normalised)) {
      nearMatchOptions.value = _nearMatchCache.get(normalised) ?? []
      return
    }

    // Cache hit
    if (_cache.has(normalised)) {
      entry.value = _cache.get(normalised)!
      error.value = ''
      return
    }

    loading.value    = true
    error.value      = ''
    entry.value      = null
    probeError.value = false

    console.debug(`[glossary] fetchEntry("${normalised}") — starting fetch`)

    try {
      const res = await fetch(`/api/glossary?term=${encodeURIComponent(normalised)}`)

      console.debug(`[glossary] fetchEntry("${normalised}") — HTTP ${res.status}`)

      if (res.status === 404) {
        // Read near-match suggestions before caching the miss
        const opts    = res.headers.get('x-near-match-options')
        const optList = opts ? opts.split(',').map(s => s.trim()).filter(Boolean) : []
        console.debug(`[glossary] fetchEntry("${normalised}") — 404, near-matches:`, optList)
        nearMatchOptions.value = optList
        if (optList.length > 0) _nearMatchCache.set(normalised, optList)
        _notFound.add(normalised)
        return
      }
      if (res.status === 503) {
        probeError.value = true
        if (userInitiated) error.value = 'Vault glossary folder not accessible — is the vault mounted?'
        return
      }
      if (!res.ok) {
        probeError.value = true
        if (userInitiated) error.value = `Glossary lookup failed (HTTP ${res.status}).`
        return
      }

      const markdown    = await res.text()
      const parsed      = parseGlossaryEntry(markdown, normalised)
      console.debug(`[glossary] fetchEntry("${normalised}") — parsed OK, setting entry.value. term="${parsed.term}"`)
      _cache.set(normalised, parsed)
      entry.value   = parsed
      synonymOf.value = res.headers.get('x-synonym-of') ?? null
      console.debug(`[glossary] fetchEntry("${normalised}") — entry.value now:`, entry.value?.term ?? 'null')
    } catch (err) {
      console.error(`[glossary] fetchEntry("${normalised}") — caught error:`, err)
      probeError.value = true
      if (userInitiated) error.value = 'Network error — could not reach local glossary endpoint.'
    } finally {
      loading.value = false
    }
  }

  /** Clear the current entry without clearing the module-level caches. */
  function clearEntry(): void {
    entry.value            = null
    error.value            = ''
    synonymOf.value        = null
    nearMatchOptions.value = []
    probeError.value       = false
  }

  return {
    loading,
    entry,
    error,
    synonymOf,
    nearMatchOptions,
    probeError,
    fetchEntry,
    clearEntry,
  }
}
