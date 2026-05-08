// UNIT_TYPE=Composable
// Feature #45 — Live Spec Complexity Footer
// Computes structural statistics over a SpecBlock.

import type { SpecBlock } from '../types/spec'

export interface SpecStats {
  totalEntries: number          // F + V + S count
  completenessPercent: number   // non-empty fields ÷ expected fields × 100
  avgDescriptionLength: number  // average chars across all description fields
  longestEntry: string          // entryId of the entry with longest description
  shortestEntry: string         // entryId of the entry with shortest description
  missingFieldCount: number     // total count of empty required fields
}

// Required fields per entry type
// F: description, successCriteria, functionOfValue  (3 fields)
// V: description, scale, meter, goal, tolerable, status  (6 fields)
// S: description, impact, function  (3 fields)

export function useSpecStats() {
  function computeStats(spec: SpecBlock): SpecStats {
    const totalEntries =
      spec.functions.length + spec.values.length + spec.solutions.length

    let totalExpected = 0
    let totalFilled = 0
    let missingFieldCount = 0

    // Track per-entry description lengths to find longest/shortest
    const descLengths: Array<{ entryId: string; len: number }> = []

    // --- F entries ---
    for (const f of spec.functions) {
      const fields = [f.description, f.successCriteria, f.functionOfValue]
      totalExpected += fields.length
      for (const val of fields) {
        if (val && val.trim().length > 0) {
          totalFilled++
        } else {
          missingFieldCount++
        }
      }
      descLengths.push({ entryId: f.id, len: f.description.length })
    }

    // --- V entries ---
    for (const v of spec.values) {
      const fields = [v.description, v.scale, v.meter, v.goal, v.tolerable, v.status]
      totalExpected += fields.length
      for (const val of fields) {
        if (val && val.trim().length > 0) {
          totalFilled++
        } else {
          missingFieldCount++
        }
      }
      descLengths.push({ entryId: v.id, len: v.description.length })
    }

    // --- S entries ---
    for (const s of spec.solutions) {
      const fields = [s.description, s.impact, s.function]
      totalExpected += fields.length
      for (const val of fields) {
        if (val && val.trim().length > 0) {
          totalFilled++
        } else {
          missingFieldCount++
        }
      }
      descLengths.push({ entryId: s.id, len: s.description.length })
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
      completenessPercent,
      avgDescriptionLength,
      longestEntry,
      shortestEntry,
      missingFieldCount,
    }
  }

  return { computeStats }
}
