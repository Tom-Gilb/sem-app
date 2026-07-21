/**
 * useGilbIllustrations — read-only index of every illustration in every Tom
 * Gilb book on the public TwinPod containers.
 *
 * Index is built outside SEM by `0 - TOMS BOOKS/twinpod-illustrations/build-index.py`
 * and copied to `public/gilb-illustrations-index.json` for Vite to serve.
 *
 * One entry per illustration carries: bookId / bookTitle / page / kind /
 * caption / chapterTitle / publicly-fetchable image URL. The picker uses
 * caption + bookTitle + chapterTitle for search (Tom's OWN words, not OCR
 * guesses — that's the keyword system he hinted at).
 *
 * Composes WITH:
 *   - Conjunction-of-Technologies SUPREME — every inserted illustration
 *     carries a citation back to the source book + page + Twin Consultant URL.
 *   - r93ppp Twin promotional discipline — citation includes the gilb.com/tomtwin
 *     concept link so the reader can jump to the paid Twin Consultant tier.
 *   - TwinPod-URI Access Policy SUPREME — these are PUBLIC pod URIs (the
 *     /public/<Book>/_images/ tree), distinct from agent-internal node URIs
 *     gated behind Solid OAuth.
 *   - American English Standard — "illustration" / "Color" / etc.
 *   - HoverHint rule — caption tooltips use the HoverHint vocabulary.
 *
 * NO API call to gilb.com from this composable — the index is static JSON.
 * Image binaries fetch lazily on render (browser image cache handles it).
 */

import { ref, computed, type Ref } from 'vue'

export interface GilbIllustration {
  /** Stable composite id: `<bookId>/<filename>`. */
  id:            string
  bookId:        string
  bookTitle:     string
  /** Direct public image URL on the book's gilb.com pod (`.jpeg` or `.png`). */
  url:           string
  filename:      string
  /** PDF page number, parsed from the filename (`_page_273_Figure_2.jpeg` → 273). May be null for non-conforming names. */
  page:          number | null
  /** "Figure" | "Picture" | "Image" | "Table" | "Diagram" | "Unknown". */
  kind:          string
  /** Index within the page (`_page_273_Figure_2.jpeg` → 2). */
  figureIndex:   number | null
  /** Chapter title parsed from the MD frontmatter (Tom's own words). */
  chapterTitle:  string
  chapterIndex:  number | null
  /** Caption text — Tom's `description` from the image-metadata HTML comment if present, else heuristic. */
  caption:       string
  /** Structured keyword tags from `keywords: [...]` in the image-metadata HTML comment.  EMPTY array if absent. */
  keywords?:     string[]
  /** Full OCR'd text content of the image from `ocr-text: |` block scalar.  EMPTY string if absent. */
  ocrText?:      string
}

export interface GilbIllustrationsIndex {
  version:             number
  generated:           string
  totalBooks:          number
  totalIllustrations:  number
  books: Array<{
    bookId:        string
    bookTitle:     string
    subdomain:     string
    bookFolder?:   string
    error?:        string | null
    illustrations: GilbIllustration[]
  }>
}

/** Singleton — one fetch per session. */
const _index   = ref<GilbIllustrationsIndex | null>(null)
const _loading = ref(false)
const _error   = ref<string | null>(null)

// r93qqq r12 (Tom 2026-06-13: "search text does not give any reply right under
// it, some old stale text is there") — root cause: Safari + Vite no-store
// headers should kill cache, but `cache: 'force-cache'` here was forcing the
// browser to serve OLD index versions from before the indexer was re-run.
// Fix: default cache mode + a version param tied to the build so any reindex
// invalidates immediately.
const INDEX_URL = `/gilb-illustrations-index.json?v=${Date.now() % 100000}`

async function ensureLoaded(): Promise<void> {
  if (_index.value || _loading.value) return
  _loading.value = true
  _error.value   = null
  try {
    const res = await fetch(INDEX_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    _index.value = await res.json() as GilbIllustrationsIndex
  } catch (e) {
    _error.value = `Could not load Gilb illustrations index: ${(e as Error).message}`
    console.warn('[useGilbIllustrations]', _error.value)
  } finally {
    _loading.value = false
  }
}

export function useGilbIllustrations() {
  ensureLoaded()

  const all = computed<GilbIllustration[]>(() => {
    if (!_index.value) return []
    return _index.value.books.flatMap(b => b.illustrations)
  })

  const books = computed(() => {
    if (!_index.value) return []
    return _index.value.books.map(b => ({
      id:    b.bookId,
      title: b.bookTitle,
      count: b.illustrations.length,
    }))
  })

  /**
   * Full-text search over multiple signal types with WEIGHTED ranking.
   *
   * r93qqq r15 (Tom 2026-06-13: "the tough ones are most fun"):  The old
   * implementation joined every field into one haystack and counted BINARY
   * hits per term (max score = number of terms entered).  That ranked an
   * AI-boilerplate caption equal to a book-title match — Tom saw "irrelevant"
   * results at the top because the wrong signal type was winning ties.
   *
   * New ranking — additive points per term per signal type:
   *   bookTitle    × 8   (highest — exact-book matches like "Stakeholder Engineering")
   *   chapterTitle × 5   (Tom's chapter labels — high-signal)
   *   keywords     × 4   (Kai's ingest tags — Tom-vocabulary aligned)
   *   filename     × 2   (`_page_42_Figure_3.jpeg` — page-locator hits)
   *   caption      × 1   (24% AI-boilerplate per data audit, so lowest)
   *   ocrText      × 1   (text-in-the-image; useful but noisy)
   *
   * Per-term `count` is the number of OCCURRENCES not boolean, so a caption
   * mentioning "stakeholder" three times scores higher than one mentioning
   * once.  Ranking is preserved if scores tie via book-title alpha as tiebreak.
   *
   * Returns top `limit` results.  Order-independent across multi-term queries
   * (each term is scored independently, scores are summed).
   */
  function search(query: string, opts: { bookId?: string, limit?: number } = {}): GilbIllustration[] {
    const limit  = opts.limit ?? 200
    const bookId = opts.bookId ?? null
    const terms  = query.trim().toLowerCase().split(/\s+/).filter(Boolean)

    let pool = all.value
    if (bookId) pool = pool.filter(i => i.bookId === bookId)
    if (!terms.length) return pool.slice(0, limit)

    const countOccurrences = (hay: string, term: string): number => {
      if (!hay) return 0
      let n = 0, idx = 0
      while ((idx = hay.indexOf(term, idx)) !== -1) { n++; idx += term.length }
      return n
    }

    const scored = pool.map(i => {
      const bookTitleLc    = i.bookTitle.toLowerCase()
      const chapterTitleLc = (i.chapterTitle ?? '').toLowerCase()
      const keywordsLc     = (i.keywords ?? []).join(' ').toLowerCase()
      const filenameLc     = i.filename.toLowerCase()
      const captionLc      = (i.caption  ?? '').toLowerCase()
      const ocrTextLc      = (i.ocrText  ?? '').toLowerCase()
      let score = 0
      for (const t of terms) {
        score += countOccurrences(bookTitleLc,    t) * 8
        score += countOccurrences(chapterTitleLc, t) * 5
        score += countOccurrences(keywordsLc,     t) * 4
        score += countOccurrences(filenameLc,     t) * 2
        score += countOccurrences(captionLc,      t) * 1
        score += countOccurrences(ocrTextLc,      t) * 1
      }
      return { i, score }
    })
    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score || a.i.bookTitle.localeCompare(b.i.bookTitle))
      .slice(0, limit)
      .map(s => s.i)
  }

  /**
   * Returns which signal-type carries the strongest hit for an illustration
   * against a query, so the picker can render a badge ("BOOK", "CHAPTER",
   * "KEYWORDS", "CAPTION") explaining WHY each result ranked where it did.
   * Returns `null` if the query is empty or no hit.
   */
  function strongestSignal(i: GilbIllustration, query: string): 'BOOK' | 'CHAPTER' | 'KEYWORDS' | 'CAPTION' | 'OCR' | 'FILENAME' | null {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!terms.length) return null
    const has = (hay: string) => terms.some(t => hay.includes(t))
    const kw  = (i.keywords ?? []).join(' ').toLowerCase()
    if (has(i.bookTitle.toLowerCase()))             return 'BOOK'
    if (has((i.chapterTitle ?? '').toLowerCase()))  return 'CHAPTER'
    if (has(kw))                                    return 'KEYWORDS'
    if (has(i.filename.toLowerCase()))              return 'FILENAME'
    if (has((i.caption  ?? '').toLowerCase()))      return 'CAPTION'
    if (has((i.ocrText  ?? '').toLowerCase()))      return 'OCR'
    return null
  }

  /** Lookup by composite id. */
  function findById(id: string): GilbIllustration | undefined {
    return all.value.find(i => i.id === id)
  }

  /**
   * Citation footer rendered alongside any embedded illustration.
   * Composes the Twin Consultant promotional discipline (r93ppp) +
   * Conjunction-of-Technologies citation requirement.
   *
   * Returns BOTH a plain-text form (for plain exports) and an HTML form
   * (for colorful exports + in-app rendering).
   */
  function citation(i: GilbIllustration): { plain: string, html: string } {
    const chap = i.chapterTitle ? ` · ${i.chapterTitle}` : ''
    const page = i.page != null ? ` p.${i.page}` : ''
    // Twin Consultant lands on the BOOK page — closer than a deep concept,
    // and reliably resolves for every book in the registry.
    const twinUrl = `https://www.gilb.com/tomtwin/book/${i.bookId}`
    return {
      plain: `From ${i.bookTitle}${page}${chap} — Tom Gilb Consultant Twin: ${twinUrl}`,
      html:
        `<span style="font-size:11px;color:#475569;line-height:1.4;">` +
          `From <em>${escapeHtml(i.bookTitle)}</em>` +
          `${page ? `, p.${i.page}` : ''}` +
          `${chap ? ` · ${escapeHtml(i.chapterTitle)}` : ''} — ` +
          `<a href="${twinUrl}" target="_blank" rel="noopener">Tom Gilb Consultant Twin</a>` +
        `</span>`,
    }
  }

  return {
    isLoading:   computed(() => _loading.value),
    error:       computed(() => _error.value),
    totalCount:  computed(() => all.value.length),
    all,
    books,
    search,
    strongestSignal,
    findById,
    citation,
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]!)
}
