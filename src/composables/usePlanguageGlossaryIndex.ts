// usePlanguageGlossaryIndex.ts — Tom Gilb 2026-06-13:
//   "what is this 8 term local glossary, the Planguage glossary your should
//    havre access to in the vault has about 700 terms, do you know where it is".
//
// Yes. Lives at /Users/Tomgilbs/Documents/MyVault/10.Standard/2.Glossary/
// PlanguageGlossary/ — 663 concept .md files, each <Name>.<Number>.md with
// rich YAML frontmatter + [!example] Definition + [!abstract] Overview blocks.
//
// `_build-index.py` in that folder walks every file and writes a flat JSON
// index to sem-app/public/planguage-glossary-index.json. This composable
// loads that JSON once per session and exposes a search() that the ⌘I picker
// uses to populate its Illumination · Information text column.
//
// Composes with: Conjunction-of-Technologies SUPREME (Glossary is the (b)
// Gilb-corpus layer materialised as deterministic data); SEM-Teaches-
// Incrementally SUPREME (Glossary surfaces at the moment of search); r93ppp
// Twin-as-Destination (every concept carries a Twin URL clickable to gilb.com
// /tomtwin/concept/<Name>.<Number>); No-Dodging-Ambiguous-Bugs rule (the
// 8-term hardcoded list was a dodge — this fixes it).

import { ref, computed } from 'vue'

export interface PlanguageGlossaryConcept {
  /** Composite id: `<NameSlug>.<Number>` (e.g. `Stakeholder.233`) */
  id:              string
  /** English name (e.g. `Stakeholder`) */
  name:            string
  /** Hyphen-slug version of the name (for URLs) */
  nameSlug:        string
  /** Concept number without the `*` prefix (e.g. `233`) */
  conceptNumber:   string
  /** Category type (e.g. `Role`, `Scalar Constraint`, `Qualifier Parameter`) */
  type:            string
  /** Tom's keyed-icon notation (e.g. `←¶→` for Stakeholder, `>>` for Tolerable) */
  keyedIcon:       string
  /** Synonym names (e.g. for Customer → `[Client, Consumer]`) */
  synonyms:        string[]
  /** Search aliases (the canonical name + concept number + alt phrasings) */
  aliases:         string[]
  /** Cross-references: `[{ number, name, note }]` */
  relatedConcepts: Array<{ number?: string; name?: string; note?: string }>
  /** Parent class in the ontology tree (e.g. `p_role`) */
  parentClass:     string
  /** Verbatim Tom-voice definition from the [!example] block */
  definition:      string
  /** Interpretive overview from the [!abstract] block */
  overview:        string
  /** Clickable Twin Consultant URL — opens this concept's page on gilb.com/tomtwin */
  twinUrl:         string
}

export interface PlanguageGlossaryIndex {
  version:        number
  generated:      string
  totalConcepts:  number
  source:         string
  concepts:       PlanguageGlossaryConcept[]
}

const _index   = ref<PlanguageGlossaryIndex | null>(null)
const _loading = ref(false)
const _error   = ref<string | null>(null)

const INDEX_URL = `/planguage-glossary-index.json?v=${Date.now() % 100000}`

async function ensureLoaded(): Promise<void> {
  if (_index.value || _loading.value) return
  _loading.value = true
  _error.value   = null
  try {
    const res = await fetch(INDEX_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    _index.value = await res.json() as PlanguageGlossaryIndex
  } catch (e) {
    _error.value = `Could not load Planguage Glossary index: ${(e as Error).message}`
    console.warn('[usePlanguageGlossaryIndex]', _error.value)
  } finally {
    _loading.value = false
  }
}

export function usePlanguageGlossaryIndex() {
  ensureLoaded()

  const all = computed<PlanguageGlossaryConcept[]>(() => _index.value?.concepts ?? [])

  /**
   * Weighted search over the 663-term Glossary.
   *
   * Signal weights (analogous to useGilbIllustrations.search):
   *   name              × 12  (highest — exact-name matches)
   *   conceptNumber     × 10  (e.g. typing "*233" or "233")
   *   keyedIcon         × 8   (typing "<<", ">>", "←¶→" etc.)
   *   synonyms          × 7
   *   aliases           × 6
   *   type              × 4
   *   definition        × 2
   *   overview          × 1
   *   relatedConcepts   × 1   (catches Q-related concepts on a stakeholder query)
   *
   * Counts OCCURRENCES per term per field; multi-term queries sum scores
   * (order-independent).  Returns top `limit` ranked by total score, tied
   * by alpha-by-name.
   */
  function search(query: string, opts: { limit?: number } = {}): PlanguageGlossaryConcept[] {
    const limit = opts.limit ?? 60
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!terms.length) return all.value.slice(0, limit)

    const countOccurrences = (hay: string, term: string): number => {
      if (!hay) return 0
      let n = 0, idx = 0
      while ((idx = hay.indexOf(term, idx)) !== -1) { n++; idx += term.length }
      return n
    }

    // r93qqq r24 (Tom 2026-06-13: "I put a word in the search window, nothing")
    // — root cause: 9 of 663 concepts had `keyedIcon: []` (the Python YAML
    // parser stored empty arrays where the source MD frontmatter had empty
    // strings).  When the search ran, `c.keyedIcon.toLowerCase()` threw on
    // those rows → unhandled-rejection in the computed → search returned
    // nothing in the UI → exact symptom Tom reported.  Defensive coercion
    // below; Python parser also fixed in `_build-index.py` to normalize.
    const str = (v: unknown): string => (typeof v === 'string' ? v : '')
    // r28 — Tom Gilb 2026-06-13: "we are nowhere near the good results we had
    // earlier".  Diagnosed: with 663 concepts the ranker was letting compound-
    // name matches outrank canonical concepts (e.g. typing "stakeholder"
    // returned "External Stakeholder *495" FIRST, with the canonical
    // "Stakeholder *233" buried at #4 because the canonical concept's name has
    // only ONE occurrence of "stakeholder" while compound concepts had the
    // term + type label + parent class references stacking the score).
    //
    // Fix — massive exact-match boost: if the query (as a whole) matches the
    // concept's name OR conceptNumber OR an alias, give a +1000 boost.  This
    // guarantees a canonical hit lands at the top while still letting compound
    // names rank by signal strength below.  Per-term scoring unchanged.
    const qFull = query.trim().toLowerCase()
    const scored = all.value.map(c => {
      const nameLc        = str(c.name).toLowerCase()
      const numberLc      = str(c.conceptNumber).toLowerCase()
      const keyedIconLc   = str(c.keyedIcon).toLowerCase()
      const synonymsLcArr = (Array.isArray(c.synonyms) ? c.synonyms : []).map(str).map(s => s.toLowerCase())
      const aliasesLcArr  = (Array.isArray(c.aliases)  ? c.aliases  : []).map(str).map(s => s.toLowerCase())
      const synonymsLc    = synonymsLcArr.join(' ')
      const aliasesLc     = aliasesLcArr.join(' ')
      const typeLc        = str(c.type).toLowerCase()
      const defLc         = str(c.definition).toLowerCase()
      const overviewLc    = str(c.overview).toLowerCase()
      const relatedLc     = (Array.isArray(c.relatedConcepts) ? c.relatedConcepts : [])
        .map(r => `${str(r?.name)} ${str(r?.note)}`).join(' ').toLowerCase()
      let score = 0
      // EXACT-MATCH BOOSTS — a canonical hit must rise above compound matches.
      if (qFull === nameLc)                 score += 1000   // exact name
      if (qFull === numberLc)               score += 1000   // typed the concept number alone
      if (`*${qFull}` === numberLc || qFull === `*${numberLc}`) score += 1000
      if (synonymsLcArr.includes(qFull))    score += 800    // exact synonym
      if (aliasesLcArr.includes(qFull))     score += 800    // exact alias
      // Partial-name boosts — query is a prefix or suffix of the name.
      if (qFull && nameLc.startsWith(qFull + ' ')) score += 300
      if (qFull && nameLc.endsWith(' ' + qFull))   score += 200
      // Per-term scoring (unchanged) — accumulates for multi-term queries
      // and handles partial matches throughout the indexed fields.
      for (const t of terms) {
        score += countOccurrences(nameLc,      t) * 12
        score += countOccurrences(numberLc,    t) * 10
        score += countOccurrences(keyedIconLc, t) * 8
        score += countOccurrences(synonymsLc,  t) * 7
        score += countOccurrences(aliasesLc,   t) * 6
        score += countOccurrences(typeLc,      t) * 4
        score += countOccurrences(defLc,       t) * 2
        score += countOccurrences(overviewLc,  t) * 1
        score += countOccurrences(relatedLc,   t) * 1
      }
      return { c, score }
    })
    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name))
      .slice(0, limit)
      .map(s => s.c)
  }

  /** Lookup by name (case-insensitive). Returns null if not found. */
  function findByName(name: string): PlanguageGlossaryConcept | null {
    const n = name.trim().toLowerCase()
    return all.value.find(c => c.name.toLowerCase() === n) ?? null
  }

  /** Lookup by composite id `<NameSlug>.<Number>`. */
  function findById(id: string): PlanguageGlossaryConcept | null {
    return all.value.find(c => c.id === id) ?? null
  }

  /** Lookup by concept number (with or without `*` prefix). */
  function findByConceptNumber(n: string | number): PlanguageGlossaryConcept | null {
    const num = String(n).replace(/^\*/, '')
    return all.value.find(c => c.conceptNumber === num) ?? null
  }

  return {
    isLoading:     computed(() => _loading.value),
    error:         computed(() => _error.value),
    totalConcepts: computed(() => all.value.length),
    all,
    search,
    findByName,
    findById,
    findByConceptNumber,
  }
}
