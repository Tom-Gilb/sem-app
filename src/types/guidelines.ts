// UNIT_TYPE=Types
/**
 * guidelines.ts — Guideline + Rule type definitions for the SEM App
 * Guidelines Library (Phase 3.5).
 *
 * Tom Gilb 2026-06-20 verbatim spec:
 *
 *   "All Rules will have a Tag ([Guideline].[RULE TAG].GUIDELINE IS THE
 *    GUIDELINE TITLE.[VERSION], AND THE TAG IS A Unique for the Guideline,
 *    MNEMONIC, (like 'Unambiguous', derived by AI), but Editable by Planners,
 *    with Source and Date, and 'Justification' for each Rule.  Additional
 *    parameters: 1. where this is checked, 2. Exceptions, 3. How to Correct
 *    (auto and manual), 4. Severity or Criticality."
 *
 * Architecture decisions (Tom Gilb 2026-06-20):
 *   - (Q1=c) Global SEM App library — types live here, not under
 *     contracts/, so Maria / Standards Auditor / Spec Editor can adopt
 *     the same shape later.
 *   - (Q2=b) Library-scoped with version-pinning — each contract pins to a
 *     specific {guidelineId, version} pair; editing a rule bumps the
 *     guideline version; pinned contracts stay on the prior version
 *     until upgraded.  Composes with Universal Undo SUPREME + Sources-of-
 *     Specs SUPREME.
 *   - (Q3=b) Structured `whereChecked` — tickbox set of (entry types ×
 *     clause kinds × lifecycle phases) with an optional free-text fallback.
 *     Deterministic check paths feed Plan Health Indicator severity scoring.
 *
 * Composes with: Planguage Mnemonic ID Standard SUPREME (Rule tag is a 1-3
 * word mnemonic, AI-derived, planner-editable), N-level Umbrella Tag SUPREME
 * (dotted hierarchy `Guideline.Rule.Version`), Planguage Parameter Discipline
 * SUPREME (each Rule IS a structured Planguage spec — recursive: Planguage
 * spec'ing the rules that constrain Planguage extraction), Sources-of-Specs
 * SUPREME (Source + Date on every Rule), Qualifiers SUPREME (Exceptions are
 * Qualifier-style carve-outs), Universal Undo SUPREME (version bump on edit
 * keeps history reachable), No-Silent-Data-Loss SUPREME (rejected Rules
 * marked status='rejected', not deleted).
 */

import type { ContractEntryType } from './contractTypes'

// ── Severity ────────────────────────────────────────────────────────────────

/** Criticality of a Rule violation.  Drives Plan Health Indicator scoring,
 *  Sharpening defect prioritisation, and visual prominence (red vs amber vs
 *  slate) in the Rewrites tab. */
export type RuleSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

// ── Where Checked (structured + optional free-text) ─────────────────────────

/** Lifecycle phase a Rule may apply to.  Mirrors the Contracts agent
 *  phase numbering (Phase 1 split / Phase 2 extract / Phase 3 rewrite review
 *  / Phase 4 version save) but generalises for cross-agent reuse. */
export type RulePhase =
  | 'phase-1-split'
  | 'phase-2-extract'
  | 'phase-3-rewrite-review'
  | 'phase-4-version-save'
  | 'sharpen'
  | 'plan-health'
  | 'export'
  | 'any'

/** Clause-kind classification (Contracts-specific but kept generic for
 *  future Sharpening / Standards Auditor reuse). */
export type RuleClauseKind =
  | 'obligation'
  | 'definition'
  | 'recital'
  | 'condition'
  | 'remedy'
  | 'governing-law'
  | 'any'

/** Structured + free-text descriptor of WHERE a Rule applies. */
export interface RuleWhereChecked {
  /** Which Planguage entry types this Rule fires on.  Empty = any. */
  entryTypes:   ContractEntryType[]
  /** Which clause kinds this Rule fires on.  Empty = any. */
  clauseKinds:  RuleClauseKind[]
  /** Which lifecycle phases this Rule fires in.  Empty = any. */
  phases:       RulePhase[]
  /** Optional free-text additional criteria for cases the tickboxes don't
   *  cover.  Claudian uses this at check-time as an extra natural-language
   *  filter alongside the structured constraints. */
  additionalCriteria?: string
}

// ── How to Correct ──────────────────────────────────────────────────────────

/** Auto-fix recipe + manual guidance. */
export interface RuleHowToCorrect {
  /** Prompt-recipe Claudian uses to auto-fix a violation.  null when no
   *  reliable auto-fix exists (manual-only Rules). */
  auto:   string | null
  /** Text guidance for the planner to fix by hand.  Always populated. */
  manual: string
}

// ── Rule ────────────────────────────────────────────────────────────────────

/** Status of a Rule within a Guideline — `active` Rules fire at check time;
 *  `rejected` Rules are kept (No-Silent-Data-Loss SUPREME) but skipped;
 *  `edited` Rules have been superseded by a newer version (their
 *  `parentRuleId` points back to the original they were forked from). */
export type RuleStatus = 'active' | 'rejected' | 'edited'

/** A single Rule within a Guideline.  The canonical tag form is
 *  `<Guideline.tag>.<Rule.tag>.<Rule.version>` — see `formatRuleTag()`. */
export interface GuidelineRule {
  /** UUID — internal identifier; never shown to planners. */
  id:           string
  /** 1-3 word Mnemonic Tag (Planguage Mnemonic ID Standard SUPREME).
   *  AI-derived by default at Rule-creation time, planner-editable. */
  tag:          string
  /** Optional longer human-readable title.  Falls back to `tag` when blank. */
  title?:       string
  /** Why this Rule exists.  Required.  Composes with Planguage Parameter
   *  Discipline SUPREME — every Rule carries its own Justification. */
  justification: string
  /** Who/what defined this Rule (Tom Gilb book ref, SEM curator, planner
   *  name, imported source, …).  Required. */
  source:       string
  /** ISO-8601 date of creation (or version bump). */
  date:         string
  /** Where this Rule fires — structured + optional free-text. */
  whereChecked: RuleWhereChecked
  /** Exceptions / carve-outs — Qualifier-style natural-language list. */
  exceptions:   string[]
  /** How to correct a violation. */
  howToCorrect: RuleHowToCorrect
  /** Severity / criticality of a violation. */
  severity:     RuleSeverity
  /** Lifecycle status. */
  status:       RuleStatus
  /** Monotonic version per Rule.  Starts at 1; increments on edit.  Edits
   *  fork the prior version (saved with status='edited') and the new one
   *  becomes status='active'. */
  version:      number
  /** When this Rule was edited from another Rule, points back to the
   *  original.  null for the original Rule of a lineage. */
  parentRuleId: string | null
}

// ── Guideline ──────────────────────────────────────────────────────────────

/** Category bucket for library organisation in the Guidelines panel. */
export type GuidelineCategory =
  | 'sem-curated'        // shipped by SEM as recommended defaults
  | 'planguage-canonical' // Tom Gilb canonical books (Competitive Engineering, ASPECTS, …)
  | 'planner-personal'   // saved by the planner
  | 'imported'           // imported from external standard (ISO, GDPR, …)
  | 'us-navy'            // r41 v463 (Tom Gilb 2026-07-02 "make a NAVY Guidelines section for SEM") — US Navy / DoD / Federal-Acquisition-Regulation domain sets.  Every rule cites a Reachable-Now FAR / DFARS / MIL-STD / DoD-FMR URL per Term + Definition + Source SUPREME (v460).

/** A collection of Rules under a versioned title.  The Guideline itself
 *  is versioned (separate from its Rules' versions) — bumping a Rule does
 *  NOT bump the Guideline; bumping the Guideline is reserved for
 *  significant reorganisations (e.g. retiring a Rule, restructuring a
 *  section).  Pinned contracts reference `{guidelineId, version}`. */
export interface Guideline {
  id:            string
  /** 1-3 word Mnemonic Tag for the Guideline (e.g. "Tom Gilb Planguage",
   *  "Plain English", "ISO 9001"). */
  tag:           string
  /** Human-readable title (longer than tag).  Falls back to tag. */
  title?:        string
  /** Monotonic version per Guideline.  Starts at 1. */
  version:       number
  /** Who curated this Guideline. */
  source:        string
  /** ISO-8601 date of creation (or version bump). */
  date:          string
  /** One-paragraph description of what this Guideline aims to enforce. */
  description:   string
  /** Library category. */
  category:      GuidelineCategory
  /** The Rules inside.  Order matters — planners can sort. */
  rules:         GuidelineRule[]
}

// ── Per-contract pinning ────────────────────────────────────────────────────

/** Which Guidelines a given contract is pinned to, and at what version.
 *  Each pin is captured at parse-time so re-running the analysis later is
 *  reproducible even if the library has since evolved.  Composes with
 *  Sources-of-Specs SUPREME (provenance) + Universal Undo SUPREME (the
 *  pinned versions are the undo-target). */
export interface GuidelinePin {
  guidelineId: string
  version:     number
  /** ISO-8601 timestamp when this pin was captured. */
  pinnedAt:    string
}

/** A contract's active Guideline set — pointer into the global library
 *  plus the version snapshots so the contract is reproducible. */
export interface ContractGuidelineActiveSet {
  contractId: string
  pins:       GuidelinePin[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Canonical Rule tag in `Guideline.Rule.vN` form.  Used in user-visible
 *  cells, exports, AI-prompt-built rule context.  Composes with Planguage
 *  Mnemonic ID Standard SUPREME (mnemonic) + N-level Umbrella Tag SUPREME
 *  (dotted hierarchy). */
export function formatRuleTag(guideline: Pick<Guideline, 'tag'>, rule: Pick<GuidelineRule, 'tag' | 'version'>): string {
  return `${guideline.tag}.${rule.tag}.v${rule.version}`
}
