// UNIT_TYPE=Types
// Maria Agent — Board Work Parse: TypeScript interfaces for structured output.
// Canonical schema for MariaResult. Mirrors the JSON contract defined in
// src/config/maria-prompt.ts (MARIA_SYSTEM_PROMPT == OUTPUT RULES section).
//
// Design principle (Architectural Resilience Rule, 2026-05-27):
//   Interfaces defined here are the single source of truth for MariaResult
//   shape. Both useMaria.ts (composable) and MariaAgentBoard.vue (renderer)
//   import from this file — never inline type definitions in components.

// ─── Governance layer ─────────────────────────────────────────────────────────

/**
 * The three-layer governance model (Tom Gilb / Maria Agent design, 2026-05-29).
 *
 * board       — Strategic governance: policy, risk appetite, board-reserved decisions.
 * management  — Executive implementation: delegated decisions within board-set limits.
 * operations  — Day-to-day execution: routine activities within management parameters.
 */
export type GovernanceLayer = 'board' | 'management' | 'operations'

// ─── Decision Inventory ───────────────────────────────────────────────────────

/**
 * A single decision extracted from the board document.
 * Every explicit or clearly implied decision gets its own MariaDecision entry.
 * A "decision" is any resolved direction, commitment, approval, or authorisation.
 */
export interface MariaDecision {
  /** Sequential identifier: "D1", "D2", "D3" … */
  id: string
  /** The decision as stated or paraphrased — one clear sentence. */
  text: string
  /** Which governance layer this decision belongs to. */
  layer: GovernanceLayer
  /** 1–2 sentences explaining WHY this decision belongs to this layer. */
  layerRationale: string
  /** True when an authority clarity gap is detected for this decision. */
  authorityGapFlagged: boolean
  /**
   * Present only when authorityGapFlagged is true.
   * Describes what is unclear about authority and why it matters.
   */
  authorityGapNote?: string
}

// ─── Authority Report ─────────────────────────────────────────────────────────

/**
 * Severity of an authority clarity gap.
 *
 * critical   — board-reserved decision made without board authority; potential
 *              legal or regulatory exposure.
 * moderate   — authority boundary blurred but immediate risk is contained;
 *              should be addressed in the next governance review.
 * advisory   — best-practice opportunity; document would be more defensible
 *              if authority were stated explicitly.
 */
export type AuthorityGapSeverity = 'critical' | 'moderate' | 'advisory'

/**
 * A single authority clarity gap entry.
 * Groups one or more decisions that share the same authority ambiguity.
 */
export interface MariaAuthorityEntry {
  /** IDs from decisionInventory — the decisions this entry relates to. */
  decisionIds: string[]
  /** Factual description of the authority clarity gap — 1–3 sentences. */
  issue: string
  /** Opportunity-framed forward-looking action — 1–3 sentences. */
  opportunity: string
  severity: AuthorityGapSeverity
}

// ─── Governance Gaps ──────────────────────────────────────────────────────────

/**
 * A topic that SHOULD have a recorded decision but does not.
 * Represents conspicuous absence — what is missing from the board record.
 */
export interface MariaGap {
  /** Sequential identifier: "G1", "G2", "G3" … */
  id: string
  /**
   * Short category label — e.g. "Missing resolution", "Unresolved risk",
   * "Deferred decision", "Undisposed audit finding".
   */
  category: string
  /** Why this gap matters — 1–2 sentences, factual. */
  significance: string
  /** Opportunity-framed action — 1–2 sentences. */
  opportunity: string
}

// ─── Pattern Analysis ─────────────────────────────────────────────────────────

/**
 * A recurring governance pattern identified across the full document.
 * Patterns reveal how the board operates — strengths or concerns.
 * 3–6 patterns per analysis run.
 */
export interface MariaPattern {
  /** Sequential identifier: "P1", "P2", "P3" … */
  id: string
  /** strength = board doing something well; concern = recurring risk behaviour. */
  type: 'strength' | 'concern'
  /** Short label — 4–8 words, e.g. "Evidence-based decision practice". */
  label: string
  /**
   * What the pattern is and where it was observed in the document.
   * 2–4 sentences — self-explanatory without surrounding context.
   */
  description: string
  /**
   * Next step — 1–3 sentences, always opportunity-framed (forward-looking,
   * positive action, never a restatement of the problem).
   */
  opportunity: string
  /** IDs from decisionInventory that provide evidence for this pattern. */
  evidenceDecisionIds: string[]
}

// ─── Top-level result ─────────────────────────────────────────────────────────

/**
 * Full structured output of a single Maria board-document analysis run.
 * Matches the JSON contract in MARIA_SYSTEM_PROMPT (OUTPUT RULES section).
 */
export interface MariaResult {
  /** All decisions extracted from the board document. */
  decisionInventory: MariaDecision[]
  /**
   * Authority clarity gaps. Empty array when no gaps exist —
   * do NOT omit the field; always present.
   */
  authorityReport: MariaAuthorityEntry[]
  /**
   * Topics that should have a recorded decision but do not. Empty array
   * when no gaps detected — always present.
   */
  governanceGaps: MariaGap[]
  /** 3–6 governance patterns (strengths or concerns). */
  patternAnalysis: MariaPattern[]
  /** ISO 8601 timestamp of the analysis run, e.g. "2026-05-29T14:30:00Z". */
  generatedAt: string
  /** Approximate word count of the input document. */
  sourceWordCount: number
}
