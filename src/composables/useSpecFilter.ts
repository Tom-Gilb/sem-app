// UNIT_TYPE=Composable
// useSpecFilter — Natural Language Spec Query / Filter (Feature #31)
// Filters a SpecBlock by a freeform query string supporting simple predicates
// ("goal > 80", "scale %") or substring matching across entry fields.

import { ref } from 'vue'
import type { SpecBlock, FEntry, VEntry, SEntry } from '../types/spec'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the trailing numeric value from a Planguage level string.
 *  Strips bracketed date/condition segments first so the year is not matched.
 *  e.g. "Goal [2025] 85%" → 85, "Goal [now] 0.5" → 0.5, "95" → 95  */
function extractNumeric(raw: string): number | null {
  // Remove bracketed segments like [2025] or [now, peak load]
  const stripped = raw.replace(/\[.*?\]/g, '')
  const m = stripped.match(/([\d]+(?:\.\d+)?)/)
  if (!m) return null
  return parseFloat(m[1])
}

type Predicate =
  | { kind: 'goal-gt'; threshold: number }
  | { kind: 'goal-lt'; threshold: number }
  | { kind: 'scale-contains'; token: string }
  | { kind: 'substring'; token: string }

function parsePredicate(q: string): Predicate {
  const norm = q.trim().toLowerCase()

  // "goal > <number>"
  const goalGt = norm.match(/^goal\s*>\s*([\d.]+)$/)
  if (goalGt) return { kind: 'goal-gt', threshold: parseFloat(goalGt[1]) }

  // "goal < <number>"
  const goalLt = norm.match(/^goal\s*<\s*([\d.]+)$/)
  if (goalLt) return { kind: 'goal-lt', threshold: parseFloat(goalLt[1]) }

  // "scale <token>"  — e.g. "scale %" or "scale seconds"
  const scaleToken = norm.match(/^scale\s+(.+)$/)
  if (scaleToken) return { kind: 'scale-contains', token: scaleToken[1] }

  return { kind: 'substring', token: norm }
}

// ---------------------------------------------------------------------------
// Per-type matchers
// ---------------------------------------------------------------------------

function matchesV(v: VEntry, pred: Predicate): boolean {
  switch (pred.kind) {
    case 'goal-gt': {
      const n = extractNumeric(v.goal)
      return n !== null && n > pred.threshold
    }
    case 'goal-lt': {
      const n = extractNumeric(v.goal)
      return n !== null && n < pred.threshold
    }
    case 'scale-contains':
      return v.scale.toLowerCase().includes(pred.token)
    case 'substring': {
      const t = pred.token
      return (
        v.description.toLowerCase().includes(t) ||
        v.scale.toLowerCase().includes(t) ||
        v.meter.toLowerCase().includes(t) ||
        v.goal.toLowerCase().includes(t) ||
        v.status.toLowerCase().includes(t) ||
        v.tolerable.toLowerCase().includes(t)
      )
    }
  }
}

function matchesF(f: FEntry, pred: Predicate): boolean {
  if (pred.kind !== 'substring') return false
  const t = pred.token
  return (
    f.description.toLowerCase().includes(t) ||
    f.successCriteria.toLowerCase().includes(t)
  )
}

function matchesS(s: SEntry, pred: Predicate): boolean {
  if (pred.kind !== 'substring') return false
  const t = pred.token
  return (
    s.description.toLowerCase().includes(t) ||
    s.impact.toLowerCase().includes(t)
  )
}

// ---------------------------------------------------------------------------
// Best-match fallback scoring (higher = better)
// ---------------------------------------------------------------------------

function scoreV(v: VEntry, pred: Predicate): number {
  switch (pred.kind) {
    case 'goal-gt': {
      const n = extractNumeric(v.goal)
      return n !== null ? n : -Infinity
    }
    case 'goal-lt': {
      const n = extractNumeric(v.goal)
      return n !== null ? -n : -Infinity
    }
    case 'scale-contains':
      return v.scale.toLowerCase().includes(pred.token) ? 1 : 0
    case 'substring': {
      const t = pred.token
      return (
        (v.description.toLowerCase().includes(t) ? 2 : 0) +
        (v.goal.toLowerCase().includes(t) ? 1 : 0)
      )
    }
  }
}

function scoreF(f: FEntry, pred: Predicate): number {
  if (pred.kind !== 'substring') return 0
  return f.description.toLowerCase().includes(pred.token) ? 1 : 0
}

function scoreS(s: SEntry, pred: Predicate): number {
  if (pred.kind !== 'substring') return 0
  return s.description.toLowerCase().includes(pred.token) ? 1 : 0
}

// ---------------------------------------------------------------------------
// Main composable
// ---------------------------------------------------------------------------

export function useSpecFilter() {
  const query = ref('')

  /**
   * Returns a new SpecBlock containing only entries that match q.
   * - If q is empty, returns the original spec unchanged.
   * - Supports: "goal > N", "goal < N", "scale <token>", or substring search.
   * - Always keeps ≥1 entry per type (best-match fallback).
   * - F. entries whose linked V. entries are included are always kept.
   */
  function filterSpec(spec: SpecBlock, q: string): SpecBlock {
    if (!q.trim()) return spec

    const pred = parsePredicate(q)

    // -- Values
    let matchedValues = spec.values.filter(v => matchesV(v, pred))
    if (matchedValues.length === 0 && spec.values.length > 0) {
      // Keep the best-scoring value as fallback
      const best = [...spec.values].sort((a, b) => scoreV(b, pred) - scoreV(a, pred))[0]
      matchedValues = [best]
    }

    // Collect matched V. ids for F. linking rule
    const matchedValueIds = new Set(matchedValues.map(v => v.id))

    // -- Functions: keep if they match the predicate OR if their linked V. entries are included
    let matchedFunctions = spec.functions.filter(f => {
      if (matchesF(f, pred)) return true
      // Check if any linked V. id is in matched values
      const fovIds = f.functionOfValue.split(/[\s,]+/).map(s => s.trim()).filter(Boolean)
      return fovIds.some(id => matchedValueIds.has(id))
    })
    if (matchedFunctions.length === 0 && spec.functions.length > 0) {
      const best = [...spec.functions].sort((a, b) => scoreF(b, pred) - scoreF(a, pred))[0]
      matchedFunctions = [best]
    }

    // -- Solutions
    let matchedSolutions = spec.solutions.filter(s => matchesS(s, pred))
    if (matchedSolutions.length === 0 && spec.solutions.length > 0) {
      const best = [...spec.solutions].sort((a, b) => scoreS(b, pred) - scoreS(a, pred))[0]
      matchedSolutions = [best]
    }

    return {
      functions: matchedFunctions,
      values: matchedValues,
      solutions: matchedSolutions,
    }
  }

  return { query, filterSpec }
}
