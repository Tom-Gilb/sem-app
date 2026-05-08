// UNIT_TYPE=Composable
// Feature #122 — Spec Constraint Mapper
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export type ConstraintCategory = 'time' | 'cost' | 'quality' | 'scope'

export interface ConstraintEntry {
  blockId: string
  blockName: string
  rawTolerable: string  // raw Tolerable field value
  category: ConstraintCategory
  severity: 'high' | 'medium' | 'low'
  interpretation: string
}

const TIME_KW = /months?|weeks?|days?|hours?|deadline|by \d{4}|before|after/i
const COST_KW = /\$|usd|eur|budget|spend|cost|fee/i
const QUALITY_KW = /%|rate|score|accuracy|defect|error|pass|fail/i
const SCOPE_KW = /entries?|items?|features?|functions?|users?|limit|max|min/i

function detectCategory(text: string): ConstraintCategory {
  if (TIME_KW.test(text)) return 'time'
  if (COST_KW.test(text)) return 'cost'
  if (QUALITY_KW.test(text)) return 'quality'
  if (SCOPE_KW.test(text)) return 'scope'
  return 'quality'
}

function detectSeverity(text: string): 'high' | 'medium' | 'low' {
  if (/must|require|never/i.test(text)) return 'high'
  // Numeric + unit pattern: a number followed by a unit-like word
  if (/\d+\s*(%|months?|weeks?|days?|hours?|\$|usd|eur|items?|users?|entries?)/.test(text)) return 'medium'
  return 'low'
}

function buildInterpretation(text: string, category: ConstraintCategory): string {
  const lower = text.toLowerCase()

  if (/%/.test(text)) {
    const pct = text.match(/(\d+(?:\.\d+)?)\s*%/)
    if (pct) return `Upper bound: ${pct[1]}%`
  }

  if (category === 'time') {
    const timeMatch = text.match(/\d+\s*(?:months?|weeks?|days?|hours?)/i)
    if (timeMatch) return `Time limit: ${timeMatch[0]}`
    if (/deadline/i.test(text)) return `Deadline constraint`
    return `Temporal constraint`
  }

  if (category === 'cost') {
    const costMatch = text.match(/[\$€]?\d[\d,.]+/)
    if (costMatch) return `Budget limit: ${costMatch[0]}`
    return `Cost constraint`
  }

  if (category === 'scope') {
    const numMatch = text.match(/(\d+)\s*(?:items?|entries?|users?|features?|functions?)/i)
    if (numMatch) return `Scope limit: ${numMatch[0]}`
    if (/max/i.test(lower)) return `Maximum scope bound`
    if (/min/i.test(lower)) return `Minimum scope bound`
    return `Scope constraint`
  }

  // quality
  return `Quality threshold: ${text.slice(0, 40)}`
}

function extractConstraints(blocks: SpecBlock[]): ConstraintEntry[] {
  const entries: ConstraintEntry[] = []

  for (const block of blocks) {
    // Extract from V. entry Tolerable fields
    for (const v of block.values) {
      const raw = v.tolerable?.trim() ?? ''
      if (!raw) continue

      const category = detectCategory(raw)
      const severity = detectSeverity(raw)
      const interpretation = buildInterpretation(raw, category)

      entries.push({
        blockId: v.id,
        blockName: v.id,
        rawTolerable: raw,
        category,
        severity,
        interpretation,
      })
    }

    // Extract from F. descriptions that contain 'must not' / 'no more than'
    for (const f of block.functions) {
      const desc = f.description?.trim() ?? ''
      if (!desc) continue
      if (/must not|no more than/i.test(desc)) {
        const category = detectCategory(desc)
        const severity = detectSeverity(desc)
        const interpretation = buildInterpretation(desc, category)

        entries.push({
          blockId: f.id,
          blockName: f.id,
          rawTolerable: desc,
          category,
          severity,
          interpretation,
        })
      }
    }
  }

  return entries
}

// ── Composable ────────────────────────────────────────────────────────────────
export function useConstraintMapper(blocks: SpecBlock[]) {
  const copied = ref(false)

  const constraints = computed<ConstraintEntry[]>(() =>
    extractConstraints(blocks),
  )

  const grouped = computed<Record<ConstraintCategory, ConstraintEntry[]>>(() => {
    const g: Record<ConstraintCategory, ConstraintEntry[]> = {
      time: [],
      cost: [],
      quality: [],
      scope: [],
    }
    for (const c of constraints.value) {
      g[c.category].push(c)
    }
    return g
  })

  const totalCount = computed<number>(() => constraints.value.length)

  const highSeverityCount = computed<number>(
    () => constraints.value.filter(c => c.severity === 'high').length,
  )

  async function copyMarkdown(): Promise<void> {
    const rows = constraints.value
    const header = '| Name | Tolerable | Category | Severity | Interpretation |'
    const sep = '|------|-----------|----------|----------|----------------|'
    const lines = rows.map(
      r => `| ${r.blockName} | ${r.rawTolerable} | ${r.category} | ${r.severity} | ${r.interpretation} |`,
    )
    const text = [header, sep, ...lines].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch {
      // no-op
    }
  }

  return {
    constraints,
    grouped,
    totalCount,
    highSeverityCount,
    copyMarkdown,
    copied,
  }
}
