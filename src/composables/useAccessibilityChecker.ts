// UNIT_TYPE=Composable
// Feature #38 — Spec Accessibility Checker
// Scans a SpecBlock for jargon, vague terms, and missing context.
// Returns a list of findings with the affected field and a suggestion.

import type { SpecBlock } from '../types/spec'

export interface AccessibilityFinding {
  /** Which entry the finding belongs to, e.g. "V.EntryFluency" */
  entryId: string
  /** "F." | "V." | "S." */
  entryType: 'F.' | 'V.' | 'S.'
  /** Human-readable field name, e.g. "Scale" */
  field: string
  /** The matched term or pattern */
  match: string
  /** Plain-language suggestion for fixing it */
  suggestion: string
  /** Severity: "jargon" | "vague" | "missing" */
  kind: 'jargon' | 'vague' | 'missing'
}

// ── Jargon patterns ───────────────────────────────────────────────────────────

interface JargonRule {
  pattern: RegExp
  suggestion: string
}

const JARGON_RULES: JargonRule[] = [
  {
    pattern: /\bsynergy\b/i,
    suggestion: 'Replace "synergy" with a specific outcome, e.g. "joint efficiency gain of X%"',
  },
  {
    pattern: /\blever(?:age)?\b/i,
    suggestion: 'Replace "leverage" with a concrete action, e.g. "use" or "apply"',
  },
  {
    pattern: /\bparadigm\b/i,
    suggestion: 'Replace "paradigm" with the specific model or approach being referenced',
  },
  {
    pattern: /\bbest[\s-]in[\s-]class\b/i,
    suggestion: 'Define "best-in-class" with a measurable benchmark, e.g. "top 10% by Gartner index"',
  },
  {
    pattern: /\bworld[\s-]class\b/i,
    suggestion: 'Define "world-class" with a specific measurable standard',
  },
  {
    pattern: /\bholistic\b/i,
    suggestion: 'Replace "holistic" by listing the specific dimensions being addressed',
  },
  {
    pattern: /\bseamless(?:ly)?\b/i,
    suggestion: 'Replace "seamless" with a measurable experience criterion, e.g. "zero error prompts during handoff"',
  },
  {
    pattern: /\brobust\b/i,
    suggestion: 'Replace "robust" with a specific reliability or fault-tolerance metric',
  },
  {
    pattern: /\bscalable\b/i,
    suggestion: 'Define "scalable": specify the load range, e.g. "handles 1 000 → 100 000 requests/min"',
  },
  {
    pattern: /\buser[\s-]friendly\b/i,
    suggestion: 'Replace "user-friendly" with a usability measure, e.g. "task completion in < 3 minutes by first-time users"',
  },
  {
    pattern: /\bintuitive\b/i,
    suggestion: 'Replace "intuitive" with a usability measure such as SUS score or error rate',
  },
  {
    pattern: /\bsignificant(?:ly)?\b/i,
    suggestion: 'Quantify "significant" — use a specific number, percentage, or benchmark',
  },
  {
    pattern: /\bsubstantial(?:ly)?\b/i,
    suggestion: 'Quantify "substantial" — use a specific number, percentage, or benchmark',
  },
  {
    pattern: /\bstate[\s-]of[\s-]the[\s-]art\b/i,
    suggestion: 'Replace "state-of-the-art" with the specific standard or technology being referenced',
  },
  {
    pattern: /\bsophisticat(?:ed|ion)\b/i,
    suggestion: 'Replace "sophisticated" by describing the specific capability or complexity involved',
  },
  {
    pattern: /\bAI[\s-]driven\b/i,
    suggestion: 'Clarify what the AI specifically does — e.g. "ML classifier predicting churn with AUC ≥ 0.85"',
  },
  {
    pattern: /\boutstanding\b/i,
    suggestion: 'Replace "outstanding" with a measurable goal level',
  },
  {
    pattern: /\bexcellent\b/i,
    suggestion: 'Replace "excellent" with a measurable goal level',
  },
]

// ── Vague-quantifier patterns ──────────────────────────────────────────────────

const VAGUE_PATTERNS: JargonRule[] = [
  {
    pattern: /\b(?:some|various|several|a\s+(?:few|lot\s+of)|many|numerous)\b/i,
    suggestion: 'Replace vague quantifiers ("some", "several", "many") with exact numbers or ranges',
  },
  {
    pattern: /\b(?:as\s+(?:soon|fast|quickly)\s+as\s+possible|ASAP)\b/i,
    suggestion: 'Replace "as soon as possible" with a specific date, time, or SLA target',
  },
  {
    pattern: /\bimprove(?:d|ment)?\b(?!\s+(?:by|\d))/i,
    suggestion: 'Quantify "improve" — state the current value and the target, e.g. "improve from X to Y"',
  },
  {
    pattern: /\benhance(?:d|ment)?\b/i,
    suggestion: 'Replace "enhance" with a specific measurable outcome',
  },
  {
    pattern: /\b(?:better|best)\s+(?:performance|results|outcomes)\b/i,
    suggestion: 'Define "better performance" with a Scale and Goal level',
  },
  {
    pattern: /\boptimis(?:e|ed|ation)\b/i,
    suggestion: 'Replace "optimise" by stating what is being minimised/maximised and the target value',
  },
  {
    pattern: /\befficiently?\b/i,
    suggestion: 'Quantify "efficiency" — specify the ratio, throughput, or time target',
  },
  {
    pattern: /\bmore\s+efficient\b/i,
    suggestion: 'Specify "more efficient by how much" — e.g. "30% fewer steps" or "half the processing time"',
  },
  {
    pattern: /\bminimise\s+(?:cost|time|errors?)\b/i,
    suggestion: '"Minimise" needs a Tolerable floor — add the minimum acceptable level',
  },
  {
    pattern: /\bmaximise\s+(?:value|revenue|performance)\b/i,
    suggestion: '"Maximise" needs a Goal ceiling and a Tolerable floor to be measurable',
  },
]

// ── Field-presence checks ──────────────────────────────────────────────────────

/**
 * Scan a text for all matching jargon/vague rules.
 */
function scanText(text: string, rules: JargonRule[]): { match: string; suggestion: string }[] {
  const findings: { match: string; suggestion: string }[] = []
  for (const rule of rules) {
    const m = text.match(rule.pattern)
    if (m) {
      findings.push({ match: m[0], suggestion: rule.suggestion })
    }
  }
  return findings
}

export function useAccessibilityChecker() {
  /**
   * Scan the full SpecBlock and return a list of findings.
   * Each finding points to a specific entry, field, matched term, and fix suggestion.
   */
  function check(spec: SpecBlock): AccessibilityFinding[] {
    const findings: AccessibilityFinding[] = []

    // ── F. entries ─────────────────────────────────────────────────────────────
    for (const f of spec.functions) {
      // Missing fields
      if (!f.description || f.description.length < 20) {
        findings.push({
          entryId: f.id,
          entryType: 'F.',
          field: 'Description',
          match: '(empty or too short)',
          suggestion: 'Add a meaningful description of at least 20 characters explaining what this function does.',
          kind: 'missing',
        })
      }
      if (!f.successCriteria) {
        findings.push({
          entryId: f.id,
          entryType: 'F.',
          field: 'Success Criteria',
          match: '(missing)',
          suggestion: 'Add measurable acceptance criteria so the function is testable.',
          kind: 'missing',
        })
      }
      // Jargon/vague scan on description + success criteria
      const fText = `${f.description} ${f.successCriteria}`
      for (const { match, suggestion } of scanText(fText, JARGON_RULES)) {
        findings.push({ entryId: f.id, entryType: 'F.', field: 'Description / Criteria', match, suggestion, kind: 'jargon' })
      }
      for (const { match, suggestion } of scanText(fText, VAGUE_PATTERNS)) {
        findings.push({ entryId: f.id, entryType: 'F.', field: 'Description / Criteria', match, suggestion, kind: 'vague' })
      }
    }

    // ── V. entries ─────────────────────────────────────────────────────────────
    for (const v of spec.values) {
      if (!v.scale) {
        findings.push({
          entryId: v.id,
          entryType: 'V.',
          field: 'Scale',
          match: '(missing)',
          suggestion: 'Define a Scale — the unit and range being measured, e.g. "% tasks completed on time, 0–100".',
          kind: 'missing',
        })
      }
      if (!v.meter) {
        findings.push({
          entryId: v.id,
          entryType: 'V.',
          field: 'Meter',
          match: '(missing)',
          suggestion: 'Define a Meter — how the Scale value is measured in practice.',
          kind: 'missing',
        })
      }
      if (!v.goal) {
        findings.push({
          entryId: v.id,
          entryType: 'V.',
          field: 'Goal',
          match: '(missing)',
          suggestion: 'Add a Goal level — the target value on the Scale the stakeholder wants to reach.',
          kind: 'missing',
        })
      }
      if (!v.tolerable) {
        findings.push({
          entryId: v.id,
          entryType: 'V.',
          field: 'Tolerable',
          match: '(missing)',
          suggestion: 'Add a Tolerable level — the minimum acceptable value before delivery is considered unsatisfactory.',
          kind: 'missing',
        })
      }
      // Jargon/vague scan on scale + description
      const vText = `${v.description} ${v.scale} ${v.meter} ${v.goal} ${v.tolerable}`
      for (const { match, suggestion } of scanText(vText, JARGON_RULES)) {
        findings.push({ entryId: v.id, entryType: 'V.', field: 'Scale / Description', match, suggestion, kind: 'jargon' })
      }
      for (const { match, suggestion } of scanText(vText, VAGUE_PATTERNS)) {
        findings.push({ entryId: v.id, entryType: 'V.', field: 'Scale / Description', match, suggestion, kind: 'vague' })
      }
    }

    // ── S. entries ─────────────────────────────────────────────────────────────
    for (const s of spec.solutions) {
      if (!s.description || s.description.length < 20) {
        findings.push({
          entryId: s.id,
          entryType: 'S.',
          field: 'Description',
          match: '(empty or too short)',
          suggestion: 'Add a meaningful description explaining how this solution achieves the linked function.',
          kind: 'missing',
        })
      }
      if (!s.impact) {
        findings.push({
          entryId: s.id,
          entryType: 'S.',
          field: 'Impact',
          match: '(missing)',
          suggestion: 'Add an Impact estimate referencing V. entries, e.g. "V.Fluency ~80%".',
          kind: 'missing',
        })
      }
      const sText = `${s.description} ${s.impact}`
      for (const { match, suggestion } of scanText(sText, JARGON_RULES)) {
        findings.push({ entryId: s.id, entryType: 'S.', field: 'Description', match, suggestion, kind: 'jargon' })
      }
      for (const { match, suggestion } of scanText(sText, VAGUE_PATTERNS)) {
        findings.push({ entryId: s.id, entryType: 'S.', field: 'Description', match, suggestion, kind: 'vague' })
      }
    }

    // De-duplicate: same entryId + field + match → keep first only
    const seen = new Set<string>()
    return findings.filter((f) => {
      const key = `${f.entryId}|${f.field}|${f.match}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  /** Group findings by kind for summary badge counts */
  function summarise(findings: AccessibilityFinding[]): {
    total: number
    jargon: number
    vague: number
    missing: number
  } {
    return {
      total: findings.length,
      jargon: findings.filter((f) => f.kind === 'jargon').length,
      vague: findings.filter((f) => f.kind === 'vague').length,
      missing: findings.filter((f) => f.kind === 'missing').length,
    }
  }

  return { check, summarise }
}
