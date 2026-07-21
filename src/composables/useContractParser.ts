// UNIT_TYPE=Composable
/**
 * useContractParser — LLM pipeline for converting contract text into Planguage.
 *
 * Two-phase pipeline:
 *   Phase 1 — splitIntoClauses(rawText):
 *     LLM identifies clause boundaries, numbers, headings.
 *     Returns ContractClause[] (entries = [], parseStatus = 'pending').
 *
 *   Phase 2 — parseClause(clause, parties):
 *     LLM converts each clause's raw text into PlanguageContractEntry[].
 *     Flags ambiguous language with specific notes.
 *     Returns LLMEntryOutput[] which caller converts to PlanguageContractEntry[].
 *
 * LLM pattern: mirrors useSpecQualityCheck.ts (Anthropic SDK, JSON output,
 * no streaming, AbortController for cancellation).
 *
 * Planguage grounding: prompt injects canonical definitions for F./V./C./R./S.
 * so the model stays within the Planguage type system, not ad-hoc classification.
 */

import Anthropic from '@anthropic-ai/sdk'
import { MODEL_ID } from '../config/llm'
import { CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT } from '../config/planguagePrompt'
import type {
  ContractClause,
  ContractParty,
  PlanguageContractEntry,
  ContractEntryType,
  LLMClauseSplit,
  LLMEntryOutput,
} from '../types/contractTypes'
import type { ContractsModeConfig } from '../data/settings'
import { useSettings } from './useSettings'
import { stampEntry } from '../utils/sourceStamp'

// r41 v47 — Contracts Mode config (Tom Gilb 2026-06-16 4-axis design) is read
// from useSettings here and woven into every LLM prompt.  When settings is
// not available (tests, headless), falls back to a safe default.
function _contractsConfig(): ContractsModeConfig {
  try {
    const { settings } = useSettings()
    // r41 v50 — explicit copy to strip the readonly arrays produced by the
    // `useSettings` immutable-store typing.  Same content, mutable type.
    const c = settings.value.contractsMode
    return {
      applyContractSharpening: c.applyContractSharpening,
      standards:               [...c.standards],
      standardsCustomUrls:     [...c.standardsCustomUrls],
      presentation:            c.presentation,
      purposes:                [...c.purposes],
    }
  } catch {
    return {
      applyContractSharpening: true,
      standards: ['gilb-planguage'],
      standardsCustomUrls: [],
      presentation: 'managers',
      purposes: ['strict-analytical'],
    }
  }
}

// Human-readable name for each built-in standard (used to inject into the prompt).
const STANDARD_LABELS: Record<string, string> = {
  'gilb-planguage':   'Tom Gilb · Planguage methodology (quantified Values, Functions, Constraints, Resources, Solutions)',
  'plain-english':    'Plain English Contract style (no archaic phrasing)',
  'iso-9001':         'ISO 9001 · Quality Management Systems',
  'iso-27001':        'ISO 27001 · Information Security Management',
  'gdpr':             'EU GDPR · General Data Protection Regulation',
  'hipaa':            'US HIPAA · Health Insurance Portability + Accountability Act',
  'sox':              'US Sarbanes-Oxley · Accounting Controls',
  'incoterms-2020':   'ICC Incoterms 2020 · International Trade Terms',
  'unidroit':         'UNIDROIT Principles of International Commercial Contracts',
  'common-law':       'Common-law jurisdictional framing',
  'civil-law':        'Civil-law jurisdictional framing',
}

const PRESENTATION_INSTRUCTIONS: Record<string, string> = {
  'legal-experts':     'Use precise legal terminology with full citations and careful preservation of defined terms.  Output reads like a lawyer-drafted memorandum.',
  'managers':          'Use plain-English summary.  Surface key obligations, risks, dates FIRST.  Define jargon inline.  Avoid archaic legal phrasing.',
  'technical-experts': 'Use engineering / domain-specific precision (SLAs, throughput numbers, system architecture).  Preserve quantifications and protocols; condense legal boilerplate.',
}

const PURPOSE_INSTRUCTIONS: Record<string, string> = {
  'strict-analytical':    'STRICTLY ANALYTICAL — surface issues, ambiguities, missing fields, conflicts with the standards.  Do NOT propose modifications.  Do NOT rewrite the contract text.',
  'change-log':           'EMIT A CHANGE LOG — for every analysis decision or proposed change, include a structured `{before, after, rationale}` triple.  Append to a `changes` array on each entry.',
  'rewrite':              'REWRITE THE CLAUSE — in the chosen Presentation style, produce a rewritten `rewrittenText` field on each entry that improves clarity while preserving legal force.  Mark the rewrite as a suggestion (the user accepts or rejects).',
  'creative-suggestions': 'CREATIVE SUGGESTIONS — propose: (a) changes to the contract; (b) appendices / supporting documents that would strengthen the contract; (c) other actions the parties should take; (d) negotiating tactics.  Add a `suggestions` array on each entry; clearly label items as suggestions, not edits.',
}

/** Build the Contracts-Mode-derived prefix injected into both LLM prompts. */
function _buildContractsModeContext(): string {
  const cfg = _contractsConfig()
  const lines: string[] = []
  lines.push('━━ CONTRACTS MODE (Tom Gilb 2026-06-16 4-axis config) ━━')
  lines.push(`SHARPENING: ${cfg.applyContractSharpening ? 'ON — run Planguage Sharpening on every clause' : 'OFF — import raw clauses without Sharpening'}`)
  if (cfg.standards.length > 0) {
    lines.push('STANDARDS the contract must conform to:')
    for (const id of cfg.standards) {
      lines.push(`  - ${STANDARD_LABELS[id] || id}`)
    }
  }
  if (cfg.standardsCustomUrls.length > 0) {
    lines.push('CUSTOM REFERENCE URLs (treat as additional standards):')
    for (const url of cfg.standardsCustomUrls) {
      if (url.trim()) lines.push(`  - ${url.trim()}`)
    }
  }
  lines.push(`PRESENTATION (audience): ${PRESENTATION_INSTRUCTIONS[cfg.presentation] || cfg.presentation}`)
  if (cfg.purposes.length > 0) {
    lines.push('PURPOSE — apply ALL of the following (compose them):')
    for (const p of cfg.purposes) {
      lines.push(`  - ${PURPOSE_INSTRUCTIONS[p] || p}`)
    }
  } else {
    lines.push('PURPOSE: (none selected — defaulting to Strictly Analytical)')
    lines.push(`  - ${PURPOSE_INSTRUCTIONS['strict-analytical']}`)
  }
  lines.push('━━ END CONTRACTS MODE ━━')
  return lines.join('\n')
}

// ── LLM client ────────────────────────────────────────────────────────────────
// Model: imported from src/config/llm.ts (claude-sonnet-4-6).
// Contract parsing is complex multi-section JSON generation — Haiku produces
// malformed or wrapped-object responses. Sonnet required per Model Selection Rule.

function _getClient(): Anthropic {
  const apiKey  = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  const isLocal = !!(import.meta.env.VITE_OLLAMA_MODEL || import.meta.env.VITE_OLLAMA_BASE_URL)
  if (!apiKey && !isLocal) {
    // r41 v394 — env-var name stays in the console for the operator; user sees
    // a plain-English summary.  Composes with No-Silent-Data-Loss (still
    // throws, so the parse doesn't silently succeed against a null key).
    console.error('[useContractParser] VITE_ANTHROPIC_API_KEY is not set — analyser cannot run.')
    throw new Error('The analyser is not configured. Please check settings and try again.')
  }
  // r41 2026-06-20 (Tom Gilb verbatim "max seconds exceeded" after 213s on a
  // 120s-timeout SDK) — timeout bumped 120s → 300s.  Long contracts
  // (Indianapolis-class multi-page legal text) routinely run 3-5 minutes
  // (AI model processing, not network).  The Anthropic SDK timeout is a
  // socket idle timeout, not a total-deadline; bumping it ensures a slow
  // model that pauses mid-response (token-rate dips) doesn't kill the call.
  // Composes with the Honest Loading Hint Copy SUPREME 2026-06-16
  // (rule_loading_hint_honest_copy.md — real time range is what's shown).
  return new Anthropic({ apiKey: apiKey ?? 'local', dangerouslyAllowBrowser: true, timeout: 300_000 })
}

// ── Partial-JSON clause extractor (r41 2026-06-20) ──────────────────────────
// Tom Gilb verbatim "This is sort of dead text, show the clauses being found"
// — scans an in-progress streamed JSON-array buffer and returns every
// COMPLETE top-level object encountered.  Brace-depth + string-state aware
// so it doesn't false-trigger on `{` inside string literals.  Returns the
// raw object strings (callers JSON.parse them individually) so a single
// malformed mid-stream object doesn't block the rest of the stream.  Used
// by splitIntoClauses() to fire the live `onClauseFound` callback as each
// clause closes in the streamed response.  Pure function — no Vue, no
// browser APIs; ports cleanly to Kai's Twin.

function _extractCompletedClauseObjects(text: string): string[] {
  const objects: string[] = []
  let depth     = 0
  let inString  = false
  let escape    = false
  let objStart  = -1
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (escape) { escape = false; continue }
    if (inString) {
      if (c === 92 /* \\ */) escape = true
      else if (c === 34 /* " */) inString = false
      continue
    }
    if (c === 34 /* " */) { inString = true; continue }
    if (c === 123 /* { */) {
      if (depth === 0) objStart = i
      depth++
    } else if (c === 125 /* } */) {
      depth--
      if (depth === 0 && objStart >= 0) {
        objects.push(text.substring(objStart, i + 1))
        objStart = -1
      }
    }
  }
  return objects
}

// ── JSON extraction helper ────────────────────────────────────────────────────

function _extractJson<T>(text: string): T | null {
  try {
    // Try direct parse first (model may output bare JSON)
    return JSON.parse(text) as T
  } catch { /* fall through */ }
  // Strip code fences
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (match) {
    try { return JSON.parse(match[1].trim()) as T } catch { /* fall through */ }
  }
  // Find first [ or { and parse from there
  const start = text.search(/[{[]/)
  if (start >= 0) {
    try { return JSON.parse(text.slice(start)) as T } catch { /* fall through */ }
  }
  return null
}

// Defensive array extractor — handles both bare arrays and LLM-wrapped objects
// e.g. {"clauses": [...]} or {"result": [...]} or just [...].
// Haiku (and occasionally Sonnet) wraps arrays even when told not to.
//
// r41 v419 (Tom Gilb 2026-07-01 "did not work" — 0 entries × 14 clauses in a
// USS Monitor contract with obvious obligations): added a truncation-recovery
// path.  If the response was cut off mid-array by max_tokens, the raw string
// is invalid JSON (missing closing `]`) and _extractJson returns null.  Before
// giving up, run the brace-depth extractor over the same text and JSON.parse
// each complete top-level `{…}` object individually.  Any complete entry
// object emitted before truncation is preserved — the truncated LAST entry
// is dropped, but the array survives.  No-Silent-Data-Loss SUPREME: silently
// returning `[]` for a truncated response IS silent data loss.
function _extractJsonArray<T>(text: string): T[] {
  const parsed = _extractJson<unknown>(text)
  if (parsed !== null && parsed !== undefined) {
    if (Array.isArray(parsed)) return parsed as T[]
    if (typeof parsed === 'object') {
      const found = Object.values(parsed as Record<string, unknown>).find(v => Array.isArray(v))
      if (found) return found as T[]
    }
  }
  // Truncation-recovery: extract complete top-level {…} objects from the
  // raw text and JSON.parse each individually.  A truncated last object
  // won't parse and is silently dropped; complete earlier objects survive.
  const objects = _extractCompletedClauseObjects(text)
  if (objects.length === 0) return []
  const recovered: T[] = []
  for (const objStr of objects) {
    try { recovered.push(JSON.parse(objStr) as T) } catch { /* skip malformed */ }
  }
  if (recovered.length > 0) {
    console.warn(
      `[useContractParser] _extractJsonArray recovered ${recovered.length} objects from truncated / malformed response (bare JSON.parse failed).`,
    )
  }
  return recovered
}

function _uuid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

// ── Heading derivation (r41 v395, Tom Gilb 2026-07-01) ──────────────────────
// Tom Gilb verbatim *"Contract Theater: the case og untitled is unsatisfactory.
// You should extract some kind of Tag and or Paragraph info to make it
// intelligible"*.  Previously any clause the LLM streamed WITHOUT a `heading`
// field fell back to the literal string "Untitled" — legally meaningless.
// The heuristic below derives an intelligible short label from the clause's
// own raw text so the Case Log rows read like proper legal references even
// while the LLM is mid-stream.
//
// Heuristic (in priority order):
//   1. First non-blank line of `rawText`, with a leading clause-number token
//      (e.g. "3.2", "Article IV", "Schedule A", "§ 12.") stripped so it isn't
//      duplicated alongside the separately-parsed `number` field.
//   2. Truncated to a legal-headline-sized window (≤ 60 chars, breaking on
//      the first sentence terminator or word boundary — never mid-word).
//   3. When the first line is bare text with no ALL-CAPS heading marker, use
//      the first sentence of the paragraph instead.
//   4. Absolute last resort — a Planguage-style mnemonic tag built from the
//      first two significant words ("Delivery Terms", "Governing Law").
//
// Composes with: Spell-out-Type-Names SUPREME (no F./V./S. abbreviations here
// — we're building a HUMAN-READABLE clause heading, not a Planguage entry
// tag), Planguage Mnemonic ID Standard SUPREME (the fallback bullet 4
// mirrors the 1-3-word mnemonic pattern), No-Silent-Data-Loss SUPREME
// (rawText untouched; the heading is a derived VIEW, never a lossy edit).
/**
 * r41 v396 (Tom Gilb 2026-07-01 verbatim *"mostly blank and unintelligible
 * (Untitled for a start) Only interest was rewrite. It jumped around a bit
 * on its own"*) — retroactive rescue.  Clauses stored BEFORE the v395 fix
 * carry a literal `heading = "Untitled"` string (the pre-v395 fallback),
 * which passes the truthy `?? _deriveClauseHeading(…)` check and defeats
 * the derivation.  Recognise the placeholder strings as "bad" so both the
 * extractor AND every render site can trigger the derivation retroactively.
 */
export function _isBadHeading(h: string | undefined | null): boolean {
  if (!h) return true
  const t = h.trim()
  if (!t) return true
  const low = t.toLowerCase()
  // Literal fallback strings from earlier versions of the parser + generic
  // placeholder shapes we should never render as legal-clause headings.
  return low === 'untitled'
      || low === 'untitled clause'
      || low === 'no title'
      || low === 'none'
      || low === 'null'
      || low === 'undefined'
      || low === '(untitled)'
}

/**
 * Public convenience — pick the best available heading for a clause.  Use
 * `heading` if it's meaningful; otherwise derive from `rawText`.  Every render
 * site in ContractHub + ContractAnalysisTheatre routes through this so
 * pre-v395 stored clauses ALSO get an intelligible label retroactively (no
 * store rewrite required).
 */
export function bestClauseHeading(clause: { heading?: string; rawText?: string; number?: string }): string {
  if (!_isBadHeading(clause.heading)) return clause.heading!.trim()
  return _deriveClauseHeading(clause.rawText ?? '', clause.number ?? '?')
}

export function _deriveClauseHeading(rawText: string, number: string): string {
  const text = (rawText ?? '').trim()
  if (!text) return (number && number !== '?' ? `Clause ${number}` : 'Untitled clause')
  const firstLine = text.split(/\r?\n/).find(l => l.trim().length > 0)?.trim() ?? ''
  // Strip a leading clause-number token that would duplicate the separately-
  // parsed `number` field.  Only matches a KNOWN legal-numbering pattern —
  // never a bare word-initial letter (so "Force Majeure:" is preserved
  // verbatim).  Trailing separator + whitespace (or end-of-string) is
  // MANDATORY, so patterns like "5% penalty" don't lose their leading digit.
  //
  //   3.2 Delivery Terms                 → "Delivery Terms"
  //   Article IV. Governing Law          → "Governing Law"
  //   § 12  Termination for Cause        → "Termination for Cause"
  //   Schedule A — Fees and Charges      → "Fees and Charges"
  //   (a) Notice of Default              → "Notice of Default"
  //   Section 3.2 Delivery               → "Delivery"
  //   IV. Governing Law                  → "Governing Law"
  //   3.2                                → "" (falls back to second line)
  //   Force Majeure:                     → "Force Majeure:" (nothing stripped)
  //   5% penalty                         → "5% penalty" (no trailing separator; kept)
  const NUMBER_STRIP_RE = new RegExp(
    '^\\s*(?:' +
      // "§ 12" or "§ 3.2"
      '§\\s*\\d+(?:\\.\\d+)*' +
    '|' +
      // "Article IV" / "Section 3.2" / "Schedule A" / "Part I" / etc.
      '(?:Article|Section|Schedule|Clause|Paragraph|Part|Chapter|Annex|Appendix|Exhibit)' +
      '\\s+' +
      '(?:[IVXLC]+|\\d+(?:\\.\\d+)*|[A-Z])' +
    '|' +
      // "(a)" or "(1)" — parenthetical sub-clause marker
      '\\(\\s*[A-Za-z0-9]+\\s*\\)' +
    '|' +
      // Bare Roman numeral, requires MANDATORY trailing "." (avoids swallowing
      // ordinary short words like "I" or "V").
      '[IVXLC]{1,}\\.' +
    '|' +
      // Bare number "3", "3.2", "12.5.1", "3-2".  Mandatory separator/space
      // after this token (see the required suffix below).
      '\\d+(?:[.\\-]\\d+)*' +
    ')' +
    '\\s*[.\\-—–:]?(?:\\s+|$)',
    'i'
  )
  let headline = firstLine.replace(NUMBER_STRIP_RE, '').trim()
  // The number-strip may have removed the whole first line (a bare "3.2"
  // heading with no descriptive text).  Recover by peeking at the SECOND line.
  if (!headline) {
    const secondLine = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)[1] ?? ''
    headline = secondLine.replace(NUMBER_STRIP_RE, '').trim()
  }
  if (!headline) headline = firstLine
  // Prefer the first sentence over a run-on paragraph.
  const firstSentence = headline.split(/(?<=[.!?;:])\s/)[0]?.trim() || headline
  const capped = _capOnWordBoundary(firstSentence, 60)
  // Strip a trailing dangling terminator that no longer aids readability.
  const cleaned = capped.replace(/[.,;:—-]+$/, '').trim()
  // Guard: require at least one letter AND at least two alphanumeric chars in
  // total before accepting the derived headline.  Otherwise fall through to
  // the mnemonic / clause-number fallback so pathological inputs (punctuation-
  // only lines, single-letter lines) don't produce nonsensical headings.
  const hasLetter = /[A-Za-z]/.test(cleaned)
  const alphaNumCount = (cleaned.match(/[A-Za-z0-9]/g) ?? []).length
  if (cleaned && hasLetter && alphaNumCount >= 2) return cleaned
  // Absolute fallback — Planguage-style two-word mnemonic from the first
  // significant words of the paragraph.  Keeps the row intelligible even for
  // pathological inputs (image-only PDFs, tables of numbers, etc.).
  const words = text.replace(/[^A-Za-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3).slice(0, 2)
  if (words.length > 0) return words.join(' ')
  return (number && number !== '?' ? `Clause ${number}` : 'Untitled clause')
}

function _capOnWordBoundary(s: string, max: number): string {
  if (s.length <= max) return s
  const slice = s.slice(0, max)
  const lastSpace = slice.lastIndexOf(' ')
  return (lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trim() + '…'
}

// ── Planguage canonical primer (r41 v270 — Tom Gilb 2026-06-21 SUPREME) ─────
// r41 v270 (Tom Gilb 2026-06-21 SUPREME — Canonical Planguage Extractor —
// Single Source of Truth): replaced the prior 19-line PLANGUAGE_PRIMER
// (which had drifted catastrophically vs SYSTEM_PROMPT — missing F-vs-Meter
// rule, V-parameter-rich requirement, Solution 26-parameter inventory,
// Qualifier framework, Infinity Trap, Stakeholder discipline, banned-scrum
// vocabulary, etc.) with an import of CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT
// from config/planguagePrompt.ts.  Indianapolis cruiser misclassification
// (trials extracted as Functions, V. entries parameter-starved) was the
// surfacing report.  Root cause: parallel-implementation drift class banked
// in Trace-Before-Patch SUPREME 2026-06-17.  This file's primer now stays
// in sync with SYSTEM_PROMPT automatically — every future Planguage SUPREME
// rule lands in BOTH paths from one edit to planguagePrompt.ts.

const PLANGUAGE_PRIMER = `
You are a Planguage expert converting LEGAL CONTRACT text into structured Planguage entries.

== CONTRACT-SPECIFIC INPUT FORMAT (input shape for this caller) ==
The input you will receive is a single CLAUSE from a legal contract: a
numbered or labelled section of contract text. The Planguage discipline
below applies verbatim — the only difference vs other extraction contexts
is that the source language is legal-obligation prose between named
PARTIES, and the output schema below carries additional fields (parties,
obligatedParty, rawSource, deadline, ambiguity flags, confidence).

The "Stakes field" referenced in the stakeholder analysis rules below
corresponds to the named PARTIES of the contract (CLIENT, SUPPLIER,
SUBCONTRACTOR, etc. supplied separately in the variable suffix).

${CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT}

== CONTRACT-SPECIFIC ENTRY-TYPE EXTENSIONS ==
In addition to the canonical Planguage Function / Value / Constraint entry
types defined above, contract extraction also produces:
  • Resource entry: A BUDGET, COST, or QUANTITY CAP. Example: "Annual Fee — CLIENT pays £50,000 per calendar year." Emit with type "R".
  • Solution entry: A proposed DESIGN DECISION or architectural choice embedded in the contract text.  Example: "Redundant Monitoring — Provider implements 2N failover architecture with automatic route-around."  Or: "Signature Workflow — parties adopt PKI-based digital signatures using X.509 certificates issued by trusted CA."  Solutions are the HOW the contract specifies as a design constraint (as opposed to Functions which are the WHAT, and Values which are the measurable targets).  Emit with type "Sol".
  • Task entry: A specific ACTION ITEM with a deadline. Example: "Onboarding — SUPPLIER delivers training within 30 days of contract signing." Emit with type "Task".
  • Stakeholder entry — see MANDATORY STAKEHOLDER EXTRACTION rule below.  In CONTRACTS MODE, the type enum letter "S" is Stakeholder, NOT Solution (the contract pipeline reuses the enum-letter for Stakeholder because contract analysis focuses on named parties + governing authorities; Solution is not the relevant category when extracting FROM a contract that is already signed).  Emit Stakeholder entries with type "S" in the JSON output, but ALWAYS think of and label them as "Stakeholder" — never as "Solution".

━━ MANDATORY STAKEHOLDER EXTRACTION (r41 v427 Tom Gilb 2026-07-01 SUPREME) ━━
Tom Gilb verbatim: *"there was something very wrong with zero stakeholders!!! Like you forgot the President and the navy and the shipyard for starters"*.  ZERO stakeholders on a naval-construction contract is a critical extraction failure.  EVERY contract has stakeholder entities that MUST be surfaced.  For each stakeholder entity you identify in the clause, emit ONE entry with type = "S" (the JSON enum letter for Stakeholder in contracts mode) carrying:

  • description       — the stakeholder's canonical NAME, ≤ 12 words.
                        Examples: "President of the United States",
                                  "United States Navy",
                                  "Bureau of Construction and Repair",
                                  "Secretary of the Navy",
                                  "New York Shipbuilding Corporation",
                                  "Congress of the United States",
                                  "Contractor's Chief Engineer",
                                  "Board of Inspection and Survey".
                        NEVER use generic party abbreviations like "CLIENT"
                        or "SUPPLIER" as the description — use the ACTUAL
                        proper name of the entity as it appears in the
                        clause text.
  • obligatedParty    — if the stakeholder is one of the named contract
                        parties (supplied in the variable suffix), set the
                        party abbreviation; else null.
  • rawSource         — verbatim clause fragment naming or describing this
                        stakeholder.
  • ambiguityNote     — if the stakeholder is named vaguely ("appropriate
                        authorities", "such officer as may be designated"),
                        set isAmbiguous = true and name the vagueness.
  • confidence        — high if named explicitly with proper noun; medium
                        if named by role only ("the Contractor"); low if
                        inferred.

Stakeholder categories to EXTRACT AGGRESSIVELY on every contract:

  1. GOVERNING AUTHORITY — the office / body whose signature or approval
     ultimately authorises the agreement.  For US federal contracts this
     often includes: President, Congress, Secretary of relevant Department,
     specific bureau/agency (Bureau of Ships, Bureau of Construction and
     Repair, NavSea, etc.).  On the Indianapolis 1929 contract, the
     President appears via the Naval Appropriations Act authority chain;
     the Secretary of the Navy signs; the Bureau of Construction & Repair
     administers.  ALL THREE are stakeholders.

  2. CONTRACTING PARTIES — the actual buyer + seller entities as named in
     the preamble.  For USS Indianapolis: The United States (buyer) and
     the shipyard (New York Shipbuilding Corp / Camden NJ) (seller).

  3. REGULATORY / INSPECTING BODIES — bodies whose approval is required at
     milestone gates.  For a 1929 naval contract: Board of Inspection and
     Survey, classification societies, Bureau technical inspectors, trial
     boards.

  4. NAMED BENEFICIARIES / END USERS — the ultimate operator of the
     delivered asset.  For a naval cruiser: the US Navy fleet command,
     specific fleet (Pacific / Atlantic), potentially the ship's
     eventual commissioned crew.

  5. FINANCIAL STAKEHOLDERS — bonding companies, payment surety bonds,
     performance bonds, congressional appropriators, Treasury.

  6. SUBCONTRACTORS / SUPPLIERS — named specialist suppliers (armor
     plate mills, gun manufacturers, propulsion vendors) if the
     contract cites them.

CEILING: extract AT LEAST 4 stakeholders on any contract clause that
names or implies named parties.  ZERO stakeholders on a preamble or
whereas-clause is a defect; emit at least the contracting parties + the
governing authority even if the extraction confidence is medium.  An
empty Stakeholder count across an ENTIRE contract is impossible —
parties always exist; if you cannot find them, name the failure
explicitly in a standardsViolations entry.

== CONTRACT-SPECIFIC OUTPUT FIELD RULES ==
  • obligatedParty — the party ABBREVIATION (e.g. "CLIENT", "SUPPLIER") or null if mutual/unclear.
  • rawSource — verbatim sentence(s) from the clause that generated this entry. NEVER paraphrase here.
  • confidence — "high" (clear obligation, all fields derivable) | "medium" (one or two fields inferred) | "low" (heavily inferred or ambiguous).
  • deadline — for Task and Stakeholder entries: ISO date or relative expression (e.g. "+30d", "Q3 2026", "on contract signing").

━━ ESSENTIAL CONTRACT STANDARD (Tom Gilb 2026-07-01 SUPREME) ━━
The essential standard for contracts, applied to EVERY clause and EVERY
entry.  Ports the Planguage precision principle to legal drafting.  A
contract clause is DEFECTIVE if any of these three tests fails:

  Test 1 — PRESENCE TEST (Functions).  For every deliverable (Function
  entry), is the wording precise enough that an independent observer,
  given the delivered artefact, can objectively determine PRESENT /
  ABSENT?
    FAILS: "suitable office space", "appropriate information",
           "necessary machinery", "as required".
    PASSES: cited standard, quantified threshold, or exhaustively
           enumerated positive list of acceptable outcomes.

  Test 2 — DESIGN-MEETS-STANDARD TEST (Stakeholders + Constraints).  For
  every stakeholder-role commitment (Stakeholder entry) or hard limit
  (Constraint entry), is the wording precise enough that an independent
  observer, given the design, can objectively determine whether it
  DEMONSTRABLY meets the intended standard or constraint?
    FAILS: "customary trade quality", "workmanlike manner", "to the
           satisfaction of the Secretary".
    PASSES: cite a named standard (ISO/MIL/AWS/NIST/ASTM/AASHTO/etc.),
           OR quantify with Scale + threshold, OR enumerate acceptable
           outcomes exhaustively.

  Test 3 — VARIABLE HAS SCALE + TARGET/TOLERABLE (Values + Resources).
  For every variable obligation — quality OR cost (Value or Resource
  entry) — is the variable specified with (a) a Scale of measurement
  AND (b) a Target (Goal/Wish/Stretch) AND/OR a Scalar Constraint
  (Tolerable)?
    FAILS: "timely manner", "efficient", "prompt payment",
           "reasonable time".
    PASSES: named Scale + at least one Goal or Tolerable.

For EVERY entry you emit that FAILS its applicable test, you MUST:
  (i)  set isAmbiguous = true
  (ii) name the specific trigger in ambiguityNote
  (iii) add one standardsViolations entry with
        standard = "essential-contract-standard" and issue = one of
        "Presence not testable — <trigger>",
        "Design-meets-standard not testable — <trigger>",
        "Variable missing Scale / Target / Tolerable — <trigger>".

Real 1929-vintage federal contracts routinely fail Test 3 on ~70 % of
clauses; modern SLAs fail Test 2 on ~30 %.  Zero findings across an
entire long contract is almost certainly under-flagging.

━━ MANDATORY AMBIGUITY CHECK — RUN ON EVERY ENTRY ━━
For EVERY entry you emit, you MUST run this check and set isAmbiguous
accordingly.  Real legal contracts are FULL of vague terms; if you emit
an entire clause worth of entries with zero flagged as ambiguous, you are
almost certainly UNDER-flagging.  Aim to flag more, not less.

Set isAmbiguous = true IF ANY of the following triggers appear in the
obligation OR its raw source text (case-insensitive):

  1. Vague-magnitude terms:      "reasonable", "sufficient", "adequate",
                                 "appropriate", "commercially reasonable",
                                 "best efforts", "reasonable endeavours",
                                 "materially", "substantially", "unduly"
  2. Vague-time terms:           "promptly", "in a timely manner",
                                 "without undue delay", "as soon as
                                 practicable", "from time to time",
                                 "reasonable time", "as necessary"
  3. Vague-scope terms:          "all such", "any such", "including but
                                 not limited to", "such other", "and the
                                 like", "etc.", "as required"
  4. Missing quantitative threshold on a Value obligation
                                 (e.g. "response time" with no ms/s target,
                                 "quality" with no acceptance criteria,
                                 "damages" with no cap/floor)
  5. Undefined technical / legal term appearing on first use in the clause
                                 (e.g. "Specifications", "Materials",
                                 "Services", "Delay" — capitalized like a
                                 defined term but no definition supplied
                                 within the clause)

For each isAmbiguous = true, populate the ambiguityNote field with ONE
short sentence naming the specific trigger and the specific undefined
variable.  For isAmbiguous = false, ambiguityNote MUST be null.

━━ MANDATORY STANDARDS CHECK — RUN WHEN PURPOSE INCLUDES 'strict-analytical' ━━
When the Contracts Mode Purpose axis includes 'strict-analytical' (see the
CONTRACTS MODE block above), you MUST populate the standardsViolations
array on every entry — even if that array is empty for a specific entry
(in which case emit an empty JSON array, NEVER null and NEVER omit the
key).  For EVERY entry, check the
obligation against EVERY active STANDARD listed above and flag any
violation as one object in the array.  Common Planguage standard violations
to look for:

  - Value entries with no Scale (Rule_Write_planguage-spec.md §Value)
  - Value entries with no Goal or Tolerable
  - Constraints with no Must/Must-not phrasing
  - Function entries carrying performance qualifiers
    (per Function-is-binary rule; those belong on Value)
  - Any obligation using vague magnitude terms
    (violates Rule_Write_planguage-spec §Precision)

When the active standards list includes non-Planguage frameworks
(ISO 9001, GDPR, HIPAA, SOX, Incoterms, UNIDROIT, Common Law, Civil Law),
check the obligation against those frameworks' precision + measurability
requirements too.  Do NOT invent violations that don't exist — but also do
NOT under-flag out of politeness.  A real 1929 naval-construction contract
will typically have 3-8 standards findings per clause; a modern SLA will
typically have 1-3.  Zero findings across an entire long contract is
almost certainly wrong; re-check.
`.trim()

// ── Phase 1: Split raw text into clauses ─────────────────────────────────────

const SPLIT_PROMPT = (rawText: string) => `
${PLANGUAGE_PRIMER}

${_buildContractsModeContext()}

Your task RIGHT NOW is Phase 1 only: split the following contract text into its logical clauses.

Rules:
- Identify natural clause boundaries: numbered sections, articles, schedules, headings.
- Each clause should be a self-contained unit (a numbered section or article).
- If no clear numbering exists, split by topic/heading.
- Keep rawText verbatim — do NOT paraphrase or summarise.
- Aim for 5–50 clauses. Do not fragment into sub-sentences; keep related sub-clauses together.

Return a JSON array of objects. Each object has:
{
  "number": "clause identifier, e.g. '3.2', 'Article IV', 'Schedule A'",
  "heading": "short descriptive title, max 8 words",
  "rawText": "verbatim clause text"
}

━━ MANDATORY CLAUSE OBJECT RULES (r41 v418) ━━
- EVERY clause object MUST have a non-empty "rawText" field carrying the
  VERBATIM clause text.  An empty rawText is a defect — do NOT emit such
  objects.
- EVERY clause object MUST have a non-empty "heading" field — an
  intelligent short label derived from the clause topic (e.g. "Delivery
  Terms", "Governing Law", "Force Majeure").  NEVER use the literal
  placeholder "Untitled", "Untitled clause", "TBD", "None", "N/A", "null".
- EVERY clause object MUST have a non-empty "number" field.  If the source
  contract has no explicit numbering for that clause, use the topic label
  in the number field (e.g. "Recitals", "Signature Block") — do NOT emit
  "?" or leave the field blank.
- Do NOT emit preamble objects, wrapper objects, example objects, or
  metadata objects.  The output MUST be a bare JSON ARRAY of clause
  objects — nothing else.  No {"clauses": […]} wrapper, no {"schema":
  …} preamble, no explanatory {"note": …}.

CONTRACT TEXT:
---
${rawText}
---

Return ONLY the JSON array. No explanation. No wrapper object. No preamble.
`.trim()

// ── Phase 2: Parse a single clause into Planguage entries ────────────────────

// r41 2026-06-20 (Tom Gilb verbatim "extracting planguage from the 38 clauses
// is surely interesting, but it takes a lot of time, like 5 minutes each
// clause. Is this something we can speed up?") — prompt split into a
// CACHEABLE prefix (PLANGUAGE_PRIMER + Contracts Mode context + JSON schema
// + closing instructions) and a VARIABLE suffix (clause text + parties).
// First clause call writes the cache; subsequent 37 calls hit it.  Per the
// claude-api skill: Anthropic prompt-cache TTL is 5 minutes, cache hits are
// ~10× cheaper and 2-5× lower latency.  For 38-clause Indianapolis-class
// contracts running in parallel batches (see _parseAllClauses), the cache
// stays hot the entire run.  Composes with: Conjunction-of-Technologies
// SUPREME (uses LLM features intelligently — Anthropic prompt-cache is one
// such feature), Architectural Resilience SUPREME (parser ready for higher
// throughput), Model Selection Rule SUPREME (Sonnet stays as the model —
// the speedup comes from caching the prompt prefix, not from downgrading
// the model).  Effort: prefix function returns cached text; variable
// function returns per-clause text; caller sends them as TWO content
// blocks, the first carrying `cache_control: { type: 'ephemeral' }`.

/** CACHEABLE prefix — identical for every clause in a parse run.  Anthropic
 *  caches this prefix on the first call; subsequent calls in the same 5-min
 *  TTL window hit the cache.  Composition: PLANGUAGE_PRIMER + Contracts
 *  Mode config + the JSON output schema + closing instructions.  No
 *  per-clause data here. */
const PARSE_CLAUSE_PROMPT_PREFIX = (): string => `
${PLANGUAGE_PRIMER}

${_buildContractsModeContext()}

Your task RIGHT NOW is Phase 2: convert the clause below into Planguage entries — applying the Contracts Mode config above.

━━ CANONICAL PLANGUAGE PARAMETER GRAMMAR (Kai-Zen Glossary SUPREME) ━━
(Tom Gilb 2026-07-01 SUPREME rule: the Kai-Zen glossary + rules are the
canonical source of truth for every Planguage parameter.  You MUST match
these definitions verbatim.)

  Scale (*132) — WHAT is being measured.  A conceptual dimension.  Defined
  FIRST for every scalar entry.  A single scale is reused by many numeric
  levels (Wish, Goal, Tolerable, Past, Status).  Typically 10-20 words.
  Ideally includes bracketed Scale Qualifiers like [Task], [Learner Type].
  Example: "Length of hull between fore-and-aft perpendiculars at middle
  point of the ship, in feet."

  Meter (*093) — HOW to measure ON that Scale.  A DESIGNED / STIPULATED
  measurement device or process.  Multiple Meters can serve ONE Scale.
  The Meter is a feedback instrument, NOT the engineering target — it can
  be changed without affecting the Scale.  Example: "Surveyor's steel
  tape measure at dry-dock inspection, per Bureau of Ships §7.2."
  NEVER put Scale content into the Meter.  NEVER put Meter content into
  the Scale.  This is the single most common Planguage failure.

  Benchmarks (reference levels placed on the Scale) — ideally supplied:
    Past (*106):   historical level, dated ("Past [1926]: 550 feet")
    Status:        current level, dated ("Status [Jul 2026]: 570 feet")

  Targets (planned future levels — per Tom Gilb 2026-07-01 verbatim
  "Wish (first)", Goal follows):
    Wish (*244):   highest aspiration, UNCOMMITTED, independent of cost
                   ("Wish: 620 feet").  Wish comes FIRST in the target set.
    Goal (*109):   the COMMITTED target — negotiated trade-off between
                   Wish and the design/resource constraints
                   ("Goal: 588 feet").

  Constraint level (must-have floor):
    Tolerable (*539): minimum non-failure level — project fails below this
                      ("Tolerable: 560 feet").

Ordering rule for scalar entries (V and R): Scale FIRST, then Meter, then
Benchmarks (Past, Status), then Targets (Wish then Goal), then Tolerable.
NEVER put a numeric level (a Scalar) as the Scale — the Scale is a
dimension, not a number.  NEVER omit Scale on a Value entry — "Goal: 170"
without a Scale is legally meaningless.

When the user message provides a clause, return a JSON array of entry objects. Each object has:
{
  "type": "F" | "V" | "C" | "R" | "Sol" | "S" | "Task",
  /* IN CONTRACTS MODE: F=Function · V=Value · C=Constraint · R=Resource ·
     Sol=SOLUTION · S=STAKEHOLDER · Task=Task.
     r41 v430 (Tom Gilb 2026-07-02): Sol is Solution — a proposed DESIGN
     DECISION or architectural choice embedded in the contract text (e.g.
     "implement redundant 2N monitoring architecture", "adopt FIDIC Yellow
     Book form", "use PKI-based signature workflow", "route via primary +
     secondary carrier with automatic failover").  Solutions differ from
     Functions (WHAT must be delivered) and from Values (measurable
     performance targets) — Solutions are the HOW that the contract
     specifies as a design constraint.
     S is Stakeholder (party / authority / regulator / beneficiary), NOT
     Solution — see MANDATORY STAKEHOLDER EXTRACTION rule above. */
  "description": "canonical Planguage description (tag will be assigned separately)",
  "obligatedParty": "PARTY_ABBREVIATION or null if mutual",
  "scale":       "for Value and Resource entries only — WHAT is measured (10-20 words; the DIMENSION, not a number)",
  "meter":       "for Value and Resource entries only — HOW to measure on the Scale (a device/process/stipulated design; never Scale content)",
  "past":        "for Value and Resource entries only — historical benchmark level (with date qualifier if possible), or null",
  "status":      "for Value and Resource entries only — current benchmark level (with date qualifier if possible), or null",
  "wish":        "for Value and Resource entries only — HIGHEST ASPIRATION, uncommitted (comes FIRST in the target set)",
  "goal":        "for Value and Resource entries only — the COMMITTED target",
  "tolerable":   "for Value and Resource entries only — minimum non-failure level (the Scalar Constraint)",
  "constraintText": "for Constraint entries only — 'Must [not]...' statement",
  "presenceTest": "for Function entries only — binary presence statement",
  "deadline":    "for Task and Stakeholder entries only — ISO date or relative expression",
  "rawSource": "verbatim sentence(s) from clause text that generated this entry",
  "confidence": "high" | "medium" | "low",
  "isAmbiguous": true | false,           /* MANDATORY on every entry — see MANDATORY AMBIGUITY CHECK above */
  "ambiguityNote": "specific explanation if isAmbiguous is true, else null",
  "standardsViolations": [               /* MANDATORY when PURPOSE includes strict-analytical — emit [] if none, NEVER null and NEVER omit */
    { "standard": "<standard id>", "issue": "specific violation description" }
  ],
  "rewrittenText": "<rewrite of the obligation in the chosen Presentation style; ONLY when PURPOSE includes 'rewrite'>",
  "changes": [                        /* r41 v47 — required when PURPOSE includes 'change-log' */
    { "before": "verbatim original phrasing", "after": "rewritten phrasing", "rationale": "why this change" }
  ],
  "suggestions": [                    /* r41 v47 — required when PURPOSE includes 'creative-suggestions' */
    { "type": "appendix" | "additional-document" | "action" | "negotiating-tactic" | "alternative-clause",
      "title": "short label",
      "body":  "concrete suggestion text" }
  ]
}

━━ EXTRACT-DON'T-SUPPRESS RULE (r41 v417 Tom Gilb 2026-07-01) ━━
Vague / ambiguous / defective wording in the clause is NOT a reason to
return an empty array.  It is the CORE reason to extract the obligation
and FLAG the defect.  Whenever a clause contains a party doing something,
receiving something, being required to do something, or being paid /
budgeted / limited — EMIT an entry.  Set isAmbiguous = true, populate
ambiguityNote and standardsViolations to name the defects, but do NOT
suppress the entry itself.  An empty array is CORRECT ONLY when the clause
is pure definitions, table-of-contents entries, recitals with no
obligation, or boilerplate signature blocks.  For any clause of 200+ chars
containing verbs of obligation ("shall", "will", "must", "agrees to",
"is required to", "pays", "delivers", "provides", "warrants"), the
correct output has ≥1 entry.

Return ONLY the JSON array. No explanation.
`.trim()

/** VARIABLE suffix — per-clause text + parties.  This is what changes
 *  between LLM calls.  Anthropic's cache HASHES only the prefix; this
 *  suffix is the only payload that distinguishes one clause call from
 *  another.  Kept small so each LLM call's incremental compute is just
 *  this suffix + the cached prefix lookup. */
const PARSE_CLAUSE_PROMPT_VARIABLE = (
  clause: ContractClause,
  parties: ContractParty[],
): string => `
Contract parties:
${parties.length > 0
  ? parties.map(p => `- ${p.abbreviation} (${p.name}, role: ${p.role})`).join('\n')
  : '(none specified — infer party names from the clause text)'}

Clause ${clause.number} — ${clause.heading}:
---
${clause.rawText}
---
`.trim()

// ── Public composable ─────────────────────────────────────────────────────────

export function useContractParser() {
  /**
   * Phase 1 — Split raw contract text into clause objects.
   *
   * r41 2026-06-20 (Tom Gilb verbatim "This is sort of dead text, show the
   * clauses being found") — switched from blocking `messages.create()` to
   * streaming via `messages.stream()` + partial-JSON parsing.  As each
   * complete clause object closes in the streamed response, fires the
   * optional `onClauseFound` callback so the caller can render clauses
   * live as the AI discovers them.  Composes with: Conjunction-of-
   * Technologies SUPREME (the AI's work is dramatised), Architectural
   * Resilience SUPREME (streaming infrastructure ready for the same
   * pattern across other Phase-1-style splitters), Honest Loading Hint
   * Copy SUPREME (real per-clause progress + visible LLM token flow).
   */
  async function splitIntoClauses(
    rawText:        string,
    signal?:        AbortSignal,
    onClauseFound?: (clause: ContractClause) => void,
  ): Promise<ContractClause[]> {
    void signal  // SDK doesn't support signal directly; caller manages abort
    const client = _getClient()
    const stream = client.messages.stream({
      model:      MODEL_ID,
      max_tokens: 4096,
      messages:   [{ role: 'user', content: SPLIT_PROMPT(rawText) }],
    })
    // r41 v389 (2026-07-01, fix for "Analysis failed — SDK messages.stream() returned a
    // non-iterable value" — Tom Gilb's Indianapolis contract): switched from
    // `for await (const event of stream)` to the SDK's stable EVENT-BASED API
    // (`stream.on('text', …)` + `await stream.finalMessage()`).  Root diagnosis:
    // the async-iterator path (`stream[Symbol.asyncIterator]`) is inherited via
    // prototype and works in Node but fires "non-iterable" in the Vite-served
    // Safari browser context — likely a bundling / prototype-chain quirk that
    // is unstable across SDK point releases.  The event API is (a) officially
    // documented in the SDK README, (b) does not depend on prototype-chain
    // resolution of well-known Symbols, and (c) is what `parseClause` already
    // relies on implicitly (non-stream `messages.create` — same event
    // machinery under the hood).  Composes with Trace-Before-Patch SUPREME
    // (root-caused the "why is Symbol.asyncIterator missing" mystery — it's
    // an environmental fragility; move off the fragile path), Architectural
    // Resilience SUPREME (event API is the SDK's most-stable public surface),
    // Do-Not-Outsource-Investigation SUPREME (Claudian diagnosed via headless
    // Node test — never asked Tom to open DevTools).
    if (!stream) {
      // r41 v394 (Tom Gilb 2026-07-01 verbatim *"do you want to keep this error
      // diagnostics in here, ok with me if useful for you, but does it need to
      // be visible to user?"*) — technical diagnostic stays in the console for
      // Claudian; user sees the plain-English summary only.  Same pattern
      // applied to the finalMessage catch below.
      console.error('[useContractParser] messages.stream() returned', stream === null ? 'null' : 'undefined',
        '— likely an SDK version mismatch or a transient API failure.')
      throw new Error('The analyser could not start. Please refresh and try again.')
    }
    let accumulated = ''
    let lastEmittedCount = 0
    // Fire onClauseFound as text streams in — scan the buffer for newly-closed
    // clause objects on every text delta.  The 'text' event fires with the
    // delta string (never null) whenever the model emits assistant text.
    stream.on('text', (textDelta: string) => {
      accumulated += textDelta
      const completed = _extractCompletedClauseObjects(accumulated)
      while (completed.length > lastEmittedCount) {
        const objStr = completed[lastEmittedCount]
        lastEmittedCount++
        try {
          const parsed = JSON.parse(objStr) as LLMClauseSplit
          if (onClauseFound) {
            const _rawText = parsed.rawText?.trim() ?? ''
            const _number  = parsed.number?.trim() ?? '?'
            // r41 v395 + v396 — derive an intelligible heading from rawText
            // when the LLM omits one OR emits a placeholder like "Untitled".
            const _headingRaw = parsed.heading?.trim() ?? ''
            // r41 v418 (Tom Gilb 2026-07-01 verbatim *"not looking godd. And
            // what are these untitled clauses, I asked you to title"*) —
            // reject bogus clause objects at ingest.  The brace-depth
            // extractor picks up ANY top-level `{…}` in the streamed buffer.
            // If the LLM emits a preamble like `{"schema": …}` / `{"note":
            // …}` / an empty `{}` / a wrapper `{"clauses": [ … ]}` (where
            // the WRAPPER closes at depth 0), the callback used to fire with
            // rawText='' + number='?' → the Case Log rendered as "?  ·
            // Untitled clause".  Trace-Before-Patch SUPREME: v395 + v396
            // fixed the DERIVATION (bestClauseHeading → Untitled clause) for
            // clauses with no rawText, but the fix was cosmetic — the real
            // bug is upstream, in the extractor accepting non-clause objects
            // as if they were clauses.  This guard drops any object whose
            // rawText is empty AND whose type-shape does NOT look like a
            // real clause (no valid `number`, no valid `heading`).  A real
            // clause with a genuinely empty rawText field is impossible
            // (the LLM was told rawText is verbatim clause text), so this
            // guard has zero false-positive risk on well-formed output.
            //
            // Diagnostic — surface the rejected object so Claudian can see
            // what the LLM sent (Do-Not-Outsource-Investigation SUPREME +
            // No-Dodging-Ambiguous-Bugs).
            if (!_rawText) {
              console.warn(
                '[useContractParser] Phase 1 rejected a depth-0 object with empty rawText — likely a preamble / wrapper / example object emitted by the LLM.  Raw object:',
                objStr.slice(0, 400),
              )
              continue
            }
            onClauseFound({
              id:          _uuid(),
              number:      _number,
              heading:     _isBadHeading(_headingRaw) ? _deriveClauseHeading(_rawText, _number) : _headingRaw,
              rawText:     _rawText,
              entries:     [],
              parseStatus: 'pending',
            })
          }
        } catch { /* malformed mid-stream — skip; final parse below catches it */ }
      }
    })
    // Await stream completion.  finalMessage() resolves when the SDK finishes
    // the stream cleanly and rejects on API / network / abort errors.  On
    // reject we still parse `accumulated` in case partial text arrived —
    // No-Silent-Data-Loss SUPREME (any clauses already streamed are honoured).
    try {
      await stream.finalMessage()
    } catch (streamErr) {
      const msg = streamErr instanceof Error ? streamErr.message : String(streamErr)
      // r41 v394 — technical diagnostic in console, plain-English error to user.
      // If we got nothing at all, surface a short user-facing error.  If we got
      // partial content, fall through and try to return what we have (better
      // than dropping everything on a late-stream failure).
      if (accumulated.length === 0) {
        console.error('[useContractParser] SDK stream failed before any content:', msg)
        throw new Error('The analyser stopped before any clauses were found. Please refresh and try again.')
      }
      // Log the partial-failure but continue to the final parse below.
      console.warn(`[useContractParser] stream ended with error after ${accumulated.length} chars / ${lastEmittedCount} clauses emitted:`, msg)
    }
    // Final consolidated parse from the full streamed text.  This is the
    // authoritative return value; the streamed callbacks are for live UI
    // only.  Composes with No-Silent-Data-Loss SUPREME — even if the
    // partial-JSON scan misses a clause due to malformed mid-stream
    // tokens, the final parse picks it up.
    const splits = _extractJsonArray<LLMClauseSplit>(accumulated)
    // r41 v418 — same rawText guard as the streaming callback above.  The
    // authoritative final return must NOT contain empty-rawText clauses
    // either.  Diagnostic surfaces every rejected shape so we can spot
    // pattern drift (Do-Not-Outsource-Investigation SUPREME).
    const rejected: LLMClauseSplit[] = []
    const clauses = splits
      .filter((s): boolean => {
        const ok = !!(s.rawText?.trim())
        if (!ok) rejected.push(s)
        return ok
      })
      .map((s): ContractClause => {
        const _rawText = s.rawText?.trim() ?? ''
        const _number  = s.number?.trim() ?? '?'
        const _headingRaw = s.heading?.trim() ?? ''
        return {
          id:          _uuid(),
          number:      _number,
          // r41 v395 + v396 — treat placeholder strings ("Untitled" etc.)
          // as missing so the derivation kicks in for LLM outputs that
          // helpfully filled the field with a useless stub.
          heading:     _isBadHeading(_headingRaw) ? _deriveClauseHeading(_rawText, _number) : _headingRaw,
          rawText:     _rawText,
          entries:     [],
          parseStatus: 'pending',
        }
      })
    if (rejected.length > 0) {
      console.warn(
        `[useContractParser] Phase 1 rejected ${rejected.length} of ${splits.length} final-parse objects (empty rawText).  First rejected shape:`,
        JSON.stringify(rejected[0]).slice(0, 400),
      )
    }
    return clauses
  }

  /**
   * Phase 2 — Parse a single clause into PlanguageContractEntry[].
   * Caller is responsible for calling nextTag() to assign sequential tags.
   *
   * `contractTitle` (added 2026-06-20) is used for the producer-side source
   * stamp: every returned entry is stamped with `"Contract Parser · <Title> ·
   * <YYYY-MM-DD>"` so the renderer's `Source:` chip and per-field provenance
   * lights up.  Optional for callers that pre-date the sweep — they get a
   * stamp without the plan-name segment.
   */
  async function parseClause(
    clause:        ContractClause,
    parties:       ContractParty[],
    // r41 v409 (Tom Gilb 2026-07-01) — tag factory now receives the entry's
    // description so callers using `mnemonicTag` can derive a Planguage-
    // standard 1-3-word Capitalized mnemonic per entry.  Legacy callers
    // that ignore the second arg still work.
    tagFn:         (type: ContractEntryType, description: string) => string,
    signal?:       AbortSignal,
    contractTitle?: string,
  ): Promise<PlanguageContractEntry[]> {
    void signal  // SDK doesn't support signal directly; loop-level abort lives in caller
    const client = _getClient()
    // r41 2026-06-20 — content-block array with prompt caching on the prefix.
    // First call in the run writes the cache (one-shot cost: ~25% surcharge on
    // those input tokens); subsequent calls hit it (90% cost discount + 2-5×
    // latency reduction).  TTL is 5 minutes; for 38-clause parallel-batch
    // parses (see _parseAllClauses caller) the cache stays hot throughout.
    // r41 v419 (Tom Gilb 2026-07-01 "did not work" — USS Monitor contract
    // returned 0 entries × 14 clauses despite obvious obligations like
    // $275,000 payable in four instalments): bumped max_tokens from 2048 to
    // 8192.  Root cause: the r41 v410-v417 prompt evolution grew per-entry
    // output ~4×.  With 4 purposes composed (strict-analytical + change-log +
    // rewrite + creative-suggestions), a single entry now carries: 21
    // schema fields + rewrittenText paragraph + changes array + suggestions
    // array = 400-800 tokens per entry.  A clause with 5 entries needs
    // 2000-4000 tokens; 2048 truncated mid-array; the truncated response is
    // invalid JSON; `_extractJsonArray` returns [] silently.  Symptom: 0
    // entries per clause across all 14 clauses.  8192 fits ~15 rich entries
    // per clause with margin.  Composes with Model Selection Rule SUPREME
    // (Sonnet stays; the fix is output budget, not model), No-Silent-Data-Loss
    // SUPREME (truncation IS silent data loss).
    const response = await client.messages.create({
      model:      MODEL_ID,
      max_tokens: 8192,
      messages:   [{
        role: 'user',
        content: [
          { type: 'text', text: PARSE_CLAUSE_PROMPT_PREFIX(), cache_control: { type: 'ephemeral' } },
          { type: 'text', text: PARSE_CLAUSE_PROMPT_VARIABLE(clause, parties) },
        ],
      }],
    })
    const text = response.content.find(b => b.type === 'text')?.text ?? '[]'
    // r41 v419 — log stop_reason so max_tokens truncation is visible in
    // the console (Do-Not-Outsource-Investigation SUPREME).  `end_turn`
    // means Sonnet finished naturally; `max_tokens` means the response was
    // cut off — an under-budget signal for the caller.
    if (response.stop_reason && response.stop_reason !== 'end_turn') {
      console.warn(
        `[useContractParser] clause ${clause.number} — Sonnet stop_reason=${response.stop_reason} (usage: in=${response.usage?.input_tokens ?? '?'} out=${response.usage?.output_tokens ?? '?'}).  If 'max_tokens', bump max_tokens.`,
      )
    }
    const outputs = _extractJsonArray<LLMEntryOutput>(text)

    // r41 v410 (Tom Gilb 2026-07-01 "I suspect these 2 checks are not working
    // or reporting findings, zero is improbable for several contracts") —
    // per-clause diagnostic so we can see whether the LLM is actually
    // populating isAmbiguous + standardsViolations.  Console only (per
    // r41 v394 error-diagnostics-console-only rule); no UI noise.
    try {
      const ambN = outputs.filter(o => o.isAmbiguous === true).length
      const stdN = outputs.reduce((s, o) => s + (Array.isArray(o.standardsViolations) ? o.standardsViolations.length : 0), 0)
      console.info(
        `[useContractParser] clause ${clause.number} — LLM returned ${outputs.length} entries; ${ambN} isAmbiguous=true; ${stdN} standardsViolations`
      )
      // r41 v417 (Tom Gilb 2026-07-01 "very suspicious 15 of 20 clauses and
      // zero planguage") — when the LLM returns 0 entries for a clause with
      // meaningful text (>= 200 chars), that's almost always a symptom of the
      // prompt pushing Sonnet into over-conservative "empty on ambiguity"
      // mode.  Capture the raw response + a rawText snippet so Claudian can
      // diagnose without asking Tom to open DevTools.  Console only.
      if (outputs.length === 0 && clause.rawText && clause.rawText.trim().length >= 200) {
        console.warn(
          `[useContractParser] clause ${clause.number} — 0 entries emitted despite ${clause.rawText.length}-char clause text.  LLM raw response (first 400 chars):`,
          text.slice(0, 400),
          '\n\nClause rawText (first 200 chars):',
          clause.rawText.slice(0, 200),
        )
      }
    } catch { /* diagnostic only — never fail the parse */ }

    return outputs.map((o): PlanguageContractEntry => stampEntry({
      id:              _uuid(),
      clauseRef:       clause.id,
      type:            _sanitiseType(o.type),
      tag:             tagFn(_sanitiseType(o.type), o.description?.trim() ?? ''),
      description:     o.description?.trim() ?? '',
      obligatedParty:  o.obligatedParty ?? undefined,
      // r41 v412 (Kai-Zen Glossary canonical order) — Scale · Meter ·
      // Benchmarks (Past, Status) · Wish · Goal · Tolerable, matching the
      // glossary definitions imported into the LLM prompt.
      scale:           o.scale          ?? undefined,
      meter:           o.meter          ?? undefined,
      past:            o.past           ?? undefined,
      status:          o.status         ?? undefined,
      wish:            o.wish           ?? undefined,
      goal:            o.goal           ?? undefined,
      tolerable:       o.tolerable      ?? undefined,
      constraintText:  o.constraintText ?? undefined,
      presenceTest:    o.presenceTest   ?? undefined,
      deadline:        o.deadline       ?? undefined,
      rawSource:       o.rawSource?.trim() ?? clause.rawText.slice(0, 200),
      confidence:      _sanitiseConfidence(o.confidence),
      isAmbiguous:     o.isAmbiguous    ?? false,
      ambiguityNote:   o.ambiguityNote  ?? undefined,
      llmGenerated:    true,
      // r41 v50 (Tom Gilb 2026-06-16 "bug in parsing, the whole implied
      // suggestions did not appear") — propagate the four Contracts-Mode
      // purpose-specific outputs.  Defensive `?? undefined` so missing
      // fields stay undefined (clean JSON) instead of carrying null.
      standardsViolations: Array.isArray(o.standardsViolations) && o.standardsViolations.length > 0 ? o.standardsViolations : undefined,
      rewrittenText:       typeof o.rewrittenText === 'string' && o.rewrittenText.trim() ? o.rewrittenText.trim() : undefined,
      changes:             Array.isArray(o.changes)             && o.changes.length             > 0 ? o.changes             : undefined,
      suggestions:         Array.isArray(o.suggestions)         && o.suggestions.length         > 0 ? o.suggestions         : undefined,
    }, {
      // r41 v413 (Tom Gilb 2026-07-01 Source Attribution SUPREME —
      // `~/.claude/…/memory/rule_source_attribution_for_every_spec_element.md`)
      // — canonical stage id + trigger text (verbatim rawSource keywords,
      // capped at 80 chars) + paragraph reference (contract clause number)
      // so every stamped field carries a complete audit trail.
      generator:    'Contract Parser',
      planName:     contractTitle,
      sourceType:   'ai',
      tool:         'Contract Parser (Sonnet)',
      stage:        'contract-parse-phase-2-extract',
      triggerText:  (o.rawSource ?? '').trim().slice(0, 80),
      paragraphRef: clause.number,
    }))
  }

  return { splitIntoClauses, parseClause }
}

// ── Sanitisers ────────────────────────────────────────────────────────────────

function _sanitiseType(t: unknown): ContractEntryType {
  const valid: ContractEntryType[] = ['F', 'V', 'C', 'R', 'Sol', 'S', 'Task']
  return valid.includes(t as ContractEntryType) ? (t as ContractEntryType) : 'F'
}

function _sanitiseConfidence(c: unknown): 'high' | 'medium' | 'low' {
  if (c === 'high' || c === 'medium' || c === 'low') return c
  return 'medium'
}
