// UNIT_TYPE=Composable
// Feature #187 — Spec "feature deprecation radar"
// Scores F. and S. entries across 5 axes to produce a risk profile.
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export type RiskLevel = 'High' | 'Medium' | 'Low'

export interface DeprecationAxes {
  age: number        // seed(id+'age',10)*10
  keywordRisk: number  // seed(id+'kw',10)*10
  complexity: number  // seed(id+'cplx',10)*10
  coupling: number    // seed(id+'coup',10)*10
  coverage: number    // seed(id+'cov',10)*10
}

export interface DeprecationEntry {
  id: string
  entryType: 'F' | 'S'
  description: string   // truncated 60 chars
  axes: DeprecationAxes
  riskScore: number     // Math.round(avg of 5 axes)
  riskLevel: RiskLevel  // High >= 60, Medium >= 30, Low < 30
}

function seed(s: string, mod: number): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mod
}

function getRiskLevel(score: number): RiskLevel {
  if (score >= 60) return 'High'
  if (score >= 30) return 'Medium'
  return 'Low'
}

export function buildDeprecationEntry(
  id: string,
  entryType: 'F' | 'S',
  description: string,
): DeprecationEntry {
  const axes: DeprecationAxes = {
    age: seed(id + 'age', 10) * 10,
    keywordRisk: seed(id + 'kw', 10) * 10,
    complexity: seed(id + 'cplx', 10) * 10,
    coupling: seed(id + 'coup', 10) * 10,
    coverage: seed(id + 'cov', 10) * 10,
  }
  const riskScore = Math.round(
    (axes.age + axes.keywordRisk + axes.complexity + axes.coupling + axes.coverage) / 5,
  )
  return {
    id,
    entryType,
    description: description.slice(0, 60),
    axes,
    riskScore,
    riskLevel: getRiskLevel(riskScore),
  }
}

export function useDeprecationRadar(blocks: SpecBlock[]) {
  const open = ref(false)
  const copied = ref(false)

  const entries = computed((): DeprecationEntry[] => {
    if (blocks.length === 0) return []
    const functions = blocks.flatMap(b => b.functions)
    const solutions = blocks.flatMap(b => b.solutions)
    const fEntries = functions.map(f => buildDeprecationEntry(f.id, 'F', f.description))
    const sEntries = solutions.map(s => buildDeprecationEntry(s.id, 'S', s.description))
    // F. first, then S.; each group sorted descending by riskScore
    const sortDesc = (a: DeprecationEntry, b: DeprecationEntry) => b.riskScore - a.riskScore
    return [...fEntries.sort(sortDesc), ...sEntries.sort(sortDesc)]
  })

  const highRiskCount = computed((): number =>
    entries.value.filter(e => e.riskLevel === 'High').length,
  )

  async function copyMarkdown(): Promise<void> {
    const lines: string[] = [
      '| ID | Type | Age | KW Risk | Complexity | Coupling | Coverage | Risk Score | Level |',
      '|---|---|---|---|---|---|---|---|---|',
    ]
    for (const e of entries.value) {
      lines.push(
        `| ${e.id} | ${e.entryType} | ${e.axes.age} | ${e.axes.keywordRisk} | ${e.axes.complexity} | ${e.axes.coupling} | ${e.axes.coverage} | ${e.riskScore} | ${e.riskLevel} |`,
      )
    }
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return { open, entries, highRiskCount, copyMarkdown, copied }
}
