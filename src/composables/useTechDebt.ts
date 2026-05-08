// UNIT_TYPE=Composable
// Feature #182 — Spec "tech debt register"
// Scans S. entries for debt patterns and calculates a debt score.
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

const DEBT_PATTERNS: Array<{ key: string; label: string; pattern: RegExp }> = [
  { key: 'deprecated', label: 'Deprecated tech', pattern: /deprecated|legacy|old\s+\w+/i },
  { key: 'workaround', label: 'Workaround', pattern: /workaround|hack|shortcut|bypass/i },
  { key: 'temporary', label: 'Temporary solution', pattern: /temporary|temp|interim|short.term/i },
  { key: 'complex', label: 'High complexity', pattern: /complex|complicated|difficult|intricate/i },
  { key: 'manual', label: 'Manual process', pattern: /manual|human\s+\w+|hand.?coded/i },
  { key: 'hardcoded', label: 'Hardcoded value', pattern: /hardcod|fixed\s+value|static\s+\w+/i },
  { key: 'undocumented', label: 'Undocumented', pattern: /undocumented|no\s+docs|missing\s+\w+doc/i },
  { key: 'coupling', label: 'Tight coupling', pattern: /depends?\s+on|coupled|tightly\s+\w+/i },
]

export interface DebtEntry {
  id: string
  description: string
  detectedPatterns: string[]
  debtScore: number
  severity: 'High' | 'Medium' | 'Low'
}

function seed(s: string, mod: number): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mod
}

function severityFromScore(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 50) return 'High'
  if (score >= 25) return 'Medium'
  return 'Low'
}

export function buildDebtEntry(id: string, description: string): DebtEntry {
  const matchedLabels: string[] = []
  for (const p of DEBT_PATTERNS) {
    if (p.pattern.test(description)) {
      matchedLabels.push(p.label)
    }
  }

  let debtScore: number
  let detectedPatterns: string[]

  if (matchedLabels.length > 0) {
    debtScore = Math.min(matchedLabels.length * 25, 100)
    detectedPatterns = matchedLabels
  } else {
    debtScore = seed(id + 'debt', 50) + 10
    const patternIdx = seed(id + 'debt', DEBT_PATTERNS.length)
    detectedPatterns = [DEBT_PATTERNS[patternIdx].label]
  }

  return {
    id,
    description: description.slice(0, 80),
    detectedPatterns,
    debtScore,
    severity: severityFromScore(debtScore),
  }
}

export function useTechDebt(blocks: SpecBlock[]) {
  const open = ref(false)
  const copied = ref(false)

  const entries = computed((): DebtEntry[] => {
    if (blocks.length === 0) return []
    const solutions = blocks.flatMap(b => b.solutions)
    const built = solutions.map(s => buildDebtEntry(s.id, s.description))
    return built.slice().sort((a, b) => b.debtScore - a.debtScore)
  })

  const totalDebtScore = computed((): number => {
    return Math.min(
      entries.value.reduce((sum, e) => sum + e.debtScore, 0),
      999,
    )
  })

  const highCount = computed((): number => {
    return entries.value.filter(e => e.severity === 'High').length
  })

  async function copyMarkdown(): Promise<void> {
    const lines: string[] = [
      '| ID | Patterns | Score | Severity |',
      '|---|---|---|---|',
    ]
    for (const e of entries.value) {
      lines.push(
        `| ${e.id} | ${e.detectedPatterns.join(', ')} | ${e.debtScore} | ${e.severity} |`,
      )
    }
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return { open, entries, totalDebtScore, highCount, copyMarkdown, copied }
}
