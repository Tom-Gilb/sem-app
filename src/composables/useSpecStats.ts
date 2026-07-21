// UNIT_TYPE=Composable
// Feature #45 — Live Spec Complexity Footer
// Computes structural statistics over a SpecBlock.

import type { SpecBlock } from '../types/spec'

export interface SpecStats {
  totalEntries: number          // F + V + S count
  fCount: number                // F. function entries
  vCount: number                // V. value entries
  sCount: number                // S. solution entries
  completenessPercent: number   // non-empty fields / expected fields × 100
  avgDescriptionLength: number  // average chars across all description fields
  longestEntry: string          // entryId of the entry with longest description
  shortestEntry: string         // entryId of the entry with shortest description
  missingFieldCount: number     // total count of empty required fields
  /**
   * Number of V. entries that are fully QUANTIFIED at planning time —
   * Tag + Scale + Tolerable + at least one Target (Wish OR Goal).
   *
   * r41 v73 (Tom Gilb 2026-06-16 verbatim "🎯 0/8 measurable … (NOT measurable,
   * Meter can come later)") — this metric used to require Scale + Meter + Goal,
   * conflating Meter (delivery-time per the Value Definition Identity SUPREME
   * r07 rule) with planning-time identity (Scale + Targets).  Per Tom's
   * Wish→Goal commitment-evolution rule, Wish counts as a Target during early
   * planning before commitment.  Meter belongs to the DELIVERY lifecycle
   * (Evo cycle steps 6-9), not planning (steps 1-5).
   *
   * The new test: Scale + Tolerable + (Wish OR Goal).  Counts as "Quantified"
   * — the planner has done their identity work; the engineering team will set
   * Meter when they're ready to measure.
   */
  measurableValues: number
}

// Required fields per entry type
// F: description, successCriteria, functionOfValue  (3 fields)
// V: description, scale, meter, goal, tolerable, status  (6 fields)
// S: description, impact, function  (3 fields)

// r41 v232 (Tom Gilb 2026-06-20 mount crash) — defensive string coercion
// helper.  Stored localStorage specs may carry historical-shape fields where
// a TS-declared `string` is actually an array / number / object due to a
// past writer bug.  This helper returns '' for anything non-string so the
// downstream `.trim()` / `.length` operations never crash.  Class fix:
// instead of patching every `.trim()` call site, all callers go through this.
function _str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export function useSpecStats() {
  function computeStats(spec: SpecBlock): SpecStats {
    const fCount = spec.functions.length
    const vCount = spec.values.length
    const sCount = spec.solutions.length
    const totalEntries = fCount + vCount + sCount

    let totalExpected = 0
    let totalFilled = 0
    let missingFieldCount = 0
    let measurableValues = 0

    // Track per-entry description lengths to find longest/shortest
    const descLengths: Array<{ entryId: string; len: number }> = []

    // --- F entries ---
    for (const f of spec.functions) {
      const fields = [_str(f.description), _str(f.successCriteria), _str(f.functionOfValue)]
      totalExpected += fields.length
      for (const val of fields) {
        if (val.trim().length > 0) {
          totalFilled++
        } else {
          missingFieldCount++
        }
      }
      descLengths.push({ entryId: f.id, len: _str(f.description).length })
    }

    // --- V entries ---
    for (const v of spec.values) {
      const fields = [_str(v.description), _str(v.scale), _str(v.meter), _str(v.goal), _str(v.tolerable), _str(v.status)]
      totalExpected += fields.length
      for (const val of fields) {
        if (val.trim().length > 0) {
          totalFilled++
        } else {
          missingFieldCount++
        }
      }
      descLengths.push({ entryId: v.id, len: _str(v.description).length })
      // r41 v73 — Quantified at planning: Scale + Tolerable + at least one
      // Target (Wish OR Goal).  Meter is delivery-time (r07 SUPREME); do NOT
      // require it here.
      const hasScale     = _str(v.scale).trim()
      const hasTolerable = _str(v.tolerable).trim()
      const hasTarget    = _str(v.goal).trim() || _str((v as { wish?: unknown }).wish).trim()
      if (hasScale && hasTolerable && hasTarget) measurableValues++
    }

    // --- S entries ---
    for (const s of spec.solutions) {
      const fields = [_str(s.description), _str(s.impact), _str(s.function)]
      totalExpected += fields.length
      for (const val of fields) {
        if (val.trim().length > 0) {
          totalFilled++
        } else {
          missingFieldCount++
        }
      }
      descLengths.push({ entryId: s.id, len: _str(s.description).length })
    }

    const completenessPercent =
      totalExpected > 0
        ? Math.round((totalFilled / totalExpected) * 100)
        : 100

    // avgDescriptionLength — mean of all description field char lengths
    const allDescLengths = descLengths.map(d => d.len)
    const avgDescriptionLength =
      allDescLengths.length > 0
        ? Math.round(
            allDescLengths.reduce((sum, l) => sum + l, 0) / allDescLengths.length,
          )
        : 0

    // longestEntry / shortestEntry
    let longestEntry = ''
    let shortestEntry = ''

    if (descLengths.length > 0) {
      let maxLen = -1
      let minLen = Infinity

      for (const { entryId, len } of descLengths) {
        if (len > maxLen) {
          maxLen = len
          longestEntry = entryId
        }
        if (len < minLen) {
          minLen = len
          shortestEntry = entryId
        }
      }
    }

    return {
      totalEntries,
      fCount,
      vCount,
      sCount,
      completenessPercent,
      avgDescriptionLength,
      longestEntry,
      shortestEntry,
      missingFieldCount,
      measurableValues,
    }
  }

  return { computeStats }
}
