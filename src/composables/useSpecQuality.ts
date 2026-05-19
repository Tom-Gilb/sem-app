// UNIT_TYPE=Composable
// Feature #22 — Spec Quality Score
// Scores a SpecBlock 0–100 and returns a grade + list of issues.

import type { SpecBlock } from '../types/spec'

export interface QualityResult {
  score: number        // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  issues: string[]     // list of specific problems found
}

export function useSpecQuality() {
  function scoreSpec(spec: SpecBlock): QualityResult {
    const issues: string[] = []

    // ── V. entries (max 50 pts) ───────────────────────────────────────────────
    let vRaw = 0
    let vMax = 0

    if (spec.values.length > 0) {
      // Per-entry max: 4+4+4+4+3+1 = 20
      vMax = spec.values.length * 20

      let scaleMissing = true
      let meterMissing = true
      let goalMissing = true
      let tolerableMissing = true
      let statusMissing = true
      let descMissing = true

      for (const v of spec.values) {
        if (v.scale)                        { vRaw += 4; scaleMissing = false }
        if (v.meter)                        { vRaw += 4; meterMissing = false }
        if (v.goal)                         { vRaw += 4; goalMissing = false }
        if (v.tolerable)                    { vRaw += 4; tolerableMissing = false }
        if (v.status)                       { vRaw += 3; statusMissing = false }
        if (v.description.length > 20)      { vRaw += 1; descMissing = false }
      }

      if (scaleMissing)     issues.push('All V. entries are missing a Scale')
      if (meterMissing)     issues.push('All V. entries are missing a Meter')
      if (goalMissing)      issues.push('All V. entries are missing a Goal')
      if (tolerableMissing) issues.push('All V. entries are missing a Tolerable')
      if (statusMissing)    issues.push('All V. entries are missing a Status')
      if (descMissing)      issues.push('All V. entries are missing a meaningful description')
    }

    const vScore = vMax > 0 ? (vRaw / vMax) * 50 : 0

    // ── F. entries (max 25 pts) ───────────────────────────────────────────────
    let fRaw = 0
    let fMax = 0

    if (spec.functions.length > 0) {
      // Per-entry max: 5+5+2 = 12
      fMax = spec.functions.length * 12

      let fDescMissing = true
      let fCriteriaMissing = true
      let fFovMissing = true

      for (const f of spec.functions) {
        if (f.description.length > 20)       { fRaw += 5; fDescMissing = false }
        if ((f.presenceTest || f.successCriteria || '').length > 10) { fRaw += 5; fCriteriaMissing = false }
        if (f.functionOfValue)               { fRaw += 2; fFovMissing = false }
      }

      if (fDescMissing)     issues.push('All F. entries are missing a meaningful description')
      if (fCriteriaMissing) issues.push('All F. entries are missing Success Criteria')
      if (fFovMissing)      issues.push('All F. entries are missing a Function of Value link')
    }

    const fScore = fMax > 0 ? (fRaw / fMax) * 25 : 0

    // ── S. entries (max 25 pts) ───────────────────────────────────────────────
    let sRaw = 0
    let sMax = 0

    if (spec.solutions.length > 0) {
      // Per-entry max: 6+4+2 = 12
      sMax = spec.solutions.length * 12

      let sDescMissing = true
      let sImpactMissing = true
      let sFuncMissing = true

      for (const s of spec.solutions) {
        if (s.description.length > 20) { sRaw += 6; sDescMissing = false }
        if (s.impact)                  { sRaw += 4; sImpactMissing = false }
        if (s.function)                { sRaw += 2; sFuncMissing = false }
      }

      if (sDescMissing)  issues.push('All S. entries are missing a meaningful description')
      if (sImpactMissing) issues.push('All S. entries are missing an Impact')
      if (sFuncMissing)  issues.push('All S. entries are missing a Function link')
    }

    const sScore = sMax > 0 ? (sRaw / sMax) * 25 : 0

    const raw = vScore + fScore + sScore
    const score = Math.round(Math.min(100, Math.max(0, raw)))

    let grade: QualityResult['grade']
    if (score >= 90)      grade = 'A'
    else if (score >= 75) grade = 'B'
    else if (score >= 60) grade = 'C'
    else if (score >= 45) grade = 'D'
    else                  grade = 'F'

    return { score, grade, issues }
  }

  return { scoreSpec }
}
