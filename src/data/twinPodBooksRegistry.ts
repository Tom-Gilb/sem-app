// UNIT_TYPE=Data
// twinPodBooksRegistry.ts — canonical SEM App mirror of the TwinPod Books URI
// registry shared by Kai Gilb on 2026-06-04.
//
// Source of truth (Kai's): /Users/kaigilb/Developer/tomgilb-chat/src/lib/books-catalogue.js
// Vault mirror (Tom's):    `0 - TOMS BOOKS/TwinPod-Books-Registry.md`
//
// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ ★★★ TWINPOD-URI ACCESS POLICY — SUPREME (Tom Gilb 2026-06-04) ★★★          ║
// ║                                                                            ║
// ║ Tom verbatim: *"We do not want users to download whole books from here. We║
// ║ want them to use the apps. The actual downloads are in the references."*  ║
// ║                                                                            ║
// ║ THE RULE:                                                                  ║
// ║                                                                            ║
// ║ The `pdfUri` and `mdUri` fields below are FOR INTERNAL CLAUDIAN USE ONLY.  ║
// ║ They are NEVER surfaced to end-users as download / clickable links in any  ║
// ║ SEM App UI surface.  Claudian (or any local agent) may fetch a chapter via ║
// ║ these URIs for the duration of a citation lookup, then discard the data;   ║
// ║ no caching, no re-distribution, no UI rendering of the raw URI.            ║
// ║                                                                            ║
// ║ WHEN END USERS WANT THE BOOK:                                              ║
// ║                                                                            ║
// ║ The UI MUST direct them to the per-book DISTRIBUTION channels (Leanpub,    ║
// ║ free Dropbox / tinyurl mirrors, ResearchGate) recorded in                  ║
// ║ `reference_tom_gilb_corpus.md` (memory file).  Those are the channels Tom  ║
// ║ Gilb himself publishes for his readers — purchase, free download, citation ║
// ║ links etc.  Surface those, not the TwinPod URIs.                           ║
// ║                                                                            ║
// ║ HELPERS REFLECT THIS:                                                      ║
// ║                                                                            ║
// ║  • aiInternalVerifyUri(book)  → returns the TwinPod URI Claudian fetches.  ║
// ║    Function NAME makes intent self-documenting at every call site.         ║
// ║  • userFacingDownloadUri(book) → returns NULL deliberately; UI must fetch  ║
// ║    the distribution URL from `reference_tom_gilb_corpus.md` per book.      ║
// ║                                                                            ║
// ║ The earlier `preferredVerifyUri()` helper is RETAINED as a deprecated      ║
// ║ alias to `aiInternalVerifyUri()` so existing call sites keep working until ║
// ║ they're audited.                                                           ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
//
// 58 books.  Each entry carries:
//   • id        — short citation key the SEM App uses (e.g. "ce", "sea", "optima")
//   • title     — display name as Kai's manifest emits it
//   • pdfUri    — TwinPod node URI for the PDF binary (AI-INTERNAL — see policy above)
//   • mdUri     — LDP container URI for chapter .md files (AI-INTERNAL — see policy above)
//   • pdfOnly   — true when MD container exists but is editorially gated
//                 (currently only SIMPLE)
//   • noMd      — true when no MD plan exists at all (Quanteer, Technoscopes)
//
// Composes with the Conjunction-of-Technologies SUPREME rule (CLAUDE.md) —
// every Gilb citation traces to a real, fetchable, third-party-verifiable URI
// FOR THE AGENT.  The USER's verification path is the public distribution
// channel, not the TwinPod.
//
// Twin portability: this exact registry powers Kai's Tom's Twin Consultant;
// SEM consumes the same source so cross-tool agent citations stay consistent.

export interface TwinPodBook {
  /** Short citation key used in SEM App prompts + UI badges. */
  id: string
  /** Display title — matches Kai's manifest verbatim. */
  title: string
  /** TwinPod PDF binary URI.  Resolvable via standard Solid HTTP. */
  pdfUri: string
  /** Chapter MD container URI — preferred for citation lookup.  null for PDF-only books. */
  mdUri: string | null
  /** True when MD container exists but is editorially gated (only SIMPLE today). */
  pdfOnly?: boolean
  /** True when the entire book is PDF-only with no MD plan at all. */
  noMd?: boolean
}

export const TWINPOD_BOOKS: TwinPodBook[] = [
  { id: 'ce',                     title: 'Competitive Engineering',                              pdfUri: 'https://competitiveengineering.gilb.com/node/t_iq0', mdUri: 'https://competitiveengineering.gilb.com/node/t_ipc' },
  { id: 'clear-communication',    title: 'Clear Communication',                                  pdfUri: 'https://clearcommunication.gilb.com/node/t_3nf',     mdUri: 'https://clearcommunication.gilb.com/node/t_h76' },
  { id: 'controlling-computer',   title: 'Controlling the Computer',                             pdfUri: 'https://controllingthecomputer.gilb.com/node/t_1t2', mdUri: 'https://controllingthecomputer.gilb.com/node/t_1sa' },
  { id: 'consultant-superpowers', title: '10 Consultant Superpowers',                            pdfUri: 'https://consultantsuperpowers.gilb.com/node/t_2js',  mdUri: 'https://consultantsuperpowers.gilb.com/node/t_2j0' },
  { id: 'value-agile',            title: 'Value Agile',                                          pdfUri: 'https://valueagile.gilb.com/node/t_2mf',             mdUri: 'https://valueagile.gilb.com/node/t_6b3' },
  { id: 'value-design',           title: 'Value Design',                                         pdfUri: 'https://valuedesign.gilb.com/node/t_26g',            mdUri: 'https://valuedesign.gilb.com/node/t_49t' },
  { id: 'board-qa',               title: 'Board QA',                                             pdfUri: 'https://boardqa.gilb.com/node/t_2n9',                mdUri: 'https://boardqa.gilb.com/node/t_2mh' },
  { id: 'success',                title: 'Success',                                              pdfUri: 'https://success.gilb.com/node/t_2q3',                mdUri: 'https://success.gilb.com/node/t_2pb' },
  { id: 'value-planning',         title: 'Value Planning',                                       pdfUri: 'https://valueplanning.gilb.com/node/t_46t',          mdUri: 'https://valueplanning.gilb.com/node/t_ro9' },
  { id: 'value-requirements',     title: 'Value Requirements',                                   pdfUri: 'https://valuerequirements.gilb.com/node/t_4wv',      mdUri: 'https://valuerequirements.gilb.com/node/t_g0f' },
  { id: 'se',                     title: 'Stakeholder Engineering',                              pdfUri: 'https://stakeholderengineering.gilb.com/node/t_484', mdUri: 'https://stakeholderengineering.gilb.com/node/t_47c' },
  { id: 'musk-methods',           title: 'Musk’s Methods',                                  pdfUri: 'https://muskmethod.gilb.com/node/t_9iy',             mdUri: 'https://muskmethod.gilb.com/node/t_9i6' },
  { id: 'scale',                  title: 'Scale',                                                pdfUri: 'https://scale.gilb.com/node/t_evx',                  mdUri: 'https://scale.gilb.com/node/t_ev5' },
  { id: 'risk',                   title: 'R.I.S.K.',                                             pdfUri: 'https://risk.gilb.com/node/t_6jf',                   mdUri: 'https://risk.gilb.com/node/t_6in' },
  { id: 'sustainability-planning',title: 'Sustainability Planning',                              pdfUri: 'https://sustainabilityplanning.gilb.com/node/t_3y7', mdUri: 'https://sustainabilityplanning.gilb.com/node/t_64h' },
  { id: 'productivity',           title: 'Productivity',                                         pdfUri: 'https://productivity.gilb.com/node/t_6mh',           mdUri: 'https://productivity.gilb.com/node/t_6lp' },
  { id: 'cost-engineering',       title: 'Cost Engineering',                                     pdfUri: 'https://costengineering.gilb.com/node/t_7fa',        mdUri: 'https://costengineering.gilb.com/node/t_9el' },
  { id: 'viet',                   title: 'Value Impact Estimation',                              pdfUri: 'https://valueimpactestimation.gilb.com/node/t_47s',  mdUri: 'https://valueimpactestimation.gilb.com/node/t_470' },
  { id: 'decisioneering',         title: 'Decision-eering',                                      pdfUri: 'https://decisioneering.gilb.com/node/t_2o1',         mdUri: 'https://decisioneering.gilb.com/node/t_4p5' },
  { id: 'sea',                    title: 'SEA',                                                  pdfUri: 'https://sea.gilb.com/node/t_cjy',                    mdUri: 'https://sea.gilb.com/node/t_cj6' },
  { id: 'simplan',                title: 'SimPlan',                                              pdfUri: 'https://simplan.gilb.com/node/t_8fb',                mdUri: 'https://simplan.gilb.com/node/t_8ej' },
  { id: 'simple',                 title: 'SIMPLE',                                               pdfUri: 'https://simple.gilb.com/node/t_a7r',                 mdUri: 'https://simple.gilb.com/node/t_a6z',                 pdfOnly: true },
  { id: 'quanteer',               title: 'Quanteer',                                             pdfUri: 'https://quanteer.gilb.com/node/t_ie',                mdUri: null,                                                 noMd: true },
  { id: 'technoscopes',           title: 'Technoscopes',                                         pdfUri: 'https://technoscopes.gilb.com/node/t_ic',            mdUri: null,                                                 noMd: true },
  { id: 'planalysis',             title: 'PLanalysis',                                           pdfUri: 'https://panalysis.gilb.com/node/t_3ad',              mdUri: 'https://panalysis.gilb.com/node/t_39l' },
  { id: 'cyber-resilience',       title: 'Cyber-Resilience Planning',                            pdfUri: 'https://cyberresilienceplanning.gilb.com/node/t_8p7',mdUri: 'https://cyberresilienceplanning.gilb.com/node/t_d13' },
  { id: 'general-theory',         title: 'General Theory of Design Engineering',                 pdfUri: 'https://generaltheory.gilb.com/node/t_zg',           mdUri: 'https://generaltheory.gilb.com/node/t_yo' },
  { id: 'argumenteering',         title: 'Argumenteering',                                       pdfUri: 'https://argumenteering.gilb.com/node/t_xx',          mdUri: 'https://argumenteering.gilb.com/node/t_x5' },
  { id: 'aspects',                title: 'Aspects',                                              pdfUri: 'https://aspects.gilb.com/node/t_xx',                 mdUri: 'https://aspects.gilb.com/node/t_x5' },
  { id: 'choice-priority',        title: 'Choice and Priority',                                  pdfUri: 'https://choicepriority.gilb.com/node/t_xx',          mdUri: 'https://choicepriority.gilb.com/node/t_22s' },
  { id: 'blackbox-planning',      title: 'Blackbox Planning',                                    pdfUri: 'https://blackboxplanning.gilb.com/node/t_xx',        mdUri: 'https://blackboxplanning.gilb.com/node/t_x5' },
  { id: 'compete',                title: 'COMPETE',                                              pdfUri: 'https://compete.gilb.com/node/t_xx',                 mdUri: 'https://compete.gilb.com/node/t_x5' },
  { id: 'datocracy',              title: 'Datocracy',                                            pdfUri: 'https://datocracy.gilb.com/node/t_xx',               mdUri: 'https://datocracy.gilb.com/node/t_x5' },
  { id: 'deep-think',             title: 'Deep Think',                                           pdfUri: 'https://deepthink.gilb.com/node/t_zf',               mdUri: 'https://deepthink.gilb.com/node/t_yn' },
  { id: 'ggg',                    title: 'Gilb’s Golden Gun',                               pdfUri: 'https://gilbsgoldengun.gilb.com/node/t_xx',          mdUri: 'https://gilbsgoldengun.gilb.com/node/t_x5' },
  { id: 'governeering',           title: 'Governeering',                                         pdfUri: 'https://governeering.gilb.com/node/t_xx',            mdUri: 'https://governeering.gilb.com/node/t_x5' },
  { id: 'guides',                 title: 'Guides',                                               pdfUri: 'https://guides.gilb.com/node/t_3nx',                 mdUri: 'https://guides.gilb.com/node/t_4oq' },
  { id: 'innovative-creativity',  title: 'Innovative Creativity',                                pdfUri: 'https://innovativecreativity.gilb.com/node/t_5zm',   mdUri: 'https://innovativecreativity.gilb.com/node/t_5yu' },
  { id: 'ppp',                    title: 'Power Page Planning (PPP)',                            pdfUri: 'https://ppp.gilb.com/node/t_332',                    mdUri: 'https://ppp.gilb.com/node/t_5df' },
  { id: 'value-management',       title: 'Value Management',                                     pdfUri: 'https://valuemanagement.gilb.com/node/t_1v7',        mdUri: 'https://valuemanagement.gilb.com/node/t_1u0' },
  { id: 'collected-works',        title: 'Tom Gilb Collected Works',                             pdfUri: 'https://collectedwisdomtomgilb.gilb.com/node/t_1t8', mdUri: 'https://collectedwisdomtomgilb.gilb.com/node/t_1sg' },
  { id: 'vp-cxo',                 title: 'Value Planning CXO',                                   pdfUri: 'https://valueplanningcxo.gilb.com/node/t_2e5',       mdUri: 'https://valueplanningcxo.gilb.com/node/t_2dd' },
  { id: 'twelve-tough',           title: 'Twelve Tough Questions',                               pdfUri: 'https://twelvethoughquestions.gilb.com/node/t_1vz',  mdUri: 'https://twelvethoughquestions.gilb.com/node/t_1v7' },
  { id: 'vision-engineering',     title: 'Vision Engineering',                                   pdfUri: 'https://visionengineering.gilb.com/node/t_3wl',      mdUri: 'https://visionengineering.gilb.com/node/t_3vt' },
  { id: 'vp-vision-engineering',  title: 'VP Vision Engineering',                                pdfUri: 'https://vpvisionengineering.gilb.com/node/t_46a',    mdUri: 'https://vpvisionengineering.gilb.com/node/t_45i' },
  { id: 'planguage-principles',   title: 'Planguage Principles',                                 pdfUri: 'https://planguageprinciples.gilb.com/node/t_6kn',    mdUri: 'https://planguageprinciples.gilb.com/node/t_6jv' },
  { id: 'evo',                    title: 'Evo Project Management',                               pdfUri: 'https://evo.gilb.com/node/t_aya',                    mdUri: 'https://evo.gilb.com/node/t_pnf' },
  { id: 'ken',                    title: 'KEN',                                                  pdfUri: 'https://ken.gilb.com/node/t_5t7',                    mdUri: 'https://ken.gilb.com/node/t_5sf' },
  { id: 'kidthink',               title: 'KidThink',                                             pdfUri: 'https://kidthink.gilb.com/node/t_4mx',               mdUri: 'https://kidthink.gilb.com/node/t_4m5' },
  { id: 'optima',                 title: 'OPTIMA',                                               pdfUri: 'https://optima.gilb.com/node/t_7pf',                 mdUri: 'https://optima.gilb.com/node/t_7on' },
  { id: 'org',                    title: 'ORG',                                                  pdfUri: 'https://org.gilb.com/node/t_dq7',                    mdUri: 'https://org.gilb.com/node/t_dpf' },
  { id: 'rds',                    title: 'Reliable Data Systems',                                pdfUri: 'https://reliabledatasystems.gilb.com/node/t_2hc',    mdUri: 'https://reliabledatasystems.gilb.com/node/t_2dy' },
  { id: 'data-engineering',       title: 'Data Engineering',                                     pdfUri: 'https://dataengineering.gilb.com/node/t_2el',        mdUri: 'https://dataengineering.gilb.com/node/t_2dt' },
  { id: 'software-inspection',    title: 'Software Inspection',                                  pdfUri: 'https://softwareinspection.gilb.com/node/t_4m8',     mdUri: 'https://softwareinspection.gilb.com/node/t_4lg' },
  { id: 'software-metrics',       title: 'Software Metrics',                                     pdfUri: 'https://softwaremetrics.gilb.com/node/t_50b',        mdUri: 'https://softwaremetrics.gilb.com/node/t_4zj' },
  { id: 'humanized-input',        title: 'Humanized Input',                                      pdfUri: 'https://humanizedinput.gilb.com/node/t_4du',         mdUri: 'https://humanizedinput.gilb.com/node/t_4d2' },
  { id: 'reliable-edp',           title: 'Reliable EDP Application Design',                      pdfUri: 'https://reliableedp.gilb.com/node/t_4b5',            mdUri: 'https://reliableedp.gilb.com/node/t_4ad' },
  { id: 'posem',                  title: 'Principles of Software Engineering Management',        pdfUri: 'https://posem.gilb.com/node/t_ewm',                  mdUri: 'https://posem.gilb.com/node/t_evu' },

  // ─── RESERVED IDs — awaiting URIs from Kai (Tom: "I sent the 3 missing to kai") ───
  // Tom approved these citation keys 2026-06-04.  Uncomment + fill pdfUri/mdUri
  // when Kai re-shares the manifest with the new books added.  Keeping the
  // commented stubs here so the IDs are reserved + obvious where they slot.
  //
  // { id: 'value-improvement',      title: 'Value Improvement',                                    pdfUri: 'https://valueimprovement.gilb.com/node/TBD',         mdUri: 'https://valueimprovement.gilb.com/node/TBD' },
  // { id: 'pppp',                   title: 'PPPP — Powerful Ploys for Problems',                   pdfUri: 'https://pppp.gilb.com/node/TBD',                     mdUri: 'https://pppp.gilb.com/node/TBD' },
  // { id: 'split',                  title: 'SPLIT',                                                pdfUri: 'https://split.gilb.com/node/TBD',                    mdUri: 'https://split.gilb.com/node/TBD' },
]

/**
 * IDs reserved for books Tom sent to Kai for the registry on 2026-06-04 but
 * not yet in Kai's manifest.  Exposed so any caller that needs to know
 * "what's coming" can show a placeholder + pointer to the distribution
 * channel in `reference_tom_gilb_corpus.md` until the URIs arrive.
 */
export const RESERVED_BOOK_IDS = ['value-improvement', 'pppp', 'split'] as const

/** Quick lookup by citation key (case-insensitive). */
export function findBookById(id: string): TwinPodBook | null {
  const needle = id.trim().toLowerCase()
  return TWINPOD_BOOKS.find(b => b.id.toLowerCase() === needle) ?? null
}

/** Fuzzy title match — used when Claudian emits a long-form title. */
export function findBookByTitle(title: string): TwinPodBook | null {
  const needle = title.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  return TWINPOD_BOOKS.find(b => b.title.toLowerCase().replace(/[^a-z0-9]/g, '') === needle) ?? null
}

/**
 * AI-INTERNAL verification URI — returned ONLY to local agents (Claudian)
 * for citation-passage lookup at query time.  NEVER render this URI in
 * end-user-facing UI as a download / clickable link.  Per the TwinPod-URI
 * Access Policy at the top of this file, end-user download flows go through
 * the per-book distribution channel in `reference_tom_gilb_corpus.md`.
 *
 * Returns the MD container URI when available (smaller, chapter-addressable);
 * falls back to the PDF URI when no MD exists.
 */
export function aiInternalVerifyUri(book: TwinPodBook): string {
  return (book.mdUri && !book.pdfOnly && !book.noMd) ? book.mdUri : book.pdfUri
}

/**
 * USER-FACING download URI for a book.
 *
 * Intentionally returns null today.  Implementation note for whoever wires
 * the citation UI: do NOT pull from `book.pdfUri` here — that is the
 * TwinPod URI reserved for agent use.  Instead, look the citation key up in
 * `reference_tom_gilb_corpus.md` (memory file) which carries the canonical
 * Leanpub / Dropbox / tinyurl / ResearchGate distribution URLs Tom Gilb
 * himself publishes for readers.
 *
 * When a per-book distribution-URL map is added to SEM (likely as a TS
 * mirror of the relevant rows in `reference_tom_gilb_corpus.md`), update
 * this function to read from it.  Until then it returns null so any caller
 * that assumed PDF download via TwinPod is forced to think about the
 * correct distribution channel.
 */
export function userFacingDownloadUri(_book: TwinPodBook): string | null {
  return null
}

/**
 * @deprecated Use `aiInternalVerifyUri()` — name makes the
 * AI-internal-vs-user-facing distinction self-documenting at call sites.
 * Retained as an alias so existing imports continue to resolve.
 */
export const preferredVerifyUri = aiInternalVerifyUri
