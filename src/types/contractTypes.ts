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

// ── Entry type ────────────────────────────────────────────────────────────────

export type ContractEntryType = 'F' | 'V' | 'C' | 'R' | 'S' | 'Task'

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

  // ── V. entry fields (Template_Write_Values.md) ──────────────────────────
  scale?: string          // what is being measured
  meter?: string          // how it is measured
  goal?: string           // target value (what we aim for)
  tolerable?: string      // minimum acceptable value
  wish?: string           // aspirational stretch value

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
  goal?: string
  tolerable?: string
  wish?: string
  constraintText?: string
  presenceTest?: string
  deadline?: string
  rawSource: string
  confidence: 'high' | 'medium' | 'low'
  isAmbiguous: boolean
  ambiguityNote?: string
}
