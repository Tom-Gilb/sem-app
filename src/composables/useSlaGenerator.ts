// UNIT_TYPE=Composable
// Feature #136 — Spec "SLA generator"
import { ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface SlaClause {
  blockId: string
  serviceName: string    // editable, default = V. entry name
  metric: string         // derived from Scale field, or "availability"
  target: string         // Goal field value, or "99.9%"
  measurementPeriod: string  // editable, default "rolling 30 days"
  penalty: string        // editable, default "5% service credit per breach"
}

function parseMetric(scale: string): string {
  const trimmed = scale?.trim()
  if (!trimmed) return 'service availability'
  // First meaningful phrase, max 40 chars
  const phrase = trimmed.split(/[;,\n]/)[0].trim()
  return phrase.length > 40 ? phrase.slice(0, 40) : phrase || 'service availability'
}

function parseTarget(goal: string): string {
  const trimmed = goal?.trim()
  if (!trimmed) return '99.9%'
  // Find first value with unit (e.g. "99.9%", "100ms", "5s", "200 ms")
  // Percentage match takes priority
  const pctMatch = trimmed.match(/\d[\d.,]*\s*%/)
  if (pctMatch) return pctMatch[0].trim()
  // Match numeric + explicit unit (not bracket chars or digits-only)
  const unitMatch = trimmed.match(/\d[\d.,]*\s*(?:ms|s\b|min\b|hr\b|hours?\b|days?\b|[xX]\b)/)
  if (unitMatch) return unitMatch[0].trim()
  // If goal has content but no obvious unit, return trimmed up to 40 chars
  const phrase = trimmed.split(/\s+/).slice(0, 6).join(' ')
  return phrase.length > 40 ? phrase.slice(0, 40) : phrase || '99.9%'
}

export function useSlaGenerator(blocks: SpecBlock[]) {
  const allValues = blocks.flatMap(b => b.values)

  const initialClauses: SlaClause[] = allValues.map(v => ({
    blockId: v.id,
    serviceName: v.id,
    metric: parseMetric(v.scale),
    target: parseTarget(v.goal),
    measurementPeriod: 'rolling 30 days',
    penalty: '5% service credit per breach event',
  }))

  const clauses = ref<SlaClause[]>(initialClauses)

  function updateClause(blockId: string, field: keyof SlaClause, value: string): void {
    const clause = clauses.value.find(c => c.blockId === blockId)
    if (clause) {
      (clause as Record<string, string>)[field] = value
    }
  }

  const copied = ref(false)

  async function copyMarkdown(): Promise<void> {
    if (clauses.value.length === 0) {
      return
    }

    const lines: string[] = []
    for (const c of clauses.value) {
      lines.push(`**${c.serviceName} — SLA Clause**`)
      lines.push(`- Metric: ${c.metric}`)
      lines.push(`- Target: ${c.target}`)
      lines.push(`- Measurement Period: ${c.measurementPeriod}`)
      lines.push(`- Penalty: ${c.penalty}`)
      lines.push('---')
    }

    const text = lines.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch {
      // clipboard not available
    }
  }

  return {
    clauses,
    updateClause,
    copyMarkdown,
    copied,
  }
}
