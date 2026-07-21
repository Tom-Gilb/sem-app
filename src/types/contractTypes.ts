/**
 * contractTypes.ts — Type system for Contracts mode.
 *
 * Contracts mode converts real legal/business contracts into Planguage,
 * making obligations, SLAs, prohibitions, and stakeholder duties explicit,
 * measurable, and unambiguous.
 *
 * Field names are aligned to Planguage Template_Write_*.md standards:
 *   F. = Function (binary obligation — present or absent)
 *   V. = Value    (measurable performance: Scale/Meter/Goal/Tolerable/Wish)
 *   C. = Constraint (prohibition, hard limit, binary compliance)
 *   R. = Resource   (budget, time, quantity cap)
 *   S. = Stakeholder (party-specific duty or claim)
 *   Task = specific action item with deadline
 *
 * Twin-portability: no Vue-specific constructs in this file. These types
 * translate cleanly to REST/GraphQL schemas for Kai's Twin app.
 */

import type { FieldSource } from './spec'

// ── Entry type ────────────────────────────────────────────────────────────────

// r41 v430 (Tom Gilb 2026-07-02 verbatim *"Contracts: the Solutions and its
// count are missing, in the row with the others"*).  Added 'Sol' as a distinct
// Solution type.  Rationale: v427 (2026-07-01) reassigned S = Stakeholder in
// contracts mode to fix the "zero stakeholders" bug on Indianapolis; Solution
// had no slot after that.  Solutions ARE relevant in contracts (proposed
// design decisions like "implement 2N redundant monitoring architecture",
// "use FIDIC Yellow Book form", "adopt PKI-based signature workflow").  'Sol'
// (three chars) chosen to be distinct from S (Stakeholder) and to match the
// spelled-out-multi-char convention already established by 'Task'.
export type ContractEntryType = 'F' | 'V' | 'C' | 'R' | 'S' | 'Sol' | 'Task'

// ── Party ─────────────────────────────────────────────────────────────────────

export type ContractPartyRole =
  | 'obligor'    // the party who must perform (the "doer")
  | 'obligee'    // the party who receives performance (the "receiver")
  | 'both'       // mutual obligation
  | 'regulator'  // external authority (GDPR, ISO, government body)
  | 'witness'    // execution witness, no obligations

export interface ContractParty {
  id: string
  name: string            // full legal name, e.g. "Acme Corporation Ltd"
  abbreviation: string    // used in entry tags, e.g. "CLIENT", "SUPPLIER"
  role: ContractPartyRole
  contact?: string        // email or address
}

// ── Planguage entry derived from a clause ────────────────────────────────────

export interface PlanguageContractEntry {
  id: string
  clauseRef: string       // clause.id this entry was derived from
  type: ContractEntryType
  tag: string             // sequential tag, e.g. "F.1", "V.3", "C.2"

  description: string     // canonical Planguage description of the obligation

  /** Which party abbreviation is obligated (null = both / unspecified) */
  obligatedParty?: string

  // ── V. entry fields — Kai-Zen Glossary canonical order ─────────────────
  // r41 v412 (Tom Gilb 2026-07-01 "the scale of measure is defined first.
  // Then the Targets (Wish (first), Goal and Constraint levels (Tolerable).
  // Ideally with a Benchmark (Past, Status).") — extended with Past + Status
  // Benchmarks per Glossary *106 + Wish ordered first per Glossary *244.
  scale?:     string      // *132 Scale of Measure — WHAT is measured (dimension, defined FIRST)
  meter?:     string      // *093 Meter — HOW to measure on the Scale (device / process, distinct from Scale)
  past?:      string      // *106 Past — historical benchmark level (with date qualifier)
  status?:    string      // Status — current benchmark level (with date qualifier)
  wish?:      string      // *244 Wish — highest aspiration, uncommitted (comes FIRST in target set)
  goal?:      string      // *109 Goal — the committed target
  tolerable?: string      // *539 Tolerable — minimum non-failure level (Scalar Constraint)

  // ── C. entry field (Template_Write_Constraint.md) ───────────────────────
  constraintText?: string // the hard rule expressed as "Must [not]..."

  // ── F. entry field (Template_Write_Function.md) ─────────────────────────
  presenceTest?: string   // binary presence statement ("X is [done/provided]")

  // ── Deadline (Task / S. entries) ────────────────────────────────────────
  deadline?: string       // ISO date or relative expression

  // ── Provenance + quality ─────────────────────────────────────────────────
  rawSource: string       // verbatim sentence(s) from contract that generated this
  confidence: 'high' | 'medium' | 'low'
  isAmbiguous: boolean
  ambiguityNote?: string  // what is vague/undefined (why confidence is low)
  llmGenerated: boolean
  manuallyEdited?: boolean

  // ── Entry-level provenance (Tom Gilb 2026-06-20 producer-stamp sweep) ───
  /** "<Generator> · <Contract title> · <YYYY-MM-DD>" — stamped by parseClause()
   *  and every other producer.  Distinct from `rawSource` (verbatim clause
   *  text); `source` names the GENERATOR + CONTEXT, not the source text. */
  source?: string
  sourceType?: 'human' | 'ai' | 'system'
  /** Per-field source attribution (parallel to SpecBlock entries). */
  fieldSources?: Record<string, FieldSource>

  // ── r41 v47 Contracts Mode purpose-specific output (Tom Gilb 2026-06-16) ──
  // These are populated based on which Purposes are active in Contracts Mode:
  //   strict-analytical    → standardsViolations
  //   change-log           → changes
  //   rewrite              → rewrittenText
  //   creative-suggestions → suggestions
  // r41 v50 bug-fix: these were defined in the prompt schema but missing from
  // both the LLMEntryOutput type AND the sanitiser, so the LLM-returned
  // values were silently dropped when the entry was built.
  standardsViolations?: Array<{ standard: string; issue: string }>
  rewrittenText?: string
  changes?:       Array<{ before: string; after: string; rationale: string }>
  suggestions?:   Array<{
    type:  'appendix' | 'additional-document' | 'action' | 'negotiating-tactic' | 'alternative-clause'
    title: string
    body:  string
  }>
}

// ── Clause ────────────────────────────────────────────────────────────────────

export type ClauseParseStatus = 'pending' | 'parsing' | 'done' | 'error'

export interface ContractClause {
  id: string
  number: string          // "3.2.1", "Article IV", "Schedule A", etc.
  heading: string         // short clause title/subject
  rawText: string         // verbatim clause text as it appears in the contract
  entries: PlanguageContractEntry[]
  parseStatus: ClauseParseStatus
  parseError?: string
  /**
   * r41 v402 (Tom Gilb 2026-07-01 verbatim "reparsing does not shaw a visible
   * result") — ISO timestamp of the last time this clause finished parsing.
   * Displayed in the clause detail so the planner sees the clause DID re-parse
   * even when the LLM decision was "0 entries extracted" (no obligations found).
   * Composes with No-Silent-Data-Loss SUPREME (records the parse event) + DD-009
   * Zero-Training UI (planner sees WHEN the parse ran without having to
   * guess).  Optional so pre-v402 stored clauses remain valid.
   */
  lastParsedAt?: string
}

// ── Contract (top-level document) ────────────────────────────────────────────

export type ContractParseStatus =
  | 'empty'     // no content yet
  | 'raw'       // raw text imported, not yet split into clauses
  | 'splitting' // LLM is splitting raw text into clause objects
  | 'parsing'   // LLM is converting clauses to Planguage entries
  | 'complete'  // all clauses parsed
  | 'error'     // unrecoverable error during parsing

export type ContractType =
  | 'service-agreement'
  | 'sla'
  | 'nda'
  | 'employment'
  | 'procurement'
  | 'partnership'
  | 'lease'
  | 'license'
  | 'other'

export interface ContractModel {
  id: string
  title: string
  subtitle?: string         // "Service Level Agreement", "NDA", etc.
  contractType: ContractType

  // ── Parties ───────────────────────────────────────────────────────────────
  parties: ContractParty[]

  // ── Dates & jurisdiction ─────────────────────────────────────────────────
  effectiveDate?: string    // ISO date string
  expiryDate?: string
  jurisdiction?: string     // e.g. "England & Wales"
  governingLaw?: string     // e.g. "English law"

  // ── Content ───────────────────────────────────────────────────────────────
  clauses: ContractClause[]
  rawImportText?: string    // full text pasted before splitting into clauses

  // ── Status ────────────────────────────────────────────────────────────────
  parseStatus: ContractParseStatus
  parseError?: string
  /** r41 v434 (Tom Gilb 2026-07-02 verbatim *"the time counters are very wrong
   *  after about 40 minutes they show 3 minutes etc"*) — persisted parse start
   *  timestamp so the elapsed-time counter survives Vite HMR reloads.
   *  ContractHub's `contractElapsed` previously derived from a JS module-scope
   *  `_contractAnimStart` variable that reset to 0 every time the component
   *  hot-reloaded — every design-history-ship in the middle of a running parse
   *  reset the timer.  Now: set once when parse starts (parseStatus →
   *  'splitting'), read verbatim to compute `now - parseStartedAt`.  ISO
   *  string for legible localStorage inspection. */
  parseStartedAt?: string

  // ── Counters (for deterministic sequential tagging: F.1, V.2, ...) ───────
  entryCounters: Record<ContractEntryType, number>

  // ── Metadata ──────────────────────────────────────────────────────────────
  createdAt: string         // ISO datetime
  updatedAt: string         // ISO datetime
  schemaVersion: 1          // for future migrations
}

// ── Obligation matrix cell ────────────────────────────────────────────────────

export interface ObligationMatrixCell {
  partyId: string
  entryType: ContractEntryType
  entries: PlanguageContractEntry[]
}

// ── Parser output types (LLM JSON contracts) ──────────────────────────────────

/** Phase 1 LLM output: split raw text into clause objects */
export interface LLMClauseSplit {
  number: string
  heading: string
  rawText: string
}

/** Phase 2 LLM output: Planguage entries from a single clause */
export interface LLMEntryOutput {
  type: ContractEntryType
  description: string
  obligatedParty?: string
  scale?: string
  meter?: string
  // r41 v412 — Kai-Zen Glossary Past + Status Benchmarks + Wish-first target order
  past?: string
  status?: string
  wish?: string
  goal?: string
  tolerable?: string
  constraintText?: string
  presenceTest?: string
  deadline?: string
  rawSource: string
  confidence: 'high' | 'medium' | 'low'
  isAmbiguous: boolean
  ambiguityNote?: string
  // r41 v47 Contracts Mode purpose-specific fields (Tom Gilb 2026-06-16).
  // r41 v50 fix: added to the LLM output type so the sanitiser can carry
  // these through into the PlanguageContractEntry instead of dropping them.
  standardsViolations?: Array<{ standard: string; issue: string }>
  rewrittenText?: string
  changes?:       Array<{ before: string; after: string; rationale: string }>
  suggestions?:   Array<{
    type:  'appendix' | 'additional-document' | 'action' | 'negotiating-tactic' | 'alternative-clause'
    title: string
    body:  string
  }>
}
