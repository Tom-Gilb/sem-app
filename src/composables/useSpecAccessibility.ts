// UNIT_TYPE=Composable
// Feature #38 — Spec Accessibility Checker
// Checks a SpecBlock for measurability, clarity, and Planguage quality issues.

import type { SpecBlock, FEntry, VEntry, SEntry } from '../types/spec'

export interface AccessibilityIssue {
  entryId: string
  field: string
  severity: 'error' | 'warning' | 'info'
  message: string
  suggestion: string
}

const JARGON_TERMS = [
  'synergy', 'leverage', 'paradigm', 'holistic', 'robust', 'scalable',
  'world-class', 'best-in-class', 'cutting-edge', 'seamless', 'streamline',
]

const VAGUE_GOAL_TERMS = ['good', 'better', 'high', 'improved', 'significant', 'effective']

// Matches "is/are/was/were" followed (anywhere in field) by a past participle
const PASSIVE_VOICE_RE = /\b(is|are|was|were)\b.{0,60}\b(\w+ed|\w+en)\b/i

// Detects any unit of measure: digit, %, ms, s, hrs, days, USD, £, €
const HAS_UNIT_RE = /\d|%|ms\b|(?<!\w)s\b|hrs\b|days\b|USD|£|€/i

export function useSpecAccessibility() {
  function checkSpec(spec: SpecBlock): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = []

    // ── Helper to check all text fields of an entry for passive voice and jargon ──

    function checkPassiveVoice(entryId: string, field: string, text: string): void {
      if (PASSIVE_VOICE_RE.test(text)) {
        issues.push({
          entryId,
          field,
          severity: 'error',
          message: 'Passive voice weakens measurability',
          suggestion: "Rewrite as active voice: 'X achieves Y' not 'Y is achieved'",
        })
      }
    }

    function checkJargon(entryId: string, field: string, text: string): void {
      const lower = text.toLowerCase()
      for (const term of JARGON_TERMS) {
        if (lower.includes(term)) {
          issues.push({
            entryId,
            field,
            severity: 'warning',
            message: 'Jargon term detected',
            suggestion: 'Replace with a specific, observable description',
          })
          break // only one warning per field
        }
      }
    }

    function checkLongDescription(entryId: string, text: string): void {
      if (text.length > 200) {
        issues.push({
          entryId,
          field: 'description',
          severity: 'warning',
          message: `Description is very long (${text.length} chars)`,
          suggestion: 'Shorten to under 150 chars for clarity',
        })
      }
    }

    // ── F. entries ────────────────────────────────────────────────────────────

    for (const f of spec.functions) {
      const fieldsToCheck: Array<[string, string]> = [
        ['description', f.description],
        ['successCriteria', f.successCriteria],
      ]

      for (const [fieldName, fieldValue] of fieldsToCheck) {
        if (fieldValue) {
          checkPassiveVoice(f.id, fieldName, fieldValue)
          checkJargon(f.id, fieldName, fieldValue)
        }
      }

      if (f.description) checkLongDescription(f.id, f.description)

      // Rule 6: Missing successCriteria
      if (!f.successCriteria || f.successCriteria.trim().length < 10) {
        issues.push({
          entryId: f.id,
          field: 'successCriteria',
          severity: 'warning',
          message: 'Function is missing success criteria',
          suggestion: 'Add a measurable exit condition',
        })
      }
    }

    // ── V. entries ────────────────────────────────────────────────────────────

    for (const v of spec.values) {
      const fieldsToCheck: Array<[string, string]> = [
        ['description', v.description],
        ['scale', v.scale],
        ['meter', v.meter],
        ['goal', v.goal],
      ]

      for (const [fieldName, fieldValue] of fieldsToCheck) {
        if (fieldValue) {
          checkPassiveVoice(v.id, fieldName, fieldValue)
          checkJargon(v.id, fieldName, fieldValue)
        }
      }

      if (v.description) checkLongDescription(v.id, v.description)

      // Rule 2: Vague goal — only flags if no number is present
      if (v.goal) {
        const goalLower = v.goal.toLowerCase()
        const hasNumber = /\d/.test(v.goal)
        if (!hasNumber) {
          for (const term of VAGUE_GOAL_TERMS) {
            if (goalLower.includes(term)) {
              issues.push({
                entryId: v.id,
                field: 'goal',
                severity: 'error',
                message: 'Goal is not quantified',
                suggestion: "Add a specific number: e.g. '85%' or '< 2 seconds'",
              })
              break // one error per goal field
            }
          }
        }
      }

      // Rule 3: Missing unit in Scale
      if (v.scale !== undefined && v.scale !== null) {
        if (!HAS_UNIT_RE.test(v.scale)) {
          issues.push({
            entryId: v.id,
            field: 'scale',
            severity: 'error',
            message: 'Scale has no measurable unit',
            suggestion: 'Add a unit: %, ms, count, USD, etc.',
          })
        }
      }

      // Rule 7: Short scale (info)
      if (v.scale && v.scale.trim().length > 0 && v.scale.trim().length < 15) {
        issues.push({
          entryId: v.id,
          field: 'scale',
          severity: 'info',
          message: 'Scale may be too brief to be unambiguous',
          suggestion: 'Consider elaborating on what exactly is measured',
        })
      }
    }

    // ── S. entries ────────────────────────────────────────────────────────────

    for (const s of spec.solutions) {
      const fieldsToCheck: Array<[string, string]> = [
        ['description', s.description],
        ['impact', s.impact],
      ]

      for (const [fieldName, fieldValue] of fieldsToCheck) {
        if (fieldValue) {
          checkPassiveVoice(s.id, fieldName, fieldValue)
          checkJargon(s.id, fieldName, fieldValue)
        }
      }

      if (s.description) checkLongDescription(s.id, s.description)
    }

    return issues
  }

  return { checkSpec }
}
