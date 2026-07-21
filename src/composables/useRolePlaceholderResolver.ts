// UNIT_TYPE=Composable
// useRolePlaceholderResolver.ts — Phase 4 of Roles redesign (Tom Gilb
// 2026-06-23 standing greenlight "then of course on with phase 2 and on").
//
// Tom Gilb 14-point directive #14 (Musk responsibility principle 1):
//   "The creation of Roles will be as automatic as possible, with defaults
//    used, and placeholders when none is nominated, or is within the Role
//    Time Span Dates, or is generic, but with specific named individuals
//    (Musks responsibility principle 1)."
//
// Phase 4 MVP — DETERMINISTIC heuristics only.  Phase 4.1 will wire
// Claudian per Claude-Code-as-AI-Layer SUPREME: the SEM App never makes
// embedded AI calls; instead the planner invokes Claudian which writes
// suggestions to a file the SEM App reads.  This MVP closes the loop using
// information already present in the spec.
//
// HEURISTICS (in priority order)
//   1. derived-from-existing-stakeholder  — another non-placeholder
//      Stakeholder has the same Position OR lists this Role's id in
//      `heldRoles[]` → suggest THEIR personName.
//   2. derived-from-plan                  — scan adjacent Solution
//      specOwner / implementationResponsible / authority fields for a
//      person-name-shaped value; if found, suggest it.
//   3. generic-template                   — fall through with
//      "Name a specific person here" as the last-resort suggestion.
//
// COMPOSING RULES (binding)
// • Claude-Code-as-AI-Layer SUPREME — MVP carries ZERO embedded API
//   calls.  Phase 4.1 (banked, not shipped) will route through Claudian.
// • Conjunction-of-Technologies SUPREME — every suggestion carries a
//   `source` label so the planner sees which layer produced it.
// • Universal Undo SUPREME — pure read-side composable; the CALLER wires
//   undoHistory.record() before promoting a candidate.
// • No-Silent-Data-Loss SUPREME — promote happens via the Panel which
//   stamps fieldSources on the personName change.
// • Stakeholder Engineering (Gilb 2025) — Role IS Stakeholder.
// • Twin portability — pure function over SpecBlock.

import type { SpecBlock, StakeholderEntry } from '../types/spec'

// ── Public types ───────────────────────────────────────────────────────────

/** Provenance of a single candidate suggestion. */
export type PlaceholderSuggestionSource =
  | 'derived-from-plan'
  | 'derived-from-existing-stakeholder'
  | 'generic-template'

export interface PlaceholderCandidate {
  /** Suggested person name (or the placeholder text for generic). */
  personName: string
  /** Which heuristic layer produced the candidate. */
  source: PlaceholderSuggestionSource
  /** One-sentence rationale for the suggestion (≤25 words). */
  rationale: string
  /** Confidence band the resolver assigns to this candidate. */
  confidence: 'high' | 'medium' | 'low'
}

export interface PlaceholderSuggestion {
  /** The Stakeholder/Role id being resolved. */
  stakeholderId: string
  /** Position string from the Stakeholder record (may be empty). */
  position: string
  /** Up to 3 candidates ordered most-confident first. */
  candidates: PlaceholderCandidate[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Looks like a person name (≥ 2 chars and includes at least one letter). */
function _looksLikePersonName(value: string): boolean {
  if (!value) return false
  const trimmed = value.trim()
  if (trimmed.length < 2) return false
  if (!/[a-zA-Z]/.test(trimmed)) return false
  // Reject obvious placeholder strings.
  const lower = trimmed.toLowerCase()
  if (lower === 'tbd' || lower === 'tba' || lower === 'unknown' || lower === '(unknown)') return false
  return true
}

/** Position-string equality, normalised. */
function _samePosition(a: string | undefined, b: string | undefined): boolean {
  const aa = (a ?? '').trim().toLowerCase()
  const bb = (b ?? '').trim().toLowerCase()
  if (!aa || !bb) return false
  return aa === bb
}

/** Returns true if the Stakeholder lists the given Role tag in heldRoles[]. */
function _holdsRole(stakeholder: StakeholderEntry, roleTag: string): boolean {
  const held = stakeholder.heldRoles ?? []
  const tag = roleTag.trim().toLowerCase()
  if (!tag) return false
  for (const h of held) {
    if (String(h).trim().toLowerCase() === tag) return true
  }
  return false
}

/** Collect every person-name shaped value referenced on adjacent Solution
 *  specOwner / implementationResponsible / authority fields. */
function _planLevelNamePool(spec: SpecBlock): string[] {
  const pool = new Set<string>()
  const solutions = spec.solutions ?? []
  for (const s of solutions) {
    for (const k of ['specOwner', 'implementationResponsible', 'authority'] as const) {
      const v = (s as Record<string, unknown>)[k]
      if (typeof v === 'string' && _looksLikePersonName(v)) pool.add(v.trim())
    }
  }
  // Plan-level fallback: scan named Stakeholders that are NOT placeholders.
  for (const sh of spec.stakeholderEntries ?? []) {
    if (sh.isPlaceholder !== true && _looksLikePersonName(sh.personName ?? '')) {
      pool.add(String(sh.personName).trim())
    }
  }
  return [...pool]
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * For every placeholder Stakeholder in `spec`, produce up to 3 candidate
 * named individuals using deterministic heuristics over information that
 * already lives inside the spec.  The CALLER routes the promotion of a
 * candidate through Universal Undo SUPREME (see RoleRoutingRulesPanel
 * `promoteCandidate`).
 *
 * MVP guarantee: ZERO embedded AI calls — Claude-Code-as-AI-Layer SUPREME
 * compliant.  Phase 4.1 will optionally route a Claudian suggestion as a
 * fourth heuristic layer.
 */
export function suggestPlaceholderResolutions(spec: SpecBlock | null): PlaceholderSuggestion[] {
  if (!spec) return []
  const allStakeholders = spec.stakeholderEntries ?? []
  const placeholders = allStakeholders.filter(s => s.isPlaceholder === true)
  if (placeholders.length === 0) return []

  const planPool = _planLevelNamePool(spec)
  const namedStakeholders = allStakeholders.filter(s => s.isPlaceholder !== true)

  const suggestions: PlaceholderSuggestion[] = []
  for (const ph of placeholders) {
    const candidates: PlaceholderCandidate[] = []

    // ── Layer 1: derived-from-existing-stakeholder (high-confidence) ────
    for (const other of namedStakeholders) {
      if (other.id === ph.id) continue
      if (!_looksLikePersonName(other.personName ?? '')) continue
      const samePos = ph.position && _samePosition(ph.position, other.position)
      const holdsRole = _holdsRole(other, ph.id)
      if (samePos || holdsRole) {
        const why = samePos
          ? `Same Position "${other.position ?? ''}" already named in Stakeholder ${other.id}`
          : `Stakeholder ${other.id} lists ${ph.id} in its heldRoles`
        candidates.push({
          personName: String(other.personName).trim(),
          source: 'derived-from-existing-stakeholder',
          rationale: why,
          confidence: 'high',
        })
        if (candidates.length >= 3) break
      }
    }

    // ── Layer 2: derived-from-plan (medium-confidence) ──────────────────
    if (candidates.length < 3) {
      for (const name of planPool) {
        // Skip duplicates already proposed in layer 1.
        if (candidates.some(c => c.personName === name)) continue
        candidates.push({
          personName: name,
          source: 'derived-from-plan',
          rationale: `Named in adjacent Solution specOwner / implementationResponsible / authority field`,
          confidence: 'medium',
        })
        if (candidates.length >= 3) break
      }
    }

    // ── Layer 3: generic-template (low-confidence, last resort) ─────────
    if (candidates.length === 0) {
      candidates.push({
        personName: 'Name a specific person here',
        source: 'generic-template',
        rationale: 'No signal found in spec — Musk responsibility principle 1 requires a specific named individual',
        confidence: 'low',
      })
    }

    suggestions.push({
      stakeholderId: ph.id,
      position:      ph.position ?? '',
      candidates,
    })
  }
  return suggestions
}
