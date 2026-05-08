// UNIT_TYPE=Composable
// useNotionExport — Export to Notion Blocks (Feature #33)
// Converts a SpecBlock (and optional EvoSteps) to Notion-paste-compatible Markdown.

import type { SpecBlock } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'

export function useNotionExport() {
  /**
   * Converts a SpecBlock (and optional EvoSteps) to a Notion-paste-compatible
   * Markdown string. Notion accepts plain markdown on paste: headings, bold,
   * bullets, and tables all work.
   */
  function convertToNotionMarkdown(spec: SpecBlock, steps?: EvoStep[]): string {
    const today = new Date().toISOString().split('T')[0]
    const lines: string[] = []

    lines.push('# Planguage Specification')
    lines.push(`*Generated ${today}*`)
    lines.push('')

    // ── Functions ──────────────────────────────────────────────────────────
    if (spec.functions.length > 0) {
      lines.push('## Functions')
      lines.push('')
      for (const f of spec.functions) {
        lines.push(`**${f.id}** ${f.description}`)
        if (f.successCriteria) {
          lines.push(`> Success: ${f.successCriteria}`)
        }
        lines.push('')
      }
    }

    // ── Values ─────────────────────────────────────────────────────────────
    if (spec.values.length > 0) {
      lines.push('## Values')
      lines.push('')
      for (const v of spec.values) {
        lines.push(`**${v.id}** ${v.description}`)
        lines.push('| Field | Value |')
        lines.push('|---|---|')
        lines.push(`| Scale | ${v.scale} |`)
        lines.push(`| Meter | ${v.meter} |`)
        lines.push(`| Goal | ${v.goal} |`)
        lines.push(`| Tolerable | ${v.tolerable} |`)
        lines.push(`| Status | ${v.status} |`)
        lines.push('')
      }
    }

    // ── Solutions ──────────────────────────────────────────────────────────
    if (spec.solutions.length > 0) {
      lines.push('## Solutions')
      lines.push('')
      for (const s of spec.solutions) {
        lines.push(`**${s.id}** ${s.description}`)
        if (s.impact) {
          lines.push(`*Impact: ${s.impact}*`)
        }
        lines.push('')
      }
    }

    // ── Evo Plan ───────────────────────────────────────────────────────────
    if (steps && steps.length > 0) {
      lines.push('## Evo Plan')
      lines.push('')
      steps.forEach((step, i) => {
        lines.push(`${i + 1}. ${step.name} — ${step.effortPercent}% effort`)
        if (step.linkedValues.length > 0) {
          lines.push(`   Values: ${step.linkedValues.join(', ')}`)
        }
      })
      lines.push('')
    }

    return lines.join('\n')
  }

  return { convertToNotionMarkdown }
}
