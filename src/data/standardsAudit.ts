// UNIT_TYPE=Data
//
// standardsAudit.ts — Planguage-vs-Standards Auditor types + Claudian prompt
// + mock seed.
//
// Tom Gilb 2026-06-03 Conjunction-of-Technologies SUPREME principle, EXPLOIT
// #1: "Planguage-vs-Standards Auditor — reads the current spec, checks
// against 10.Standard/Standard.Kai-Zen/Template_Write_*.md + Rule_Write_*.md,
// returns per-defect violation with Gilb-Standard citation."
//
// This is the FIRST exploit to ship because the citation universe is CLOSED:
// the standards live in Tom's vault (10.Standard/Standard.Kai-Zen/) — Claudian
// can read them directly via the Read tool, no hallucination possible.

import type { SpecBlock } from '../types/spec'
import type { SourceProvenance, StandardsCitation } from './aiSource'

// ── Audit finding ────────────────────────────────────────────────────────────

export type StandardsSeverity = 'red' | 'orange' | 'green'

/** Which Planguage entry type the finding concerns. */
export type StandardsTargetType = 'function' | 'value' | 'solution' | 'constraint' | 'resource' | 'stakeholder' | 'plan-level'

export interface StandardsFinding {
  /** Stable id */
  id: string
  /** Severity — drives display colour. */
  severity: StandardsSeverity
  /** Which entry the finding is on (id or "plan-level"). */
  targetType: StandardsTargetType
  targetRef: string
  /** Short defect title. */
  title: string
  /** Full defect description — what's wrong + why it violates the standard. */
  description: string
  /** Proposed fix — what to change to comply. */
  suggestedFix: string
  /** Standards citation (REQUIRED for this tool — the whole point is rigorous
   *  cross-reference; no finding without a citation). */
  standardsCitation: StandardsCitation
  /** Provenance — always 'standards' for findings from this tool. */
  provenance: SourceProvenance
}

// ── The full audit set ───────────────────────────────────────────────────────

export interface StandardsAuditSet {
  planId: string
  generatedAt: number
  generatedBy: 'claudian' | 'mock' | 'manual'
  /** All detected findings. */
  findings: StandardsFinding[]
  /** Which standards were consulted (for transparency). */
  standardsConsulted: string[]
}

// ── localStorage key ─────────────────────────────────────────────────────────

export function storageKey(planId: string): string {
  return `standardsAudit:v1:${(planId || 'default').trim()}`
}

// ── Claudian prompt builder ──────────────────────────────────────────────────

export function buildClaudianPrompt(spec: SpecBlock): string {
  return [
    'You are the Planguage-vs-Standards Auditor (Tom Gilb 2026-06-03 Conjunction-of-Technologies EXPLOIT #1).',
    '',
    'TASK: Read the current spec below and audit it against Tom Gilb\'s authored Planguage standards.',
    '',
    'STANDARDS UNIVERSE (read these files directly via the Read tool — they live in the vault):',
    '  /Users/Tomgilbs/Documents/MyVault/10.Standard/Standard.Kai-Zen/Template_Write_Function.md',
    '  /Users/Tomgilbs/Documents/MyVault/10.Standard/Standard.Kai-Zen/Template_Write_Values.md',
    '  /Users/Tomgilbs/Documents/MyVault/10.Standard/Standard.Kai-Zen/Template_Write_Solution.md',
    '  /Users/Tomgilbs/Documents/MyVault/10.Standard/Standard.Kai-Zen/Template_Write_Constraint.md',
    '  /Users/Tomgilbs/Documents/MyVault/10.Standard/Standard.Kai-Zen/Template_Write_Resource.md',
    '  /Users/Tomgilbs/Documents/MyVault/10.Standard/Standard.Kai-Zen/Rule_Write_planguage-spec.md',
    '  /Users/Tomgilbs/Documents/MyVault/10.Standard/Standard.Kai-Zen/Rule_Write_planguage-spec-entry-types.md',
    '  /Users/Tomgilbs/Documents/MyVault/10.Standard/Standard.Kai-Zen/Rule_Write_planguage-spec-format-a.md',
    '  /Users/Tomgilbs/Documents/MyVault/10.Standard/Standard.Kai-Zen/Rule_Write_planguage-spec-format-b.md',
    '  /Users/Tomgilbs/Documents/MyVault/10.Standard/Standard.Kai-Zen/Rule_Write_planguage-spec-format-c.md',
    '  /Users/Tomgilbs/Documents/MyVault/10.Standard/Standard.Kai-Zen/Rule_Write_planguage-spec-level-rules.md',
    '  /Users/Tomgilbs/Documents/MyVault/10.Standard/Standard.Kai-Zen/Rule_Write_planguage-spec-status-lifecycle.md',
    '',
    'For each violation found:',
    '  - severity: "red" (must-fix structural violation) | "orange" (style / clarity issue) | "green" (best-practice nudge)',
    '  - targetType: function / value / solution / constraint / resource / stakeholder / plan-level',
    '  - targetRef: the entry id (e.g. "V.LoginSpeed") or "plan-level"',
    '  - title: short defect (≤ 8 words)',
    '  - description: what is wrong + which standard rule is violated',
    '  - suggestedFix: concrete edit to apply',
    '  - standardsCitation: { file, section, quote } — MANDATORY, no hallucination',
    '  - provenance: { source: "standards", standardsCitation: { same as above } }',
    '',
    'CRITICAL: every finding must cite a REAL passage in a REAL standards file.  Read the file',
    'first, then write the finding.  Do NOT invent rules that are not in the standards.',
    '',
    'INPUT SPEC:',
    JSON.stringify(spec, null, 2),
    '',
    'OUTPUT — return ONLY this JSON, no prose, no markdown fences:',
    '',
    JSON.stringify({
      planId: '(filled by app)',
      generatedAt: 0,
      generatedBy: 'claudian',
      standardsConsulted: ['Template_Write_Values.md', 'Rule_Write_planguage-spec.md'],
      findings: [{
        id: 'find-1',
        severity: 'red',
        targetType: 'value',
        targetRef: 'V.LoginSpeed',
        title: 'Goal field missing',
        description: 'V.LoginSpeed has no Goal threshold. Per Template_Write_Values.md, every Value Spec MUST have a Goal field stating the target value with date.',
        suggestedFix: 'Add Goal: e.g. "95% by Q4 2026" using the same Scale and Meter as the existing fields.',
        standardsCitation: { file: 'Template_Write_Values.md', section: 'Goal field', quote: 'Every Value must declare a Goal threshold with target value and date.' },
        provenance: {
          source: 'standards',
          standardsCitation: { file: 'Template_Write_Values.md', section: 'Goal field', quote: 'Every Value must declare a Goal threshold with target value and date.' },
        },
      }],
    }, null, 2),
    '',
    'After producing the JSON, paste it back into the Planguage Standards Auditor panel.',
  ].join('\n')
}

// ── Mock seed (v1 demo) ──────────────────────────────────────────────────────

export function buildMockAudit(planId: string, spec: SpecBlock): StandardsAuditSet {
  const findings: StandardsFinding[] = []
  // Real deterministic checks (no Claudian needed for these):
  for (const v of spec.values ?? []) {
    if (!v.goal?.trim()) {
      findings.push({
        id: `find-no-goal-${v.id}`,
        severity: 'red',
        targetType: 'value',
        targetRef: v.id,
        title: 'Value Spec missing Goal field',
        description: `Value Spec "${v.id}" has no Goal field. Per Template_Write_Values.md, every Value Spec MUST declare a Goal threshold.`,
        suggestedFix: `Add a Goal field naming the target value (using the V.'s Scale) and a deadline date.`,
        standardsCitation: { file: 'Template_Write_Values.md', section: 'Goal field', quote: 'Every Value must declare a Goal threshold with target value and date.' },
        provenance: {
          source: 'standards',
          standardsCitation: { file: 'Template_Write_Values.md', section: 'Goal field' },
        },
      })
    }
    if (!v.scale?.trim()) {
      findings.push({
        id: `find-no-scale-${v.id}`,
        severity: 'red',
        targetType: 'value',
        targetRef: v.id,
        title: 'Value Spec missing Scale',
        description: `"${v.id}" has no Scale field. Per Rule_Write_planguage-spec.md, every Value MUST have a measurable Scale.`,
        suggestedFix: 'Add Scale: name the unit of measurement (e.g. "% of login attempts succeeding", "seconds to first paint").',
        standardsCitation: { file: 'Rule_Write_planguage-spec.md', section: 'Value Spec rules', quote: 'Every Value Spec must declare a Scale before Goal / Tolerable / Wish can be set.' },
        provenance: {
          source: 'standards',
          standardsCitation: { file: 'Rule_Write_planguage-spec.md', section: 'Value Spec rules' },
        },
      })
    }
    if (!v.meter?.trim()) {
      findings.push({
        id: `find-no-meter-${v.id}`,
        severity: 'orange',
        targetType: 'value',
        targetRef: v.id,
        title: 'Value Spec missing Meter',
        description: `"${v.id}" has no Meter — how the Scale is measured.`,
        suggestedFix: 'Add Meter: describe the instrument or method used to measure the Scale.',
        standardsCitation: { file: 'Template_Write_Values.md', section: 'Meter field', quote: 'Meter names the measurement instrument or method — without it, Status data cannot be collected.' },
        provenance: {
          source: 'standards',
          standardsCitation: { file: 'Template_Write_Values.md', section: 'Meter field' },
        },
      })
    }
  }
  for (const f of spec.functions ?? []) {
    if (!f.presenceTest?.trim()) {
      findings.push({
        id: `find-no-presence-${f.id}`,
        severity: 'red',
        targetType: 'function',
        targetRef: f.id,
        title: 'Function Spec missing presenceTest',
        description: `Function "${f.id}" has no presenceTest. Per DD-004 + Template_Write_Function.md, every Function MUST have a binary YES/NO presenceTest.`,
        suggestedFix: 'Add presenceTest: a YES/NO statement that can be checked externally (e.g. "Authentication endpoint accepts credentials and returns a session token YES/NO").',
        standardsCitation: { file: 'Template_Write_Function.md', section: 'presenceTest', quote: 'A Function is binary — present or absent. presenceTest names the observable YES/NO check.' },
        provenance: {
          source: 'standards',
          standardsCitation: { file: 'Template_Write_Function.md', section: 'presenceTest' },
        },
      })
    }
  }
  for (const s of spec.solutions ?? []) {
    if (!s.impact?.trim()) {
      findings.push({
        id: `find-no-impact-${s.id}`,
        severity: 'orange',
        targetType: 'solution',
        targetRef: s.id,
        title: 'Solution Spec missing impact field',
        description: `Solution "${s.id}" has no impact field. Per Template_Write_Solution.md, every Solution should state expected impact on V. entries.`,
        suggestedFix: 'Add impact: name the Value Spec(s) this solution affects and the expected delta.',
        standardsCitation: { file: 'Template_Write_Solution.md', section: 'impact field', quote: 'Every Solution must state its expected impact on at least one Value.' },
        provenance: {
          source: 'standards',
          standardsCitation: { file: 'Template_Write_Solution.md', section: 'impact field' },
        },
      })
    }
  }
  return {
    planId,
    generatedAt: Date.now(),
    generatedBy: 'mock',
    findings,
    standardsConsulted: [
      'Template_Write_Function.md',
      'Template_Write_Values.md',
      'Template_Write_Solution.md',
      'Rule_Write_planguage-spec.md',
    ],
  }
}
